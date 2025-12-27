/**
 * Dynamic EQ Service
 * 
 * Dynamic equalization to prevent frequency masking.
 * Activates EQ only when frequencies compete, reducing muddy mixes.
 */

import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';

/**
 * Dynamic EQ configuration for frequency masking prevention
 */
export interface DynamicEQConfig {
  /**
   * Frequency to monitor and potentially reduce
   */
  detectFrequency: number;  // Hz (e.g., 2500Hz for vocals)

  /**
   * How much to reduce when frequency is detected
   */
  reduceAmountDb: number;   // dB (typically -6 to -12)

  /**
   * Attack time for EQ activation
   */
  attackMs: number;         // ms (typically 10-50ms)

  /**
   * Release time for EQ deactivation
   */
  releaseMs: number;        // ms (typically 50-200ms)

  /**
   * Width of frequency band to monitor
   */
  bandWidth: number;        // Q value (typically 1-5)

  /**
   * Threshold level to trigger EQ
   */
  thresholdDb: number;      // dB (typically -20 to -10)

  /**
   * Type of frequency curve
   */
  curveType: 'h' | 'q' | 's'; // high-shelf, bell, shelf

  /**
   * Make-up gain after reduction
   */
  makeUpGainDb?: number;
}

/**
 * Frequency masking analysis result
 */
export interface FrequencyMaskingResult {
  maskingDetected: boolean;
  conflictingFrequencies: number[];
  severity: 'none' | 'minor' | 'moderate' | 'major';
  recommendations: string[];
}

/**
 * Stem-specific EQ settings for frequency masking prevention
 */
export interface StemEQSettings {
  stemType: 'vocals' | 'drums' | 'bass' | 'other';
  highpassFreq?: number;    // Cut low frequencies
  lowpassFreq?: number;     // Cut high frequencies
  notchFreqs?: number[];    // Specific frequencies to reduce
  bellEq?: Array<{
    freq: number;
    gain: number;
    q: number;
  }>;
  shelfEq?: Array<{
    freq: number;
    gain: number;
    type: 'high' | 'low';
  }>;
}

/**
 * Common problematic frequency ranges and their solutions
 */
const FREQUENCY_MASKING_FIXES = [
  // Low-mids mud (200-500Hz)
  { range: [200, 500], eq: 'equalizer=f=350:t=h:width=150:g=-3', cause: 'bass_rhythm_mud' },
  
  // Vocal presence (2-4kHz)
  { range: [2000, 4000], eq: 'equalizer=f=3000:t=h:width=1000:g=-2', cause: 'vocals_instruments_clash' },
  
  // Sibilance (5-8kHz)
  { range: [5000, 8000], eq: 'equalizer=f=6500:t=h:width=2000:g=-4', cause: 'sibilance_harshness' },
  
  // Boxiness (400-800Hz)
  { range: [400, 800], eq: 'equalizer=f=600:t=h:width=300:g=-3', cause: 'boxy_resonance' },
  
  // Low end rumble (20-80Hz)
  { range: [20, 80], eq: 'highpass=f=60', cause: 'low_rumble' },
];

/**
 * Default EQ settings per stem type for frequency masking prevention
 */
export const DEFAULT_STEM_DYNAEQ: Record<string, StemEQSettings> = {
  vocals: {
    stemType: 'vocals',
    highpassFreq: 120,
    lowpassFreq: 12000,
    bellEq: [
      { freq: 350, gain: -2, q: 2 },   // Reduce low-mids
      { freq: 500, gain: -2, q: 2 },   // Reduce mud
      { freq: 6500, gain: -3, q: 2 }, // Reduce sibilance
    ],
  },
  
  drums: {
    stemType: 'drums',
    highpassFreq: 80,
    lowpassFreq: 12000,
    bellEq: [
      { freq: 150, gain: -3, q: 2 },   // Cut low-mud
      { freq: 250, gain: 2, q: 2 },   // Boost low-end punch
      { freq: 400, gain: -2, q: 2 },  // Reduce mud
    ],
  },
  
  bass: {
    stemType: 'bass',
    lowpassFreq: 200,
    bellEq: [
      { freq: 80, gain: 3, q: 1 },     // Boost sub
      { freq: 150, gain: 2, q: 1 },   // Boost low-end
      { freq: 350, gain: -4, q: 2 },  // Cut mud heavily
    ],
  },
  
  other: {
    stemType: 'other',
    bellEq: [
      { freq: 500, gain: -4, q: 2 },  // Cut mud significantly
      { freq: 2500, gain: -2, q: 2 }, // Reduce vocal clash
    ],
  },
};

/**
 * Build dynamic EQ filter for FFmpeg
 * 
 * FFmpeg doesn't have native dynamic EQ, so we approximate with:
 * 1. Sidechain compressor for frequency bands
 * 2. Volume automation based on frequency detection
 * 3. Parametric EQ with envelope following (advanced)
 */
export function buildDynamicEQFilter(config: DynamicEQConfig): string {
  // Method 1: Use acompressor as frequency-specific sidechain
  // This creates a "ducking" effect only for the monitored frequency band
  
  const bandpass = `bandpass=f=${config.detectFrequency}:width_type=h:width=${config.bandWidth}`;
  const compressor = `acompressor=threshold=${config.thresholdDb}db:ratio=${Math.pow(10, Math.abs(config.reduceAmountDb) / 20)}:attack=${config.attackMs}ms:release=${config.releaseMs}ms`;
  const makeup = config.makeUpGainDb !== undefined ? `volume=${Math.pow(10, config.makeUpGainDb / 20)}` : '';
  
  // This is an approximation - true dynamic EQ would need a DAW or plugin
  return `${bandpass},${compressor}${makeup ? `,${makeup}` : ''}`;
}

/**
 * Build stem-specific EQ filter chain from settings
 */
export function buildStemEQFilter(settings: StemEQSettings): string {
  const filters: string[] = [];

  // Highpass
  if (settings.highpassFreq) {
    filters.push(`highpass=f=${settings.highpassFreq}`);
  }

  // Lowpass
  if (settings.lowpassFreq) {
    filters.push(`lowpass=f=${settings.lowpassFreq}`);
  }

  // Bell EQ (peaking filters)
  if (settings.bellEq) {
    for (const bell of settings.bellEq) {
      filters.push(`equalizer=f=${bell.freq}:t=h:width=${bell.q * 100}:g=${bell.gain}`);
    }
  }

  // Shelf EQ
  if (settings.shelfEq) {
    for (const shelf of settings.shelfEq) {
      const type = shelf.type === 'high' ? 'highshelf' : 'lowshelf';
      filters.push(`${type}_filter=f=${shelf.freq}:gain=${shelf.gain}`);
    }
  }

  // Notch frequencies (for removing specific problem frequencies)
  if (settings.notchFreqs) {
    for (const notch of settings.notchFreqs) {
      filters.push(`equalizer=f=${notch}:t=h:width=50:g=-20`); // 50Hz Q = narrow notch
    }
  }

  return filters.join(',');
}

/**
 * Detect frequency masking between stems
 * 
 * Analyzes spectral content and identifies overlapping frequencies
 */
export async function detectFrequencyMasking(
  stems: Map<string, Buffer>,
  sampleRate: number = 44100
): Promise<FrequencyMaskingResult> {
  // Note: This would require FFT analysis of audio buffers
  // For now, we'll use heuristics based on stem types
  
  const conflictingFrequencies: number[] = [];
  const recommendations: string[] = [];
  
  const hasVocals = stems.has('vocals');
  const hasDrums = stems.has('drums');
  const hasBass = stems.has('bass');
  const hasOther = stems.has('other');
  
  // Detect common masking scenarios
  
  // 1. Vocals vs Instruments (2-4kHz clash)
  if (hasVocals && (hasOther || hasDrums)) {
    conflictingFrequencies.push(2500);
    conflictingFrequencies.push(3500);
    recommendations.push('Apply -2dB cut to instruments at 2500-4000Hz for vocal clarity');
  }
  
  // 2. Bass vs Drums (80-200Hz clash)
  if (hasBass && hasDrums) {
    conflictingFrequencies.push(120);
    conflictingFrequencies.push(150);
    recommendations.push('Use sidechain compression: duck bass when drums enter');
  }
  
  // 3. Low-mids mud (200-500Hz)
  if (hasDrums && hasOther) {
    conflictingFrequencies.push(350);
    recommendations.push('Apply highpass filter at 150Hz to instruments');
  }
  
  // Determine severity
  let severity: 'none' | 'minor' | 'moderate' | 'major';
  if (conflictingFrequencies.length === 0) {
    severity = 'none';
  } else if (conflictingFrequencies.length <= 2) {
    severity = 'minor';
  } else if (conflictingFrequencies.length <= 4) {
    severity = 'moderate';
  } else {
    severity = 'major';
  }

  log('info', 'dynamicEq.maskingDetected', {
    conflictingFrequencies,
    severity,
    recommendationCount: recommendations.length,
  });

  return {
    maskingDetected: conflictingFrequencies.length > 0,
    conflictingFrequencies,
    severity,
    recommendations,
  };
}

/**
 * Get recommended EQ settings for preventing frequency masking
 * 
 * Returns EQ settings based on which stems are present
 */
export function getPreventativeEQSettings(
  stemsPresent: string[]
): Map<string, StemEQSettings> {
  const settings = new Map<string, StemEQSettings>();
  
  for (const stemType of stemsPresent) {
    const defaultSettings = DEFAULT_STEM_DYNAEQ[stemType];
    if (defaultSettings) {
      settings.set(stemType, { ...defaultSettings });
    }
  }
  
  // Adjust based on which other stems are present
  
  // If vocals present, reduce mids in other stems
  if (stemsPresent.includes('vocals')) {
    for (const otherStem of ['drums', 'bass', 'other']) {
      if (stemsPresent.includes(otherStem) && settings.has(otherStem)) {
        const currentSettings = settings.get(otherStem)!;
        // Add bell EQ to cut vocal presence range
        currentSettings.bellEq = currentSettings.bellEq || [];
        currentSettings.bellEq.push({ freq: 3000, gain: -3, q: 2 });
      }
    }
  }
  
  // If bass and drums both present, add sidechain recommendation
  if (stemsPresent.includes('bass') && stemsPresent.includes('drums')) {
    const bassSettings = settings.get('bass');
    if (bassSettings) {
      bassSettings.shelfEq = bassSettings.shelfEq || [];
      bassSettings.shelfEq.push({ freq: 80, gain: -2, type: 'low' });
    }
  }
  
  return settings;
}

/**
 * Build complete dynamic EQ filter graph for multiple stems
 */
export function buildDynamicEQGraph(
  stems: Map<string, Buffer>,
  settings: Map<string, StemEQSettings>
): string {
  const filters: string[] = [];
  
  for (const [stemType, stemBuffer] of stems) {
    const stemSettings = settings.get(stemType);
    if (!stemSettings || !stemBuffer) {
      continue;
    }
    
    // Get input label for this stem
    const inputLabel = `${stemType}_in`;
    
    // Build stem-specific EQ filter
    const eqFilter = buildStemEQFilter(stemSettings);
    
    filters.push(`[${inputLabel}]${eqFilter}[${stemType}_eq]`);
  }
  
  return filters.join(';');
}

/**
 * Validate dynamic EQ configuration
 */
export function validateDynamicEQConfig(config: DynamicEQConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Frequency range
  if (config.detectFrequency < 20 || config.detectFrequency > 20000) {
    errors.push(`detectFrequency must be between 20-20000Hz, got ${config.detectFrequency}`);
  }
  
  // Reduce amount range
  if (config.reduceAmountDb > 0 || config.reduceAmountDb < -24) {
    errors.push(`reduceAmountDb must be between -24 and 0dB, got ${config.reduceAmountDb}`);
  }
  
  // Attack time range
  if (config.attackMs < 1 || config.attackMs > 500) {
    errors.push(`attackMs must be between 1-500ms, got ${config.attackMs}`);
  }
  
  // Release time range
  if (config.releaseMs < 5 || config.releaseMs > 2000) {
    errors.push(`releaseMs must be between 5-2000ms, got ${config.releaseMs}`);
  }
  
  // Bandwidth (Q) range
  if (config.bandWidth < 0.1 || config.bandWidth > 10) {
    errors.push(`bandWidth (Q) must be between 0.1-10, got ${config.bandWidth}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get common frequency masking presets
 */
export function getFrequencyMaskingPreset(presetName: 'vocals_clear' | 'bass_tight' | 'drums_punchy' | 'full_mix'): StemEQSettings {
  const presets: Record<string, StemEQSettings> = {
    vocals_clear: {
      stemType: 'vocals',
      highpassFreq: 120,
      lowpassFreq: 12000,
      bellEq: [
        { freq: 350, gain: -3, q: 2 },
        { freq: 2500, gain: 1, q: 1 },   // Presence
        { freq: 5000, gain: -4, q: 2 },  // Sibilance
        { freq: 8000, gain: -3, q: 2 },  // Air control
      ],
    },
    
    bass_tight: {
      stemType: 'bass',
      lowpassFreq: 200,
      bellEq: [
        { freq: 60, gain: 2, q: 1 },
        { freq: 250, gain: -4, q: 1 }, // Cut mud
        { freq: 400, gain: -6, q: 2 },
      ],
    },
    
    drums_punchy: {
      stemType: 'drums',
      highpassFreq: 80,
      lowpassFreq: 12000,
      bellEq: [
        { freq: 100, gain: 3, q: 1 },
        { freq: 250, gain: -3, q: 2 },
        { freq: 400, gain: -2, q: 1 },
        { freq: 5000, gain: 2, q: 2 },  // Attack
      ],
    },
    
    full_mix: {
      stemType: 'other',
      bellEq: [
        { freq: 200, gain: -3, q: 2 },
        { freq: 350, gain: -4, q: 2 },
        { freq: 600, gain: -2, q: 1 },
        { freq: 2500, gain: -2, q: 2 },
        { freq: 8000, gain: -1, q: 1 },
      ],
    },
  };
  
  return presets[presetName];
}

/**
 * Apply dynamic EQ in real-time (for live mixing)
 * 
 * This is a placeholder for future real-time implementation
 * that would use Web Audio API or similar
 */
export class DynamicEQProcessor {
  private config: DynamicEQConfig;
  private enabled: boolean = true;
  
  constructor(config: DynamicEQConfig) {
    this.config = config;
  }
  
  public updateConfig(newConfig: Partial<DynamicEQConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Process audio frame with dynamic EQ
   * This would be implemented with Web Audio API in the browser
   */
  public processFrame(audioData: Float32Array): Float32Array {
    if (!this.enabled) {
      return audioData;
    }
    
    // Placeholder: In a real implementation, this would:
    // 1. FFT to get frequency spectrum
    // 2. Detect presence of target frequency
    // 3. Apply EQ reduction if detected
    // 4. Use attack/release smoothing
    
    return audioData;
  }
}

log('info', 'dynamicEq.service.loaded', {
  availablePresets: ['vocals_clear', 'bass_tight', 'drums_punchy', 'full_mix'],
  defaultStemEQ: Object.keys(DEFAULT_STEM_DYNAEQ),
});
