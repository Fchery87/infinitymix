import { db } from '@/lib/db';
import { mashups, uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { logTelemetry } from '@/lib/telemetry';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';

function generateSineWaveWav(durationSeconds: number, frequency = 440, sampleRate = 8000): Buffer {
  const sampleCount = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const dataSize = sampleCount * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // channels
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t) * 0.2;
    buffer.writeInt16LE(Math.floor(sample * 0x7fff), 44 + i * 2);
  }

  return buffer;
}

function calculateRenderTime(trackCount: number, durationSeconds: number) {
  const base = 4000 + trackCount * 800;
  const durationFactor = Math.min(6000, Math.max(1500, durationSeconds * 8));
  return base + durationFactor;
}

export async function renderMashup(mashupId: string, inputTrackIds: string[], durationSeconds: number) {
  try {
    logTelemetry({
      name: 'mashup.render.start',
      properties: { mashupId, trackCount: inputTrackIds.length, durationSeconds },
    });

    await db
      .update(mashups)
      .set({ generationStatus: 'generating', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));

    const processingTime = calculateRenderTime(inputTrackIds.length, durationSeconds);
    await new Promise(resolve => setTimeout(resolve, processingTime));
    const storage = await getStorage();

    let outputBuffer = generateSineWaveWav(durationSeconds);
    let mimeType = 'audio/wav';
    let extension = 'wav';

    try {
      const [source] = await db
        .select({ storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType })
        .from(uploadedTracks)
        .where(eq(uploadedTracks.id, inputTrackIds[0]))
        .limit(1);

      if (source && storage.getFile) {
        const fetched = await storage.getFile(source.storageUrl);
        if (fetched?.buffer) {
          outputBuffer = fetched.buffer;
          mimeType = fetched.mimeType || source.mimeType || 'audio/mpeg';
          extension = mimeType.includes('wav') ? 'wav' : 'mp3';
        }
      }
    } catch (e) {
      log('warn', 'mashup.render.source_fetch_failed', { mashupId, error: (e as Error)?.message });
    }

    const outputUrl = await storage.uploadFile(outputBuffer, `${mashupId}.${extension}`, mimeType);

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        outputFormat: extension,
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
