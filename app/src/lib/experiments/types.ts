/**
 * Experiment System Types
 * 
 * Type definitions for the controlled rollout and experimentation infrastructure.
 */

// ============================================================================
// Core Experiment Types
// ============================================================================

/**
 * Valid experiment domains
 */
export type ExperimentDomain = 
  | 'analysis'      // Analysis strategy changes
  | 'cue_point'     // Cue point detection strategy
  | 'planner'       // Sequence planning strategy
  | 'transition'    // Transition execution policy
  | 'render'        // Render quality settings
  | 'ui';           // UI/UX changes

/**
 * Experiment status lifecycle
 */
export type ExperimentStatus = 
  | 'draft'         // Being configured, not yet active
  | 'running'       // Active and collecting data
  | 'paused'        // Temporarily stopped
  | 'completed'     // Finished, results analyzed
  | 'rolled_back';  // Rolled back due to issues

/**
 * A variant within an experiment
 */
export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;                    // e.g., 'control', 'candidate-v1'
  description?: string;
  codePath: string;               // Identifier for code branch (e.g., 'planner-v2')
  trafficPercentage: number;      // 0-100
  configOverrides: Record<string, unknown>;  // Config changes for this variant
  isControl: boolean;             // Is this the control variant?
  createdAt: string;
}

/**
 * Experiment definition
 */
export interface Experiment {
  id: string;
  name: string;                   // Unique identifier (e.g., 'planner-2026-03-v2')
  domain: ExperimentDomain;
  description: string;
  hypothesis: string;             // What we're testing
  
  // Lifecycle
  status: ExperimentStatus;
  startDate: string;
  endDate?: string;
  
  // Traffic allocation
  trafficAllocation: number;      // Overall % of users in experiment (0-100)
  
  // Variants
  variants: ExperimentVariant[];
  controlVariantId: string;
  
  // Rollback settings
  autoRollbackEnabled: boolean;
  rollbackThresholds?: RollbackThresholds;
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/**
 * Thresholds for automatic rollback
 */
export interface RollbackThresholds {
  maxErrorRateIncrease: number;        // 2.0 = 2x error rate
  maxLatencyIncreaseMs: number;        // e.g., 5000ms
  minSatisfactionScore: number;        // 0-1 scale
  maxQaFailureRate: number;            // 0-1 scale
}

// ============================================================================
// Assignment Types
// ============================================================================

/**
 * User assignment to a variant
 */
export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  userId: string;
  variantId: string;
  assignedAt: string;
  
  // Context at assignment time
  context: {
    userAgent?: string;
    ipHash?: string;            // Hashed for privacy
    sessionId?: string;
    timestamp: string;
  };
}

/**
 * Result of variant assignment
 */
export interface AssignmentResult {
  experimentId: string;
  variantId: string;
  variantName: string;
  codePath: string;
  config: Record<string, unknown>;
  isFirstAssignment: boolean;   // Is this a new assignment?
}

// ============================================================================
// Telemetry Types
// ============================================================================

/**
 * Types of telemetry events
 */
export type TelemetryEventType =
  | 'assignment_created'      // User assigned to variant
  | 'feature_invoked'         // Feature used (e.g., plan created)
  | 'feature_completed'       // Feature completed successfully
  | 'feature_failed'          // Feature failed
  | 'user_feedback'           // Explicit user feedback
  | 'qa_result'               // QA measurement
  | 'export_completed'        // User exported/downloaded
  | 'regeneration_requested'; // User asked for new plan

/**
 * Base telemetry event
 */
export interface TelemetryEvent {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  eventType: TelemetryEventType;
  eventData: Record<string, unknown>;
  metadata: {
    userAgent: string;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * User feedback captured
 */
export interface UserFeedback {
  id: string;
  experimentId: string;
  variantId: string;
  userId: string;
  mashupId?: string;
  
  // Feedback data
  rating?: number;              // 1-5 star rating
  wouldRecommend?: boolean;     // NPS-style
  feedbackText?: string;        // Free text
  
  // Derived metrics
  previewListened: boolean;     // Did user preview?
  downloadCompleted: boolean;   // Did user download?
  replayCount: number;          // How many replays?
  
  // Technical context
  planQualityScore?: number;
  qaOutcome?: 'passed' | 'failed' | 'retry';
  
  createdAt: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Metrics for a variant
 */
export interface VariantMetrics {
  variantId: string;
  variantName: string;
  
  // Sample size
  sampleSize: number;
  
  // Key metrics
  metrics: {
    successRate: number;
    errorRate: number;
    averageLatencyMs: number;
    userSatisfaction: number;
    qaPassRate: number;
    regenerationRate: number;
    exportRate: number;
    [key: string]: number;
  };
  
  // Confidence intervals (95%)
  confidenceIntervals: Record<string, [number, number]>;
}

/**
 * Comparison between variants
 */
export interface VariantComparison {
  isSignificant: boolean;           // Statistical significance
  pValue?: number;                  // Statistical p-value
  winnerVariantId?: string;         // Winning variant (if significant)
  improvement?: number;             // % improvement over control
  recommendation: 'promote' | 'rollback' | 'continue' | 'inconclusive';
  reasoning: string;
}

/**
 * Experiment analysis result
 */
export interface ExperimentAnalysis {
  experiment: Experiment;
  variantMetrics: VariantMetrics[];
  comparison: VariantComparison;
  generatedAt: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Experiment configuration for a domain
 */
export interface DomainExperimentConfig {
  enabled: boolean;
  currentExperimentId?: string;
  defaultVariant?: string;
}

/**
 * Global experiments configuration
 */
export interface ExperimentsConfig {
  enabled: boolean;
  salt: string;                     // For stable hashing
  domains: Record<ExperimentDomain, DomainExperimentConfig>;
  globalTrafficPercentage: number;  // % of users eligible for experiments
}

// ============================================================================
// Rollback Types
// ============================================================================

/**
 * Rollback request
 */
export interface RollbackRequest {
  experimentId: string;
  reason: string;
  gradual: boolean;
  durationMinutes: number;
  triggeredBy: 'auto' | 'manual';
  triggeredByUserId?: string;
}

/**
 * Rollback status
 */
export interface RollbackStatus {
  experimentId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'aborted';
  startedAt: string;
  estimatedCompletionAt?: string;
  currentTrafficShift: number;      // 0-100 (100 = all on control)
  abortReason?: string;
}
