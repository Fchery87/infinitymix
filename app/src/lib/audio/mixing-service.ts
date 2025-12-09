import { db } from '@/lib/db';
import { mashups, uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { logTelemetry } from '@/lib/telemetry';
import { log } from '@/lib/logger';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { eq, inArray } from 'drizzle-orm';
import { getStemBuffer, getTrackInfoForMixing } from './stems-service';
import { calculatePitchShiftSemitones, semitonesToPitchRatio, calculateTempoRatio, camelotCompatible, calculateBeatAlignment, BeatAlignMode } from '@/lib/utils/audio-compat';

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';
const DEFAULT_TARGET_BPM = 120;
type MixMode = 'standard' | 'vocals_over_instrumental' | 'drum_swap';

export type TransitionStyle = 'smooth' | 'drop' | 'cut' | 'energy';

const CROSSFADE_PRESETS: Record<TransitionStyle, { duration: number; curve1: string; curve2: string }> = {
  smooth: { duration: 4, curve1: 'tri', curve2: 'tri' },
  drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },
  cut: { duration: 0, curve1: 'nofade', curve2: 'nofade' },
  energy: { duration: 2, curve1: 'qsin', curve2: 'qsin' },
};

// Stem-based mashup configuration
export type StemMashupConfig = {
  vocalTrackId: string;        // Track to take vocals from
  instrumentalTrackId: string; // Track to take instrumental from
  targetBpm?: number;          // Target BPM (defaults to instrumental track BPM)
  autoKeyMatch?: boolean;      // Auto pitch-shift vocals to match instrumental key
  pitchShiftSemitones?: number; // Manual pitch shift override
  vocalVolume?: number;        // Vocal volume 0-1 (default 0.75)
  instrumentalVolume?: number; // Instrumental volume 0-1 (default 0.85)
  durationSeconds?: number;    // Output duration
  beatAlign?: boolean;         // Enable beat grid alignment (default true)
  beatAlignMode?: BeatAlignMode; // downbeat or nearest beat
  crossfade?: {
    enabled: boolean;
    duration?: number;
    style?: TransitionStyle;
    transitionAt?: 'start' | 'drop' | 'chorus' | 'auto';
  };
};

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

function modeFilters(mode: MixMode, index: number) {
  if (mode === 'vocals_over_instrumental') {
    return index === 0 ? 'highpass=f=1200,acompressor' : 'lowpass=f=1800,compand';
  }
  if (mode === 'drum_swap') {
    return index === 0 ? 'alimiter' : 'highpass=f=150,compand';
  }
  return '';
}

export async function mixToBuffer(tracks: PreparedTrack[], durationSeconds: number, mode: MixMode = 'standard') {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg-static binary not available for mixing');
  }

  const safeDuration = Math.max(5, Number.isFinite(durationSeconds) ? durationSeconds : 60);
  const targetBpm = tracks.map(t => t.bpm).filter((bpm): bpm is number => Number.isFinite(bpm)).at(0) ?? DEFAULT_TARGET_BPM;
  const inputCount = tracks.length;
  const volumePerTrack = Number((1 / Math.max(1, inputCount)).toFixed(3));

  // fluent-ffmpeg only supports one input stream, so we need to use temp files
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');
  
  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];
  
  try {
    // Write all track buffers to temp files
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const ext = track.mimeType.includes('wav') ? '.wav' : '.mp3';
      const tempPath = path.join(tempDir, `infinitymix-input-${Date.now()}-${i}${ext}`);
      await fs.writeFile(tempPath, track.buffer);
      tempFiles.push(tempPath);
    }

    const command = ffmpeg();
    
    // Add all temp files as inputs
    tempFiles.forEach((filePath) => {
      command.input(filePath);
    });

    const filterChains: string[] = [];
    tracks.forEach((track, idx) => {
      const ratio = track.bpm && track.bpm > 0 ? targetBpm / track.bpm : 1;
      const atempo = buildAtempoChain(ratio);
      const modeFilter = modeFilters(mode, idx);
      const chain = [atempo, modeFilter, `volume=${volumePerTrack}`].filter(Boolean).join(',');
      const inputLabel = `${idx}:a`;
      const outputLabel = `a${idx}`;
      filterChains.push(`[${inputLabel}]${chain || 'anull'}[${outputLabel}]`);
    });

    const inputLabels = tracks.map((_, idx) => `[a${idx}]`).join('');
    filterChains.push(`${inputLabels}amix=inputs=${inputCount}:duration=shortest:normalize=0[mixed]`);

    command
      .complexFilter(filterChains, 'mixed')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        `-t ${safeDuration}`,
        '-b:a 192k',
      ])
      .format('mp3');

    const chunks: Buffer[] = [];

    console.log(`🎵 FFmpeg: Starting mix with ${tracks.length} tracks, duration=${safeDuration}s`);
    console.log(`🎵 FFmpeg: Filter chains: ${JSON.stringify(filterChains)}`);

    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('start', (cmdline) => {
        console.log(`🎵 FFmpeg command: ${cmdline}`);
      });
      
      command.on('stderr', (stderrLine) => {
        // Log FFmpeg progress/errors
        if (stderrLine.includes('Error') || stderrLine.includes('error')) {
          console.error(`🎵 FFmpeg stderr: ${stderrLine}`);
        }
      });
      
      command.on('error', (err) => {
        console.error(`❌ FFmpeg error:`, err);
        reject(err);
      });
      
      command.on('end', () => {
        console.log(`✅ FFmpeg completed, output size: ${chunks.reduce((a, b) => a + b.length, 0)} bytes`);
      });
      
      const output = command.pipe();
      output.on('data', chunk => {
        chunks.push(chunk);
      });
      output.on('end', () => {
        const totalSize = chunks.reduce((a, b) => a + b.length, 0);
        console.log(`✅ FFmpeg stream ended, total: ${totalSize} bytes`);
        resolve(Buffer.concat(chunks));
      });
      output.on('error', (err) => {
        console.error(`❌ FFmpeg stream error:`, err);
        reject(err);
      });
    });

    console.log(`✅ Mix complete: ${result.length} bytes`);
    return result;
  } finally {
    // Clean up temp files
    for (const tempPath of tempFiles) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
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

export async function renderMashup(mashupId: string, inputTrackIds: string[], durationSeconds: number, mixMode: MixMode = 'standard') {
  const startedAt = Date.now();

  try {
    logTelemetry({
      name: 'mashup.render.start',
      properties: { mashupId, trackCount: inputTrackIds.length, durationSeconds },
    });

    await db
      .update(mashups)
      .set({ generationStatus: 'generating', mixMode, updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));

    const tracks = await loadTracks(inputTrackIds);
    const outputBuffer = await mixToBuffer(tracks, durationSeconds, mixMode);
    const storage = await getStorage();
    const outputUrl = await storage.uploadFile(outputBuffer, `${mashupId}.${OUTPUT_FORMAT}`, 'audio/mpeg');

    const processingTime = Date.now() - startedAt;

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        publicPlaybackUrl: outputUrl,
        outputFormat: OUTPUT_FORMAT,
        generationTimeMs: processingTime,
        mixMode,
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
        mixMode,
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

/**
 * Mix stems from two tracks: vocals from one, instrumental from another
 * With optional key matching and BPM sync
 */
export async function mixStemMashup(config: StemMashupConfig): Promise<Buffer> {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg-static binary not available for mixing');
  }

  const { vocalTrackId, instrumentalTrackId, autoKeyMatch = true } = config;

  // Load track info for BPM and key
  const [vocalTrack, instTrack] = await Promise.all([
    getTrackInfoForMixing(vocalTrackId),
    getTrackInfoForMixing(instrumentalTrackId),
  ]);

  if (!vocalTrack || !instTrack) {
    throw new Error('Could not load track info for mixing');
  }

  // Load stems
  const [vocalsStem, instStem] = await Promise.all([
    getStemBuffer(vocalTrackId, 'vocals'),
    getStemBuffer(instrumentalTrackId, 'other'), // 'other' = instrumental
  ]);

  if (!vocalsStem) {
    throw new Error(`No vocals stem found for track ${vocalTrackId}`);
  }
  if (!instStem) {
    throw new Error(`No instrumental stem found for track ${instrumentalTrackId}`);
  }

  // Determine target BPM (default to instrumental track BPM)
  const targetBpm = config.targetBpm ?? instTrack.bpm ?? DEFAULT_TARGET_BPM;

  // Adjust beat grids for tempo changes
  const vocalTempoRatio = calculateTempoRatio(vocalTrack.bpm, targetBpm);
  const instTempoRatio = calculateTempoRatio(instTrack.bpm, targetBpm);
  const adjustedVocalBeatGrid = (vocalTrack.beatGrid ?? []).map((t) => t / (vocalTempoRatio || 1));
  const adjustedInstBeatGrid = (instTrack.beatGrid ?? []).map((t) => t / (instTempoRatio || 1));

  // Calculate pitch shift for key matching
  let pitchShiftSemitones = config.pitchShiftSemitones ?? 0;
  if (autoKeyMatch && pitchShiftSemitones === 0 && vocalTrack.camelotKey && instTrack.camelotKey) {
    // Check if keys are already compatible
    if (!camelotCompatible(vocalTrack.camelotKey, instTrack.camelotKey)) {
      pitchShiftSemitones = calculatePitchShiftSemitones(vocalTrack.camelotKey, instTrack.camelotKey);
      log('info', 'stemMashup.keyMatch', {
        vocalKey: vocalTrack.camelotKey,
        instKey: instTrack.camelotKey,
        pitchShift: pitchShiftSemitones,
      });
    }
  }

  // Volume levels
  const vocalVolume = config.vocalVolume ?? 0.75;
  const instVolume = config.instrumentalVolume ?? 0.85;

  // Duration
  const duration = config.durationSeconds ?? Math.min(
    vocalTrack.durationSeconds ?? 180,
    instTrack.durationSeconds ?? 180,
    180
  );

  console.log(`🎵 Stem Mashup: vocals from ${vocalTrackId}, instrumental from ${instrumentalTrackId}`);
  console.log(`🎵 Target BPM: ${targetBpm}, Pitch shift: ${pitchShiftSemitones} semitones`);
  console.log(`🎵 Vocal tempo ratio: ${vocalTempoRatio.toFixed(3)}, Inst tempo ratio: ${instTempoRatio.toFixed(3)}`);

  // Write stems to temp files
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');
  
  const tempDir = os.tmpdir();
  const vocalPath = path.join(tempDir, `infinitymix-vocals-${Date.now()}.wav`);
  const instPath = path.join(tempDir, `infinitymix-inst-${Date.now()}.wav`);
  
  await fs.writeFile(vocalPath, vocalsStem.buffer);
  await fs.writeFile(instPath, instStem.buffer);

  try {
    const command = ffmpeg();
    command.input(vocalPath);
    command.input(instPath);

    // Build filter chain
    const filterChains: string[] = [];

    // Vocal processing: tempo + pitch shift + EQ + volume
    let vocalChain = '';
    const vocalAtempo = buildAtempoChain(vocalTempoRatio);
    if (vocalAtempo) {
      vocalChain = vocalAtempo;
    }
    
    // Add pitch shift if needed (using asetrate + atempo combo for pitch without rubberband)
    // Note: FFmpeg rubberband requires librubberband. Fallback to asetrate method.
    if (pitchShiftSemitones !== 0) {
      const pitchRatio = semitonesToPitchRatio(pitchShiftSemitones);
      const newRate = Math.round(OUTPUT_SAMPLE_RATE * pitchRatio);
      // asetrate changes pitch by changing playback rate, then we resample back
      const pitchFilter = `asetrate=${newRate},aresample=${OUTPUT_SAMPLE_RATE}`;
      vocalChain = vocalChain ? `${vocalChain},${pitchFilter}` : pitchFilter;
    }

    // Vocal EQ: highpass to remove low rumble, slight presence boost
    vocalChain = vocalChain 
      ? `${vocalChain},highpass=f=120,lowpass=f=12000,volume=${vocalVolume}` 
      : `highpass=f=120,lowpass=f=12000,volume=${vocalVolume}`;
    filterChains.push(`[0:a]${vocalChain}[vocals]`);

    // Instrumental processing: tempo + EQ + volume
    let instChain = '';
    const instAtempo = buildAtempoChain(instTempoRatio);
    if (instAtempo) {
      instChain = instAtempo;
    }
    
    // Beat alignment
    if (config.beatAlign !== false) {
      const beatOffset = calculateBeatAlignment(
        adjustedVocalBeatGrid,
        adjustedInstBeatGrid,
        targetBpm,
        config.beatAlignMode ?? 'downbeat'
      );
      if (beatOffset !== 0) {
        const delayMs = Math.abs(Math.round(beatOffset * 1000));
        if (beatOffset > 0) {
          vocalChain = vocalChain ? `adelay=${delayMs}|${delayMs},${vocalChain}` : `adelay=${delayMs}|${delayMs}`;
        } else {
          instChain = instChain ? `adelay=${delayMs}|${delayMs},${instChain}` : `adelay=${delayMs}|${delayMs}`;
        }
      }
    }

    // Instrumental EQ: slight low-pass to leave room for vocals
    instChain = instChain 
      ? `${instChain},lowpass=f=14000,volume=${instVolume}` 
      : `lowpass=f=14000,volume=${instVolume}`;
    filterChains.push(`[1:a]${instChain}[inst]`);

    const crossfadeConfig = config.crossfade;
    const style: TransitionStyle = crossfadeConfig?.style ?? 'smooth';
    const preset = CROSSFADE_PRESETS[style] ?? CROSSFADE_PRESETS.smooth;
    const fadeDuration = Math.max(0, crossfadeConfig?.duration ?? preset.duration);
    const crossfadeEnabled = !!crossfadeConfig?.enabled && fadeDuration > 0 && duration > 0;

    if (crossfadeEnabled) {
      const fadeLen = Math.min(fadeDuration, duration / 2); // Ensure fade doesn't exceed half duration
      
      // Split vocals and inst streams for multiple uses (FFmpeg labels can only be consumed once)
      filterChains.push(`[vocals]asplit=2[vocals_a][vocals_b]`);
      filterChains.push(`[inst]asplit=2[inst_a][inst_b]`);
      
      // Intro crossfade section
      filterChains.push(`[vocals_a]atrim=end=${fadeLen},asetpts=PTS-STARTPTS[v0]`);
      filterChains.push(`[inst_a]atrim=end=${fadeLen},asetpts=PTS-STARTPTS[i0]`);
      filterChains.push(`[v0][i0]acrossfade=d=${fadeLen}:c1=${preset.curve1}:c2=${preset.curve2}[intro]`);
      
      // Rest of the mix (after crossfade)
      filterChains.push(`[vocals_b]atrim=start=${fadeLen},asetpts=PTS-STARTPTS[v1]`);
      filterChains.push(`[inst_b]atrim=start=${fadeLen},asetpts=PTS-STARTPTS[i1]`);
      filterChains.push(`[v1][i1]amix=inputs=2:duration=shortest:normalize=0[restmix]`);
      
      // Concatenate intro crossfade with rest of mix
      filterChains.push(`[intro][restmix]concat=n=2:v=0:a=1[premix]`);
    } else {
      filterChains.push(`[vocals][inst]amix=inputs=2:duration=shortest:normalize=0[premix]`);
    }

    // Final limiter to prevent clipping
    filterChains.push(`[premix]alimiter=level_in=1:level_out=0.95[out]`);

    console.log(`🎵 Filter chains: ${JSON.stringify(filterChains)}`);

    command
      .complexFilter(filterChains, 'out')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        `-t ${duration}`,
        '-b:a 192k',
      ])
      .format('mp3');

    const chunks: Buffer[] = [];

    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('start', (cmdline) => {
        console.log(`🎵 FFmpeg stem mashup: ${cmdline}`);
      });
      
      command.on('stderr', (stderrLine) => {
        if (stderrLine.includes('Error') || stderrLine.includes('error')) {
          console.error(`🎵 FFmpeg stderr: ${stderrLine}`);
        }
      });
      
      command.on('error', (err) => {
        console.error(`❌ FFmpeg stem mashup error:`, err);
        reject(err);
      });
      
      const output = command.pipe();
      output.on('data', chunk => {
        chunks.push(chunk);
      });
      output.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      output.on('error', (err) => {
        reject(err);
      });
    });

    console.log(`✅ Stem mashup complete: ${result.length} bytes`);
    
    if (result.length === 0) {
      throw new Error('FFmpeg produced empty output - filter chain may have failed');
    }
    
    return result;
  } finally {
    // Clean up temp files
    await fs.unlink(vocalPath).catch(() => {});
    await fs.unlink(instPath).catch(() => {});
  }
}

/**
 * Create and render a stem-based mashup, saving to database
 */
export async function renderStemMashup(
  mashupId: string,
  config: StemMashupConfig
): Promise<void> {
  const startedAt = Date.now();

  try {
    logTelemetry({
      name: 'stemMashup.render.start',
      properties: { mashupId, vocalTrackId: config.vocalTrackId, instrumentalTrackId: config.instrumentalTrackId },
    });

    await db
      .update(mashups)
      .set({ generationStatus: 'generating', mixMode: 'vocals_over_instrumental', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));

    const outputBuffer = await mixStemMashup(config);
    const storage = await getStorage();
    const outputUrl = await storage.uploadFile(outputBuffer, `${mashupId}.${OUTPUT_FORMAT}`, 'audio/mpeg');

    const processingTime = Date.now() - startedAt;

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        publicPlaybackUrl: outputUrl,
        outputFormat: OUTPUT_FORMAT,
        generationTimeMs: processingTime,
        mixMode: 'vocals_over_instrumental',
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId));

    logTelemetry({
      name: 'stemMashup.render.completed',
      properties: {
        mashupId,
        vocalTrackId: config.vocalTrackId,
        instrumentalTrackId: config.instrumentalTrackId,
        processingTimeMs: processingTime,
        outputUrl,
      },
    });

    log('info', 'stemMashup.render.completed', {
      mashupId,
      processingTimeMs: processingTime,
    });
  } catch (error) {
    handleAsyncError(error as Error, 'renderStemMashup');
    logTelemetry({ name: 'stemMashup.render.failed', level: 'error', properties: { mashupId, error: (error as Error)?.message } });
    log('error', 'stemMashup.render.failed', { mashupId, error: (error as Error)?.message });
    await db
      .update(mashups)
      .set({ generationStatus: 'failed', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));
  }
}
