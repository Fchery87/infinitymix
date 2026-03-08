/**
 * Sequence Planner Module
 * 
 * Export all planner functionality for sequence planning and compatibility scoring.
 */

// Types
export type * from '@/lib/audio/types/planner';

// Main planner
export { planSequence } from './sequence-planner';

// Graph building
export {
  buildPlanningGraph,
  getCompatibility,
  getOutboundCompatibilities,
  getInboundCompatibilities,
} from './planning-graph-builder';

// Compatibility scoring
export { calculateAsymmetricCompatibility } from './compatibility-scorer';

// Track analysis
export {
  calculateEnergyProfile,
  calculateVocalDominance,
  getBestCuePoint,
  getEnergyAtTime,
} from './track-analyzer';

// Policy rules
export {
  getDefaultPolicy,
  getPolicyForArchetype,
  validateEnergyArc,
  isTransitionAllowed,
} from './policy-rules';

// Trace persistence
export {
  persistPlannerTrace,
  updatePlannerTraceQuality,
  getPlannerTracesForUser,
  getPlannerStatistics,
} from './trace-persistence';
