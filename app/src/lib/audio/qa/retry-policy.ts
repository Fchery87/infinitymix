/**
 * Retry and Correction Policy Engine
 * 
 * Determines when to retry renders and applies correction strategies.
 * Implements bounded retry logic with escalation to manual review.
 */

import type {
  RenderQAMetrics,
  TransitionQARecord,
  RetryPolicy,
  CorrectionStrategy,
  RetryableFailureType,
  QAThresholds,
} from '@/lib/audio/types/qa';
import { DEFAULT_RETRY_POLICY, DEFAULT_QA_THRESHOLDS } from '@/lib/audio/types/qa';

export type QAAction =
  | { action: 'pass'; reason?: string }
  | { action: 'fail'; reason: string; message?: string }
  | { action: 'retry_with_new_params'; reason: string; message?: string; strategy: CorrectionStrategy }
  | { action: 'escalate_to_manual'; reason: string; message?: string };

/**
 * Evaluate QA results and determine next action
 */
export function evaluateRenderQA(
  metrics: RenderQAMetrics,
  retryCount: number = 0,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): QAAction {
  // If already passed, no action needed
  if (metrics.passed) {
    return { action: 'pass' };
  }
  
  // Check if we've exceeded max retries
  if (retryCount >= policy.maxRetries) {
    if (policy.escalateToManual) {
      return {
        action: 'escalate_to_manual',
        reason: 'max_retries_exceeded',
        message: `Failed after ${retryCount} retry attempts`,
      };
    }
    return {
      action: 'fail',
      reason: 'max_retries_exceeded',
      message: `Failed after ${retryCount} retry attempts`,
    };
  }
  
  // Analyze failures and determine if retryable
  const failureTypes = identifyFailureTypes(metrics);
  
  // Check if any failures are retryable
  const retryableFailures = failureTypes.filter(f => policy.retryOn[f]);
  
  if (retryableFailures.length === 0) {
    // No retryable failures - hard fail
    return {
      action: 'fail',
      reason: 'non_retryable_failures',
      message: `Unrecoverable QA failures: ${metrics.failedChecks.join(', ')}`,
    };
  }
  
  // Get the primary failure (most severe)
  const primaryFailure = retryableFailures[0];
  const strategy = policy.correctionStrategies[primaryFailure];
  
  if (!strategy) {
    return {
      action: 'fail',
      reason: 'no_correction_strategy',
      message: `No correction strategy for: ${primaryFailure}`,
    };
  }
  
  if (!strategy.automatic) {
    // Requires manual intervention
    if (policy.escalateToManual) {
      return {
        action: 'escalate_to_manual',
        reason: primaryFailure,
        message: `${strategy.description} requires manual intervention`,
      };
    }
    return {
      action: 'fail',
      reason: primaryFailure,
      message: `${strategy.description} requires manual intervention`,
    };
  }
  
  // Return retry action with correction strategy
  return {
    action: 'retry_with_new_params',
    reason: primaryFailure,
    message: `Applying correction: ${strategy.description}`,
    strategy,
  };
}

/**
 * Identify types of failures from QA metrics
 */
function identifyFailureTypes(metrics: RenderQAMetrics): RetryableFailureType[] {
  const failures: RetryableFailureType[] = [];
  
  // Check loudness
  if (metrics.failedChecks.some(c => c.includes('loudness'))) {
    if (metrics.loudness.integratedLufs > -10) {
      failures.push('loudness_overshoot');
    }
  }
  
  // Check clipping
  if (metrics.failedChecks.some(c => c.includes('clipping'))) {
    failures.push('clipping_detected');
  }
  
  // Check dynamic range (might indicate over-compression)
  if (metrics.failedChecks.some(c => c.includes('dynamic_range'))) {
    failures.push('overlap_too_dense');
  }
  
  return failures;
}

/**
 * Evaluate transition QA and determine if retry needed
 */
export function evaluateTransitionQA(
  transition: TransitionQARecord,
  retryCount: number = 0,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): QAAction {
  if (transition.passed) {
    return { action: 'pass' };
  }
  
  if (retryCount >= policy.maxRetries) {
    return {
      action: 'fail',
      reason: 'max_retries_exceeded',
      message: `Transition failed after ${retryCount} attempts`,
    };
  }
  
  // Identify transition-specific failures
  const failures: RetryableFailureType[] = [];
  
  if (transition.vocalCollision && transition.vocalCollisionSeverity && transition.vocalCollisionSeverity > 0.6) {
    failures.push('vocal_collision_severe');
  }
  
  if (!transition.stretchAcceptable) {
    failures.push('stretch_too_aggressive');
  }
  
  if (!transition.overlapAcceptable) {
    failures.push('overlap_too_dense');
  }
  
  if (transition.spectralClash && transition.spectralClash.clashSeverity > 0.7) {
    failures.push('spectral_clash_severe');
  }
  
  const retryableFailures = failures.filter(f => policy.retryOn[f]);
  
  if (retryableFailures.length === 0) {
    return {
      action: 'fail',
      reason: 'non_retryable_transition_failures',
      message: `Transition has unrecoverable failures`,
    };
  }
  
  const primaryFailure = retryableFailures[0];
  const strategy = policy.correctionStrategies[primaryFailure];
  
  if (!strategy || !strategy.automatic) {
    return {
      action: 'fail',
      reason: primaryFailure,
      message: strategy?.description || 'No correction available',
    };
  }
  
  return {
    action: 'retry_with_new_params',
    reason: primaryFailure,
    message: `Correcting transition: ${strategy.description}`,
    strategy,
  };
}

/**
 * Apply correction strategy to render parameters
 */
export function applyCorrection(
  currentParams: Record<string, unknown>,
  strategy: CorrectionStrategy
): Record<string, unknown> {
  return {
    ...currentParams,
    ...strategy.parameterAdjustments,
    _correctionApplied: strategy.failureType,
    _correctionDescription: strategy.description,
  };
}

/**
 * Generate retry recommendation with specific parameter changes
 */
export function generateRetryRecommendation(
  qaMetrics: RenderQAMetrics,
  previousAttempts: number
): {
  shouldRetry: boolean;
  recommendedChanges: string[];
  confidence: 'high' | 'medium' | 'low';
} {
  const recommendations: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // Loudness issues
  if (qaMetrics.failedChecks.some(c => c.includes('loudness'))) {
    const diff = qaMetrics.loudness.integratedLufs - DEFAULT_QA_THRESHOLDS.targetIntegratedLufs;
    if (diff > 0) {
      recommendations.push(`Reduce master gain by ${diff.toFixed(1)} dB`);
    } else {
      recommendations.push(`Increase master gain by ${Math.abs(diff).toFixed(1)} dB`);
    }
  }
  
  // Clipping issues
  if (qaMetrics.failedChecks.some(c => c.includes('clipping'))) {
    recommendations.push('Apply soft limiting and reduce peak levels');
    confidence = previousAttempts > 1 ? 'medium' : 'high';
  }
  
  // Dynamic range issues
  if (qaMetrics.failedChecks.some(c => c.includes('dynamic_range'))) {
    recommendations.push('Reduce compression ratio or increase threshold');
    confidence = 'medium';
  }
  
  return {
    shouldRetry: recommendations.length > 0 && previousAttempts < 3,
    recommendedChanges: recommendations,
    confidence,
  };
}

/**
 * Check if QA results meet minimum standards (even if not perfect)
 */
export function meetsMinimumStandards(
  metrics: RenderQAMetrics,
  thresholds: QAThresholds = DEFAULT_QA_THRESHOLDS
): { meetsStandards: boolean; criticalIssues: string[] } {
  const criticalIssues: string[] = [];
  
  // Critical: No severe clipping
  if (metrics.clipping.clippingRate > 0.01) {
    criticalIssues.push('severe_clipping');
  }
  
  // Critical: Not completely silent
  if (metrics.loudness.integratedLufs < -70) {
    criticalIssues.push('near_silence');
  }
  
  // Critical: True peak not dangerously high
  if (metrics.loudness.truePeakDbtp > 0) {
    criticalIssues.push('dangerous_peaks');
  }
  
  return {
    meetsStandards: criticalIssues.length === 0,
    criticalIssues,
  };
}

/**
 * Create summary of QA results for display/logging
 */
export function createQASummary(
  metrics: RenderQAMetrics,
  transitions: TransitionQARecord[]
): {
  overall: 'pass' | 'fail' | 'warning';
  summary: string;
  details: string[];
} {
  const details: string[] = [];
  
  // Mix metrics
  details.push(`Loudness: ${metrics.loudness.integratedLufs.toFixed(1)} LUFS`);
  details.push(`True Peak: ${metrics.loudness.truePeakDbtp.toFixed(2)} dBTP`);
  details.push(`Dynamic Range: ${metrics.dynamicRange.dynamicRangeLu.toFixed(1)} LU`);
  
  if (metrics.clipping.clippedSamples > 0) {
    details.push(`Clipping: ${metrics.clipping.clippedSamples} samples`);
  }
  
  // Transition metrics
  const failedTransitions = transitions.filter(t => !t.passed);
  if (failedTransitions.length > 0) {
    details.push(`${failedTransitions.length}/${transitions.length} transitions failed QA`);
  }
  
  let overall: 'pass' | 'fail' | 'warning';
  let summary: string;
  
  if (metrics.passed && failedTransitions.length === 0) {
    overall = 'pass';
    summary = 'All QA checks passed';
  } else if (failedTransitions.length > 0 || metrics.failedChecks.length > 2) {
    overall = 'fail';
    summary = `QA failed: ${metrics.failedChecks.length} issues`;
  } else {
    overall = 'warning';
    summary = `QA passed with ${metrics.failedChecks.length} warnings`;
  }
  
  return { overall, summary, details };
}
