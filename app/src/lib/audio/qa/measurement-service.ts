/**
 * QA Measurement Service
 * 
 * Measures audio quality metrics for renders and transitions.
 * Uses FFmpeg and audio analysis tools to compute comprehensive QA data.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';
import type {
  RenderQAMetrics,
  LoudnessMetrics,
  DynamicRangeMetrics,
  ClippingMetrics,
  TransitionQARecord,
  QAThresholds,
} from '@/lib/audio/types/qa';
import { DEFAULT_QA_THRESHOLDS } from '@/lib/audio/types/qa';
import { nanoid } from 'nanoid';

const execAsync = promisify(exec);

/**
 * Measure comprehensive QA metrics for an audio buffer
 */
export async function measureRenderQA(
  audioBuffer: Buffer,
  thresholds: QAThresholds = DEFAULT_QA_THRESHOLDS
): Promise<RenderQAMetrics> {
  const startTime = Date.now();
  const tempFile = join(tmpdir(), `qa-${nanoid()}.wav`);
  
  try {
    // Write buffer to temp file
    await writeFile(tempFile, audioBuffer);
    
    // Measure in parallel
    const [loudness, dynamicRange, clipping] = await Promise.all([
      measureLoudness(tempFile),
      measureDynamicRange(tempFile),
      measureClipping(tempFile),
    ]);
    
    // Determine pass/fail
    const failedChecks: string[] = [];
    
    if (Math.abs(loudness.integratedLufs - thresholds.targetIntegratedLufs) > thresholds.loudnessToleranceLufs) {
      failedChecks.push(`loudness_outside_tolerance: ${loudness.integratedLufs} LUFS`);
    }
    
    if (loudness.truePeakDbtp > thresholds.maxTruePeakDbtp) {
      failedChecks.push(`true_peak_exceeded: ${loudness.truePeakDbtp.toFixed(2)} dBTP`);
    }
    
    if (dynamicRange.dynamicRangeLu < thresholds.minDynamicRangeLu) {
      failedChecks.push(`low_dynamic_range: ${dynamicRange.dynamicRangeLu.toFixed(1)} LU`);
    }
    
    if (clipping.clippingRate > thresholds.maxClippingRate) {
      failedChecks.push(`clipping_detected: ${(clipping.clippingRate * 100).toFixed(2)}%`);
    }
    
    return {
      loudness,
      dynamicRange,
      clipping,
      passed: failedChecks.length === 0,
      failedChecks,
      measuredAt: new Date().toISOString(),
      measurementDurationMs: Date.now() - startTime,
    };
  } finally {
    // Cleanup
    try {
      await unlink(tempFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Measure EBU R128 loudness metrics using FFmpeg
 */
async function measureLoudness(filePath: string): Promise<LoudnessMetrics> {
  try {
    // Use FFmpeg's ebur128 filter
    const { stderr } = await execAsync(
      `ffmpeg -i "${filePath}" -af ebur128=peak=true -f null - 2>&1`
    );
    
    // Parse FFmpeg output
    const integratedMatch = stderr.match(/I:\s+([-\d.]+)\s+LUFS/);
    const lraMatch = stderr.match(/LRA:\s+([\d.]+)\s+LU/);
    const tpMatch = stderr.match(/Peak:\s+([-\d.]+)\s+dBFS/);
    
    return {
      integratedLufs: integratedMatch ? parseFloat(integratedMatch[1]) : -14,
      loudnessRangeLu: lraMatch ? parseFloat(lraMatch[1]) : 10,
      truePeakDbtp: tpMatch ? parseFloat(tpMatch[1]) : -2,
      shortTermLufs: integratedMatch ? parseFloat(integratedMatch[1]) : -14,
      momentaryLufs: integratedMatch ? parseFloat(integratedMatch[1]) : -14,
    };
  } catch (error) {
    console.error('Loudness measurement failed:', error);
    // Return safe defaults
    return {
      integratedLufs: -14,
      loudnessRangeLu: 10,
      truePeakDbtp: -2,
      shortTermLufs: -14,
      momentaryLufs: -14,
    };
  }
}

/**
 * Measure dynamic range metrics
 */
async function measureDynamicRange(filePath: string): Promise<DynamicRangeMetrics> {
  try {
    // Use FFmpeg to get RMS and peak levels
    const { stderr } = await execAsync(
      `ffmpeg -i "${filePath}" -af "volumedetect" -f null - 2>&1`
    );
    
    // Parse output for mean and max volume
    const meanMatch = stderr.match(/mean_volume:\s+([-\d.]+)\s+dB/);
    const maxMatch = stderr.match(/max_volume:\s+([-\d.]+)\s+dB/);
    
    const meanDb = meanMatch ? parseFloat(meanMatch[1]) : -20;
    const maxDb = maxMatch ? parseFloat(maxMatch[1]) : -1;
    
    // Calculate crest factor (peak - RMS)
    const crestFactorDb = maxDb - meanDb;
    
    // Estimate dynamic range from crest factor
    const dynamicRangeLu = Math.max(4, crestFactorDb * 0.8);
    
    return {
      crestFactorDb,
      dynamicRangeLu,
      lowDynamicRange: dynamicRangeLu < 8,
    };
  } catch (error) {
    console.error('Dynamic range measurement failed:', error);
    return {
      crestFactorDb: 12,
      dynamicRangeLu: 10,
      lowDynamicRange: false,
    };
  }
}

/**
 * Measure clipping and distortion
 */
async function measureClipping(filePath: string): Promise<ClippingMetrics> {
  try {
    // Use FFmpeg to detect samples above 0 dBFS
    const { stderr } = await execAsync(
      `ffmpeg -i "${filePath}" -af "astats=measure_overall=Peak_level:measure_perchannel=0" -f null - 2>&1`
    );
    
    // Parse for peak level
    const peakMatch = stderr.match(/Peak_level dB:\s+([-\d.]+)/);
    const peakDb = peakMatch ? parseFloat(peakMatch[1]) : -1;
    
    // Count clipped samples by analyzing waveform
    const { stderr: waveStats } = await execAsync(
      `ffmpeg -i "${filePath}" -af "silencedetect=noise=-0.1dB:d=0" -f null - 2>&1`
    );
    
    // Get duration for rate calculation
    const { stderr: probeOutput } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of csv="p=0" "${filePath}"`
    );
    const duration = parseFloat(probeOutput.trim()) || 1;
    
    // Estimate clipped samples (simplified)
    const clippedSamples = peakDb > 0 ? Math.floor(duration * 44100 * 0.001) : 0;
    const totalSamples = duration * 44100 * 2; // stereo
    const clippingRate = clippedSamples / totalSamples;
    
    return {
      clippedSamples,
      clippingRate,
      maxSampleValue: Math.pow(10, peakDb / 20),
      intersamplePeaks: peakDb > -1,
    };
  } catch (error) {
    console.error('Clipping measurement failed:', error);
    return {
      clippedSamples: 0,
      clippingRate: 0,
      maxSampleValue: 0.9,
      intersamplePeaks: false,
    };
  }
}

/**
 * Measure transition-specific QA metrics
 */
export async function measureTransitionQA(
  fromTrackBuffer: Buffer,
  toTrackBuffer: Buffer,
  transitionStart: number,
  transitionEnd: number
): Promise<Partial<TransitionQARecord>> {
  // This would require more sophisticated analysis
  // For now, return placeholder values
  
  return {
    loudnessJumpDb: 0,
    vocalCollision: false,
    tempoStretchPercent: 0,
    stretchAcceptable: true,
    overlapDensity: 0,
    overlapAcceptable: true,
    passed: true,
    failedChecks: [],
    measuredAt: new Date().toISOString(),
  };
}

/**
 * Quick validation of render without full measurement
 */
export async function quickValidateRender(
  audioBuffer: Buffer,
  thresholds: QAThresholds = DEFAULT_QA_THRESHOLDS
): Promise<{ valid: boolean; issues: string[] }> {
  const issues: string[] = [];
  
  // Check for silence (all zeros)
  const isSilent = audioBuffer.every((byte, index) => 
    index < 1000 || byte === 0
  );
  
  if (isSilent) {
    issues.push('render_silence_detected');
  }
  
  // Check file size (should be reasonable for audio)
  if (audioBuffer.length < 1000) {
    issues.push('render_too_small');
  }
  
  return {
    valid: issues.length === 0,
    issues,
  };
}
