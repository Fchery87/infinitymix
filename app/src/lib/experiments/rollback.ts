/**
 * Rollback Service
 * 
 * Handles gradual and immediate rollbacks of experiments.
 * Monitors metrics during rollback and can abort if needed.
 */

import type { 
  Experiment, 
  RollbackRequest, 
  RollbackStatus,
  RollbackThresholds 
} from './types';
import { getVariantMetrics } from './telemetry';

// Active rollbacks
const activeRollbacks = new Map<string, RollbackStatus>();

/**
 * Initiate a rollback
 */
export async function initiateRollback(
  request: RollbackRequest
): Promise<RollbackStatus> {
  const { experimentId, gradual, durationMinutes } = request;
  
  // Check if rollback already in progress
  const existing = activeRollbacks.get(experimentId);
  if (existing && existing.status === 'in_progress') {
    return existing;
  }
  
  const status: RollbackStatus = {
    experimentId,
    status: 'pending',
    startedAt: new Date().toISOString(),
    currentTrafficShift: 0,
  };
  
  if (gradual) {
    status.status = 'in_progress';
    status.estimatedCompletionAt = new Date(
      Date.now() + durationMinutes * 60 * 1000
    ).toISOString();
    
    // Start gradual rollback
    executeGradualRollback(experimentId, durationMinutes);
  } else {
    // Immediate rollback
    status.status = 'completed';
    status.currentTrafficShift = 100;
    await executeImmediateRollback(experimentId);
  }
  
  activeRollbacks.set(experimentId, status);
  
  // Log rollback initiation
  console.log('Rollback initiated:', {
    experimentId,
    gradual,
    durationMinutes,
    reason: request.reason,
  });
  
  return status;
}

/**
 * Execute gradual rollback with traffic shifting
 */
async function executeGradualRollback(
  experimentId: string,
  durationMinutes: number
): Promise<void> {
  const steps = 10; // Number of steps
  const stepDurationMs = (durationMinutes * 60 * 1000) / steps;
  
  for (let i = 1; i <= steps; i++) {
    const shiftPercentage = (i / steps) * 100;
    
    // Update traffic allocation
    await shiftTraffic(experimentId, shiftPercentage);
    
    // Update status
    const status = activeRollbacks.get(experimentId);
    if (status) {
      status.currentTrafficShift = shiftPercentage;
    }
    
    // Check if we should abort (metrics improved)
    if (i > steps / 2) {
      const shouldAbort = await checkAbortConditions(experimentId);
      if (shouldAbort) {
        await abortRollback(experimentId, 'metrics_improved');
        return;
      }
    }
    
    // Wait before next step (except for last step)
    if (i < steps) {
      await sleep(stepDurationMs);
    }
  }
  
  // Mark as completed
  const status = activeRollbacks.get(experimentId);
  if (status) {
    status.status = 'completed';
    status.currentTrafficShift = 100;
  }
}

/**
 * Execute immediate rollback
 */
async function executeImmediateRollback(experimentId: string): Promise<void> {
  // Shift all traffic to control immediately
  await shiftTraffic(experimentId, 100);
  
  // Update experiment status
  await updateExperimentStatus(experimentId, 'rolled_back');
}

/**
 * Shift traffic from variants to control
 */
async function shiftTraffic(
  experimentId: string,
  controlPercentage: number
): Promise<void> {
  // In production, this would update the experiment configuration
  // to change traffic percentages in real-time
  console.log(`Shifting traffic for ${experimentId}: ${controlPercentage}% to control`);
  
  // Placeholder: would update database
  // await db.update(experiments)
  //   .set({ trafficAllocation: controlPercentage })
  //   .where(eq(experiments.id, experimentId));
}

/**
 * Check if rollback should be aborted
 */
async function checkAbortConditions(experimentId: string): Promise<boolean> {
  // Get current metrics
  const metrics = await getVariantMetrics(experimentId, 'control');
  
  // If error rate is back to normal, consider aborting
  // This is a simplified check - production would be more sophisticated
  const failureRate = metrics.eventCount > 0 ? metrics.failureCount / metrics.eventCount : 0;
  if (failureRate < 0.05) {
    return true;
  }
  
  return false;
}

/**
 * Abort an in-progress rollback
 */
export async function abortRollback(
  experimentId: string,
  reason: string
): Promise<void> {
  const status = activeRollbacks.get(experimentId);
  if (!status || status.status !== 'in_progress') {
    return;
  }
  
  status.status = 'aborted';
  status.abortReason = reason;
  
  // Restore original traffic allocation
  // In production, this would revert to the pre-rollback state
  console.log(`Rollback aborted for ${experimentId}: ${reason}`);
}

/**
 * Get rollback status
 */
export function getRollbackStatus(experimentId: string): RollbackStatus | undefined {
  return activeRollbacks.get(experimentId);
}

/**
 * Check if automatic rollback should be triggered
 */
export async function checkAutomaticRollback(
  experiment: Experiment,
  thresholds: RollbackThresholds
): Promise<{ shouldRollback: boolean; reason?: string }> {
  const controlMetrics = await getVariantMetrics(experiment.id, experiment.controlVariantId);
  
  // Check each variant against control
  for (const variant of experiment.variants) {
    if (variant.isControl) continue;
    
    const variantMetrics = await getVariantMetrics(experiment.id, variant.id);
    
    // Calculate failure rates
    const controlFailureRate = controlMetrics.eventCount > 0 
      ? controlMetrics.failureCount / controlMetrics.eventCount 
      : 0;
    const variantFailureRate = variantMetrics.eventCount > 0 
      ? variantMetrics.failureCount / variantMetrics.eventCount 
      : 0;
    
    // Check error rate increase
    if (controlFailureRate > 0) {
      const errorRateRatio = variantFailureRate / controlFailureRate;
      if (errorRateRatio > thresholds.maxErrorRateIncrease) {
        return {
          shouldRollback: true,
          reason: `Variant ${variant.name} has ${errorRateRatio.toFixed(1)}x the error rate of control`,
        };
      }
    } else if (variantFailureRate > 0.1) {
      // Control has no errors but variant has significant errors
      return {
        shouldRollback: true,
        reason: `Variant ${variant.name} has ${(variantFailureRate * 100).toFixed(1)}% error rate`,
      };
    }
    
    // Check latency increase
    const latencyIncrease = variantMetrics.averageDurationMs - controlMetrics.averageDurationMs;
    if (latencyIncrease > thresholds.maxLatencyIncreaseMs) {
      return {
        shouldRollback: true,
        reason: `Variant ${variant.name} is ${latencyIncrease}ms slower than control`,
      };
    }
  }
  
  return { shouldRollback: false };
}

/**
 * Update experiment status
 */
async function updateExperimentStatus(
  experimentId: string,
  status: string
): Promise<void> {
  // In production, update database
  console.log(`Updating experiment ${experimentId} status to: ${status}`);
  
  // Placeholder: would update database
  // await db.update(experiments)
  //   .set({ status })
  //   .where(eq(experiments.id, experimentId));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
