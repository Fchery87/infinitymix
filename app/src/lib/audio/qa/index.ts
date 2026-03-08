/**
 * Quality Assurance Module
 * 
 * Comprehensive QA system for render quality enforcement
 * and corrective loop implementation.
 */

// Types
export type {
  RenderQAMetrics,
  LoudnessMetrics,
  DynamicRangeMetrics,
  ClippingMetrics,
  TransitionQARecord,
  SpectralClashMetrics,
  TransitionTimingMetrics,
  QAThresholds,
  RetryPolicy,
  CorrectionStrategy,
  RetryableFailureType,
  AutomationQAResults,
  QADatabaseRecord,
  OutputProfile,
  FixtureSignoffCheck,
} from '@/lib/audio/types/qa';

// Constants
export {
  DEFAULT_QA_THRESHOLDS,
  DEFAULT_RETRY_POLICY,
  OUTPUT_PROFILES,
} from '@/lib/audio/types/qa';

// Measurement service
export {
  measureRenderQA,
  measureTransitionQA,
  quickValidateRender,
} from './measurement-service';

// Retry policy
export {
  evaluateRenderQA,
  evaluateTransitionQA,
  applyCorrection,
  generateRetryRecommendation,
  meetsMinimumStandards,
  createQASummary,
} from './retry-policy';

export type { QAAction } from './retry-policy';

// Persistence
export {
  createQARecord,
  updateQARecordRetry,
  reviewQARecord,
  getQARecord,
  getQARecordsForMashup,
  getQAStatistics,
  getRecentQAFailures,
} from './persistence';
