import { db } from '@/lib/db';
import { trackStems, uploadedTracks, stemTypeEnum, stemQualityEnum } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { log } from '@/lib/logger';
import { eq, and } from 'drizzle-orm';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'node:stream';
import { 
  isHuggingFaceAvailable, 
  separateWithHuggingFace, 
  getHuggingFaceStatus 
} from './huggingface-stems';

export type StemType = (typeof stemTypeEnum.enumValues)[number];
type StemQuality = (typeof stemQualityEnum.enumValues)[number];

const STEM_TYPES: StemType[] = ['vocals', 'drums', 'bass', 'other'];
const DEMUCS_SERVICE_URL = process.env.DEMUCS_SERVICE_URL || 'http://localhost:8001';

// FFmpeg fallback filters (basic frequency-based separation)
const STEM_FILTERS: Record<string, string | undefined> = {
  vocals: 'highpass=f=1200,asetrate=44100',
  drums: 'highpass=f=150,alimiter',
  bass: 'lowpass=f=150',
  other: undefined,
};

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

type StemRecord = typeof trackStems.$inferSelect;

async function isDemucsAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DEMUCS_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function separateWithDemucs(buffer: Buffer, filename: string): Promise<Map<StemType, Buffer>> {
  const formData = new FormData();
  formData.append('file', new Blob([buffer]), filename);

  const response = await fetch(`${DEMUCS_SERVICE_URL}/separate/all`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Demucs separation failed: ${error}`);
  }

  // Response is a ZIP file with all stems
  const zipBuffer = Buffer.from(await response.arrayBuffer());
  
  // Parse ZIP and extract stems
  const stems = new Map<StemType, Buffer>();
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(zipBuffer);
  
  for (const stemType of STEM_TYPES) {
    const stemFile = zip.file(`${stemType}.wav`);
    if (stemFile) {
      const stemData = await stemFile.async('nodebuffer');
      stems.set(stemType, stemData);
    }
  }

  return stems;
}

async function renderStemWithFFmpeg(buffer: Buffer, mimeType: string, stemType: StemType, quality: StemQuality): Promise<Buffer> {
  if (!ffmpegStatic) {
    return buffer;
  }

  const filter = STEM_FILTERS[stemType];
  const command = ffmpeg();
  const input = command.input(Readable.from(buffer));
  if (mimeType.includes('wav')) input.inputFormat('wav');

  if (filter) {
    command.audioFilters(filter);
  }

  command.format('mp3');
  const bitrate = quality === 'hifi' ? '256k' : '192k';
  command.outputOptions(['-ac 2', '-ar 44100', `-b:a ${bitrate}`]);
  command.output('pipe:1');

  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    command.on('error', reject);
    const stream = command.pipe();
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

async function convertWavToMp3(wavBuffer: Buffer, quality: StemQuality): Promise<Buffer> {
  log('info', 'convertWavToMp3.start', { 
    inputSize: wavBuffer.length, 
    quality,
    hasFfmpeg: !!ffmpegStatic 
  });

  if (!ffmpegStatic) {
    log('warn', 'convertWavToMp3.noFfmpeg', { returning: 'original buffer' });
    return wavBuffer;
  }

  if (wavBuffer.length === 0) {
    log('error', 'convertWavToMp3.emptyInput', {});
    return wavBuffer;
  }

  try {
    const command = ffmpeg();
    command.input(Readable.from(wavBuffer)).inputFormat('wav');
    command.format('mp3');
    const bitrate = quality === 'hifi' ? '256k' : '192k';
    command.outputOptions(['-ac 2', '-ar 44100', `-b:a ${bitrate}`]);
    command.output('pipe:1');

    const chunks: Buffer[] = [];
    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('error', (err) => {
        log('error', 'convertWavToMp3.ffmpegError', { error: err.message });
        reject(err);
      });
      const stream = command.pipe();
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const output = Buffer.concat(chunks);
        log('info', 'convertWavToMp3.complete', { outputSize: output.length });
        resolve(output);
      });
      stream.on('error', (err) => {
        log('error', 'convertWavToMp3.streamError', { error: err.message });
        reject(err);
      });
    });

    // If conversion resulted in empty buffer, return original
    if (result.length === 0) {
      log('warn', 'convertWavToMp3.emptyOutput', { returning: 'original buffer' });
      return wavBuffer;
    }

    return result;
  } catch (error) {
    log('error', 'convertWavToMp3.failed', { error: (error as Error).message });
    // Return original buffer on failure
    return wavBuffer;
  }
}

async function upsertStemRecord(trackId: string, stemType: StemType, values: Partial<StemRecord>) {
  const [existing] = await db
    .select()
    .from(trackStems)
    .where(and(eq(trackStems.uploadedTrackId, trackId), eq(trackStems.stemType, stemType)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(trackStems)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(trackStems.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(trackStems)
    .values({
      uploadedTrackId: trackId,
      stemType,
      status: 'pending',
      quality: (values as StemRecord | { quality?: StemQuality }).quality ?? 'draft',
      ...values,
    })
    .returning();
  return created;
}

export async function separateStems(trackId: string, quality: StemQuality = 'draft') {
  const storage = await getStorage();
  if (!storage.getFile) {
    throw new Error('Storage driver does not support getFile; stem separation requires readable storage');
  }

  const [track] = await db
    .select({ 
      id: uploadedTracks.id, 
      storageUrl: uploadedTracks.storageUrl, 
      mimeType: uploadedTracks.mimeType, 
      hasStems: uploadedTracks.hasStems,
      originalFilename: uploadedTracks.originalFilename
    })
    .from(uploadedTracks)
    .where(eq(uploadedTracks.id, trackId))
    .limit(1);

  if (!track) {
    throw new Error('Track not found');
  }

  // If already marked hasStems, return existing records
  const existingStems = await db
    .select()
    .from(trackStems)
    .where(eq(trackStems.uploadedTrackId, trackId));
  if (track.hasStems && existingStems.length === STEM_TYPES.length) {
    return existingStems;
  }

  const fetched = await storage.getFile(track.storageUrl);
  if (!fetched?.buffer) {
    throw new Error('Failed to fetch original audio for stems');
  }

  const results: StemRecord[] = [];
  const useDemucs = await isDemucsAvailable();
  const useHuggingFace = !useDemucs && await isHuggingFaceAvailable();
  const engine = useDemucs ? 'demucs' : (useHuggingFace ? 'huggingface' : (quality === 'hifi' ? 'ffmpeg-hifi' : 'ffmpeg'));

  log('info', 'stems.separation.start', { trackId, engine, quality });

  if (useDemucs) {
    // Use Demucs AI separation - process all stems at once
    try {
      // Mark all stems as processing
      for (const stemType of STEM_TYPES) {
        await upsertStemRecord(trackId, stemType, { status: 'processing', quality });
      }

      const stems = await separateWithDemucs(fetched.buffer, track.originalFilename);
      
      for (const stemType of STEM_TYPES) {
        const stemBuffer = stems.get(stemType);
        if (!stemBuffer) {
          log('warn', 'stems.missing', { trackId, stemType });
          continue;
        }

        try {
          // Convert WAV to MP3
          const mp3Buffer = await convertWavToMp3(stemBuffer, quality);
          const key = `${trackId}/stems/${stemType}.mp3`;
          const url = await storage.uploadFile(mp3Buffer, key, 'audio/mpeg');

          const [saved] = await db
            .update(trackStems)
            .set({ 
              storageUrl: url, 
              status: 'completed', 
              quality, 
              engine: 'demucs', 
              updatedAt: new Date() 
            })
            .where(and(eq(trackStems.uploadedTrackId, trackId), eq(trackStems.stemType, stemType)))
            .returning();

          if (saved) results.push(saved);
        } catch (error) {
          handleAsyncError(error as Error, `renderStem:${stemType}`);
          await db
            .update(trackStems)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(and(eq(trackStems.uploadedTrackId, trackId), eq(trackStems.stemType, stemType)));
        }
      }
    } catch (error) {
      handleAsyncError(error as Error, 'demucs.separation');
      log('warn', 'stems.demucs.fallback', { trackId, error: (error as Error).message });
      // Fall through to HuggingFace or FFmpeg fallback below
    }
  }

  // HuggingFace fallback (if Demucs unavailable or failed)
  if (results.length === 0 && useHuggingFace) {
    try {
      // Mark all stems as processing
      for (const stemType of STEM_TYPES) {
        await upsertStemRecord(trackId, stemType, { status: 'processing', quality });
      }

      log('info', 'stems.huggingface.start', { trackId });
      const stems = await separateWithHuggingFace(fetched.buffer, track.originalFilename);
      
      for (const stemType of STEM_TYPES) {
        const stemBuffer = stems.get(stemType);
        if (!stemBuffer) {
          log('warn', 'stems.huggingface.missing', { trackId, stemType });
          continue;
        }

        try {
          // HuggingFace returns WAV files - upload directly (skip conversion due to ffmpeg issues)
          log('info', 'stems.huggingface.processing', { 
            trackId, 
            stemType, 
            bufferSize: stemBuffer.length 
          });
          // Save as WAV since FFmpeg conversion has issues on some systems
          const key = `${trackId}/stems/${stemType}.wav`;
          const url = await storage.uploadFile(stemBuffer, key, 'audio/wav');
          log('info', 'stems.huggingface.uploaded', { trackId, stemType, url });

          const [saved] = await db
            .update(trackStems)
            .set({ 
              storageUrl: url, 
              status: 'completed', 
              quality, 
              engine: 'huggingface', 
              updatedAt: new Date() 
            })
            .where(and(eq(trackStems.uploadedTrackId, trackId), eq(trackStems.stemType, stemType)))
            .returning();

          if (saved) results.push(saved);
        } catch (error) {
          handleAsyncError(error as Error, `huggingface.stem:${stemType}`);
          await db
            .update(trackStems)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(and(eq(trackStems.uploadedTrackId, trackId), eq(trackStems.stemType, stemType)));
        }
      }

      log('info', 'stems.huggingface.complete', { trackId, stemsProcessed: results.length });
    } catch (error) {
      handleAsyncError(error as Error, 'huggingface.separation');
      log('warn', 'stems.huggingface.fallback', { trackId, error: (error as Error).message });
      // Fall through to FFmpeg fallback below
    }
  }

  // FFmpeg fallback (if Demucs and HuggingFace unavailable or failed)
  if (results.length === 0) {
    for (const stemType of STEM_TYPES) {
      const started = await upsertStemRecord(trackId, stemType, { status: 'processing', quality });

      try {
        const rendered = await renderStemWithFFmpeg(
          fetched.buffer, 
          fetched.mimeType || track.mimeType, 
          stemType, 
          quality
        );
        const key = `${trackId}/stems/${stemType}.mp3`;
        const url = await storage.uploadFile(rendered, key, 'audio/mpeg');

        const [saved] = await db
          .update(trackStems)
          .set({ 
            storageUrl: url, 
            status: 'completed', 
            quality, 
            engine: quality === 'hifi' ? 'ffmpeg-hifi' : 'ffmpeg', 
            updatedAt: new Date() 
          })
          .where(eq(trackStems.id, started.id))
          .returning();

        results.push(saved);
      } catch (error) {
        handleAsyncError(error as Error, 'renderStem');
        await db
          .update(trackStems)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(trackStems.id, started.id));
      }
    }
  }

  // Mark track as having stems if we produced any completed stems
  const completed = results.length;
  if (completed > 0) {
    await db
      .update(uploadedTracks)
      .set({ hasStems: true, updatedAt: new Date() })
      .where(eq(uploadedTracks.id, trackId));
  }

  log('info', 'stems.generated', { trackId, completed, quality, engine });
  return results;
}

export async function getStemsForTrack(trackId: string) {
  return db
    .select()
    .from(trackStems)
    .where(eq(trackStems.uploadedTrackId, trackId));
}

export async function getDemucsStatus(): Promise<{ available: boolean; device?: string }> {
  try {
    const response = await fetch(`${DEMUCS_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return { available: true, device: data.device };
    }
  } catch {
    // Demucs not available
  }
  return { available: false };
}

export async function getStemSeparationStatus(): Promise<{
  demucs: { available: boolean; device?: string };
  huggingface: { available: boolean; space: string };
  fallback: string;
}> {
  const demucs = await getDemucsStatus();
  const huggingface = await getHuggingFaceStatus();
  
  let fallback = 'ffmpeg';
  if (demucs.available) {
    fallback = 'demucs';
  } else if (huggingface.available) {
    fallback = 'huggingface';
  }

  return { demucs, huggingface, fallback };
}

/**
 * Get a stem buffer by track ID and stem type for use in mixing
 */
export async function getStemBuffer(trackId: string, stemType: StemType): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const storage = await getStorage();
  if (!storage.getFile) {
    log('error', 'stems.getStemBuffer', { trackId, stemType, error: 'Storage does not support getFile' });
    return null;
  }

  const stems = await db
    .select()
    .from(trackStems)
    .where(eq(trackStems.uploadedTrackId, trackId));
  
  const stem = stems.find(s => s.stemType === stemType && s.status === 'completed' && s.storageUrl);
  
  if (!stem || !stem.storageUrl) {
    log('warn', 'stems.getStemBuffer.notFound', { trackId, stemType });
    return null;
  }

  try {
    const file = await storage.getFile(stem.storageUrl);
    if (!file?.buffer) {
      log('error', 'stems.getStemBuffer.fetchFailed', { trackId, stemType, url: stem.storageUrl });
      return null;
    }
    return { buffer: file.buffer, mimeType: file.mimeType || 'audio/wav' };
  } catch (error) {
    log('error', 'stems.getStemBuffer.error', { trackId, stemType, error: (error as Error).message });
    return null;
  }
}

/**
 * Get all available stems for a track with their buffers (for mixing)
 */
export async function getAllStemBuffers(trackId: string): Promise<Map<StemType, { buffer: Buffer; mimeType: string }>> {
  const stemTypes: StemType[] = ['vocals', 'drums', 'bass', 'other'];
  const results = new Map<StemType, { buffer: Buffer; mimeType: string }>();
  
  for (const type of stemTypes) {
    const stem = await getStemBuffer(trackId, type);
    if (stem) {
      results.set(type, stem);
    }
  }
  
  return results;
}

/**
 * Get track info needed for stem mashup mixing
 */
export async function getTrackInfoForMixing(trackId: string): Promise<{
  id: string;
  bpm: number | null;
  camelotKey: string | null;
  durationSeconds: number | null;
  beatGrid: number[] | null;
  dropMoments: number[] | null;
  structure: Array<{ label: string; start: number; end: number; confidence: number }> | null;
  cuePoints: { mixIn: number; drop: number | null; breakdown: number | null; mixOut: number; confidence: number; detectedAt?: string } | null;
} | null> {
  const tracks = await db
    .select({
      id: uploadedTracks.id,
      bpm: uploadedTracks.bpm,
      camelotKey: uploadedTracks.camelotKey,
      durationSeconds: uploadedTracks.durationSeconds,
      beatGrid: uploadedTracks.beatGrid,
      dropMoments: uploadedTracks.dropMoments,
      structure: uploadedTracks.structure,
      cuePoints: uploadedTracks.cuePoints,
    })
    .from(uploadedTracks)
    .where(eq(uploadedTracks.id, trackId));
  
  if (tracks.length === 0) return null;
  
  const t = tracks[0];
  return {
    id: t.id,
    bpm: t.bpm ? Number(t.bpm) : null,
    camelotKey: t.camelotKey,
    durationSeconds: t.durationSeconds ? Number(t.durationSeconds) : null,
    beatGrid: t.beatGrid ?? null,
    dropMoments: t.dropMoments ?? null,
    structure: t.structure ?? null,
    cuePoints: t.cuePoints ?? null,
  };
}
