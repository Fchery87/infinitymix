import type { AutoDjEnergyMode, AutoDjTransitionStyle } from '@/lib/audio/auto-dj-service';

export type StylePackSchemaVersion = '1.0.0';

export type StylePack = {
  schemaVersion: StylePackSchemaVersion;
  id: string;
  name: string;
  description?: string;
  isBuiltIn?: boolean;
  planner: {
    energyArc: {
      profile: AutoDjEnergyMode;
      targetCurve?: 'flat' | 'rising' | 'rolling';
      peakWindow?: [number, number];
    };
    phraseLengthsBars?: number[];
    sectionPriorities?: Array<'intro' | 'verse' | 'chorus' | 'hook' | 'bridge' | 'buildup' | 'drop' | 'outro'>;
    sectionQuotas?: {
      minVocalSegments?: number;
      minInstrumentalSegments?: number;
      maxHighEnergySegmentsInRow?: number;
    };
    transitions: {
      preferred: AutoDjTransitionStyle[];
      disallowed?: AutoDjTransitionStyle[];
      defaultStyle?: AutoDjTransitionStyle;
      durationMultiplier?: number;
      fxUsage?: {
        maxWetFx?: number;
        allowPreviewOnlyFx?: boolean;
      };
    };
    constraints: {
      phraseSafety: 'strict' | 'balanced' | 'loose';
      genreCompatibility: 'strict' | 'balanced' | 'loose';
      requireKeyCompatibility?: boolean;
      preferStems?: boolean;
      keepOrder?: boolean;
    };
    debug?: {
      traceEnabledDefault?: boolean;
      emitRejectedAlternatives?: boolean;
    };
  };
};

export type StylePackSummary = Pick<StylePack, 'id' | 'name' | 'description' | 'schemaVersion' | 'isBuiltIn'> & {
  energyProfile: AutoDjEnergyMode;
  defaultTransitionStyle: AutoDjTransitionStyle;
};

export const BUILT_IN_STYLE_PACKS: StylePack[] = [
  {
    schemaVersion: '1.0.0',
    id: 'steady-default',
    name: 'Steady Flow',
    description: 'Maps to current steady energy mode behavior with smooth phrase-safe transitions.',
    isBuiltIn: true,
    planner: {
      energyArc: { profile: 'steady', targetCurve: 'flat', peakWindow: [0.35, 0.7] },
      phraseLengthsBars: [8, 16],
      sectionPriorities: ['verse', 'chorus', 'hook', 'buildup', 'intro', 'outro'],
      sectionQuotas: {
        minVocalSegments: 1,
        minInstrumentalSegments: 1,
        maxHighEnergySegmentsInRow: 2,
      },
      transitions: {
        preferred: ['smooth', 'energy', 'echo_reverb', 'filter_sweep'],
        defaultStyle: 'smooth',
        durationMultiplier: 1,
        fxUsage: { maxWetFx: 0.35, allowPreviewOnlyFx: true },
      },
      constraints: {
        phraseSafety: 'strict',
        genreCompatibility: 'balanced',
        requireKeyCompatibility: true,
        preferStems: true,
        keepOrder: false,
      },
      debug: {
        traceEnabledDefault: false,
        emitRejectedAlternatives: false,
      },
    },
  },
  {
    schemaVersion: '1.0.0',
    id: 'build-default',
    name: 'Build Arc',
    description: 'Maps to current build mode with stronger energy lift and drop-oriented transitions.',
    isBuiltIn: true,
    planner: {
      energyArc: { profile: 'build', targetCurve: 'rising', peakWindow: [0.6, 0.95] },
      phraseLengthsBars: [8, 16, 32],
      sectionPriorities: ['intro', 'verse', 'buildup', 'chorus', 'drop', 'hook', 'outro'],
      sectionQuotas: {
        minVocalSegments: 1,
        minInstrumentalSegments: 2,
        maxHighEnergySegmentsInRow: 3,
      },
      transitions: {
        preferred: ['energy', 'drop', 'bass_drop', 'snare_roll', 'noise_riser', 'filter_sweep'],
        disallowed: ['cut'],
        defaultStyle: 'energy',
        durationMultiplier: 1.1,
        fxUsage: { maxWetFx: 0.5, allowPreviewOnlyFx: true },
      },
      constraints: {
        phraseSafety: 'balanced',
        genreCompatibility: 'balanced',
        requireKeyCompatibility: true,
        preferStems: true,
        keepOrder: false,
      },
      debug: {
        traceEnabledDefault: false,
        emitRejectedAlternatives: false,
      },
    },
  },
  {
    schemaVersion: '1.0.0',
    id: 'wave-default',
    name: 'Wave Motion',
    description: 'Maps to current wave mode with rolling energy and alternating tension/release transitions.',
    isBuiltIn: true,
    planner: {
      energyArc: { profile: 'wave', targetCurve: 'rolling', peakWindow: [0.45, 0.8] },
      phraseLengthsBars: [8, 16],
      sectionPriorities: ['verse', 'chorus', 'bridge', 'buildup', 'hook', 'drop', 'outro'],
      sectionQuotas: {
        minVocalSegments: 1,
        minInstrumentalSegments: 1,
        maxHighEnergySegmentsInRow: 2,
      },
      transitions: {
        preferred: ['smooth', 'energy', 'echo_reverb', 'drop', 'reverb_wash', 'echo_out'],
        defaultStyle: 'smooth',
        durationMultiplier: 1,
        fxUsage: { maxWetFx: 0.45, allowPreviewOnlyFx: true },
      },
      constraints: {
        phraseSafety: 'strict',
        genreCompatibility: 'balanced',
        requireKeyCompatibility: true,
        preferStems: true,
        keepOrder: false,
      },
      debug: {
        traceEnabledDefault: false,
        emitRejectedAlternatives: false,
      },
    },
  },
];

export function listBuiltInStylePacks(): StylePack[] {
  return BUILT_IN_STYLE_PACKS.map((pack) => structuredClone(pack));
}

export function listBuiltInStylePackSummaries(): StylePackSummary[] {
  return BUILT_IN_STYLE_PACKS.map((pack) => ({
    id: pack.id,
    name: pack.name,
    description: pack.description,
    schemaVersion: pack.schemaVersion,
    isBuiltIn: Boolean(pack.isBuiltIn),
    energyProfile: pack.planner.energyArc.profile,
    defaultTransitionStyle: pack.planner.transitions.defaultStyle ?? pack.planner.transitions.preferred[0] ?? 'smooth',
  }));
}

export function getBuiltInStylePackById(stylePackId: string): StylePack | null {
  const found = BUILT_IN_STYLE_PACKS.find((pack) => pack.id === stylePackId);
  return found ? structuredClone(found) : null;
}

export function applyStylePackToAutoDjRequest<
  T extends {
    energyMode?: AutoDjEnergyMode;
    transitionStyle?: AutoDjTransitionStyle;
    preferStems?: boolean;
    keepOrder?: boolean;
    fadeDurationSeconds?: number;
  },
>(request: T, stylePack: StylePack): T {
  const preferredTransition =
    stylePack.planner.transitions.defaultStyle ??
    stylePack.planner.transitions.preferred[0] ??
    request.transitionStyle;
  const durationMultiplier = stylePack.planner.transitions.durationMultiplier ?? 1;
  return {
    ...request,
    energyMode: request.energyMode ?? stylePack.planner.energyArc.profile,
    transitionStyle: request.transitionStyle ?? preferredTransition,
    preferStems: request.preferStems ?? stylePack.planner.constraints.preferStems,
    keepOrder: request.keepOrder ?? stylePack.planner.constraints.keepOrder,
    fadeDurationSeconds:
      request.fadeDurationSeconds != null
        ? request.fadeDurationSeconds
        : preferredTransition && durationMultiplier !== 1
          ? Math.max(0, Number((4 * durationMultiplier).toFixed(2)))
          : request.fadeDurationSeconds,
  };
}
