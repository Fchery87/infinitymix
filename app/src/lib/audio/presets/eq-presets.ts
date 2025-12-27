/**
 * EQ Presets
 * 
 * Collection of equalization presets for different stems, genres, and use cases.
 * Prevents frequency masking and enhances clarity.
 */

import { log } from '@/lib/logger';

/**
 * EQ band definition
 */
export interface EQBand {
  freq: number;     // Frequency in Hz
  gain: number;     // Gain in dB
  q: number;        // Q value (bandwidth)
  type: 'bell' | 'high' | 'low';  // Filter type
}

/**
 * Stem-specific EQ preset
 */
export interface StemEQPreset {
  name: string;
  description: string;
  bands: EQBand[];
  highpass?: number;   // Highpass filter frequency
  lowpass?: number;    // Lowpass filter frequency
}

/**
 * Genre-specific EQ preset
 */
export interface GenreEQPreset {
  name: string;
  description: string;
  vocals: EQBand[];
  drums: EQBand[];
  bass: EQBand[];
  other: EQBand[];
  overall: EQBand[];
}

/**
 * Problem-solving EQ presets (fixes common issues)
 */
export interface ProblemEQPreset {
  name: string;
  description: string;
  problem: string;
  solution: string;
  bands: EQBand[];
}

/**
 * Stem-specific EQ presets for preventing frequency masking
 */
export const STEM_EQ_PRESETS: Record<string, StemEQPreset> = {
  // ==================== Vocals ====================
  vocals_clear: {
    name: 'Vocals - Clear & Present',
    description: 'Reduces muddiness, enhances presence, controls sibilance',
    highpass: 120,
    lowpass: 12000,
    bands: [
      { freq: 350, gain: -2, q: 2, type: 'bell' },   // Reduce low-mids
      { freq: 500, gain: -2, q: 2, type: 'bell' },   // Cut mud
      { freq: 2500, gain: 1, q: 1, type: 'bell' },  // Presence
      { freq: 5000, gain: -4, q: 2, type: 'bell' },  // Sibilance
      { freq: 8000, gain: -3, q: 2, type: 'bell' },  // Air control
    ],
  },

  vocals_warm: {
    name: 'Vocals - Warm & Smooth',
    description: 'Adds warmth, reduces harshness',
    highpass: 100,
    lowpass: 10000,
    bands: [
      { freq: 250, gain: 2, q: 1, type: 'bell' },    // Add warmth
      { freq: 350, gain: -1, q: 2, type: 'bell' },
      { freq: 3000, gain: 1, q: 1, type: 'bell' },
      { freq: 6000, gain: -2, q: 1, type: 'bell' },  // Reduce harshness
    ],
  },

  // ==================== Drums ====================
  drums_punchy: {
    name: 'Drums - Punchy & Tight',
    description: 'Enhances attack, tightens low end',
    highpass: 80,
    lowpass: 12000,
    bands: [
      { freq: 100, gain: 3, q: 1, type: 'bell' },    // Boost low punch
      { freq: 150, gain: 2, q: 1, type: 'bell' },   // Low-end
      { freq: 250, gain: -3, q: 2, type: 'bell' },   // Cut mud
      { freq: 400, gain: -2, q: 1, type: 'bell' },
      { freq: 4000, gain: 3, q: 1, type: 'bell' },  // Attack
      { freq: 6000, gain: 2, q: 2, type: 'bell' },  // Click
    ],
  },

  drums_room: {
    name: 'Drums - Roomy & Natural',
    description: 'Preserves room tone, adds body',
    highpass: 60,
    lowpass: 14000,
    bands: [
      { freq: 80, gain: 1, q: 1, type: 'bell' },
      { freq: 200, gain: 2, q: 1, type: 'bell' },
      { freq: 5000, gain: 1, q: 1, type: 'bell' },
    ],
  },

  // ==================== Bass ====================
  bass_tight: {
    name: 'Bass - Tight & Focused',
    description: 'Focuses on sub and low-mid, cuts mud',
    lowpass: 200,
    bands: [
      { freq: 60, gain: 3, q: 1, type: 'bell' },    // Boost sub
      { freq: 100, gain: 2, q: 1, type: 'bell' },   // Low-end
      { freq: 150, gain: 1, q: 1, type: 'bell' },
      { freq: 350, gain: -4, q: 2, type: 'bell' },  // Cut mud heavily
      { freq: 500, gain: -2, q: 1, type: 'bell' },
    ],
  },

  bass_boomy: {
    name: 'Bass - Boomy & Warm',
    description: 'Emphasizes warmth and body',
    lowpass: 250,
    bands: [
      { freq: 80, gain: 4, q: 1, type: 'bell' },
      { freq: 120, gain: 3, q: 1, type: 'bell' },
      { freq: 200, gain: 1, q: 1, type: 'bell' },
    ],
  },

  // ==================== Other (Instrumental/Melody) ====================
  other_clear: {
    name: 'Other - Clear & Defined',
    description: 'Cuts mud, leaves mids for blend',
    highpass: 200,
    lowpass: 15000,
    bands: [
      { freq: 350, gain: -4, q: 2, type: 'bell' },  // Cut low-mud significantly
      { freq: 500, gain: -3, q: 1, type: 'bell' },
      { freq: 2500, gain: -2, q: 2, type: 'bell' }, // Reduce vocal clash
      { freq: 6000, gain: -1, q: 1, type: 'bell' },
    ],
  },

  other_warm: {
    name: 'Other - Warm & Blended',
    description: 'Adds warmth for smooth mixing',
    highpass: 150,
    bands: [
      { freq: 250, gain: 2, q: 1, type: 'bell' },
      { freq: 400, gain: -2, q: 1, type: 'bell' },
      { freq: 2000, gain: 1, q: 1, type: 'bell' },
      { freq: 5000, gain: -1, q: 1, type: 'bell' },
    ],
  },
};

/**
 * Genre-specific EQ presets
 */
export const GENRE_EQ_PRESETS: Record<string, GenreEQPreset> = {
  electronic: {
    name: 'Electronic',
    description: 'Tight bass, punchy drums, clear vocals',
    vocals: [
      { freq: 350, gain: -2, q: 2, type: 'bell' },
      { freq: 5000, gain: -3, q: 2, type: 'bell' },
      { freq: 8000, gain: 2, q: 1, type: 'bell' },  // Brightness
    ],
    drums: [
      { freq: 100, gain: 3, q: 1, type: 'bell' },
      { freq: 4000, gain: 3, q: 1, type: 'bell' },
    ],
    bass: [
      { freq: 60, gain: 4, q: 1, type: 'bell' },
      { freq: 350, gain: -4, q: 2, type: 'bell' },
    ],
    other: [
      { freq: 350, gain: -4, q: 2, type: 'bell' },
      { freq: 2500, gain: -2, q: 2, type: 'bell' },
    ],
    overall: [
      { freq: 120, gain: -1, q: 1, type: 'bell' },  // Highpass
      { freq: 14000, gain: -1, q: 1, type: 'bell' }, // Lowpass
    ],
  },

  hiphop: {
    name: 'Hip Hop',
    description: 'Boomy 808s, punchy snares, present vocals',
    vocals: [
      { freq: 400, gain: -1, q: 2, type: 'bell' },
      { freq: 3000, gain: 2, q: 1, type: 'bell' },  // Upper-mid presence
    ],
    drums: [
      { freq: 120, gain: 2, q: 1, type: 'bell' },
      { freq: 5000, gain: 4, q: 1, type: 'bell' },  // Snare crack
    ],
    bass: [
      { freq: 80, gain: 5, q: 1, type: 'bell' },
      { freq: 200, gain: 2, q: 1, type: 'bell' },
    ],
    other: [
      { freq: 350, gain: -3, q: 2, type: 'bell' },
    ],
    overall: [
      { freq: 80, gain: -1, q: 1, type: 'bell' },
    ],
  },

  rock: {
    name: 'Rock',
    description: 'Aggressive drums, warm vocals, defined bass',
    vocals: [
      { freq: 350, gain: -3, q: 2, type: 'bell' },  // Cut boxiness
      { freq: 2000, gain: 2, q: 1, type: 'bell' },
    ],
    drums: [
      { freq: 150, gain: 3, q: 1, type: 'bell' },
      { freq: 3000, gain: 2, q: 1, type: 'bell' },
    ],
    bass: [
      { freq: 80, gain: 2, q: 1, type: 'bell' },
      { freq: 400, gain: -3, q: 2, type: 'bell' },
    ],
    other: [
      { freq: 400, gain: -2, q: 1, type: 'bell' },
    ],
    overall: [
      { freq: 100, gain: -2, q: 1, type: 'bell' },
    ],
  },

  pop: {
    name: 'Pop',
    description: 'Balanced, polished, radio-ready',
    vocals: [
      { freq: 250, gain: 1, q: 1, type: 'bell' },    // Warmth
      { freq: 500, gain: -1, q: 2, type: 'bell' },
      { freq: 3000, gain: 2, q: 1, type: 'bell' },
      { freq: 6000, gain: 1, q: 1, type: 'bell' },   // Air
    ],
    drums: [
      { freq: 100, gain: 2, q: 1, type: 'bell' },
      { freq: 4000, gain: 2, q: 1, type: 'bell' },
    ],
    bass: [
      { freq: 80, gain: 2, q: 1, type: 'bell' },
      { freq: 200, gain: 1, q: 1, type: 'bell' },
    ],
    other: [
      { freq: 400, gain: -2, q: 1, type: 'bell' },
    ],
    overall: [
      { freq: 100, gain: -1, q: 1, type: 'bell' },
    ],
  },

  jazz: {
    name: 'Jazz',
    description: 'Warm, natural, preserving acoustic character',
    vocals: [
      { freq: 200, gain: 2, q: 1, type: 'bell' },
      { freq: 2000, gain: 1, q: 1, type: 'bell' },
    ],
    drums: [
      { freq: 80, gain: 1, q: 1, type: 'bell' },
      { freq: 3000, gain: 1, q: 1, type: 'bell' },
    ],
    bass: [
      { freq: 100, gain: 1, q: 1, type: 'bell' },
    ],
    other: [
      { freq: 300, gain: -1, q: 1, type: 'bell' },
    ],
    overall: [],  // Minimal processing
  },
};

/**
 * Problem-solving EQ presets
 */
export const PROBLEM_EQ_PRESETS: Record<string, ProblemEQPreset> = {
  // ==================== Common Problems ====================
  muddy_mix: {
    name: 'Muddy Mix',
    description: 'Removes low-mid mud for clarity',
    problem: 'Mud in 200-500Hz range',
    solution: 'Cut low-mids and apply highpass',
    bands: [
      { freq: 250, gain: -3, q: 2, type: 'bell' },
      { freq: 350, gain: -3, q: 2, type: 'bell' },
      { freq: 450, gain: -2, q: 2, type: 'bell' },
      { freq: 80, gain: -2, q: 1, type: 'low' },
    ],
  },

  boxy_sound: {
    name: 'Boxy Sound',
    description: 'Removes boxy resonance',
    problem: 'Boxy resonance at 400-800Hz',
    solution: 'Cut boxy frequency range',
    bands: [
      { freq: 500, gain: -4, q: 2, type: 'bell' },
      { freq: 650, gain: -3, q: 2, type: 'bell' },
    ],
  },

  harsh_highs: {
    name: 'Harsh Highs',
    description: 'Reduces harshness in high frequencies',
    problem: 'Harshness above 5kHz',
    solution: 'Cut high frequencies gently',
    bands: [
      { freq: 5000, gain: -3, q: 2, type: 'bell' },
      { freq: 6500, gain: -3, q: 2, type: 'bell' },
      { freq: 8000, gain: -2, q: 1, type: 'bell' },
      { freq: 12000, gain: -2, q: 1, type: 'low' },
    ],
  },

  vocal_clash: {
    name: 'Vocal Clash',
    description: 'Reduces vocal-instrument frequency overlap',
    problem: 'Vocals clashing with instruments at 2-4kHz',
    solution: 'Cut vocal presence range in instruments',
    bands: [
      { freq: 2500, gain: -4, q: 2, type: 'bell' },
      { freq: 3500, gain: -3, q: 2, type: 'bell' },
    ],
  },

  bass_drum_competition: {
    name: 'Bass-Drum Competition',
    description: 'Creates separation between bass and kick',
    problem: 'Bass and kick competing for headroom',
    solution: 'Sidechain: duck bass when drums enter',
    bands: [
      { freq: 80, gain: 2, q: 1, type: 'bell' },
      { freq: 120, gain: -2, q: 1, type: 'bell' },
    ],
  },

  sibilance: {
    name: 'Sibilance',
    description: 'Reduces harsh "S" sounds',
    problem: 'Sibilance at 5-8kHz',
    solution: 'Cut sibilant frequency range',
    bands: [
      { freq: 5500, gain: -4, q: 2, type: 'bell' },
      { freq: 7000, gain: -4, q: 2, type: 'bell' },
      { freq: 8500, gain: -2, q: 2, type: 'bell' },
    ],
  },

  nasal_tone: {
    name: 'Nasal Tone',
    description: 'Removes nasal resonance',
    problem: 'Nasal resonance at 1-2kHz',
    solution: 'Cut nasal frequency',
    bands: [
      { freq: 1000, gain: -4, q: 2, type: 'bell' },
      { freq: 1500, gain: -2, q: 2, type: 'bell' },
    ],
  },
};

/**
 * Get EQ preset by stem type
 */
export function getStemEQPreset(stemType: string, presetName?: string): StemEQPreset {
  const presetId = presetName || `${stemType}_clear`;
  return STEM_EQ_PRESETS[presetId] || STEM_EQ_PRESETS[`${stemType}_clear`];
}

/**
 * Get EQ preset by genre
 */
export function getGenreEQPreset(genre: string): GenreEQPreset {
  return GENRE_EQ_PRESETS[genre] || GENRE_EQ_PRESETS.electronic;
}

/**
 * Get problem-solving EQ preset
 */
export function getProblemEQPreset(problem: string): ProblemEQPreset | undefined {
  return PROBLEM_EQ_PRESETS[problem];
}

/**
 * Build FFmpeg EQ filter string from bands
 */
export function buildEQFilterFromBands(bands: EQBand[], highpass?: number, lowpass?: number): string {
  const filters: string[] = [];

  // Add highpass
  if (highpass) {
    filters.push(`highpass=f=${highpass}`);
  }

  // Add bell filters
  for (const band of bands) {
    if (band.type === 'bell') {
      filters.push(`equalizer=f=${band.freq}:t=h:width=${band.q * 100}:g=${band.gain}`);
    }
  }

  // Add shelf filters
  for (const band of bands) {
    if (band.type === 'high') {
      filters.push(`highshelf=f=${band.freq}:gain=${band.gain}`);
    } else if (band.type === 'low') {
      filters.push(`lowshelf=f=${band.freq}:gain=${band.gain}`);
    }
  }

  // Add lowpass
  if (lowpass) {
    filters.push(`lowpass=f=${lowpass}`);
  }

  return filters.join(',');
}

/**
 * Analyze and suggest EQ fixes for common problems
 */
export function suggestEQFixes(audioAnalysis: {
  hasMud: boolean;
  hasHarshness: boolean;
  hasSibilance: boolean;
  hasBoxiness: boolean;
}): string[] {
  const suggestions: string[] = [];

  if (audioAnalysis.hasMud) {
    suggestions.push('Apply highpass at 80-120Hz and cut 200-500Hz');
  }

  if (audioAnalysis.hasHarshness) {
    suggestions.push('Cut 5-8kHz frequency range');
  }

  if (audioAnalysis.hasSibilance) {
    suggestions.push('Apply de-essing at 5-8kHz');
  }

  if (audioAnalysis.hasBoxiness) {
    suggestions.push('Cut 400-800Hz frequency range');
  }

  return suggestions;
}

/**
 * Get recommended EQ for preventing frequency masking
 * between specific stems
 */
export function getAntiMaskingEQ(
  fromStem: string,
  toStem: string
): EQBand[] {
  const eqs: Array<[string, string, EQBand[]]> = [
    // Vocals vs Other
    ['vocals', 'other', [
      { freq: 2500, gain: -3, q: 2, type: 'bell' },
      { freq: 3500, gain: -2, q: 2, type: 'bell' },
    ]],

    // Bass vs Drums
    ['bass', 'drums', [
      { freq: 100, gain: -2, q: 1, type: 'bell' },
      { freq: 150, gain: -2, q: 1, type: 'bell' },
    ]],

    // Drums vs Other
    ['drums', 'other', [
      { freq: 400, gain: -3, q: 2, type: 'bell' },
    ]],

    // Bass vs Other
    ['bass', 'other', [
      { freq: 300, gain: -4, q: 2, type: 'bell' },
    ]],
  ];

  const pair = eqs.find(([f, t]) => 
    (f === fromStem && t === toStem) || 
    (f === toStem && t === fromStem)
  );

  return pair ? pair[2] : [];
}

log('info', 'eqPresets.loaded', {
  stemPresets: Object.keys(STEM_EQ_PRESETS),
  genrePresets: Object.keys(GENRE_EQ_PRESETS),
  problemPresets: Object.keys(PROBLEM_EQ_PRESETS),
});
