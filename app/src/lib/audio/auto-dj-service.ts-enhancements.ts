/**
 * Auto-DJ Service - Enhanced Features
 * 
 * Additions for advanced DJ mixing techniques.
 * These functions should be integrated into the existing auto-dj-service.ts file.
 */

import { log } from '@/lib/logger';
import type { TransitionStyle } from './mixing-service';

/**
 * Extended transition style with all new advanced styles
 */
export type AdvancedTransitionStyle =
  | 'smooth'          // Linear crossfade (existing)
  | 'drop'            // Quick cut at drop (existing)
  | 'cut'             // Instant cut (existing)
  | 'energy'          // Sine curve crossfade (existing)
  | 'filter_sweep'    // Highpass to lowpass sweep (NEW)
  | 'echo_reverb'     // Echo out + reverb in (NEW)
  | 'backspin'        // Reverse + spin effect (NEW)
  | 'tape_stop'       // Slow-down tape stop (NEW)
  | 'stutter_edit'    // Rhythmic stutters (NEW)
  | 'three_band_swap' // Swap frequency bands (NEW)
  | 'bass_drop'       // Bass drop on transition (NEW)
  | 'snare_roll'      // Snare roll build (NEW)
  | 'noise_riser';    // White noise riser (NEW)

/**
 * Crossfade curve presets with additional curves
 */
export const CROSSFADE_PRESETS: Record<AdvancedTransitionStyle, any> = {
  // Existing basic presets
  smooth: { duration: 4, curve1: 'tri', curve2: 'tri' },
  drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },
  cut: { duration: 0, curve1: 'nofade', curve2: 'nofade' },
  energy: { duration: 2, curve1: 'qsin', curve2: 'qsin' },

  // NEW: Additional crossfade curves
  hsin: { duration: 3, curve1: 'hsin', curve2: 'hsin' },   // Half-sine S-curve
  par: { duration: 3, curve1: 'par', curve2: 'par' },     // Parabolic curve
  cub: { duration: 3, curve1: 'cub', curve2: 'cub' },     // Cubic S-curve
  lis: { duration: 3, curve1: 'lis', curve2: 'lis' },     // Linear-sine
  sqr: { duration: 3, curve1: 'sqr', curve2: 'sqr' },     // Square cut

  // NEW: Filter sweep
  filter_sweep: {
    duration: 4,
    curve1: 'tri',
    curve2: 'tri',
    preFilter: 'highpass=f=20',    // Start bright
    postFilter: 'lowpass=f=20000', // End dark
    effect: 'dynamic_filter',
  },

  // NEW: Echo + Reverb
  echo_reverb: {
    duration: 3,
    curve1: 'tri',
    curve2: 'tri',
    effect: 'aecho=0.8:0.9:1000:0.3,areverse',
  },

  // NEW: Backspin
  backspin: {
    duration: 2,
    curve1: 'exp',
    curve2: 'log',
    effect: 'areverse,asetrate=48000,aresample=44100',
  },

  // NEW: Tape stop
  tape_stop: {
    duration: 1.5,
    curve1: 'log',
    curve2: 'tri',
    effect: 'asetrate=22050,aresample=44100', // Pitch down
  },

  // NEW: Stutter edit
  stutter_edit: {
    duration: 3,
    curve1: 'qsin',
    curve2: 'tri',
    effect: 'atempo=1.5,atempo=0.66', // Stutter pattern
  },

  // NEW: Three-band frequency swap
  three_band_swap: {
    duration: 2,
    curve1: 'tri',
    curve2: 'tri',
    bands: [
      { freq: '500', direction: 'out->in' },   // Bass from A
      { freq: '2000', direction: 'out->in' }, // Mids from A
      { freq: '8000', direction: 'in->out' }, // Highs from B
    ],
  },

  // NEW: Bass drop
  bass_drop: {
    duration: 0.5,
    curve1: 'exp',
    curve2: 'log',
    preFilter: 'lowpass=f=200', // Cut bass temporarily
    effect: 'dynamic_bass',
  },

  // NEW: Snare roll
  snare_roll: {
    duration: 4,
    curve1: 'qsin',
    curve2: 'qsin',
    effect: 'volume=1.2',
  },

  // NEW: Noise riser
  noise_riser: {
    duration: 3,
    curve1: 'tri',
    curve2: 'exp',
    effect: 'aeval=sin(2000*t)', // White noise approximation
  },
};

/**
 * Filter sweep configuration
 */
export interface FilterSweepConfig {
  startFreq: number;    // Default 20 Hz
  endFreq: number;      // Default 20000 Hz
  duration: number;     // Match fade duration
  curve: 'linear' | 'exponential' | 'logarithmic';
  filterType: 'highpass' | 'lowpass' | 'bandpass';
}

/**
 * Build filter sweep FFmpeg filter
 */
export function buildFilterSweep(config: FilterSweepConfig): string {
  let freqExpression: string;

  switch (config.curve) {
    case 'linear':
      freqExpression = `${config.startFreq}+(${config.endFreq}-${config.startFreq})*t/${config.duration}`;
      break;

    case 'exponential':
      freqExpression = `${config.startFreq}*(${config.endFreq}/${config.startFreq})^(t/${config.duration})`;
      break;

    case 'logarithmic':
      // Using Math.exp for logarithmic curve
      freqExpression = `${config.startFreq}*Math.exp(Math.log(${config.endFreq}/${config.startFreq})*t/${config.duration})`;
      break;

    default:
      freqExpression = `${config.startFreq}+(${config.endFreq}-${config.startFreq})*t/${config.duration}`;
  }

  return `${config.filterType}=f=${freqExpression}`;
}

/**
 * Sidechain ducking configuration for vocals
 */
export interface VocalDuckConfig {
  duckDuration: number;   // Duration of duck in seconds
  duckAmount: number;     // Volume reduction (0-1, typically 0.3)
  attackMs: number;       // Attack time
  releaseMs: number;      // Release time
  duckWhen?: 'drums_enter' | 'bass_enter' | 'transition_start';
}

/**
 * Build vocal ducking filter
 */
export function buildVocalDuckFilter(config: VocalDuckConfig): string {
  // Gradually reduce vocals over duckDuration
  const duckCurve = `1-${config.duckAmount}*t/${config.duckDuration}`;
  return `volume=${duckCurve}`;
}

/**
 * Get recommended transition style based on context
 */
export function getRecommendedTransitionStyle(
  bpmFrom: number,
  bpmTo: number,
  energyFrom: number,  // 0-1
  energyTo: number,     // 0-1
  genre: string = 'electronic'
): AdvancedTransitionStyle {
  const bpmDiff = Math.abs(bpmTo - bpmFrom);
  const energyDiff = energyTo - energyFrom;

  // Major BPM change - use cut or drop
  if (bpmDiff > 10) {
    return 'cut';
  }

  // Moderate BPM change - use drop
  if (bpmDiff > 5) {
    return 'drop';
  }

  // Energy rising significantly
  if (energyDiff > 0.3) {
    if (genre === 'hiphop' || genre === 'trap') {
      return 'bass_drop';
    }
    return 'snare_roll';
  }

  // Energy dropping significantly
  if (energyDiff < -0.3) {
    if (genre === 'electronic' || genre === 'techno') {
      return 'filter_sweep';
    }
    return 'tape_stop';
  }

  // Similar energy and BPM - use smooth transition
  if (genre === 'electronic' || genre === 'house') {
    return 'smooth';
  } else if (genre === 'hiphop' || genre === 'trap') {
    return 'energy';
  } else if (genre === 'techno') {
    return 'cut';
  }

  return 'smooth';
}

/**
 * Build transition filter graph for two tracks
 */
export function buildTransitionFilterGraph(
  fromLabel: string,
  toLabel: string,
  style: AdvancedTransitionStyle,
  duration: number
): string {
  const preset = CROSSFADE_PRESETS[style];

  switch (style) {
    case 'three_band_swap':
      // Swap frequency bands between tracks
      return `
        [${fromLabel}]asplit=3[f${fromLabel}_low][f${fromLabel}_mid][f${fromLabel}_high];
        [${toLabel}]asplit=3[f${toLabel}_low][f${toLabel}_mid][f${toLabel}_high];
        [f${fromLabel}_low][f${toLabel}_low]amix=inputs=2:duration=longest[swapped_low];
        [f${fromLabel}_mid][f${toLabel}_mid]amix=inputs=2:duration=longest[swapped_mid];
        [f${fromLabel}_high][f${toLabel}_high]amix=inputs=2:duration=longest[swapped_high];
        [swapped_low][swapped_mid][swapped_high]amix=inputs=3:duration=longest[transition_out]
      `.trim();

    case 'filter_sweep':
      // Dynamic filter during transition
      const filterSweep = buildFilterSweep({
        startFreq: 20,
        endFreq: 20000,
        duration: duration,
        curve: 'linear',
        filterType: 'highpass',
      });

      return `
        [${fromLabel}]${filterSweep}[${fromLabel}_filtered];
        [${toLabel}]${filterSweep}[${toLabel}_filtered];
        [${fromLabel}_filtered][${toLabel}_filtered]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'echo_reverb':
      // Echo out first track
      return `
        [${fromLabel}]aecho=0.8:0.9:1000:0.3[${fromLabel}_echo];
        [${fromLabel}_echo][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'backspin':
      // Reverse first track
      return `
        [${fromLabel}]areverse[${fromLabel}_reverse];
        [${fromLabel}_reverse][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'tape_stop':
      // Slow down first track
      return `
        [${fromLabel}]asetrate=22050,aresample=44100[${fromLabel}_slowed];
        [${fromLabel}_slowed][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'stutter_edit':
      // Rhythmic stutter
      return `
        [${fromLabel}]atempo=1.5,atempo=0.66[${fromLabel}_stutter];
        [${fromLabel}_stutter][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'bass_drop':
      // Cut bass temporarily
      return `
        [${fromLabel}]lowpass=f=200[${fromLabel}_nobass];
        [${toLabel}]lowpass=f=200[${toLabel}_nobass];
        [${fromLabel}_nobass][${toLabel}_nobass]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_nobass];
        [${fromLabel}][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_full];
        [transition_nobass][transition_full]amix=inputs=2:duration=longest[transition_out]
      `.trim();

    case 'snare_roll':
      // Boost snare during transition
      return `
        [${fromLabel}]highpass=f=2000,volume=1.2[${fromLabel}_boosted];
        [${fromLabel}_boosted][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'noise_riser':
      // Add noise riser
      return `
        [${fromLabel}]aeval=sin(2000*t),volume=0.1[${fromLabel}_noise];
        [${fromLabel}_noise][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]
      `.trim();

    case 'cut':
      return `[${fromLabel}][${toLabel}]acrossfade=d=${0}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]`;

    case 'smooth':
    case 'drop':
    case 'energy':
    default:
      // Standard crossfade
      return `[${fromLabel}][${toLabel}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition_out]`;
  }
}

/**
 * Get optimal transition duration based on BPM and style
 */
export function getOptimalTransitionDuration(
  bpm: number,
  style: AdvancedTransitionStyle
): number {
  const barDuration = 240 / bpm; // Duration of one bar (4/4 time)

  switch (style) {
    case 'cut':
      return 0;

    case 'drop':
    case 'bass_drop':
      return Math.max(0.5, barDuration * 0.5); // Half bar

    case 'tape_stop':
      return Math.max(1, barDuration); // One bar

    case 'three_band_swap':
      return Math.max(1.5, barDuration * 1.5); // 1.5 bars

    case 'smooth':
    case 'energy':
      return Math.max(2, barDuration * 2); // Two bars

    case 'filter_sweep':
    case 'echo_reverb':
    case 'stutter_edit':
    case 'snare_roll':
    case 'noise_riser':
    case 'backspin':
      return Math.max(3, barDuration * 3); // Three bars

    default:
      return Math.max(2, barDuration * 2);
  }
}

/**
 * Validate transition configuration
 */
export function validateTransitionConfig(
  style: AdvancedTransitionStyle,
  duration: number,
  bpm?: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!CROSSFADE_PRESETS[style]) {
    errors.push(`Unknown transition style: ${style}`);
  }

  if (duration < 0) {
    errors.push('Transition duration cannot be negative');
  }

  if (bpm !== undefined) {
    const barDuration = 240 / bpm;
    if (duration > barDuration * 8) {
      errors.push(`Transition duration (${duration}s) too long for BPM (${bpm})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

log('info', 'autoDJ.enhancements.loaded', {
  availableStyles: Object.keys(CROSSFADE_PRESETS),
  advancedFeatures: [
    'filter_sweep',
    'echo_reverb',
    'backspin',
    'tape_stop',
    'stutter_edit',
    'three_band_swap',
    'bass_drop',
    'snare_roll',
    'noise_riser',
  ],
});
