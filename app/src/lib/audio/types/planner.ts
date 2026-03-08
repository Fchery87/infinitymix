/**
 * Sequence Planner Types
 * 
 * Defines the data structures for whole-set track planning,
 * including compatibility scoring, role assignment, and transition planning.
 */

import type { AnnotationProvenance } from './analysis';

// ============================================================================
// Core Planning Types
// ============================================================================

/**
 * Track role in a mashup context
 */
export type TrackRole = 
  | 'lead-vocal'      // Primary vocal track
  | 'lead-instrumental' // Primary instrumental bed
  | 'support-vocal'   // Background vocals/harmonies
  | 'support-instrumental' // Additional instrumental layers
  | 'transition-bridge' // Brief transitional element
  | 'full-mix';       // No role separation, full tracks

/**
 * Transition style between tracks
 */
export type TransitionStyle =
  | 'cut'             // Hard cut
  | 'fade'            // Simple crossfade
  | 'echo-reverb'     // Echo out + reverb in
  | 'filter-sweep'    // Filter-based transition
  | 'energy-build'    // Build-up then drop
  | 'bass-drop'       // Drop at downbeat
  | 'vocal-handoff'   // Vocal line carries over
  | 'phrase-snap';    // Align to phrase boundaries

/**
 * Event archetype for energy flow
 */
export type EventArchetype =
  | 'party-peak'      // High energy throughout
  | 'warmup-journey'  // Build from low to high
  | 'peak-valley'     // Alternating energy levels
  | 'chill-vibe'      // Consistent low-mid energy
  | 'sunrise-set';    // Gradual increase then plateau

// ============================================================================
// Planning Graph
// ============================================================================

/**
 * Summary of a track for planning purposes
 */
export type TrackPlanningSummary = {
  trackId: string;
  durationSeconds: number;
  bpm: number | null;
  camelotKey: string | null;
  
  // Analysis-derived features
  energyProfile: {
    averageEnergy: number;      // 0-1 scale
    peakEnergy: number;
    valleyEnergy: number;
    energyVariance: number;     // How dynamic
  };
  
  structure: Array<{
    label: string;
    start: number;
    end: number;
    energy: number;
    confidence: number;
  }>;
  
  cuePoints: Array<{
    position: number;
    type: 'mix-in' | 'mix-out' | 'drop' | 'breakdown';
    confidence: number;
  }>;
  
  // Stem availability
  hasStems: boolean;
  stemQuality?: 'draft' | 'hifi';
  
  // Vocal/instrumental characterization
  vocalDominance: number;       // 0 = instrumental, 1 = vocal
  hasClearVocalSections: boolean;
  hasClearInstrumentalSections: boolean;
};

/**
 * Compatibility between two tracks in a specific direction
 * (asymmetric: A→B is different from B→A)
 */
export type AsymmetricCompatibility = {
  sourceTrackId: string;
  targetTrackId: string;
  
  // Core compatibility scores
  tempoCompatibility: number;    // 0-1
  harmonicCompatibility: number; // 0-1
  energyFlowScore: number;       // 0-1, transition quality
  
  // Role-aware scoring
  vocalOverInstrumentalScore: number;   // Source vocal → Target instrumental
  instrumentalOverVocalScore: number;   // Source instrumental → Target vocal
  fullTrackTransitionScore: number;     // Both as full tracks
  
  // Quality penalties
  tempoStretchPenalty: number;   // Reduction for aggressive stretching
  stemQualityPenalty: number;    // Reduction for low-quality stems
  harmonicClashSeverity: number; // 0-1, 1 = severe clash
  vocalCollisionRisk: number;    // 0-1, 1 = high risk
  
  // Overall scores by role combination
  scores: {
    'lead-vocal_to_lead-instrumental': number;
    'lead-instrumental_to_lead-vocal': number;
    'full-mix_to_full-mix': number;
    'lead-vocal_to_full-mix': number;
    'full-mix_to_lead-instrumental': number;
  };
  
  // Suggested transition
  suggestedTransitionStyle: TransitionStyle;
  suggestedOverlapDuration: number; // seconds
};

/**
 * The complete planning graph for a set of tracks
 */
export type PlanningGraph = {
  tracks: TrackPlanningSummary[];
  compatibilities: AsymmetricCompatibility[];
  
  // Quick lookup indices
  trackIndex: Map<string, TrackPlanningSummary>;
  compatibilityIndex: Map<string, AsymmetricCompatibility>; // key: "sourceId->targetId"
};

// ============================================================================
// Planning Constraints & Policies
// ============================================================================

/**
 * Constraints for the planning process
 */
export type PlanningConstraints = {
  // Duration
  targetDurationSeconds: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  
  // Track count
  minTracks?: number;
  maxTracks?: number;
  
  // Event context
  eventArchetype?: EventArchetype;
  targetBpm?: number;           // Lock to specific BPM
  
  // Stem preferences
  preferStems?: boolean;
  allowFullTracks?: boolean;
  
  // Transition preferences
  allowedTransitionStyles?: TransitionStyle[];
  minTransitionDuration?: number;
  maxTransitionDuration?: number;
  
  // Safety
  blockVocalCollisions?: boolean;
  maxTempoStretchPercent?: number;
  requireHarmonicCompatibility?: boolean;
};

/**
 * Policy rules for planning decisions
 */
export type PlanningPolicy = {
  // Energy arc policy
  energyArcPolicy: {
    type: EventArchetype;
    checkpoints: Array<{
      progressPercent: number;    // 0-100 through the mix
      targetEnergyLevel: number;  // 0-1
      tolerance: number;
    }>;
  };
  
  // Stem usage policy
  stemUsagePolicy: {
    useStemsWhenAvailable: boolean;
    preferVocalOverInstrumental: boolean;
    maxStemQualityPenalty: number;
  };
  
  // Transition policies
  transitionPolicy: {
    defaultStyle: TransitionStyle;
    phraseAligned: boolean;
    minOverlapBeats: number;
    maxOverlapBeats: number;
  };
  
  // Safety rules
  safetyRules: {
    rejectVocalCollisions: boolean;
    maxTempoStretchPercent: number;
    minHarmonicCompatibility: number;
    minCuePointConfidence: number;
  };
};

// ============================================================================
// Planner Output
// ============================================================================

/**
 * A planned transition between two tracks
 */
export type PlannedTransition = {
  fromTrackId: string;
  toTrackId: string;
  
  // Track roles in this transition
  fromRole: TrackRole;
  toRole: TrackRole;
  
  // Timing
  fromExitCueSeconds: number;   // When to start mixing out
  toEntryCueSeconds: number;    // When track B starts
  overlapDurationSeconds: number;
  
  // Transition details
  transitionStyle: TransitionStyle;
  tempoRampStrategy: 'none' | 'linear' | 'exponential';
  targetBpm: number | null;
  
  // Stem usage (if applicable)
  useStems: boolean;
  stemConfig?: {
    vocalTrackId: string;
    instrumentalTrackId: string;
  };
  
  // Scores at decision time
  compatibilityScore: number;
  confidence: number;
};

/**
 * The complete sequence plan
 */
export type SequencePlan = {
  planId: string;
  createdAt: string;
  
  // Input tracks
  trackIds: string[];
  
  // Planned sequence
  sequence: Array<{
    trackId: string;
    role: TrackRole;
    startTimeSeconds: number;     // In the final mix
    endTimeSeconds: number;
    entryCueUsed: number;         // Which cue point was selected
    exitCueUsed: number;
  }>;
  
  // Transitions between tracks
  transitions: PlannedTransition[];
  
  // Overall plan metrics
  totalDurationSeconds: number;
  estimatedEnergyFlow: Array<{
    timeSeconds: number;
    energyLevel: number;
  }>;
  
  // Quality scores
  qualityScores: {
    overallScore: number;
    tempoCompatibility: number;
    harmonicFlow: number;
    energyFlow: number;
    transitionQuality: number;
    vocalClashRisk: number;
  };
};

// ============================================================================
// Planner Trace (for observability)
// ============================================================================

/**
 * Detailed trace of planning decisions for debugging/QA
 */
export type PlannerTrace = {
  traceId: string;
  planId: string;
  createdAt: string;
  
  // Input state
  inputTrackCount: number;
  constraints: PlanningConstraints;
  policy: PlanningPolicy;
  
  // Planning steps
  steps: Array<{
    stepNumber: number;
    stepType: 'build_graph' | 'score_compatibilities' | 'select_sequence' | 'assign_roles' | 'plan_transitions' | 'validate';
    durationMs: number;
    details: Record<string, unknown>;
  }>;
  
  // Key decisions
  decisions: Array<{
    decisionType: 'sequence_order' | 'role_assignment' | 'transition_style' | 'stem_usage';
    trackIds: string[];
    chosen: unknown;
    rejected: Array<{
      option: unknown;
      reason: string;
      score: number;
    }>;
    rationale: string;
  }>;
  
  // Rejected candidates
  rejectedCandidates: Array<{
    type: 'track' | 'transition' | 'role_assignment';
    candidate: unknown;
    rejectionReason: string;
    qualityScore: number;
  }>;
  
  // Warnings
  warnings: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    affectedTrackIds?: string[];
  }>;
  
  // Performance
  totalPlanningDurationMs: number;
  graphBuildDurationMs: number;
  compatibilityScoringDurationMs: number;
  sequenceOptimizationDurationMs: number;
};

// ============================================================================
// Planner API
// ============================================================================

export type PlanSequenceInput = {
  trackIds: string[];
  constraints: PlanningConstraints;
  policy?: Partial<PlanningPolicy>; // Override defaults
  userId: string;
};

export type PlanSequenceOutput = {
  plan: SequencePlan;
  trace: PlannerTrace;
  alternatives?: SequencePlan[]; // Alternative sequences if requested
};
