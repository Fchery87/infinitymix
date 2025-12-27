/**
 * Audio Normalizer Service
 * 
 * EBU R128 two-pass loudness normalization for consistent output.
 * Also supports peak normalization and dynamic range analysis.
 */

import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

/**
 * Loudness statistics from analysis
 */
export interface LoudnessStats {
  input_i: number;      // Input integrated loudness (LUFS)
  input_tp: number;     // Input true peak (dB)
  input_lra: number;    // Input loudness range (LU)
  input_thresh: number;  // Input threshold (LUFS)
  target_offset: number; // Target offset (LU)
  I: number;            // Output integrated loudness (LUFS)
  TP: number;           // Output true peak (dB)
  LRA: number;          // Output loudness range (LU)
  thresh: number;       // Output threshold (LUFS)
}

/**
 * Loudness normalization configuration
 */
export interface LoudnessConfig {
  targetIntegrated: number;  // Target integrated loudness in LUFS (EBU standard: -23)
  targetLRA: number;        // Target loudness range in LU (EBU standard: 7)
  targetTP: number;          // Target true peak in dB (EBU standard: -2)
  dualMono: boolean;         // Treat mono file as dual mono (stereo)
  printFormat: 'json' | 'summary' | 'none';
}

/**
 * EBU R128 standard configuration
 */
export const EBU_R128_CONFIG: LoudnessConfig = {
  targetIntegrated: -23,
  targetLRA: 7,
  targetTP: -2,
  dualMono: true,
  printFormat: 'json',
};

/**
 * Peak normalization configuration
 */
export interface PeakNormalizationConfig {
  targetDb: number;   // Target peak level in dB (typically -3 to -1)
}

/**
 * Build loudnorm filter string
 */
export function buildLoudnormFilter(config: LoudnessConfig): string {
  return `loudnorm=` +
         `I=${config.targetIntegrated}:` +
         `LRA=${config.targetLRA}:` +
         `TP=${config.targetTP}:` +
         `dual_mono=${config.dualMono ? 'true' : 'false'}:` +
         `print_format=${config.printFormat}`;
}

/**
 * Analyze audio loudness using EBU R128
 * 
 * First pass of two-pass normalization
 */
export async function analyzeLoudness(
  inputPath: string,
  config: LoudnessConfig = EBU_R128_CONFIG
): Promise<LoudnessStats> {
  const filter = buildLoudnormFilter(config);

  const chunks: Buffer[] = [];

  return new Promise<LoudnessStats>((resolve, reject) => {
    const command = ffmpeg()
      .input(inputPath)
      .audioFilter(filter)
      .format('null')
      .output('-')
      .outputOption('f', 'null');

    command.on('start', (cmdline) => {
      log('info', 'audioNormalizer.analyze.start', { cmdline });
    });

    command.on('stderr', (stderrLine) => {
      // Parse loudnorm output (JSON format)
      if (config.printFormat === 'json' && stderrLine.includes('loudnorm')) {
        try {
          const jsonMatch = stderrLine.match(/\{.*\}/);
          if (jsonMatch) {
            const stats = JSON.parse(jsonMatch[0]);
            resolve(stats as LoudnessStats);
            return;
          }
        } catch {
          // Try parsing in 'end' handler
        }
      }
    });

    command.on('error', (err) => {
      log('error', 'audioNormalizer.analyze.error', { error: err.message });
      reject(err);
    });

    const output = command.pipe();
    output.on('data', chunk => chunks.push(chunk));
    output.on('end', () => {
      // Try parsing any remaining output
      const combined = Buffer.concat(chunks).toString('utf-8');
      try {
        const jsonMatch = combined.match(/\{.*\}/);
        if (jsonMatch) {
          const stats = JSON.parse(jsonMatch[0]);
          resolve(stats as LoudnessStats);
        }
      } catch {
        reject(new Error('Failed to parse loudness statistics'));
      }
    });
    output.on('error', (err) => {
      log('error', 'audioNormalizer.analyze.streamError', { error: err.message });
      reject(err);
    });
  });
}

/**
 * Normalize audio to EBU R128 loudness standard
 * 
 * Two-pass normalization:
 * Pass 1: Analyze current loudness
 * Pass 2: Apply normalization using measured stats
 */
export async function normalizeToEBU128(
  inputBuffer: Buffer,
  config: LoudnessConfig = EBU_R128_CONFIG
): Promise<Buffer> {
  const startedAt = Date.now();

  log('info', 'audioNormalizer.normalize.start', {
    targetIntegrated: config.targetIntegrated,
    targetLRA: config.targetLRA,
    targetTP: config.targetTP,
  });

  logTelemetry({
    name: 'audioNormalizer.normalize.start',
    properties: {
      targetIntegrated: config.targetIntegrated,
      targetLRA: config.targetLRA,
    },
  });

  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `loudnorm-input-${Date.now()}.wav`);
  const outputPath = path.join(tempDir, `loudnorm-output-${Date.now()}.mp3`);

  try {
    // Write input buffer to temp file
    await fs.writeFile(inputPath, inputBuffer);

    // ========================================================================
    // Pass 1: Analyze current loudness
    // ========================================================================
    const stats = await analyzeLoudness(inputPath, config);

    log('info', 'audioNormalizer.analyze.completed', {
      input_i: stats.input_i,
      input_tp: stats.input_tp,
      input_lra: stats.input_lra,
    });

    // ========================================================================
    // Pass 2: Apply normalization using measured stats
    // ========================================================================
    // Build filter with measured values as parameters
    const normalizeFilter = `loudnorm=` +
      `I=${config.targetIntegrated}:` +
      `TP=${config.targetTP}:` +
      `LRA=${config.targetLRA}:` +
      `measured_I=${stats.input_i}:` +
      `measured_TP=${stats.input_tp}:` +
      `measured_LRA=${stats.input_lra}:` +
      `measured_thresh=${stats.input_thresh}:` +
      `offset=${stats.target_offset}:` +
      `dual_mono=${config.dualMono ? 'true' : 'false'}:print_format=none`;

    const result = await new Promise<Buffer>((resolve, reject) => {
      const command = ffmpeg()
        .input(inputPath)
        .audioFilter(normalizeFilter)
        .outputOptions([
          '-ac 2',
          '-ar 44100',
          '-b:a 192k',
        ])
        .format('mp3')
        .output(outputPath);

      command.on('start', (cmdline) => {
        log('info', 'audioNormalizer.normalize.start', { cmdline });
      });

      command.on('error', (err) => {
        log('error', 'audioNormalizer.normalize.error', { error: err.message });
        reject(err);
      });

      command.on('end', async () => {
        const normalized = await fs.readFile(outputPath);
        resolve(normalized);
      });

      command.run();
    });

    const processingTime = Date.now() - startedAt;

    logTelemetry({
      name: 'audioNormalizer.normalize.completed',
      properties: {
        processingTimeMs: processingTime,
        input_i: stats.input_i,
        output_i: config.targetIntegrated,
        sizeBytes: result.length,
      },
    });

    log('info', 'audioNormalizer.normalize.completed', {
      processingTimeMs: processingTime,
      sizeBytes: result.length,
    });

    return result;
  } finally {
    // Cleanup temp files
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/**
 * Normalize to peak level
 * 
 * Simpler normalization that ensures output peaks at target dB
 */
export async function normalizeToPeak(
  inputBuffer: Buffer,
  config: PeakNormalizationConfig
): Promise<Buffer> {
  log('info', 'audioNormalizer.peakNormalize.start', {
    targetDb: config.targetDb,
  });

  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `peaknorm-input-${Date.now()}.wav`);

  try {
    await fs.writeFile(inputPath, inputBuffer);

    // Use volume filter to achieve target peak
    // Formula: volume = 10^((target - current_peak) / 20)
    // FFmpeg can handle this with loudnorm or volume directly

    const chunks: Buffer[] = [];

    const result = await new Promise<Buffer>((resolve, reject) => {
      const command = ffmpeg()
        .input(inputPath)
        .audioFilter(`loudnorm=TP=${config.targetDb}:I=-16:LRA=11`)
        .outputOptions([
          '-ac 2',
          '-ar 44100',
          '-b:a 192k',
        ])
        .format('mp3');

      command.on('error', (err) => {
        log('error', 'audioNormalizer.peakNormalize.error', { error: err.message });
        reject(err);
      });

      const output = command.pipe();
      output.on('data', chunk => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', (err) => {
        log('error', 'audioNormalizer.peakNormalize.streamError', { error: err.message });
        reject(err);
      });
    });

    log('info', 'audioNormalizer.peakNormalize.completed', {
      sizeBytes: result.length,
    });

    return result;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}

/**
 * Measure loudness without modifying audio
 */
export async function measureLoudness(
  inputBuffer: Buffer
): Promise<LoudnessStats> {
  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `measure-${Date.now()}.wav`);

  try {
    await fs.writeFile(inputPath, inputBuffer);
    const stats = await analyzeLoudness(inputPath, EBU_R128_CONFIG);

    log('info', 'audioNormalizer.measure.completed', {
      integrated: stats.input_i,
      truePeak: stats.input_tp,
      lra: stats.input_lra,
    });

    return stats;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}

/**
 * Validate loudness configuration
 */
export function validateLoudnessConfig(config: LoudnessConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Valid range for integrated loudness: -70 to -5 LUFS
  if (config.targetIntegrated < -70 || config.targetIntegrated > -5) {
    errors.push(`targetIntegrated must be between -70 and -5 LUFS, got ${config.targetIntegrated}`);
  }

  // Valid range for LRA: 1 to 20 LU
  if (config.targetLRA < 1 || config.targetLRA > 20) {
    errors.push(`targetLRA must be between 1 and 20 LU, got ${config.targetLRA}`);
  }

  // Valid range for true peak: -9 to 0 dB
  if (config.targetTP < -9 || config.targetTP > 0) {
    errors.push(`targetTP must be between -9 and 0 dB, got ${config.targetTP}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get recommended loudness config for different platforms
 */
export function getPlatformLoudnessConfig(platform: 'spotify' | 'apple_music' | 'youtube' | 'youtube_music' | 'pandora' | 'default'): LoudnessConfig {
  const configs: Record<string, Partial<LoudnessConfig>> = {
    spotify: { targetIntegrated: -14, targetLRA: 8, targetTP: -2 },
    apple_music: { targetIntegrated: -16, targetLRA: 9, targetTP: -1 },
    youtube: { targetIntegrated: -14, targetLRA: 8, targetTP: -1 },
    youtube_music: { targetIntegrated: -14, targetLRA: 8, targetTP: -1 },
    pandora: { targetIntegrated: -16, targetLRA: 8, targetTP: -2 },
    default: EBU_R128_CONFIG,
  };

  return {
    ...EBU_R128_CONFIG,
    ...configs[platform],
    dualMono: true,
    printFormat: 'json',
  };
}
