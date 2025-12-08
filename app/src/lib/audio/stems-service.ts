import { db } from '@/lib/db';
import { trackStems, uploadedTracks, stemTypeEnum } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { log } from '@/lib/logger';
import { eq, and } from 'drizzle-orm';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'node:stream';

type StemType = (typeof stemTypeEnum.enumValues)[number];

const STEM_TYPES: StemType[] = ['vocals', 'drums', 'bass', 'other'];
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

async function renderStem(buffer: Buffer, mimeType: string, stemType: StemType) {
  if (!ffmpegStatic) {
    return buffer; // fallback: return original buffer if ffmpeg is unavailable
  }

  const filter = STEM_FILTERS[stemType];
  const command = ffmpeg();
  const input = command.input(Readable.from(buffer));
  if (mimeType.includes('wav')) input.inputFormat('wav');

  if (filter) {
    command.audioFilters(filter);
  }

  command.format('mp3');
  command.outputOptions(['-ac 2', '-ar 44100', '-b:a 192k']);
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
      ...values,
    })
    .returning();
  return created;
}

export async function separateStems(trackId: string) {
  const storage = await getStorage();
  if (!storage.getFile) {
    throw new Error('Storage driver does not support getFile; stem separation requires readable storage');
  }

  const [track] = await db
    .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType, hasStems: uploadedTracks.hasStems })
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

  for (const stemType of STEM_TYPES) {
    const started = await upsertStemRecord(trackId, stemType, { status: 'processing' });

    try {
      const rendered = await renderStem(fetched.buffer, fetched.mimeType || track.mimeType, stemType);
      const key = `${trackId}/stems/${stemType}.mp3`;
      const url = await storage.uploadFile(rendered, key, 'audio/mpeg');

      const [saved] = await db
        .update(trackStems)
        .set({ storageUrl: url, status: 'completed', updatedAt: new Date() })
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

  // Mark track as having stems if we produced any completed stems
  const completed = results.length;
  if (completed > 0) {
    await db
      .update(uploadedTracks)
      .set({ hasStems: true, updatedAt: new Date() })
      .where(eq(uploadedTracks.id, trackId));
  }

  log('info', 'stems.generated', { trackId, completed });
  return results;
}

export async function getStemsForTrack(trackId: string) {
  return db
    .select()
    .from(trackStems)
    .where(eq(trackStems.uploadedTrackId, trackId));
}
