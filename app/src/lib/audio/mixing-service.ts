import { db } from '@/lib/db';
import { mashups, uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { logTelemetry } from '@/lib/telemetry';
import { log } from '@/lib/logger';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'node:stream';
import { eq, inArray } from 'drizzle-orm';

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';
const DEFAULT_TARGET_BPM = 120;

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

type TrackSource = {
  id: string;
  storageUrl: string;
  mimeType: string;
  bpm: number | null;
};

export type PreparedTrack = TrackSource & {
  buffer: Buffer;
};

function buildAtempoChain(ratio: number) {
  const filters: string[] = [];
  let value = ratio;

  while (value > 2) {
    filters.push('atempo=2');
    value = value / 2;
  }

  while (value < 0.5) {
    filters.push('atempo=0.5');
    value = value / 0.5;
  }

  if (Math.abs(value - 1) > 0.01) {
    filters.push(`atempo=${Number(value.toFixed(2))}`);
  }

  return filters.join(',');
}

export async function mixToBuffer(tracks: PreparedTrack[], durationSeconds: number) {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg-static binary not available for mixing');
  }

  const safeDuration = Math.max(5, Number.isFinite(durationSeconds) ? durationSeconds : 60);
  const targetBpm = tracks.map(t => t.bpm).filter((bpm): bpm is number => Number.isFinite(bpm)).at(0) ?? DEFAULT_TARGET_BPM;
  const inputCount = tracks.length;
  const volumePerTrack = Number((1 / Math.max(1, inputCount)).toFixed(3));

  const command = ffmpeg();
  tracks.forEach((track) => {
    const stream = Readable.from(track.buffer);
    const input = command.input(stream);
    if (track.mimeType.includes('wav')) {
      input.inputFormat('wav');
    }
  });

  const filterChains: string[] = [];
  tracks.forEach((track, idx) => {
    const ratio = track.bpm && track.bpm > 0 ? targetBpm / track.bpm : 1;
    const atempo = buildAtempoChain(ratio);
    const chain = [atempo, `volume=${volumePerTrack}`].filter(Boolean).join(',');
    const inputLabel = `${idx}:a`;
    const outputLabel = `a${idx}`;
    filterChains.push(`[${inputLabel}]${chain || 'anull'}[${outputLabel}]`);
  });

  const inputLabels = tracks.map((_, idx) => `[a${idx}]`).join('');
  filterChains.push(`${inputLabels}amix=inputs=${inputCount}:duration=shortest:normalize=0[mixed]`);

  command
    .complexFilter(filterChains, 'mixed')
    .outputOptions([
      '-map [mixed]',
      `-ac ${OUTPUT_CHANNELS}`,
      `-ar ${OUTPUT_SAMPLE_RATE}`,
      `-t ${safeDuration}`,
      '-b:a 192k',
      '-f mp3',
    ]);
  command.output('pipe:1');

  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    command.on('error', reject);
    const output = command.pipe();
    output.on('data', chunk => chunks.push(chunk));
    output.on('end', () => resolve(Buffer.concat(chunks)));
    output.on('error', reject);
  });
}

async function loadTracks(inputTrackIds: string[]): Promise<PreparedTrack[]> {
  const storage = await getStorage();
  if (!storage.getFile) {
    throw new Error('Storage driver does not support reading files (getFile)');
  }

  const records = await db
    .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType, bpm: uploadedTracks.bpm })
    .from(uploadedTracks)
    .where(inArray(uploadedTracks.id, inputTrackIds));

  if (records.length === 0) {
    throw new Error('No input tracks found');
  }

  const tracks: PreparedTrack[] = [];
  for (const record of records) {
    const fetched = await storage.getFile(record.storageUrl);
    if (!fetched?.buffer) {
      throw new Error(`Failed to fetch audio for track ${record.id}`);
    }

    tracks.push({
      id: record.id,
      storageUrl: record.storageUrl,
      mimeType: fetched.mimeType || record.mimeType || 'audio/mpeg',
      bpm: record.bpm ? Number(record.bpm) : null,
      buffer: fetched.buffer,
    });
  }

  return tracks;
}

export async function renderMashup(mashupId: string, inputTrackIds: string[], durationSeconds: number) {
  const startedAt = Date.now();

  try {
    logTelemetry({
      name: 'mashup.render.start',
      properties: { mashupId, trackCount: inputTrackIds.length, durationSeconds },
    });

    await db
      .update(mashups)
      .set({ generationStatus: 'generating', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));

    const tracks = await loadTracks(inputTrackIds);
    const outputBuffer = await mixToBuffer(tracks, durationSeconds);
    const storage = await getStorage();
    const outputUrl = await storage.uploadFile(outputBuffer, `${mashupId}.${OUTPUT_FORMAT}`, 'audio/mpeg');

    const processingTime = Date.now() - startedAt;

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        outputFormat: OUTPUT_FORMAT,
        generationTimeMs: processingTime,
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId));

    logTelemetry({
      name: 'mashup.render.completed',
      properties: {
        mashupId,
        trackCount: inputTrackIds.length,
        durationSeconds,
        processingTimeMs: processingTime,
        outputUrl,
      },
    });

    log('info', 'mashup.render.completed', {
      mashupId,
      trackCount: inputTrackIds.length,
      durationSeconds,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    handleAsyncError(error as Error, 'renderMashup');
    logTelemetry({ name: 'mashup.render.failed', level: 'error', properties: { mashupId, error: (error as Error)?.message } });
    log('error', 'mashup.render.failed', { mashupId, error: (error as Error)?.message });
    await db
      .update(mashups)
      .set({ generationStatus: 'failed', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));
  }
}
