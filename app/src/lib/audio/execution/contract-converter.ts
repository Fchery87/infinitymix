/**
 * Contract Converter Service
 * 
 * Converts Phase 3 planner output (PlannedTransition) to Phase 4
 * TransitionExecutionContract for use by both preview and render.
 */

import type {
  PlannedTransition,
  TrackRole,
} from '@/lib/audio/types/planner';
import type {
  TransitionExecutionContract,
  TransitionRole,
  TempoRampStrategy,
  EqIntent,
} from '@/lib/audio/types/transition';

/**
 * Convert a PlannedTransition to a TransitionExecutionContract
 * 
 * This is the bridge between the planner's output and the execution layer.
 * Both preview and render should use contracts produced by this function
 * to ensure consistency.
 */
export function convertPlannedTransitionToContract(
  planned: PlannedTransition
): TransitionExecutionContract {
  // Map track roles from planner to execution roles
  const trackARole = mapTrackRoleToExecutionRole(planned.fromRole);
  const trackBRole = mapTrackRoleToExecutionRole(planned.toRole);
  
  // Map tempo ramp strategy
  const tempoRampStrategy = mapTempoRampStrategy(planned.tempoRampStrategy);
  
  // Build EQ intents based on transition style and roles
  const { trackAEqIntent, trackBEqIntent } = buildEqIntents(
    planned.transitionStyle,
    planned.fromRole,
    planned.toRole
  );
  
  return {
    trackAId: planned.fromTrackId,
    trackBId: planned.toTrackId,
    trackARole,
    trackBRole,
    mixOutCueSeconds: planned.fromExitCueSeconds,
    mixInCueSeconds: planned.toEntryCueSeconds,
    overlapDurationSeconds: planned.overlapDurationSeconds,
    tempoRampStrategy,
    targetBpm: planned.targetBpm ?? undefined,
    trackAEqIntent,
    trackBEqIntent,
    transitionStyle: planned.transitionStyle,
  };
}

/**
 * Convert multiple planned transitions to contracts
 */
export function convertPlannedTransitionsToContracts(
  plannedTransitions: PlannedTransition[]
): TransitionExecutionContract[] {
  return plannedTransitions.map(convertPlannedTransitionToContract);
}

/**
 * Map planner track roles to execution transition roles
 */
function mapTrackRoleToExecutionRole(role: TrackRole): TransitionRole {
  switch (role) {
    case 'lead-vocal':
      return 'stem-vocal';
    case 'lead-instrumental':
      return 'stem-instrumental';
    case 'support-vocal':
      return 'stem-vocal';
    case 'support-instrumental':
      return 'stem-instrumental';
    case 'transition-bridge':
      return 'trackA'; // Default for bridge elements
    case 'full-mix':
    default:
      return 'trackA';
  }
}

/**
 * Map tempo ramp strategy strings to enum values
 */
function mapTempoRampStrategy(strategy: string): TempoRampStrategy {
  switch (strategy) {
    case 'linear':
      return 'linear';
    case 'exponential':
      return 'exponential';
    case 'none':
    default:
      return 'none';
  }
}

/**
 * Build EQ intents based on transition style and track roles
 * 
 * This is where we encode the "preview-only" vs "render-authoritative"
 * behavior. The EQ intents here are hints that both preview and render
 * should respect, but render has final authority.
 */
function buildEqIntents(
  transitionStyle: string,
  fromRole: TrackRole,
  toRole: TrackRole
): { trackAEqIntent?: EqIntent; trackBEqIntent?: EqIntent } {
  const trackAEqIntent: EqIntent = {};
  const trackBEqIntent: EqIntent = {};
  
  switch (transitionStyle) {
    case 'bass-drop':
    case 'drop':
      // Low-pass sweep on track A leading to drop
      trackAEqIntent.lowPassHz = 200;
      trackAEqIntent.fadeDurationSeconds = 2;
      break;
      
    case 'filter_sweep':
      // Band-limited sweep
      trackAEqIntent.highPassHz = 250;
      trackBEqIntent.highPassHz = 250;
      break;
      
    case 'vocal-handoff':
      // If track A is vocal, reduce it; if track B is vocal, prepare it
      if (fromRole === 'lead-vocal') {
        trackAEqIntent.lowPassHz = 800;
      }
      if (toRole === 'lead-vocal') {
        trackBEqIntent.highPassHz = 800;
      }
      break;
      
    case 'energy':
    case 'snare_roll':
      // Energy transitions may have slight EQ changes
      trackAEqIntent.highPassHz = 100;
      break;
      
    case 'echo_out':
    case 'echo-reverb':
      // Echo/reverb transitions often involve low-end reduction
      trackAEqIntent.highPassHz = 150;
      break;
      
    default:
      // Default: no specific EQ intents
      break;
  }
  
  return {
    ...(Object.keys(trackAEqIntent).length > 0 && { trackAEqIntent }),
    ...(Object.keys(trackBEqIntent).length > 0 && { trackBEqIntent }),
  };
}

/**
 * Validate that a contract is complete and usable
 */
export function validateTransitionContract(
  contract: TransitionExecutionContract
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!contract.trackAId) {
    errors.push('trackAId is required');
  }
  
  if (!contract.trackBId) {
    errors.push('trackBId is required');
  }
  
  if (contract.mixOutCueSeconds === undefined || contract.mixOutCueSeconds < 0) {
    errors.push('mixOutCueSeconds must be non-negative');
  }
  
  if (contract.mixInCueSeconds === undefined || contract.mixInCueSeconds < 0) {
    errors.push('mixInCueSeconds must be non-negative');
  }
  
  if (contract.overlapDurationSeconds <= 0) {
    errors.push('overlapDurationSeconds must be positive');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a contract for a specific transition in a plan
 * 
 * This is a convenience function for when you have a plan ID
 * and want to get the contract for a specific transition.
 */
export async function getContractForTransition(
  planId: string,
  transitionIndex: number
): Promise<TransitionExecutionContract | null> {
  // This would fetch the plan from the database and extract
  // the specific transition contract. Implementation depends
  // on how plans are stored.
  
  // For now, this is a placeholder that would be implemented
  // once we have plan persistence.
  throw new Error('Not implemented: Plan persistence required');
}
