/**
 * Experiments Module
 * 
 * Controlled rollout and experimentation infrastructure.
 */

// Types
export type {
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentDomain,
  ExperimentStatus,
  AssignmentResult,
  TelemetryEvent,
  TelemetryEventType,
  UserFeedback,
  VariantMetrics,
  VariantComparison,
  ExperimentAnalysis,
  RollbackRequest,
  RollbackStatus,
  RollbackThresholds,
} from './types';

// Assignment
export {
  assignVariant,
  getOrCreateAssignment,
  getVariantForDomain,
  isUserInVariant,
  registerExperiment,
  getExperiment,
  getActiveExperimentsForDomain,
} from './assignment';

// Telemetry
export {
  captureEvent,
  captureFeedback,
  recordFeatureInvoked,
  recordFeatureCompleted,
  recordFeatureFailed,
  recordQAResult,
  recordExportCompleted,
  recordRegenerationRequested,
  flushTelemetry,
  flushFeedback,
  getVariantMetrics,
} from './telemetry';

// Rollback
export {
  initiateRollback,
  abortRollback,
  getRollbackStatus,
  checkAutomaticRollback,
} from './rollback';
