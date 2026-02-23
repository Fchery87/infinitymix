import * as ffmpeg from 'fluent-ffmpeg';

export const TARGET_LUFS = -14;
export const TRUE_PEAK_CEILING = -1.5;
export const LRA_TARGET = 11;
export const LOUDNESS_TOLERANCE_LU = 1.0;
export const TRUE_PEAK_MAX = -1.0;
export const MAX_RETRIES = 2;

export interface LoudnormStats {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
}

export interface QaMetrics {
  integratedLoudness: number;
  truePeak: number;
  loudnessRange: number;
  clippingDetected: boolean;
}

export interface LoudnormJsonOutput {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  output_i?: string;
  output_tp?: string;
  output_lra?: string;
  output_thresh?: string;
  normalization_type?: string;
  target_offset?: string;
}

export function parseLoudnormStats(raw: string): LoudnormStats | null {
  try {
    const json: LoudnormJsonOutput = JSON.parse(raw);
    return {
      inputI: parseFloat(json.input_i),
      inputTp: parseFloat(json.input_tp),
      inputLra: parseFloat(json.input_lra),
      inputThresh: parseFloat(json.input_thresh),
    };
  } catch {
    return null;
  }
}

export function buildLoudnormPass2Filter(stats: LoudnormStats): string {
  return `loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_CEILING}:LRA=${LRA_TARGET}:measured_I=${stats.inputI}:measured_TP=${stats.inputTp}:measured_LRA=${stats.inputLra}:measured_thresh=${stats.inputThresh}:linear=true:print_format=json`;
}

export function shouldRetryRender(metrics: QaMetrics): boolean {
  const loudnessDiff = Math.abs(metrics.integratedLoudness - TARGET_LUFS);
  if (loudnessDiff > LOUDNESS_TOLERANCE_LU) {
    return true;
  }
  if (metrics.truePeak > TRUE_PEAK_MAX) {
    return true;
  }
  if (metrics.clippingDetected) {
    return true;
  }
  return false;
}

export function runLoudnormPass1(inputPath: string): Promise<LoudnormStats> {
  return new Promise((resolve, reject) => {
    let outputData = '';

    ffmpeg(inputPath)
      .audioFilters(`loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_CEILING}:LRA=${LRA_TARGET}:print_format=json`)
      .format('null')
      .on('stderr', (stderrLine: string) => {
        outputData += stderrLine;
      })
      .on('end', () => {
        const stats = parseLoudnormStats(outputData);
        if (stats) {
          resolve(stats);
        } else {
          reject(new Error('Failed to parse loudnorm pass 1 output'));
        }
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .save('-');
  });
}

export function runLoudnormPass2(
  inputPath: string,
  outputPath: string,
  stats: LoudnormStats
): Promise<QaMetrics> {
  return new Promise((resolve, reject) => {
    let outputData = '';

    const filter = buildLoudnormPass2Filter(stats);

    ffmpeg(inputPath)
      .audioFilters(filter)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('stderr', (stderrLine: string) => {
        outputData += stderrLine;
      })
      .on('end', () => {
        const metrics = extractQaMetrics(outputData);
        if (metrics) {
          resolve(metrics);
        } else {
          reject(new Error('Failed to extract QA metrics from pass 2 output'));
        }
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .save(outputPath);
  });
}

export function extractQaMetrics(output: string): QaMetrics | null {
  try {
    const jsonMatch = output.match(/\{[\s\S]*"input_i"[\s\S]*\}/g);
    if (!jsonMatch) {
      return null;
    }
    const lastMatch = jsonMatch[jsonMatch.length - 1];
    const json: LoudnormJsonOutput = JSON.parse(lastMatch);

    return {
      integratedLoudness: parseFloat(json.output_i || json.input_i || '0'),
      truePeak: parseFloat(json.output_tp || json.input_tp || '0'),
      loudnessRange: parseFloat(json.output_lra || json.input_lra || '0'),
      clippingDetected: false,
    };
  } catch {
    return null;
  }
}

export async function normalizeLoudness(
  inputPath: string,
  outputPath: string,
  retryCount = 0
): Promise<QaMetrics> {
  const stats = await runLoudnormPass1(inputPath);
  const metrics = await runLoudnormPass2(inputPath, outputPath, stats);

  if (shouldRetryRender(metrics) && retryCount < MAX_RETRIES) {
    return normalizeLoudness(inputPath, outputPath, retryCount + 1);
  }

  return metrics;
}
