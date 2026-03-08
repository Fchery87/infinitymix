import type { RenderQAMetrics } from './types/qa';

export type RenderFailureReason = 
  | 'LoudnessOvershoot'
  | 'Clipping'
  | 'TooAggressiveStretch'
  | 'PoorStemQuality'
  | 'Unknown';

export interface RenderCorrectionAction {
  action: 'retry_with_new_params' | 'fallback_transition' | 'fail';
  reason: RenderFailureReason;
  newNormalizerTarget?: number;
  message?: string;
}

/**
 * Evaluates the actual measured audio metrics against target profiles.
 * Returns a RenderCorrectionAction if the render fails QA and must be retried or failed.
 * Returns null if the render passes QA.
 */
export function evaluateRenderQA(
  metrics: RenderQAMetrics,
  targetLoudness: number = -14 // Standard platform target, e.g. Spotify
): RenderCorrectionAction | null {
  // 1. Check for clipping or high true peak
  // Standard platforms recommend -1 or -2 dBTP max. We fail if >= -0.5
  if (metrics.truePeak !== undefined && metrics.truePeak >= -0.5) {
    return {
      action: 'fail',
      reason: 'Clipping',
      message: `True peak too high: ${metrics.truePeak.toFixed(2)} dBTP`,
    };
  }

  if (metrics.clippingIncidence !== undefined && metrics.clippingIncidence > 0) {
    return {
      action: 'fail',
      reason: 'Clipping',
      message: `Hard clipping detected: ${metrics.clippingIncidence} incidents`,
    };
  }

  // 2. Check for loudness compliance
  if (metrics.integratedLoudness !== undefined) {
    const errorLU = metrics.integratedLoudness - targetLoudness;
    
    // If output is more than 1.5 LU off from our target, flag it for retry
    if (Math.abs(errorLU) > 1.5) {
      return {
        action: 'retry_with_new_params',
        reason: 'LoudnessOvershoot',
        newNormalizerTarget: targetLoudness - errorLU,
        message: `Loudness deviation: ${errorLU.toFixed(2)} LU`,
      };
    }
  }

  // 3. Dynamic range checks
  if (metrics.dynamicRangeWarning) {
    return {
      action: 'fail', // or could trigger an alternative master compression route
      reason: 'TooAggressiveStretch', 
      message: 'Dynamic range warning limits breached',
    };
  }

  // Success
  return null;
}
