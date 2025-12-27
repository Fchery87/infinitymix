/**
 * Transition Presets
 * 
 * Comprehensive collection of DJ transition styles.
 * Includes filter parameters, crossfade curves, and timing.
 */

import { log } from '@/lib/logger';

/**
 * Crossfade curve types supported by FFmpeg acrossfade filter
 */
export type CrossfadeCurve = 'tri' | 'exp' | 'log' | 'qsin' | 'hsin' | 'par' | 'cub' | 'lis' | 'sqr' | 'nofade';

/**
 * Advanced transition styles
 */
export type TransitionStyle =
  | 'smooth'          // Linear crossfade
  | 'drop'            // Quick cut at drop
  | 'cut'             // Instant cut
  | 'energy'          // Sine curve crossfade
  | 'filter_sweep'    // Highpass to lowpass sweep
  | 'echo_reverb'     // Echo out + reverb in
  | 'backspin'        // Reverse + spin effect
  | 'tape_stop'       // Slow-down tape stop
  | 'stutter_edit'    // Rhythmic stutters
  | 'three_band_swap' // Swap frequency bands
  | 'bass_drop'       // Bass drop on transition
  | 'snare_roll'      // Snare roll build
  | 'noise_riser';    // White noise riser

/**
 * Transition preset configuration
 */
export interface TransitionPreset {
  id: TransitionStyle;
  name: string;
  description: string;
  duration: number;              // Default duration in seconds
  curve1: CrossfadeCurve;        // Fade out curve for first track
  curve2: CrossfadeCurve;        // Fade in curve for second track
  preFilter?: string;           // Filter to apply before transition
  postFilter?: string;          // Filter to apply after transition
  energyEffect?: 'rise' | 'drop' | 'neutral'; // Energy change
  bpmImpact?: number;           // How much it affects perceived BPM
  stemHandling?: 'full' | 'vocals_only' | 'instrumental' | 'three_band';
}

/**
 * Crossfade curve presets
 */
export const CROSSFADE_CURVES: Record<CrossfadeCurve, { name: string; description: string }> = {
  tri: { name: 'Linear', description: 'Straight line fade' },
  exp: { name: 'Exponential', description: 'Fast at start, slow at end' },
  log: { name: 'Logarithmic', description: 'Slow at start, fast at end' },
  qsin: { name: 'Quarter Sine', description: 'Gentle S-curve fade' },
  hsin: { name: 'Half Sine', description: 'Smooth S-curve fade' },
  par: { name: 'Parabolic', description: 'Curved fade' },
  cub: { name: 'Cubic', description: 'S-shaped cubic fade' },
  lis: { name: 'Linear Sine', description: 'Linear then sine fade' },
  sqr: { name: 'Square', description: 'Hard square fade' },
  nofade: { name: 'No Fade', description: 'Instant cut' },
};

/**
 * Complete collection of transition presets
 */
export const TRANSITION_PRESETS: Record<TransitionStyle, TransitionPreset> = {
  // ==================== Basic Transitions ====================
  smooth: {
    id: 'smooth',
    name: 'Smooth Crossfade',
    description: 'Standard linear crossfade for seamless blending',
    duration: 4,
    curve1: 'tri',
    curve2: 'tri',
    energyEffect: 'neutral',
    bpmImpact: 0,
    stemHandling: 'full',
  },

  drop: {
    id: 'drop',
    name: 'Drop Cut',
    description: 'Quick cut synced to the drop of the incoming track',
    duration: 0.5,
    curve1: 'exp',
    curve2: 'log',
    energyEffect: 'rise',
    bpmImpact: 0.2,
    stemHandling: 'full',
  },

  cut: {
    id: 'cut',
    name: 'Quick Cut',
    description: 'Instant cut between tracks',
    duration: 0,
    curve1: 'nofade',
    curve2: 'nofade',
    energyEffect: 'drop',
    bpmImpact: 0.5,
    stemHandling: 'full',
  },

  energy: {
    id: 'energy',
    name: 'Energy Crossfade',
    description: 'Sine curve crossfade for energetic blends',
    duration: 2,
    curve1: 'qsin',
    curve2: 'qsin',
    energyEffect: 'rise',
    bpmImpact: 0.1,
    stemHandling: 'full',
  },

  // ==================== Filter-Based Transitions ====================
  filter_sweep: {
    id: 'filter_sweep',
    name: 'Filter Sweep',
    description: 'Highpass to lowpass frequency sweep for dramatic effect',
    duration: 4,
    curve1: 'tri',
    curve2: 'tri',
    preFilter: 'highpass=f=20',
    postFilter: 'lowpass=f=20000',
    energyEffect: 'drop',
    bpmImpact: 0,
    stemHandling: 'full',
  },

  // ==================== Effect-Based Transitions ====================
  echo_reverb: {
    id: 'echo_reverb',
    name: 'Echo + Reverb',
    description: 'Echo out the first track while bringing in the second',
    duration: 3,
    curve1: 'tri',
    curve2: 'tri',
    preFilter: 'aecho=0.8:0.9:1000:0.3',
    energyEffect: 'neutral',
    bpmImpact: -0.1,
    stemHandling: 'full',
  },

  backspin: {
    id: 'backspin',
    name: 'Backspin Effect',
    description: 'Reverse the first track then spin into the second',
    duration: 2,
    curve1: 'qsin',
    curve2: 'qsin',
    preFilter: 'areverse',
    energyEffect: 'rise',
    bpmImpact: 0.3,
    stemHandling: 'full',
  },

  tape_stop: {
    id: 'tape_stop',
    name: 'Tape Stop',
    description: 'Slow down the first track like a tape stopping',
    duration: 1.5,
    curve1: 'qsin',
    curve2: 'tri',
    preFilter: 'asetrate=22050,aresample=44100', // Pitch down one octave
    energyEffect: 'drop',
    bpmImpact: -0.5,
    stemHandling: 'full',
  },

  stutter_edit: {
    id: 'stutter_edit',
    name: 'Stutter Edit',
    description: 'Rhythmic stutters on the first track before transition',
    duration: 3,
    curve1: 'qsin',
    curve2: 'tri',
    preFilter: 'atempo=1.5,atempo=0.66', // Stutter effect
    energyEffect: 'rise',
    bpmImpact: 0.2,
    stemHandling: 'full',
  },

  // ==================== Stem-Specific Transitions ====================
  three_band_swap: {
    id: 'three_band_swap',
    name: 'Three-Band Swap',
    description: 'Swap low/mid/high frequency ranges between tracks',
    duration: 2,
    curve1: 'tri',
    curve2: 'tri',
    energyEffect: 'neutral',
    bpmImpact: 0,
    stemHandling: 'three_band',
  },

  // ==================== Energy Transitions ====================
  bass_drop: {
    id: 'bass_drop',
    name: 'Bass Drop',
    description: 'Drop the bass on transition for impact',
    duration: 0.5,
    curve1: 'exp',
    curve2: 'log',
    preFilter: 'lowpass=f=200', // Cut bass temporarily
    energyEffect: 'rise',
    bpmImpact: 0.3,
    stemHandling: 'full',
  },

  snare_roll: {
    id: 'snare_roll',
    name: 'Snare Roll',
    description: 'Build tension with snare rolls before transition',
    duration: 4,
    curve1: 'qsin',
    curve2: 'qsin',
    energyEffect: 'rise',
    bpmImpact: 0.2,
    stemHandling: 'vocals_only',
  },

  noise_riser: {
    id: 'noise_riser',
    name: 'Noise Riser',
    description: 'White noise riser leading into the drop',
    duration: 3,
    curve1: 'tri',
    curve2: 'log',
    energyEffect: 'rise',
    bpmImpact: 0.3,
    stemHandling: 'full',
  },
};

/**
 * Get transition preset by ID
 */
export function getTransitionPreset(style: TransitionStyle): TransitionPreset {
  return TRANSITION_PRESETS[style];
}

/**
 * Get all available transition presets
 */
export function getAllTransitionPresets(): TransitionPreset[] {
  return Object.values(TRANSITION_PRESETS);
}

/**
 * Get transitions filtered by energy effect
 */
export function getTransitionsByEnergyEffect(effect: 'rise' | 'drop' | 'neutral'): TransitionPreset[] {
  return Object.values(TRANSITION_PRESETS).filter(p => p.energyEffect === effect);
}

/**
 * Get transitions filtered by stem handling
 */
export function getTransitionsByStemHandling(handling: 'full' | 'vocals_only' | 'instrumental' | 'three_band'): TransitionPreset[] {
  return Object.values(TRANSITION_PRESETS).filter(p => p.stemHandling === handling);
}

/**
 * Get recommended transition for BPM difference
 */
export function getRecommendedTransitionForBPM(bpmDiff: number): TransitionStyle {
  const absDiff = Math.abs(bpmDiff);
  
  if (absDiff < 2) {
    return 'smooth'; // Minimal BPM change - smooth transition
  } else if (absDiff < 5) {
    return 'energy'; // Moderate change - energy transition
  } else if (absDiff < 10) {
    return 'drop'; // Larger change - drop cut
  } else {
    return 'filter_sweep'; // Major change - filter sweep
  }
}

/**
 * Get recommended transition for energy change
 */
export function getRecommendedTransitionForEnergy(fromEnergy: number, toEnergy: number): TransitionStyle {
  const energyDiff = toEnergy - fromEnergy;
  
  if (energyDiff > 0.3) {
    // Big energy rise
    return 'bass_drop';
  } else if (energyDiff > 0.1) {
    // Moderate energy rise
    return 'energy';
  } else if (energyDiff < -0.3) {
    // Big energy drop
    return 'tape_stop';
  } else if (energyDiff < -0.1) {
    // Moderate energy drop
    return 'echo_reverb';
  } else {
    // Similar energy
    return 'smooth';
  }
}

/**
 * Build FFmpeg crossfade command from preset
 */
export function buildCrossfadeFromPreset(
  preset: TransitionPreset,
  duration?: number
): string {
  const actualDuration = duration ?? preset.duration;
  
  // Base crossfade
  let filter = `acrossfade=d=${actualDuration}:c1=${preset.curve1}:c2=${preset.curve2}`;
  
  // Add pre-filter if specified
  if (preset.preFilter) {
    filter = `${preset.preFilter},${filter}`;
  }
  
  // Add post-filter if specified
  if (preset.postFilter) {
    filter = `${filter},${preset.postFilter}`;
  }
  
  return filter;
}

/**
 * Build transition filter for specific stem handling
 */
export function buildTransitionFilterForStems(
  preset: TransitionPreset,
  fromStem: string,
  toStem: string,
  duration: number
): string {
  const actualDuration = duration ?? preset.duration;
  
  switch (preset.stemHandling) {
    case 'vocals_only':
      // Mix only vocals during transition
      return `[${fromStem}][${toStem}]acrossfade=d=${actualDuration}:c1=${preset.curve1}:c2=${preset.curve2}`;
    
    case 'instrumental':
      // Remove vocals from both tracks during transition
      return `[${fromStem}][${toStem}]acrossfade=d=${actualDuration}:c1=${preset.curve1}:c2=${preset.curve2},volume=0`;
    
    case 'three_band':
      // Swap frequency bands between stems
      return `
        [${fromStem}]asplit=3[f${fromStem}_low][f${fromStem}_mid][f${fromStem}_high];
        [${toStem}]asplit=3[f${toStem}_low][f${toStem}_mid][f${toStem}_high];
        [f${fromStem}_low][f${toStem}_low]amix=inputs=2:duration=longest[swapped_low];
        [f${fromStem}_mid][f${toStem}_mid]amix=inputs=2:duration=longest[swapped_mid];
        [f${fromStem}_high][f${toStem}_high]amix=inputs=2:duration=longest[swapped_high];
        [swapped_low][swapped_mid][swapped_high]amix=inputs=3:duration=longest
      `.trim();
    
    case 'full':
    default:
      // Standard full crossfade
      return `[${fromStem}][${toStem}]acrossfade=d=${actualDuration}:c1=${preset.curve1}:c2=${preset.curve2}`;
  }
}

/**
 * Get transition duration based on BPM
 */
export function getOptimalTransitionDuration(bpm: number, style: TransitionStyle): number {
  const barDuration = 240 / bpm; // Duration of one bar in seconds (assuming 4/4 time)
  
  switch (style) {
    case 'cut':
      return 0;
    
    case 'drop':
    case 'bass_drop':
      return Math.max(0.5, barDuration * 0.5); // Half bar
    
    case 'smooth':
    case 'energy':
      return Math.max(2, barDuration * 2); // 2 bars
    
    case 'filter_sweep':
    case 'echo_reverb':
    case 'backspin':
    case 'stutter_edit':
    case 'snare_roll':
    case 'noise_riser':
      return Math.max(3, barDuration * 3); // 3 bars
    
    case 'tape_stop':
      return Math.max(1, barDuration); // 1 bar
    
    case 'three_band_swap':
      return Math.max(1.5, barDuration * 1.5); // 1.5 bars
    
    default:
      return Math.max(2, barDuration * 2);
  }
}

/**
 * Validate transition preset
 */
export function validateTransitionPreset(preset: TransitionPreset): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (preset.duration < 0) {
    errors.push('Transition duration cannot be negative');
  }
  
  if (!CROSSFADE_CURVES[preset.curve1]) {
    errors.push(`Invalid curve1: ${preset.curve1}`);
  }
  
  if (!CROSSFADE_CURVES[preset.curve2]) {
    errors.push(`Invalid curve2: ${preset.curve2}`);
  }
  
  if (preset.bpmImpact !== undefined && (preset.bpmImpact < -1 || preset.bpmImpact > 1)) {
    errors.push('bpmImpact must be between -1 and 1');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

log('info', 'transitionPresets.loaded', {
  presetCount: Object.keys(TRANSITION_PRESETS).length,
  availableStyles: Object.keys(TRANSITION_PRESETS),
  curveTypes: Object.keys(CROSSFADE_CURVES),
});
