/**
 * Genre Presets
 * 
 * Complete genre-specific audio processing configurations.
 * Includes transition styles, EQ settings, and mastering parameters.
 */

import { log } from '@/lib/logger';
import type { TransitionStyle } from '../presets/transition-presets';
import type { StemEQPreset } from '../presets/eq-presets';
import type { LoudnessConfig } from '../audio-normalizer';

/**
 * Audio processing preset for a specific genre
 */
export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  
  // Mixing settings
  mixSettings: {
    defaultTransition: TransitionStyle;
    transitionStyles: TransitionStyle[];
    crossfadeDuration: number;  // Default in seconds
    mixEnergy: 'high' | 'medium' | 'low';
  };
  
  // Processing settings
  processing: {
    enableMultibandCompression: boolean;
    enableDynamicEQ: boolean;
    enableSidechainDucking: boolean;
    loudnessNormalization: LoudnessConfig;
  };
  
  // Stem EQ settings
  stemEQ: {
    vocals: string;  // Preset ID from EQ presets
    drums: string;
    bass: string;
    other: string;
  };
  
  // Mastering settings
  mastering: {
    targetPeakDb: number;
    releaseReady: boolean;
    platformSpecific: 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'none';
  };
}

/**
 * Complete collection of genre presets
 */
export const GENRE_PRESETS: Record<string, GenrePreset> = {
  // ==================== Electronic ====================
  electronic: {
    id: 'electronic',
    name: 'Electronic / EDM',
    description: 'High energy, punchy drums, tight bass, seamless blends',
    mixSettings: {
      defaultTransition: 'drop',
      transitionStyles: ['smooth', 'drop', 'energy', 'filter_sweep', 'bass_drop', 'stutter_edit'],
      crossfadeDuration: 3,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 8,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  house: {
    id: 'house',
    name: 'House',
    description: 'Smooth blends, steady groove, warm bass, atmospheric',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'energy', 'filter_sweep', 'echo_reverb'],
      crossfadeDuration: 4,
      mixEnergy: 'medium',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 7,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_warm',
      drums: 'drums_room',
      bass: 'bass_boomy',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  techno: {
    id: 'techno',
    name: 'Techno',
    description: 'Driving beats, industrial bass, dark atmosphere',
    mixSettings: {
      defaultTransition: 'cut',
      transitionStyles: ['cut', 'drop', 'filter_sweep', 'tape_stop'],
      crossfadeDuration: 2,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 8,
        targetTP: -1.5,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1,
      releaseReady: false,
      platformSpecific: 'soundcloud',
    },
  },

  drum_bass: {
    id: 'drum_bass',
    name: 'Drum & Bass',
    description: 'Fast tempo, heavy bass, aggressive energy',
    mixSettings: {
      defaultTransition: 'cut',
      transitionStyles: ['cut', 'drop', 'stutter_edit', 'backspin'],
      crossfadeDuration: 1,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 9,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1,
      releaseReady: false,
      platformSpecific: 'soundcloud',
    },
  },

  // ==================== Hip Hop ====================
  hiphop: {
    id: 'hiphop',
    name: 'Hip Hop',
    description: 'Boomy 808s, punchy snares, present vocals',
    mixSettings: {
      defaultTransition: 'drop',
      transitionStyles: ['drop', 'cut', 'bass_drop', 'snare_roll'],
      crossfadeDuration: 3,
      mixEnergy: 'medium',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 9,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_boomy',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  trap: {
    id: 'trap',
    name: 'Trap',
    description: 'Dark 808s, rolling hi-hats, aggressive',
    mixSettings: {
      defaultTransition: 'drop',
      transitionStyles: ['drop', 'cut', 'bass_drop', 'stutter_edit'],
      crossfadeDuration: 2,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 10,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_boomy',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'soundcloud',
    },
  },

  rnb: {
    id: 'rnb',
    name: 'R&B',
    description: 'Smooth vocals, warm bass, polished production',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'energy', 'echo_reverb', 'filter_sweep'],
      crossfadeDuration: 4,
      mixEnergy: 'low',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 7,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_warm',
      drums: 'drums_room',
      bass: 'bass_boomy',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -2,
      releaseReady: true,
      platformSpecific: 'apple_music',
    },
  },

  // ==================== Rock ====================
  rock: {
    id: 'rock',
    name: 'Rock',
    description: 'Aggressive drums, punchy bass, present guitars',
    mixSettings: {
      defaultTransition: 'cut',
      transitionStyles: ['cut', 'drop', 'backspin', 'stutter_edit'],
      crossfadeDuration: 2,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 9,
        targetTP: -1.5,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  indie: {
    id: 'indie',
    name: 'Indie / Alternative',
    description: 'Natural tone, relaxed production, warm blends',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'energy', 'echo_reverb'],
      crossfadeDuration: 4,
      mixEnergy: 'low',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: false,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 9,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_warm',
      drums: 'drums_room',
      bass: 'bass_boomy',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -2,
      releaseReady: true,
      platformSpecific: 'apple_music',
    },
  },

  punk: {
    id: 'punk',
    name: 'Punk',
    description: 'Raw energy, fast tempo, aggressive',
    mixSettings: {
      defaultTransition: 'cut',
      transitionStyles: ['cut', 'drop', 'backspin'],
      crossfadeDuration: 1,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: false,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 10,
        targetTP: -1,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1,
      releaseReady: false,
      platformSpecific: 'soundcloud',
    },
  },

  // ==================== Pop ====================
  pop: {
    id: 'pop',
    name: 'Pop',
    description: 'Polished, radio-ready, balanced production',
    mixSettings: {
      defaultTransition: 'energy',
      transitionStyles: ['smooth', 'energy', 'filter_sweep', 'echo_reverb'],
      crossfadeDuration: 3,
      mixEnergy: 'medium',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 7,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  // ==================== Other ====================
  jazz: {
    id: 'jazz',
    name: 'Jazz',
    description: 'Warm, natural tone, minimal processing',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'energy', 'echo_reverb'],
      crossfadeDuration: 5,
      mixEnergy: 'low',
    },
    processing: {
      enableMultibandCompression: false,
      enableDynamicEQ: false,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -18,
        targetLRA: 10,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_warm',
      drums: 'drums_room',
      bass: 'bass_boomy',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -2.5,
      releaseReady: true,
      platformSpecific: 'apple_music',
    },
  },

  lofi: {
    id: 'lofi',
    name: 'Lo-Fi',
    description: 'Vintage tone, relaxed, warm',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'echo_reverb', 'tape_stop'],
      crossfadeDuration: 4,
      mixEnergy: 'low',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: false,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 10,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_warm',
      drums: 'drums_room',
      bass: 'bass_boomy',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -2,
      releaseReady: false,
      platformSpecific: 'youtube',
    },
  },

  // ==================== Country ====================
  country: {
    id: 'country',
    name: 'Country',
    description: 'Clear vocals, punchy drums, acoustic warmth',
    mixSettings: {
      defaultTransition: 'smooth',
      transitionStyles: ['smooth', 'energy', 'echo_reverb'],
      crossfadeDuration: 3,
      mixEnergy: 'medium',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: false,
      loudnessNormalization: {
        targetIntegrated: -16,
        targetLRA: 8,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_warm',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },

  // ==================== Latin ====================
  latin: {
    id: 'latin',
    name: 'Latin',
    description: 'Rhythmic, energetic, percussive',
    mixSettings: {
      defaultTransition: 'energy',
      transitionStyles: ['smooth', 'energy', 'drop', 'stutter_edit'],
      crossfadeDuration: 2,
      mixEnergy: 'high',
    },
    processing: {
      enableMultibandCompression: true,
      enableDynamicEQ: true,
      enableSidechainDucking: true,
      loudnessNormalization: {
        targetIntegrated: -14,
        targetLRA: 9,
        targetTP: -2,
        dualMono: true,
        printFormat: 'json',
      },
    },
    stemEQ: {
      vocals: 'vocals_clear',
      drums: 'drums_punchy',
      bass: 'bass_tight',
      other: 'other_clear',
    },
    mastering: {
      targetPeakDb: -1.5,
      releaseReady: true,
      platformSpecific: 'spotify',
    },
  },
};

/**
 * Get genre preset by ID
 */
export function getGenrePreset(genreId: string): GenrePreset | undefined {
  return GENRE_PRESETS[genreId];
}

/**
 * Get all available genre presets
 */
export function getAllGenrePresets(): GenrePreset[] {
  return Object.values(GENRE_PRESETS);
}

/**
 * Get genres filtered by energy level
 */
export function getGenresByEnergy(energy: 'high' | 'medium' | 'low'): GenrePreset[] {
  return Object.values(GENRE_PRESETS).filter(p => p.mixSettings.mixEnergy === energy);
}

/**
 * Get genres filtered by transition style
 */
export function getGenresByTransitionStyle(style: TransitionStyle): GenrePreset[] {
  return Object.values(GENRE_PRESETS).filter(p => 
    p.mixSettings.transitionStyles.includes(style)
  );
}

/**
 * Get recommended genre based on BPM
 */
export function getRecommendedGenreForBPM(bpm: number): string {
  if (bpm < 80) return 'lofi';
  if (bpm < 100) return 'hiphop';
  if (bpm < 110) return 'trap';
  if (bpm < 125) return 'house';
  if (bpm < 140) return 'techno';
  if (bpm < 160) return 'drum_bass';
  return 'electronic';
}

/**
 * Get recommended genre based on key compatibility
 */
export function getCompatibleGenres(camelotKey: string): string[] {
  // Suggest genres that work well with harmonic mixing
  const harmonicGenres = ['house', 'techno', 'electronic', 'drum_bass', 'trap'];
  const allGenres = ['pop', 'rock', 'indie', 'hiphop', 'rnb', 'jazz', 'lofi', 'country', 'latin'];
  
  return [...harmonicGenres, ...allGenres];
}

/**
 * Validate genre preset
 */
export function validateGenrePreset(preset: GenrePreset): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (preset.mixSettings.crossfadeDuration < 0) {
    errors.push('crossfadeDuration cannot be negative');
  }

  if (preset.processing.loudnessNormalization.targetIntegrated < -70) {
    errors.push('targetIntegrated too low (< -70 LUFS)');
  }

  if (preset.mastering.targetPeakDb > 0) {
    errors.push('targetPeakDb must be <= 0');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

log('info', 'genrePresets.loaded', {
  genreCount: Object.keys(GENRE_PRESETS).length,
  availableGenres: Object.keys(GENRE_PRESETS),
  energyLevels: ['high', 'medium', 'low'],
});
