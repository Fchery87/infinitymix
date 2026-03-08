/**
 * Render Quality Assurance Types
 * 
 * Comprehensive type definitions for render QA metrics,
 * transition-level QA, and retry/correction policies.
 */

// ============================================================================
// Core QA Metrics
// ============================================================================

/**
 * Loudness metrics per EBU R128 / ITU-R BS.1770-4
 */
export interface LoudnessMetrics {
  /** Integrated loudness in LUFS (-23 LUFS is broadcast standard) */
  integratedLufs: number;
  
  /** Loudness range in LU (difference between 10th and 95th percentiles) */
  loudnessRangeLu: number;
  
  /** Maximum true peak in dBTP (should be < -1.0 dBTP) */
  truePeakDbtp: number;
  
  /** Short-term loudness (3s window) */
  shortTermLufs: number;
  
  /** Momentary loudness (400ms window) */
  momentaryLufs: number;
}

/**
 * Dynamic range and crest factor metrics
 */
export interface DynamicRangeMetrics {
  /** Crest factor in dB (peak to RMS ratio) */
  crestFactorDb: number;
  
  /** Dynamic range in LU */
  dynamicRangeLu: number;
  
  /** Low dynamic range warning (if DR < 8 LU) */
  lowDynamicRange: boolean;
}

/**
 * Clipping and distortion metrics
 */
export interface ClippingMetrics {
  /** Number of clipped samples */
  clippedSamples: number;
  
  /** Clipping rate (clipped samples / total samples) */
  clippingRate: number;
  
  /** Maximum sample value (> 1.0 indicates clipping) */
  maxSampleValue: number;
  
  /** Inter-sample peaks detected */
  intersamplePeaks: boolean;
}

/**
 * Complete render QA metrics for a mix
 */
export interface RenderQAMetrics {
  /** Loudness metrics */
  loudness: LoudnessMetrics;
  
  /** Dynamic range metrics */
  dynamicRange: DynamicRangeMetrics;
  
  /** Clipping metrics */
  clipping: ClippingMetrics;
  
  /** Overall pass/fail status */
  passed: boolean;
  
  /** List of failed checks */
  failedChecks: string[];
  
  /** Timestamp of measurement */
  measuredAt: string;
  
  /** Duration of measurement process in ms */
  measurementDurationMs: number;
}

// ============================================================================
// Transition-Level QA
// ============================================================================

/**
 * Spectral clash analysis between two tracks
 */
export interface SpectralClashMetrics {
  /** Overall clash severity (0-1, where 1 = severe clash) */
  clashSeverity: number;
  
  /** Frequency bands with clashes */
  clashingBands: Array<{
    /** Center frequency in Hz */
    frequencyHz: number;
    /** Severity in this band (0-1) */
    severity: number;
    /** Description of the clash */
    description: string;
  }>;
  
  /** Masking analysis - which track is dominant */
  dominantTrackId: string | null;
}

/**
 * Transition timing and alignment QA
 */
export interface TransitionTimingMetrics {
  /** Beat alignment error in ms */
  beatAlignmentErrorMs: number;
  
  /** Downbeat alignment error in ms */
  downbeatAlignmentErrorMs: number;
  
  /** Phrase boundary alignment error */
  phraseAlignmentErrorMs: number;
  
  /** Whether transition is phrase-aligned */
  phraseAligned: boolean;
}

/**
 * QA metrics for a specific transition
 */
export interface TransitionQARecord {
  /** Unique identifier */
  id: string;
  
  /** Source track ID */
  fromTrackId: string;
  
  /** Target track ID */
  toTrackId: string;
  
  /** Transition index in sequence */
  transitionIndex: number;
  
  /** Spectral clash analysis */
  spectralClash?: SpectralClashMetrics;
  
  /** Loudness jump between tracks */
  loudnessJumpDb: number;
  
  /** Timing and alignment */
  timing?: TransitionTimingMetrics;
  
  /** Vocal collision detected */
  vocalCollision: boolean;
  
  /** Vocal collision severity (0-1) */
  vocalCollisionSeverity?: number;
  
  /** Tempo stretch applied */
  tempoStretchPercent: number;
  
  /** Whether stretch is within acceptable limits */
  stretchAcceptable: boolean;
  
  /** Transition density (overlap duration / track length) */
  overlapDensity: number;
  
  /** Whether overlap is acceptable */
  overlapAcceptable: boolean;
  
  /** Overall pass/fail */
  passed: boolean;
  
  /** Failed checks */
  failedChecks: string[];
  
  /** Timestamp */
  measuredAt: string;
}

// ============================================================================
// QA Rules and Thresholds
// ============================================================================

/**
 * QA threshold configuration
 */
export interface QAThresholds {
  /** Target integrated loudness in LUFS */
  targetIntegratedLufs: number;
  
  /** Acceptable loudness tolerance in LUFS */
  loudnessToleranceLufs: number;
  
  /** Maximum true peak in dBTP */
  maxTruePeakDbtp: number;
  
  /** Minimum acceptable dynamic range in LU */
  minDynamicRangeLu: number;
  
  /** Maximum acceptable clipping rate */
  maxClippingRate: number;
  
  /** Maximum loudness jump between transitions in dB */
  maxLoudnessJumpDb: number;
  
  /** Maximum spectral clash severity */
  maxSpectralClashSeverity: number;
  
  /** Maximum vocal collision severity */
  maxVocalCollisionSeverity: number;
  
  /** Maximum acceptable tempo stretch percent */
  maxTempoStretchPercent: number;
  
  /** Maximum acceptable overlap density */
  maxOverlapDensity: number;
  
  /** Maximum beat alignment error in ms */
  maxBeatAlignmentErrorMs: number;
}

/**
 * Default QA thresholds (broadcast-quality standards)
 */
export const DEFAULT_QA_THRESHOLDS: QAThresholds = {
  targetIntegratedLufs: -14, // Spotify standard
  loudnessToleranceLufs: 1.0,
  maxTruePeakDbtp: -1.0,
  minDynamicRangeLu: 8,
  maxClippingRate: 0.001, // 0.1%
  maxLoudnessJumpDb: 3,
  maxSpectralClashSeverity: 0.7,
  maxVocalCollisionSeverity: 0.6,
  maxTempoStretchPercent: 8,
  maxOverlapDensity: 0.3,
  maxBeatAlignmentErrorMs: 50,
};

// ============================================================================
// Retry and Correction Policies
// ============================================================================

/**
 * Types of QA failures that can trigger retry
 */
export type RetryableFailureType =
  | 'loudness_overshoot'
  | 'clipping_detected'
  | 'overlap_too_dense'
  | 'vocal_collision_severe'
  | 'stretch_too_aggressive'
  | 'poor_stem_quality'
  | 'spectral_clash_severe';

/**
 * Correction strategy for a specific failure
 */
export interface CorrectionStrategy {
  /** Type of failure this corrects */
  failureType: RetryableFailureType;
  
  /** Human-readable description */
  description: string;
  
  /** Parameters to adjust */
  parameterAdjustments: Record<string, number | string | boolean>;
  
  /** Whether this is an automatic or manual correction */
  automatic: boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Whether to retry on each failure type */
  retryOn: Record<RetryableFailureType, boolean>;
  
  /** Correction strategies for each failure type */
  correctionStrategies: Record<RetryableFailureType, CorrectionStrategy>;
  
  /** Backoff strategy between retries */
  backoffMs: number;
  
  /** Whether to escalate to manual review after max retries */
  escalateToManual: boolean;
}

/**
 * Default retry policy
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  retryOn: {
    loudness_overshoot: true,
    clipping_detected: true,
    overlap_too_dense: true,
    vocal_collision_severe: true,
    stretch_too_aggressive: true,
    poor_stem_quality: false, // Requires manual intervention
    spectral_clash_severe: false, // Requires manual intervention
  },
  correctionStrategies: {
    loudness_overshoot: {
      failureType: 'loudness_overshoot',
      description: 'Reduce master limiter threshold',
      parameterAdjustments: { limiterThreshold: -1.0 },
      automatic: true,
    },
    clipping_detected: {
      failureType: 'clipping_detected',
      description: 'Reduce gain and apply soft limiting',
      parameterAdjustments: { outputGain: -2.0, softLimit: true },
      automatic: true,
    },
    overlap_too_dense: {
      failureType: 'overlap_too_dense',
      description: 'Reduce overlap duration',
      parameterAdjustments: { overlapReductionPercent: 20 },
      automatic: true,
    },
    vocal_collision_severe: {
      failureType: 'vocal_collision_severe',
      description: 'Adjust mix balance or use stems',
      parameterAdjustments: { vocalDuckDb: -3.0 },
      automatic: true,
    },
    stretch_too_aggressive: {
      failureType: 'stretch_too_aggressive',
      description: 'Reduce tempo stretch or reject transition',
      parameterAdjustments: { maxStretchPercent: 6 },
      automatic: false, // May need manual track selection
    },
    poor_stem_quality: {
      failureType: 'poor_stem_quality',
      description: 'Use full mix instead of stems',
      parameterAdjustments: { useStems: false },
      automatic: true,
    },
    spectral_clash_severe: {
      failureType: 'spectral_clash_severe',
      description: 'Apply EQ to reduce clash frequencies',
      parameterAdjustments: { applyClashEq: true },
      automatic: true,
    },
  },
  backoffMs: 1000,
  escalateToManual: true,
};

// ============================================================================
// Complete QA Results
// ============================================================================

/**
 * Complete QA results for a render operation
 */
export interface AutomationQAResults {
  /** Render/mix level metrics */
  mixMetrics: RenderQAMetrics;
  
  /** Per-transition QA records */
  transitions: TransitionQARecord[];
  
  /** Overall pass/fail */
  passed: boolean;
  
  /** Rules that failed */
  failedRules: string[];
  
  /** Thresholds used for QA */
  thresholds: QAThresholds;
  
  /** Timestamp */
  measuredAt: string;
  
  /** Measurement duration */
  totalMeasurementDurationMs: number;
}

/**
 * QA record stored in database
 */
export interface QADatabaseRecord {
  id: string;
  jobId: string;
  mashupId: string | null;
  userId: string;
  results: AutomationQAResults;
  passed: boolean;
  retryCount: number;
  retryReasons: string[];
  createdAt: string;
}

// ============================================================================
// Fixture-Based Signoff
// ============================================================================

/**
 * Target output profile for fixture-based testing
 */
export interface OutputProfile {
  name: string;
  description: string;
  thresholds: QAThresholds;
  applicableFormats: string[];
}

/**
 * Predefined output profiles
 */
export const OUTPUT_PROFILES: OutputProfile[] = [
  {
    name: 'streaming',
    description: 'Optimized for Spotify, Apple Music, etc. (-14 LUFS)',
    thresholds: {
      ...DEFAULT_QA_THRESHOLDS,
      targetIntegratedLufs: -14,
    },
    applicableFormats: ['mp3', 'aac', 'ogg'],
  },
  {
    name: 'broadcast',
    description: 'Broadcast standard (-23 LUFS)',
    thresholds: {
      ...DEFAULT_QA_THRESHOLDS,
      targetIntegratedLufs: -23,
      maxTruePeakDbtp: -2.0,
    },
    applicableFormats: ['wav', 'aiff', 'flac'],
  },
  {
    name: 'club',
    description: 'Club/DJ standard (-8 LUFS)',
    thresholds: {
      ...DEFAULT_QA_THRESHOLDS,
      targetIntegratedLufs: -8,
      minDynamicRangeLu: 6,
    },
    applicableFormats: ['wav', 'aiff'],
  },
];

/**
 * Signoff check for a fixture render
 */
export interface FixtureSignoffCheck {
  fixtureId: string;
  outputProfile: string;
  qaResults: AutomationQAResults;
  passed: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
}
