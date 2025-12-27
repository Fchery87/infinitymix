/**
 * Mixing Service - Updated
 *
 * Core audio mixing functionality with enhanced features:
 * - Multiband compression
 * - Per-stem EQ
 * - Sidechain ducking
 * - Advanced transitions
 */

import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import ffmpeg from 'fluent-ffmpeg';
import type { TransitionStyle, TransitionPreset } from './auto-dj-service';
import { AudioFilterChain } from './filter-chain-builder';
import type { StemMixingConfig } from './stem-mixing-service';
import { mixStemsPerTrack } from './stem-mixing-service';
import { normalizeToEBU128, measureLoudness } from './audio-normalizer';

/**
 * Find FFmpeg path (same logic as auto-dj-service)
 */
function configureFFmpeg() {
  const possiblePaths: string[] = [];

  // 1. Try ffmpeg-static package
  try {
    const ffmpegStaticPath = require('ffmpeg-static');
    if (typeof ffmpegStaticPath === 'string') {
      possiblePaths.push(ffmpegStaticPath);
    } else if (typeof ffmpegStaticPath === 'object' && ffmpegStaticPath.path) {
      possiblePaths.push(ffmpegStaticPath.path);
    } else if (
      typeof ffmpegStaticPath === 'object' &&
      (ffmpegStaticPath as any).ffmpegPath
    ) {
      possiblePaths.push((ffmpegStaticPath as any).ffmpegPath);
    }
  } catch (error) {
    // Ignore
  }

  // 2. Try environment variable
  if (process.env.FFMPEG_PATH) {
    possiblePaths.push(process.env.FFMPEG_PATH);
  }

  // 3. Try common system paths (platform-specific)
  const platform = process.platform;
  const systemPaths: string[] = [];

  if (platform === 'linux') {
    // Linux paths
    systemPaths.push(
      '/usr/bin/ffmpeg', // apt, yum, dnf
      '/usr/local/bin/ffmpeg', // Manual install
      '/snap/bin/ffmpeg', // Snap package
      '/usr/lib/ffmpeg', // Some distros
      '/usr/libexec/ffmpeg', // Some distros
      '/opt/ffmpeg/bin/ffmpeg' // Manual/opt install
    );
  } else if (platform === 'darwin') {
    // macOS paths
    systemPaths.push(
      '/opt/homebrew/bin/ffmpeg', // Homebrew Apple Silicon
      '/usr/local/bin/ffmpeg' // Homebrew Intel
    );
  } else if (platform === 'win32') {
    // Windows paths
    systemPaths.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe'
    );
  }

  possiblePaths.push(...systemPaths);

  // Try each path
  for (const ffmpegPath of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        log('info', 'mixing.ffmpeg.configured', { path: ffmpegPath });
        return ffmpegPath;
      }
    } catch (error) {
      // Continue
    }
  }

  return null;
}

configureFFmpeg();

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';

/**
 * Multiband compression configuration
 */
export interface MultibandConfig {
  lowBand: { threshold: number; ratio: number };
  midBand: { threshold: number; ratio: number };
  highBand: { threshold: number; ratio: number };
}

/**
 * Sidechain ducking configuration
 */
export interface SidechainConfig {
  enabled: boolean;
  thresholdDb: number;
  ratio: number;
  attackMs: number;
  releaseMs: number;
}

/**
 * Enhanced mixing configuration
 */
export interface MixingConfig {
  inputBuffers: Buffer[];
  duration?: number;
  outputFormat?: string;

  // Processing options
  enableMultibandCompression?: boolean;
  multibandConfig?: MultibandConfig;

  enableSidechainDucking?: boolean;
  sidechainConfig?: SidechainConfig;

  enableDynamicEQ?: boolean;

  // Loudness normalization
  loudnessNormalization?: 'ebu_r128' | 'peak' | 'none';
  targetLoudness?: number; // -23 for EBU

  // Transitions
  transitions?: Array<{
    fromIdx: number;
    toIdx: number;
    duration: number;
    style: TransitionStyle;
  }>;

  // Per-stem mixing (overrides simple mixing)
  stemMixing?: StemMixingConfig;
}

/**
 * Mix quality metrics
 */
export interface MixingMetrics {
  processingTimeMs: number;
  outputSizeBytes: number;
  tracksMixed: number;
  transitionsApplied: number;
  peakDb: number;
  rmsDb: number;
  integratedLoudness?: number;
}

/**
 * Crossfade presets for FFmpeg acrossfade filter
 */
export const CROSSFADE_PRESETS: Record<
  TransitionStyle,
  { curve1: string; curve2: string }
> = {
  smooth: { curve1: 'tri', curve2: 'tri' },
  drop: { curve1: 'exp', curve2: 'log' },
  cut: { curve1: 'nofade', curve2: 'nofade' },
  energy: { curve1: 'qsin', curve2: 'qsin' },

  // Additional curves
  filter_sweep: { curve1: 'hsin', curve2: 'hsin' },
  echo_reverb: { curve1: 'qsin', curve2: 'tri' },
  backspin: { curve1: 'exp', curve2: 'log' },
  tape_stop: { curve1: 'log', curve2: 'tri' },
  stutter_edit: { curve1: 'tri', curve2: 'qsin' },
  three_band_swap: { curve1: 'tri', curve2: 'tri' },
  bass_drop: { curve1: 'exp', curve2: 'log' },
  snare_roll: { curve1: 'qsin', curve2: 'qsin' },
  noise_riser: { curve1: 'tri', curve2: 'exp' },

  // New stem-based transitions
  vocal_handoff: { curve1: 'qsin', curve2: 'qsin' },
  bass_swap: { curve1: 'exp', curve2: 'exp' },
  reverb_wash: { curve1: 'tri', curve2: 'exp' },
  echo_out: { curve1: 'qsin', curve2: 'tri' },
};

/**
 * Mix multiple audio buffers together
 *
 * This is the main entry point for audio mixing.
 * Routes to per-stem mixing if configured, otherwise uses simple mixing.
 */
export async function mixToBuffer(
  inputBuffers: Buffer[],
  config: MixingConfig = {}
): Promise<{ buffer: Buffer; metrics: MixingMetrics }> {
  const startedAt = Date.now();

  log('info', 'mixing.start', {
    trackCount: inputBuffers.length,
    duration: config.duration,
    processing: {
      multiband: config.enableMultibandCompression,
      sidechain: config.enableSidechainDucking,
      dynamicEQ: config.enableDynamicEQ,
      loudness: config.loudnessNormalization,
      stemMixing: !!config.stemMixing,
    },
  });

  logTelemetry({
    name: 'mixing.start',
    properties: {
      trackCount: inputBuffers.length,
      enableMultiband: config.enableMultibandCompression ?? false,
      enableSidechain: config.enableSidechainDucking ?? false,
      loudnessNorm: config.loudnessNormalization ?? 'none',
    },
  });

  // Route to per-stem mixing if configured
  if (config.stemMixing) {
    return mixStemsPerTrack(config.stemMixing, config.duration).then(
      (result) => ({
        buffer: result.buffer,
        metrics: {
          processingTimeMs: result.metrics.processingTimeMs,
          outputSizeBytes: result.metrics.outputSizeBytes,
          tracksMixed: config.stemMixing.tracks.length,
          transitionsApplied: config.stemMixing.transitions.length,
          peakDb: result.metrics.peakDb,
          rmsDb: result.metrics.rmsDb,
        },
      })
    );
  }

  // Otherwise, use simple mixing
  const { buffer, metrics } = await simpleMix(inputBuffers, config);

  log('info', 'mixing.completed', metrics);

  return { buffer, metrics };
}

/**
 * Simple mixing for full tracks (no per-stem processing)
 */
async function simpleMix(
  inputBuffers: Buffer[],
  config: MixingConfig
): Promise<{ buffer: Buffer; metrics: MixingMetrics }> {
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];

  try {
    // ========================================================================
    // Phase 1: Write all buffers to temp files
    // ========================================================================
    for (let i = 0; i < inputBuffers.length; i++) {
      const ext = 'mp3'; // Assume MP3 for now
      const tempPath = path.join(
        tempDir,
        `mix-input-${i}-${Date.now()}.${ext}`
      );
      await fs.writeFile(tempPath, inputBuffers[i]);
      tempFiles.push(tempPath);
    }

    // ========================================================================
    // Phase 2: Build filter chain
    // ========================================================================
    const filterChain = new AudioFilterChain();

    // Multiband compression
    if (config.enableMultibandCompression) {
      const mbConfig = config.multibandConfig || DEFAULT_MULTIBAND_CONFIG;
      filterChain.addMultibandCompression(mbConfig);
    }

    // Sidechain ducking
    if (config.enableSidechainDucking) {
      const scConfig = config.sidechainConfig;
      if (scConfig && scConfig.enabled) {
        filterChain.addSidechainDucking(
          scConfig.thresholdDb,
          scConfig.ratio,
          scConfig.attackMs,
          scConfig.releaseMs
        );
      }
    }

    // Transitions
    if (config.transitions && config.transitions.length > 0) {
      for (const transition of config.transitions) {
        const preset = CROSSFADE_PRESETS[transition.style];
        filterChain.addCustomFilter(
          `acrossfade=d=${transition.duration}:c1=${preset.curve1}:c2=${preset.curve2}`
        );
      }
    }

    // Final limiter
    filterChain.addLimiter(1, 0.95, 5, 50);

    // ========================================================================
    // Phase 3: Execute FFmpeg
    // ========================================================================
    const command = ffmpeg();

    // Add all temp files as inputs
    tempFiles.forEach((filePath) => command.input(filePath));

    // Build filter chain
    const args = filterChain.buildFFmpegArgs();

    command
      .complexFilter(args[1], 'out')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        ...(config.duration ? [`-t ${config.duration}`] : []),
        '-b:a 192k',
      ])
      .format(config.outputFormat || OUTPUT_FORMAT);

    log('info', 'mixing.ffmpeg.build', {
      inputCount: tempFiles.length,
      filterCount: filterChain.getFilterCount(),
    });

    const chunks: Buffer[] = [];

    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('start', (cmdline) => {
        log('info', 'mixing.ffmpeg.start', { cmdline });
      });

      command.on('stderr', (stderrLine) => {
        if (stderrLine.includes('Error') || stderrLine.includes('error')) {
          log('error', 'mixing.ffmpeg.stderr', { stderrLine });
        }
      });

      command.on('error', (err) => {
        log('error', 'mixing.ffmpeg.error', { error: err.message });
        reject(err);
      });

      const output = command.pipe();
      output.on('data', (chunk) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', (err) => {
        log('error', 'mixing.stream.error', { error: err.message });
        reject(err);
      });
    });

    if (!result || result.length === 0) {
      throw new Error('Mixing produced empty output');
    }

    // ========================================================================
    // Phase 4: Loudness normalization (optional)
    // ========================================================================
    let finalBuffer = result;

    if (config.loudnessNormalization === 'ebu_r128') {
      const target = config.targetLoudness || -23;
      try {
        finalBuffer = await normalizeToEBU128(result, {
          targetIntegrated: target,
          targetLRA: 7,
          targetTP: -2,
          dualMono: true,
          printFormat: 'json',
        });

        log('info', 'mixing.loudness.normalized', { target: target });
      } catch (err) {
        log('warn', 'mixing.loudness.failed', {
          error: (err as Error).message,
        });
      }
    }

    const processingTime = Date.now() - Date.now();

    const metrics: MixingMetrics = {
      processingTimeMs: processingTime,
      outputSizeBytes: finalBuffer.length,
      tracksMixed: inputBuffers.length,
      transitionsApplied: config.transitions?.length || 0,
      peakDb: -3,
      rmsDb: -12,
    };

    return { buffer: finalBuffer, metrics };
  } finally {
    // Cleanup temp files
    for (const tempPath of tempFiles) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

/**
 * Mix two audio buffers with crossfade
 */
export async function crossfadeBuffers(
  bufferA: Buffer,
  bufferB: Buffer,
  duration: number,
  style: TransitionStyle = 'smooth'
): Promise<Buffer> {
  const preset = CROSSFADE_PRESETS[style];

  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];

  try {
    const pathA = path.join(tempDir, `crossfade-a-${Date.now()}.mp3`);
    const pathB = path.join(tempDir, `crossfade-b-${Date.now()}.mp3`);

    await fs.writeFile(pathA, bufferA);
    await fs.writeFile(pathB, bufferB);

    tempFiles.push(pathA, pathB);

    const chunks: Buffer[] = [];

    return await new Promise<Buffer>((resolve, reject) => {
      const command = ffmpeg()
        .input(pathA)
        .input(pathB)
        .complexFilter(
          `[0:a][1:a]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[out]`,
          'out'
        )
        .outputOptions(['-ac 2', '-ar 44100', '-b:a 192k'])
        .format('mp3');

      command.on('error', reject);

      const output = command.pipe();
      output.on('data', (chunk) => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', reject);
    });
  } finally {
    for (const tempPath of tempFiles) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

/**
 * Measure audio quality metrics
 */
export async function measureAudioMetrics(buffer: Buffer): Promise<{
  peakDb: number;
  rmsDb: number;
  loudness?: number;
}> {
  // Simplified metrics (would need proper audio decoding for accuracy)
  const peak = Math.max(...buffer);
  const rms = Math.sqrt(
    buffer.reduce((sum, byte) => sum + byte * byte, 0) / buffer.length
  );

  return {
    peakDb: 20 * Math.log10(peak / 255),
    rmsDb: 20 * Math.log10(rms / 255),
  };
}

/**
 * Default multiband compression configuration
 */
const DEFAULT_MULTIBAND_CONFIG: MultibandConfig = {
  lowBand: { threshold: -24, ratio: 2 },
  midBand: { threshold: -20, ratio: 3 },
  highBand: { threshold: -18, ratio: 4 },
};

/**
 * Validate mixing configuration
 */
export function validateMixingConfig(config: MixingConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.inputBuffers || config.inputBuffers.length === 0) {
    errors.push('At least one input buffer is required');
  }

  if (config.duration !== undefined && config.duration <= 0) {
    errors.push('Duration must be positive');
  }

  if (config.transitions) {
    for (const trans of config.transitions) {
      if (
        trans.fromIdx < 0 ||
        trans.fromIdx >= (config.inputBuffers?.length || 0)
      ) {
        errors.push(`Transition fromIdx ${trans.fromIdx} out of range`);
      }
      if (
        trans.toIdx < 0 ||
        trans.toIdx >= (config.inputBuffers?.length || 0)
      ) {
        errors.push(`Transition toIdx ${trans.toIdx} out of range`);
      }
      if (trans.duration < 0) {
        errors.push(
          `Transition duration cannot be negative: ${trans.duration}`
        );
      }
    }
  }

  if (config.multibandConfig) {
    if (config.multibandConfig.lowBand.threshold > 0) {
      errors.push('Multiband threshold must be negative');
    }
  }

  if (config.sidechainConfig?.enabled) {
    if (config.sidechainConfig.thresholdDb > 0) {
      errors.push('Sidechain threshold must be negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

log('info', 'mixing.service.loaded', {
  outputSampleRate: OUTPUT_SAMPLE_RATE,
  outputChannels: OUTPUT_CHANNELS,
  availableTransitions: Object.keys(CROSSFADE_PRESETS),
});
