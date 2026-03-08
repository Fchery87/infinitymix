export type TransitionRole = 'trackA' | 'trackB' | 'stem-vocal' | 'stem-instrumental';

export type TempoRampStrategy = 'linear' | 'exponential' | 'none';

export type EqIntent = {
  highPassHz?: number;
  lowPassHz?: number;
  fadeDurationSeconds?: number;
};

export interface TransitionExecutionContract {
  /**
   * The IDs of the tracks involved in the transition.
   */
  trackAId: string;
  trackBId: string;
  
  /**
   * Roles of the tracks (e.g., standard track vs stem).
   */
  trackARole: TransitionRole;
  trackBRole: TransitionRole;

  /**
   * The point in Track A (in seconds) where the transition out starts.
   */
  mixOutCueSeconds: number;

  /**
   * The point in Track B (in seconds) where the transition in starts.
   */
  mixInCueSeconds: number;

  /**
   * The duration of the overlap between Track A and Track B (in seconds).
   */
  overlapDurationSeconds: number;

  /**
   * Strategy for how tempo ramps between Track A and Track B.
   */
  tempoRampStrategy: TempoRampStrategy;

  /**
   * Target BPM for the transition (defaults to Track B's BPM or master BPM).
   */
  targetBpm?: number;

  /**
   * EQ / Filter intent for Track A during the overlap.
   */
  trackAEqIntent?: EqIntent;

  /**
   * EQ / Filter intent for Track B during the overlap.
   */
  trackBEqIntent?: EqIntent;
  
  /**
   * The style of the transition.
   */
  transitionStyle?: string;
}
