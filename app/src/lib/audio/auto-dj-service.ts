import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { calculateBeatAlignment, calculateTempoRatio } from '@/lib/utils/audio-compat';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { getTrackInfoForMixing } from './stems-service';
import { eq, inArray } from 'drizzle-orm';
import { uploadedTracks } from '@/lib/db/schema';

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';

export type AutoDjEnergyMode = 'steady' | 'build' | 'wave';
export type AutoDjEventType = 'wedding' | 'birthday' | 'sweet16' | 'club' | 'default';
export type AutoDjTransitionStyle = 'smooth' | 'drop' | 'energy' | 'cut';

const CROSSFADE_PRESETS: Record<AutoDjTransitionStyle, { duration: number; curve1: string; curve2: string }> = {
  smooth: { duration: 4, curve1: 'tri', curve2: 'tri' },
  drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },
  cut: { duration: 0, curve1: 'nofade', curve2: 'nofade' },
  energy: { duration: 2, curve1: 'qsin', curve2: 'qsin' },
};

type TrackInfo = NonNullable<Awaited<ReturnType<typeof getTrackInfoForMixing>>>;

type TrackBuffer = {
  id: string;
  buffer: Buffer;
  mimeType: string;
};

export type AutoDjConfig = {
  trackIds: string[];
  targetDurationSeconds: number;
  targetBpm?: number;
  transitionStyle?: AutoDjTransitionStyle;
  fadeDurationSeconds?: number;
  energyMode?: AutoDjEnergyMode;
  keepOrder?: boolean;
  preferStems?: boolean;
  eventType?: AutoDjEventType;
};

export type PlannedTransition = {
  fromId: string;
  toId: string;
  style: AutoDjTransitionStyle;
  fadeDuration: number;
  beatOffsetSeconds: number;
  curve1: string;
  curve2: string;
};

export type AutoDjPlan = {
  order: string[];
  targetBpm: number;
  transitions: PlannedTransition[];
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

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function clampTempoRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1.33, Math.max(0.75, Number(value.toFixed(3))));
}

async function loadTrackBuffers(trackIds: string[]): Promise<TrackBuffer[]> {
  const storage = await getStorage();
  if (!storage.getFile) {
    throw new Error('Storage driver does not support reading files (getFile)');
  }

  const records = await db
    .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType })
    .from(uploadedTracks)
    .where(inArray(uploadedTracks.id, trackIds));

  const buffers: TrackBuffer[] = [];
  for (const record of records) {
    const fetched = await storage.getFile(record.storageUrl);
    if (!fetched?.buffer) {
      throw new Error(`Failed to fetch audio for track ${record.id}`);
    }
    buffers.push({ id: record.id, buffer: fetched.buffer, mimeType: fetched.mimeType || record.mimeType || 'audio/mpeg' });
  }
  return buffers;
}

export async function planAutoDjMix(trackInfos: TrackInfo[], config: AutoDjConfig): Promise<AutoDjPlan> {
  const transitionStyle = config.transitionStyle ?? 'smooth';
  const preset = CROSSFADE_PRESETS[transitionStyle];
  const targetBpm = config.targetBpm ?? (median(trackInfos.map((t) => t.bpm || 0).filter(Boolean)) ?? 120);

  let ordered = config.keepOrder
    ? [...config.trackIds]
    : [...trackInfos]
        .sort((a, b) => {
          const abpm = a.bpm ? Math.abs((a.bpm as number) - targetBpm) : 999;
          const bbpm = b.bpm ? Math.abs((b.bpm as number) - targetBpm) : 999;
          return abpm - bbpm;
        })
        .map((t) => t.id);

  if (!config.keepOrder && config.energyMode === 'build') {
    ordered = [...trackInfos]
      .sort((a, b) => (a.bpm ?? targetBpm) - (b.bpm ?? targetBpm))
      .map((t) => t.id);
  }

  if (!config.keepOrder && config.energyMode === 'wave') {
    const sorted = [...trackInfos].sort((a, b) => (a.bpm ?? targetBpm) - (b.bpm ?? targetBpm));
    const low = sorted.filter((_, idx) => idx % 2 === 0);
    const high = sorted.filter((_, idx) => idx % 2 === 1).reverse();
    ordered = [...low, ...high].map((t) => t.id);
  }

  const transitions: PlannedTransition[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = trackInfos.find((t) => t.id === ordered[i]);
    const to = trackInfos.find((t) => t.id === ordered[i + 1]);
    const fromBpm = from?.bpm ? Number(from.bpm) : targetBpm;
    const toBpm = to?.bpm ? Number(to.bpm) : targetBpm;
    const fromRatio = clampTempoRatio(calculateTempoRatio(fromBpm, targetBpm));
    const toRatio = clampTempoRatio(calculateTempoRatio(toBpm, targetBpm));
    const fromGrid = (from?.beatGrid ?? []).map((t) => t / fromRatio);
    const toGrid = (to?.beatGrid ?? []).map((t) => t / toRatio);
    const beatOffset = calculateBeatAlignment(fromGrid, toGrid, targetBpm, 'downbeat');

    transitions.push({
      fromId: ordered[i],
      toId: ordered[i + 1],
      style: transitionStyle,
      fadeDuration: config.fadeDurationSeconds ?? preset.duration,
      beatOffsetSeconds: beatOffset,
      curve1: preset.curve1,
      curve2: preset.curve2,
    });
  }

  return { order: ordered, targetBpm, transitions };
}

export async function renderAutoDjMix(
  mashupId: string,
  config: AutoDjConfig & { plan?: AutoDjPlan }
): Promise<void> {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg-static binary not available for mixing');
  }

  const startedAt = Date.now();
  const storage = await getStorage();

  const trackInfos: TrackInfo[] = [];
  for (const trackId of config.trackIds) {
    const info = await getTrackInfoForMixing(trackId);
    if (info) trackInfos.push(info);
  }
  if (trackInfos.length === 0) {
    throw new Error('No track info available for auto DJ mix');
  }

  const plan = config.plan ?? (await planAutoDjMix(trackInfos, config));

  await db
    .update(mashups)
    .set({ generationStatus: 'generating', mixMode: 'standard', recommendationContext: { plan, request: config }, updatedAt: new Date() })
    .where(eq(mashups.id, mashupId));

  const orderedBuffers = await loadTrackBuffers(plan.order);
  if (orderedBuffers.length === 0) throw new Error('No audio buffers loaded for auto DJ mix');

  const tempFs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];

  try {
    for (let i = 0; i < orderedBuffers.length; i++) {
      const track = orderedBuffers[i];
      const ext = track.mimeType.includes('wav') ? '.wav' : '.mp3';
      const tempPath = path.join(tempDir, `auto-dj-${Date.now()}-${i}${ext}`);
      await tempFs.writeFile(tempPath, track.buffer);
      tempFiles.push(tempPath);
    }

    const command = ffmpeg();
    tempFiles.forEach((filePath) => command.input(filePath));

    const filters: string[] = [];
    const targetBpm = plan.targetBpm;
    const numTracks = orderedBuffers.length;
    const totalDuration = config.targetDurationSeconds;
    
    // Calculate crossfade duration
    const transitionStyle = config.transitionStyle ?? 'smooth';
    const defaultFade = CROSSFADE_PRESETS[transitionStyle]?.duration ?? 2;
    const fadeDuration = Math.min(config.fadeDurationSeconds ?? defaultFade, 8);
    
    // Calculate segment duration for each track
    // Total duration = sum of segments - overlaps
    // With N tracks and (N-1) overlaps of fadeDuration each:
    // totalDuration = N * segmentDuration - (N-1) * fadeDuration
    // segmentDuration = (totalDuration + (N-1) * fadeDuration) / N
    const segmentDuration = numTracks > 1 
      ? (totalDuration + (numTracks - 1) * fadeDuration) / numTracks
      : totalDuration;
    
    console.log(`🎵 Auto DJ: ${numTracks} tracks, ${totalDuration}s total, ${segmentDuration.toFixed(1)}s per segment, ${fadeDuration}s crossfade`);

    // Process each track: tempo adjust, trim to segment length
    orderedBuffers.forEach((track, idx) => {
      const info = trackInfos.find((t) => t.id === track.id);
      const bpm = info?.bpm ? Number(info.bpm) : targetBpm;
      const tempoRatio = clampTempoRatio(calculateTempoRatio(bpm, targetBpm));
      const atempo = buildAtempoChain(tempoRatio);
      
      const chainParts: string[] = [];
      if (atempo) chainParts.push(atempo);
      // Trim each track to segment duration
      chainParts.push(`atrim=0:${segmentDuration.toFixed(2)}`);
      chainParts.push('asetpts=PTS-STARTPTS');
      chainParts.push('volume=1');
      
      filters.push(`[${idx}:a]${chainParts.join(',')}[t${idx}]`);
    });

    if (numTracks === 1) {
      filters.push(`[t0]anull[mixed]`);
    } else {
      // For DJ-style mixing, we delay each track and use amix with crossfade envelopes
      // Track 0: starts at 0
      // Track 1: starts at (segmentDuration - fadeDuration)
      // Track 2: starts at 2*(segmentDuration - fadeDuration)
      // etc.
      
      const stepDuration = segmentDuration - fadeDuration;
      
      // Apply delays and fades to each track
      for (let i = 0; i < numTracks; i++) {
        const startTime = i * stepDuration;
        const delayMs = Math.round(startTime * 1000);
        
        // Build fade envelope: fade in at start (except track 0), fade out at end (except last track)
        const fadeFilters: string[] = [];
        
        // Fade in (except first track)
        if (i > 0) {
          fadeFilters.push(`afade=t=in:st=0:d=${fadeDuration}`);
        }
        
        // Fade out (except last track)
        if (i < numTracks - 1) {
          const fadeOutStart = segmentDuration - fadeDuration;
          fadeFilters.push(`afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${fadeDuration}`);
        }
        
        let chain = `[t${i}]`;
        if (fadeFilters.length > 0) {
          chain += fadeFilters.join(',');
          chain += `[f${i}]`;
          filters.push(chain);
          chain = `[f${i}]`;
        } else {
          chain = `[t${i}]`;
        }
        
        // Apply delay
        if (delayMs > 0) {
          filters.push(`${chain}adelay=${delayMs}|${delayMs}[d${i}]`);
        } else {
          filters.push(`${chain}anull[d${i}]`);
        }
      }
      
      // Mix all delayed/faded tracks together
      const mixInputs = Array.from({ length: numTracks }, (_, i) => `[d${i}]`).join('');
      filters.push(`${mixInputs}amix=inputs=${numTracks}:duration=longest:normalize=0[mixed]`);
    }

    const safeDuration = Math.max(30, Math.round(config.targetDurationSeconds));

    command
      .complexFilter(filters, 'mixed')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        `-t ${safeDuration}`,
        '-b:a 192k',
      ])
      .format(OUTPUT_FORMAT);

    const chunks: Buffer[] = [];

    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('start', (cmdline) => {
        log('info', 'autoDj.ffmpeg.start', { cmdline });
      });

      command.on('stderr', (stderrLine) => {
        if (stderrLine.includes('Error') || stderrLine.includes('error')) {
          log('error', 'autoDj.ffmpeg.stderr', { stderrLine });
        }
      });

      command.on('error', (err) => {
        log('error', 'autoDj.ffmpeg.error', { error: err.message });
        reject(err);
      });

      const output = command.pipe();
      output.on('data', (chunk) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', (err) => reject(err));
    });

    if (!result || result.length === 0) {
      throw new Error('Auto DJ render produced empty output');
    }

    const outputUrl = await storage.uploadFile(result, `${mashupId}.${OUTPUT_FORMAT}`, 'audio/mpeg');
    const processingTime = Date.now() - startedAt;

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        publicPlaybackUrl: outputUrl,
        outputFormat: OUTPUT_FORMAT,
        generationTimeMs: processingTime,
        mixMode: 'standard',
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId));

    logTelemetry({ name: 'autoDj.render.completed', properties: { mashupId, outputUrl, processingTimeMs: processingTime } });
  } catch (error) {
    handleAsyncError(error as Error, 'renderAutoDjMix');
    await db
      .update(mashups)
      .set({ generationStatus: 'failed', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));
    throw error;
  } finally {
    for (const tempPath of tempFiles) {
      await tempFs.unlink(tempPath).catch(() => {});
    }
  }
}
