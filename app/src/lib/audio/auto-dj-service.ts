import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import { handleAsyncError } from '@/lib/utils/error-handling';
import {
  calculateBeatAlignment,
  calculateTempoRatio,
} from '@/lib/utils/audio-compat';
import ffmpeg from 'fluent-ffmpeg';
import { getTrackInfoForMixing } from './stems-service';
import { eq, inArray } from 'drizzle-orm';
import { uploadedTracks } from '@/lib/db/schema';
import path from 'node:path';

export type { TransitionPreset } from './presets/transition-presets';

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';

/**
 * Find and configure FFmpeg path
 * Handles multiple installation methods and package versions
 */
function configureFFmpeg() {
  const possiblePaths: string[] = [];

  // 1. Try ffmpeg-static package (newer versions)
  try {
    const ffmpegStaticPath = require('ffmpeg-static');
    if (typeof ffmpegStaticPath === 'string') {
      possiblePaths.push(ffmpegStaticPath);
    } else if (typeof ffmpegStaticPath === 'object' && ffmpegStaticPath.path) {
      possiblePaths.push(ffmpegStaticPath.path);
    } else if (
      typeof ffmpegStaticPath === 'object' &&
      (ffmpegStaticPath as any).ffmpegPath
    ) {
      possiblePaths.push((ffmpegStaticPath as any).ffmpegPath);
    }
  } catch (error) {
    log('warn', 'ffmpeg.static.notFound', { error: (error as Error).message });
  }

  // 2. Try environment variable
  if (process.env.FFMPEG_PATH) {
    possiblePaths.push(process.env.FFMPEG_PATH);
  }

  // 3. Try common system paths (for manually installed ffmpeg)
  const platform = process.platform;
  const systemPaths: string[] = [];

  if (platform === 'linux') {
    // Linux paths
    systemPaths.push(
      '/usr/bin/ffmpeg', // Most common (apt, yum, dnf)
      '/usr/local/bin/ffmpeg', // Manual install
      '/snap/bin/ffmpeg', // Snap package
      '/usr/lib/ffmpeg', // Some distros
      '/usr/libexec/ffmpeg', // Some distros
      '/opt/ffmpeg/bin/ffmpeg' // Manual/opt install
    );
  } else if (platform === 'darwin') {
    // macOS paths
    systemPaths.push(
      '/opt/homebrew/bin/ffmpeg', // Homebrew on Apple Silicon
      '/usr/local/bin/ffmpeg', // Homebrew Intel / manual
      '/opt/local/bin/ffmpeg'
    );
  } else if (platform === 'win32') {
    // Windows paths
    systemPaths.push(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe'
    );
  }

  possiblePaths.push(...systemPaths);

  // 4. Try node_modules direct paths (platform-specific)
  const nodeModulesPaths: string[] = [];

  if (platform === 'linux') {
    nodeModulesPaths.push(
      path.join(
        process.cwd(),
        'node_modules',
        'ffmpeg-static',
        'linux',
        'x64',
        'ffmpeg'
      ),
      path.join(
        process.cwd(),
        'node_modules',
        '@ffmpeg-installer',
        'linux',
        'x64',
        'ffmpeg'
      )
    );
  } else if (platform === 'darwin') {
    nodeModulesPaths.push(
      path.join(
        process.cwd(),
        'node_modules',
        'ffmpeg-static',
        'darwin',
        'x64',
        'ffmpeg'
      ),
      path.join(
        process.cwd(),
        'node_modules',
        'ffmpeg-static',
        'darwin',
        'arm64',
        'ffmpeg'
      )
    );
  } else if (platform === 'win32') {
    nodeModulesPaths.push(
      path.join(
        process.cwd(),
        'node_modules',
        'ffmpeg-static',
        'win32',
        'x64',
        'ffmpeg.exe'
      )
    );
  }

  // Universal fallback path
  nodeModulesPaths.push(
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    path.join(process.cwd(), 'node_modules', '@ffmpeg-installer', 'ffmpeg')
  );

  possiblePaths.push(...nodeModulesPaths);

  // Try each path until one works
  for (const ffmpegPath of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        log('info', 'ffmpeg.path.configured', {
          path: ffmpegPath,
          method: 'auto-detected',
        });
        return ffmpegPath;
      }
    } catch (error) {
      // Continue to next path
    }
  }

  log('warn', 'ffmpeg.path.notFound', {
    tried: possiblePaths,
    message: 'FFmpeg not found - audio processing will fail',
  });

  return null;
}

const configuredFfmpegPath = configureFFmpeg();

export type AutoDjEnergyMode = 'steady' | 'build' | 'wave';
export type AutoDjEventType =
  | 'wedding'
  | 'birthday'
  | 'sweet16'
  | 'club'
  | 'default';
export type AutoDjTransitionStyle =
  | 'smooth'
  | 'drop'
  | 'energy'
  | 'cut'
  | 'filter_sweep'
  | 'echo_reverb'
  | 'backspin'
  | 'tape_stop'
  | 'stutter_edit'
  | 'three_band_swap'
  | 'bass_drop'
  | 'snare_roll'
  | 'noise_riser'
  // New stem-based transitions
  | 'vocal_handoff'
  | 'bass_swap'
  | 'reverb_wash'
  | 'echo_out';

export type TransitionStyle = AutoDjTransitionStyle;

export type AutoDjMixMode =
  | 'standard'
  | 'vocals_over_instrumental'
  | 'drum_swap';

export const CROSSFADE_PRESETS: Record<
  AutoDjTransitionStyle,
  { duration: number; curve1: string; curve2: string }
> = {
  smooth: { duration: 4, curve1: 'tri', curve2: 'tri' },
  drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },
  cut: { duration: 0, curve1: 'nofade', curve2: 'nofade' },
  energy: { duration: 2, curve1: 'qsin', curve2: 'qsin' },

  // Advanced transitions
  filter_sweep: { duration: 4, curve1: 'hsin', curve2: 'hsin' },
  echo_reverb: { duration: 3, curve1: 'qsin', curve2: 'tri' },
  backspin: { duration: 2, curve1: 'exp', curve2: 'log' },
  tape_stop: { duration: 1.5, curve1: 'log', curve2: 'tri' },
  stutter_edit: { duration: 3, curve1: 'tri', curve2: 'qsin' },
  three_band_swap: { duration: 2, curve1: 'tri', curve2: 'tri' },
  bass_drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },
  snare_roll: { duration: 4, curve1: 'qsin', curve2: 'qsin' },
  noise_riser: { duration: 3, curve1: 'tri', curve2: 'exp' },

  // New stem-based transitions
  vocal_handoff: { duration: 3, curve1: 'qsin', curve2: 'qsin' },
  bass_swap: { duration: 0.25, curve1: 'exp', curve2: 'exp' },
  reverb_wash: { duration: 4, curve1: 'tri', curve2: 'exp' },
  echo_out: { duration: 3, curve1: 'qsin', curve2: 'tri' },
};

type PhraseLength = 8 | 16 | 32;

/**
 * Filter sweep configuration for advanced transitions
 */
export type FilterSweepConfig = {
  startFreq: number; // Starting frequency (Hz)
  endFreq: number; // Ending frequency (Hz)
  duration: number; // Sweep duration (seconds)
  curveType: 'linear' | 'exponential' | 'logarithmic';
};

/**
 * Vocal ducking configuration for cleaner transitions
 */
export type VocalDuckConfig = {
  duckAmount: number; // How much to reduce vocals (0-1)
  duckDuration: number; // How long to duck (seconds)
  releaseDuration: number; // How long to return to normal (seconds)
};

export type MixPoint = {
  outStart: number;
  inStart: number;
  overlapSeconds: number;
  phraseAligned: boolean;
  outSection?: string;
  inSection?: string;
  warnings?: string[];
};

const STRUCTURE_RULES = {
  mixOutAllowed: ['outro', 'breakdown', 'verse'],
  mixOutForbidden: ['drop', 'chorus', 'buildup'],
  mixInAllowed: ['intro', 'buildup', 'verse'],
  mixInForbidden: ['drop', 'chorus'],
};

const GENRE_COMPATIBILITY: Record<string, string[]> = {
  house: ['tech_house', 'deep_house', 'disco', 'nu_disco', 'uk_garage'],
  techno: ['tech_house', 'minimal', 'industrial', 'acid'],
  hip_hop: ['trap', 'rnb', 'dancehall', 'afrobeats'],
  pop: ['dance_pop', 'synth_pop', 'disco', 'rnb'],
  dnb: ['jungle', 'liquid', 'neurofunk'],
};

type TrackInfo = NonNullable<Awaited<ReturnType<typeof getTrackInfoForMixing>>>;

type TrackBuffer = {
  id: string;
  buffer: Buffer;
  mimeType: string;
};

export type EnergyPhase = 'warmup' | 'build' | 'peak' | 'cooldown';
export type MixInStrategy =
  | 'intro'
  | 'post_intro'
  | 'buildup'
  | 'drop'
  | 'verse'
  | 'custom';

export type AutoCuePoints = {
  mixIn: number;
  drop: number | null;
  breakdown: number | null;
  mixOut: number;
  confidence: number;
  detectedAt?: string;
};

type MixInSelection = {
  point: number;
  strategy: MixInStrategy;
  reason: string;
  cuePoints: AutoCuePoints;
};

export type AutoDjConfig = {
  trackIds: string[];
  targetDurationSeconds: number;
  targetBpm?: number;
  transitionStyle?: AutoDjTransitionStyle;
  fadeDurationSeconds?: number;
  energyMode?: AutoDjEnergyMode;
  keepOrder?: boolean;
  preferStems?: boolean;
  eventType?: AutoDjEventType;
  enableFilterSweep?: boolean;
  tempoRampSeconds?: number;
  mixMode?: AutoDjMixMode;

  // New advanced processing options
  enableMultibandCompression?: boolean;
  enableSidechainDucking?: boolean;
  enableDynamicEQ?: boolean;
  loudnessNormalization?: 'ebu_r128' | 'peak' | 'none';
  targetLoudness?: number;

  // BPM restoration settings
  enableBpmRestoration?: boolean; // Enable/disable gradual BPM restoration after transitions (default: true)
  bpmRestorationDurationSeconds?: number; // Duration of restoration ramp in seconds (default: 6)
  bpmRestorationMinRatio?: number; // Only restore if tempo ratio differs by at least this amount (default: 0.05)
};

type TrackPlaybackPlan = {
  id: string;
  tempoRatio: number;
  adjustedDuration: number;
  maxSegmentDuration: number;
  startOffset: number;
  startOffsetSource: number;
  startTime: number;
  fadeInDuration: number;
  fadeOutStart: number | null;
  fadeOutDuration: number;
  trimEnd: number;
};

export type TransitionPreviewConfig = {
  trackAId: string;
  trackBId: string;
  mixPoint: MixPoint;
  transitionStyle?: AutoDjTransitionStyle;
  targetBpm?: number;
};

export type PlannedTransition = {
  fromId: string;
  toId: string;
  style: AutoDjTransitionStyle;
  fadeDuration: number;
  beatOffsetSeconds: number;
  curve1: string;
  curve2: string;
  mixPoint: MixPoint;
  mixInPoint: MixInSelection;
  vocalCollision?: VocalCollision;
  bpmDiff?: number;
  suggestedType?:
    | 'standard'
    | 'instrumental_bridge'
    | 'filter_sweep'
    | 'tempo_ramp';
};

export type AutoDjPlan = {
  order: string[];
  targetBpm: number;
  transitions: PlannedTransition[];
  quality?: MixQualityReport;
};

type MixQualityReport = {
  overallScore: number;
  transitionScores: { index: number; score: number; issues: string[] }[];
  suggestions: string[];
};

type VocalCollision = {
  collision: boolean;
  severity: 'none' | 'minor' | 'major';
};

function buildAtempoChain(ratio: number) {
  const filters: string[] = [];
  let value = ratio;

  while (value > 2) {
    filters.push('atempo=2');
    value = value / 2;
  }

  while (value < 0.5) {
    filters.push('atempo=0.5');
    value = value / 0.5;
  }

  if (Math.abs(value - 1) > 0.01) {
    filters.push(`atempo=${Number(value.toFixed(2))}`);
  }

  return filters.join(',');
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function clampTempoRatio(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(1.33, Math.max(0.75, Number(value.toFixed(3))));
}

function applyTempoRamp(
  tempoRatio: number,
  rampSeconds: number | undefined
): string {
  if (!rampSeconds || rampSeconds <= 0 || Math.abs(tempoRatio - 1) < 0.01) {
    return buildAtempoChain(tempoRatio);
  }
  const clamped = Math.min(1.33, Math.max(0.75, tempoRatio));
  return `atempo='1+(${clamped.toFixed(3)}-1)*min(t/${rampSeconds.toFixed(
    2
  )},1)'`;
}

/**
 * Calculate restoration configuration for BPM restoration after transitions
 */
function calculateRestorationWindow(
  trackPlan: TrackPlaybackPlan,
  trackIndex: number,
  config: AutoDjConfig,
  restorationEnabled: boolean
): {
  shouldRestore: boolean;
  restorationStartSeconds: number;
  restorationDurationSeconds: number;
  targetRatio: number;
} {
  if (!restorationEnabled) {
    return {
      shouldRestore: false,
      restorationStartSeconds: 0,
      restorationDurationSeconds: 0,
      targetRatio: trackPlan.tempoRatio,
    };
  }

  // Skip first track (no incoming transition to complete)
  if (trackIndex === 0) {
    return {
      shouldRestore: false,
      restorationStartSeconds: 0,
      restorationDurationSeconds: 0,
      targetRatio: trackPlan.tempoRatio,
    };
  }

  // Skip if tempo ratio is already close to 1.0 (original BPM)
  const minRatioThreshold = config.bpmRestorationMinRatio ?? 0.05;
  if (Math.abs(trackPlan.tempoRatio - 1.0) < minRatioThreshold) {
    return {
      shouldRestore: false,
      restorationStartSeconds: 0,
      restorationDurationSeconds: 0,
      targetRatio: trackPlan.tempoRatio,
    };
  }

  // Restoration starts AFTER fade-in completes
  const restorationStartSeconds = trackPlan.fadeInDuration;
  const restorationDurationSeconds = config.bpmRestorationDurationSeconds ?? 6;

  // Ensure restoration fits within track playback window
  const trackPlaybackDuration = trackPlan.trimEnd - trackPlan.startOffset;
  const availableSpace = trackPlaybackDuration - restorationStartSeconds;

  if (availableSpace < restorationDurationSeconds + 2) {
    // Not enough space - skip restoration
    return {
      shouldRestore: false,
      restorationStartSeconds: 0,
      restorationDurationSeconds: 0,
      targetRatio: trackPlan.tempoRatio,
    };
  }

  return {
    shouldRestore: true,
    restorationStartSeconds,
    restorationDurationSeconds: Math.min(restorationDurationSeconds, availableSpace - 1),
    targetRatio: trackPlan.tempoRatio,
  };
}

const RESTORATION_STEPS = 4;

function clampAtempoValue(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2, Math.max(0.5, value));
}

function appendBpmRestorationFilters(
  filters: string[],
  inputLabel: string,
  trackPlan: TrackPlaybackPlan,
  restorationConfig: {
    restorationStartSeconds: number;
    restorationDurationSeconds: number;
    targetRatio: number;
  },
  index: number
): string {
  const trackLength = Math.max(0, trackPlan.trimEnd - trackPlan.startOffset);
  const restorationStart = Math.max(0, restorationConfig.restorationStartSeconds);
  const restorationDuration = Math.max(
    0,
    restorationConfig.restorationDurationSeconds
  );
  const restorationEnd = Math.min(
    trackLength,
    restorationStart + restorationDuration
  );

  if (restorationEnd <= restorationStart + 0.001) {
    return inputLabel;
  }

  const targetMultiplierRaw = 1 / restorationConfig.targetRatio;
  const targetMultiplier = clampAtempoValue(targetMultiplierRaw);
  const stepCount = Math.max(2, RESTORATION_STEPS);
  const stepDuration = (restorationEnd - restorationStart) / stepCount;

  const segments: Array<{
    start: number;
    end: number;
    multiplier: number;
  }> = [];

  if (restorationStart > 0.001) {
    segments.push({ start: 0, end: restorationStart, multiplier: 1 });
  }

  for (let i = 0; i < stepCount; i++) {
    const progress = (i + 1) / stepCount;
    const eased = progress * progress;
    const multiplier = clampAtempoValue(
      1 + (targetMultiplier - 1) * eased
    );
    segments.push({
      start: restorationStart + i * stepDuration,
      end: restorationStart + (i + 1) * stepDuration,
      multiplier,
    });
  }

  if (restorationEnd < trackLength - 0.001) {
    segments.push({
      start: restorationEnd,
      end: trackLength,
      multiplier: targetMultiplier,
    });
  }

  if (segments.length <= 1) {
    return inputLabel;
  }

  const splitLabels = segments.map((_, idx) => `r${index}s${idx}`);
  filters.push(
    `[${inputLabel}]asplit=${segments.length}${splitLabels
      .map((label) => `[${label}]`)
      .join('')}`
  );

  const segmentLabels: string[] = [];
  segments.forEach((segment, segIdx) => {
    const segLabel = `r${index}seg${segIdx}`;
    const parts = [
      `atrim=start=${segment.start.toFixed(3)}:end=${segment.end.toFixed(3)}`,
      'asetpts=PTS-STARTPTS',
    ];
    if (Math.abs(segment.multiplier - 1) > 0.001) {
      parts.push(`atempo=${segment.multiplier.toFixed(3)}`);
    }
    filters.push(`[${splitLabels[segIdx]}]${parts.join(',')}[${segLabel}]`);
    segmentLabels.push(`[${segLabel}]`);
  });

  const outputLabel = `r${index}out`;
  filters.push(
    `${segmentLabels.join('')}concat=n=${segmentLabels.length}:v=0:a=1[${outputLabel}]`
  );

  if (Math.abs(targetMultiplierRaw - targetMultiplier) > 0.001) {
    log('warn', 'autoDj.bpmRestoration.clamped', {
      trackId: trackPlan.id,
      ratio: restorationConfig.targetRatio,
      multiplier: targetMultiplierRaw,
      clampedMultiplier: targetMultiplier,
    });
  }

  return outputLabel;
}

function getBarDuration(targetBpm: number) {
  const bpm = Number.isFinite(targetBpm) && targetBpm > 0 ? targetBpm : 120;
  return (60 / bpm) * 4;
}

function snapToPhraseBoundary(
  value: number,
  phraseLength: PhraseLength,
  barDuration: number
) {
  const phraseSeconds = phraseLength * barDuration;
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(phraseSeconds) ||
    phraseSeconds <= 0
  )
    return 0;
  return Math.max(0, Math.round(value / phraseSeconds) * phraseSeconds);
}

function normalizeStructure(track: TrackInfo | undefined) {
  return (track?.structure ?? [])
    .map((s) => ({ ...s, label: (s.label || '').toLowerCase() }))
    .sort((a, b) => a.start - b.start);
}

function findSection(
  structure: Array<{
    label: string;
    start: number;
    end: number;
    confidence: number;
  }>,
  labels: string[]
) {
  return structure.find((s) => labels.includes(s.label));
}

export function detectCuePoints(trackInfo: TrackInfo): AutoCuePoints {
  const structure = normalizeStructure(trackInfo);
  const bpm = Number(trackInfo.bpm) || 120;
  const barDuration = getBarDuration(bpm);
  const duration = Number(trackInfo.durationSeconds) || 180;

  const intro = findSection(structure, ['intro']);
  const verse = findSection(structure, ['verse']);
  const buildup = findSection(structure, ['buildup', 'build']);
  const drop = findSection(structure, ['drop', 'chorus']);
  const breakdown = findSection(structure, ['breakdown']);
  const outro = findSection(structure, ['outro']);

  let mixIn = 0;
  let mixInSource = 'default';

  // Check intro end (use != null to handle 0 values correctly)
  if (intro && intro.end != null && intro.end > 0) {
    mixIn = snapToPhraseBoundary(intro.end, 8, barDuration);
    mixInSource = 'intro_end';
  } else if (verse && verse.start != null && verse.start > 0) {
    mixIn = snapToPhraseBoundary(verse.start, 8, barDuration);
    mixInSource = 'verse_start';
  } else if (buildup && buildup.start != null && buildup.start > 0) {
    mixIn = snapToPhraseBoundary(buildup.start, 8, barDuration);
    mixInSource = 'buildup_start';
  } else {
    // Fallback: skip first 10% of track or 16 bars, whichever is smaller
    mixIn = Math.min(16 * barDuration, duration * 0.1);
    mixInSource = 'fallback';
  }

  // Ensure mixIn is at least a few seconds in (skip very short intros)
  if (mixIn < 4 && duration > 60) {
    mixIn = Math.min(16 * barDuration, duration * 0.1);
    mixInSource = 'fallback_minimum';
  }

  log('info', 'autoDj.cuePoints.detected', {
    trackId: trackInfo.id,
    bpm,
    duration,
    barDuration: barDuration.toFixed(2),
    structureSections: structure.length,
    hasIntro: !!intro,
    introEnd: intro?.end,
    hasVerse: !!verse,
    verseStart: verse?.start,
    mixIn: mixIn.toFixed(2),
    mixInSource,
  });

  const dropPoint = drop?.start ?? trackInfo.dropMoments?.[0] ?? null;
  const breakdownPoint = breakdown?.start ?? null;

  let mixOut = duration;
  if (outro?.start) {
    mixOut = snapToPhraseBoundary(outro.start, 8, barDuration);
  } else {
    mixOut = Math.max(0, duration - 32 * barDuration);
  }

  return {
    mixIn: Math.max(0, mixIn),
    drop: dropPoint,
    breakdown: breakdownPoint,
    mixOut: Math.min(duration, mixOut),
    confidence: structure.length > 0 ? 0.8 : 0.5,
    detectedAt: new Date().toISOString(),
  };
}

function getEnergyPhase(
  index: number,
  total: number,
  mode: AutoDjEnergyMode | undefined
): EnergyPhase {
  if (mode === 'steady') return 'build';
  if (mode === 'wave') {
    const cycle = index % 3;
    if (cycle === 0) return 'build';
    if (cycle === 1) return 'peak';
    return 'cooldown';
  }

  const progress = total > 1 ? index / (total - 1) : 0;
  if (progress < 0.25) return 'warmup';
  if (progress < 0.6) return 'build';
  if (progress < 0.9) return 'peak';
  return 'cooldown';
}

function selectMixInPoint(
  incomingTrack: TrackInfo,
  _outgoingTrack: TrackInfo | undefined,
  context: {
    transitionStyle: AutoDjTransitionStyle;
    energyPhase: EnergyPhase;
    overlapDuration: number;
  }
): MixInSelection {
  const cuePoints = incomingTrack.cuePoints ?? detectCuePoints(incomingTrack);
  const barDuration = getBarDuration(Number(incomingTrack.bpm) || 120);

  if (context.transitionStyle === 'drop' && cuePoints.drop !== null) {
    return {
      point: cuePoints.drop,
      strategy: 'drop',
      reason: 'Drop mixing: entering at first drop for maximum impact',
      cuePoints,
    };
  }

  if (context.energyPhase === 'peak') {
    const buildup = normalizeStructure(incomingTrack).find(
      (s) => s.label === 'buildup'
    );
    if (buildup) {
      return {
        point: snapToPhraseBoundary(buildup.start, 8, barDuration),
        strategy: 'buildup',
        reason: 'Peak phase: entering at buildup to maintain energy',
        cuePoints,
      };
    }
    if (cuePoints.drop !== null) {
      return {
        point: cuePoints.drop,
        strategy: 'drop',
        reason: 'Peak phase: entering at drop to keep momentum',
        cuePoints,
      };
    }
  }

  if (context.overlapDuration < 8 * barDuration) {
    log('info', 'autoDj.mixInPoint.selected', {
      trackId: incomingTrack.id,
      point: cuePoints.mixIn,
      strategy: 'post_intro',
      overlapDuration: context.overlapDuration,
      barDuration,
      threshold: 8 * barDuration,
    });
    return {
      point: cuePoints.mixIn,
      strategy: 'post_intro',
      reason: 'Short transition: skipping intro for tighter blend',
      cuePoints,
    };
  }

  if (context.overlapDuration >= 16 * barDuration) {
    log('info', 'autoDj.mixInPoint.selected', {
      trackId: incomingTrack.id,
      point: 0,
      strategy: 'intro',
      overlapDuration: context.overlapDuration,
      barDuration,
      threshold: 16 * barDuration,
    });
    return {
      point: 0,
      strategy: 'intro',
      reason: 'Long transition: using full intro for gradual blend',
      cuePoints,
    };
  }

  const verse = normalizeStructure(incomingTrack).find(
    (s) => s.label === 'verse'
  );
  if (verse) {
    return {
      point: snapToPhraseBoundary(verse.start, 8, barDuration),
      strategy: 'verse',
      reason: 'Balanced energy: starting at verse after intro',
      cuePoints,
    };
  }

  return {
    point: cuePoints.mixIn,
    strategy: 'post_intro',
    reason: 'Standard transition: starting after intro',
    cuePoints,
  };
}

function isVocalSection(label: string | undefined) {
  if (!label) return false;
  const vocalish = ['verse', 'chorus', 'buildup', 'bridge', 'hook'];
  return vocalish.includes(label.toLowerCase());
}

function checkGenreCompatibility(
  genreA: string | undefined,
  genreB: string | undefined
): { compatible: boolean; distance: number } {
  if (!genreA || !genreB) return { compatible: true, distance: 0 };
  if (genreA === genreB) return { compatible: true, distance: 0 };
  if (GENRE_COMPATIBILITY[genreA]?.includes(genreB))
    return { compatible: true, distance: 1 };
  if (GENRE_COMPATIBILITY[genreB]?.includes(genreA))
    return { compatible: true, distance: 1 };
  return { compatible: false, distance: 3 };
}

function detectVocalCollision(
  trackA: TrackInfo,
  trackB: TrackInfo,
  mixPoint: MixPoint,
  targetBpm: number
): VocalCollision {
  const barDuration = getBarDuration(targetBpm);
  const overlap = mixPoint.overlapSeconds ?? 0;
  if (overlap <= 0) return { collision: false, severity: 'none' };

  const aLabel = getStructureAt(trackA, mixPoint.outStart);
  const bLabel = getStructureAt(trackB, mixPoint.inStart);
  if (isVocalSection(aLabel) && isVocalSection(bLabel)) {
    if (overlap > 8 * barDuration)
      return { collision: true, severity: 'major' };
    return { collision: true, severity: 'minor' };
  }
  return { collision: false, severity: 'none' };
}

function suggestTransitionType(
  vocalCollision: VocalCollision | undefined,
  bpmDiff: number | undefined
): PlannedTransition['suggestedType'] {
  if (vocalCollision?.severity === 'major') return 'instrumental_bridge';
  if (bpmDiff && bpmDiff > 8) return 'tempo_ramp';
  return 'standard';
}

function getStructureAt(
  track: TrackInfo | undefined,
  position: number
): string | undefined {
  if (!track?.structure?.length || !Number.isFinite(position)) return undefined;
  const found = track.structure.find(
    (s) => position >= s.start && position < s.end
  );
  return found?.label;
}

function findNextAllowedMixOut(
  track: TrackInfo | undefined,
  start: number,
  barDuration: number
) {
  if (!track?.structure?.length)
    return snapToPhraseBoundary(start + 8 * barDuration, 8, barDuration);
  const segments = [...track.structure].sort((a, b) => a.start - b.start);
  const nextAllowed = segments.find(
    (s) => s.start >= start && STRUCTURE_RULES.mixOutAllowed.includes(s.label)
  );
  if (nextAllowed) {
    return snapToPhraseBoundary(nextAllowed.start, 8, barDuration);
  }
  const lastEnd = segments.at(-1)?.end ?? start;
  return snapToPhraseBoundary(
    Math.max(start, lastEnd - 8 * barDuration),
    8,
    barDuration
  );
}

function findPhraseAlignedMixPoint(
  trackA: TrackInfo,
  trackB: TrackInfo,
  targetBpm: number,
  incomingStart: number,
  overlapHintSeconds?: number,
  strategy?: MixInStrategy
): MixPoint {
  const barDuration = getBarDuration(targetBpm);
  const outroStart =
    trackA.structure?.find((s) => s.label === 'outro')?.start ??
    Math.max(0, (Number(trackA.durationSeconds) || 0) - 32 * barDuration);
  const snappedOutro = snapToPhraseBoundary(outroStart, 8, barDuration);
  const snappedIn = snapToPhraseBoundary(incomingStart, 8, barDuration);
  const phraseAligned = Math.abs(snappedIn - incomingStart) < barDuration / 2;
  const introEnd =
    trackB.structure?.find((s) => s.label === 'intro')?.end ?? 16 * barDuration;
  const overlapSource = overlapHintSeconds ?? introEnd ?? 8 * barDuration;
  const minBars = strategy === 'drop' ? 2 : 4;
  const overlapBars = Math.min(
    16,
    Math.max(minBars, Math.round(Math.max(overlapSource, 1) / barDuration))
  );
  const mixPoint: MixPoint = {
    outStart: snappedOutro,
    inStart: snappedIn,
    overlapSeconds: overlapBars * barDuration,
    phraseAligned,
    outSection: getStructureAt(trackA, snappedOutro),
    inSection: getStructureAt(trackB, snappedIn),
  };
  return mixPoint;
}

function validateMixPoint(
  trackA: TrackInfo,
  trackB: TrackInfo,
  proposed: MixPoint,
  targetBpm: number,
  options?: { allowDropIn?: boolean }
): MixPoint {
  const warnings: string[] = [];
  const barDuration = getBarDuration(targetBpm);
  let structureAtOut = getStructureAt(trackA, proposed.outStart);
  let structureAtIn = getStructureAt(trackB, proposed.inStart);

  if (
    structureAtOut &&
    STRUCTURE_RULES.mixOutForbidden.includes(structureAtOut)
  ) {
    const alternative = findNextAllowedMixOut(
      trackA,
      proposed.outStart,
      barDuration
    );
    warnings.push(
      `Adjusted mix-out from ${structureAtOut} to allowed section at ${alternative.toFixed(
        2
      )}s`
    );
    proposed = { ...proposed, outStart: alternative, phraseAligned: false };
    structureAtOut = getStructureAt(trackA, proposed.outStart);
  }

  if (
    structureAtIn &&
    STRUCTURE_RULES.mixInForbidden.includes(structureAtIn) &&
    !options?.allowDropIn
  ) {
    const introStart = snapToPhraseBoundary(
      proposed.inStart + 4 * barDuration,
      8,
      barDuration
    );
    warnings.push(
      `Adjusted mix-in away from ${structureAtIn} to ${introStart.toFixed(2)}s`
    );
    proposed = { ...proposed, inStart: introStart, phraseAligned: false };
    structureAtIn = getStructureAt(trackB, proposed.inStart);
  }

  return {
    ...proposed,
    warnings: warnings.length ? warnings : undefined,
    outSection: structureAtOut,
    inSection: structureAtIn,
  };
}

function buildMixPoint(
  trackA: TrackInfo,
  trackB: TrackInfo,
  targetBpm: number,
  mixInSelection: MixInSelection | undefined,
  overlapHintSeconds?: number
): MixPoint {
  const base = findPhraseAlignedMixPoint(
    trackA,
    trackB,
    targetBpm,
    mixInSelection?.point ?? 0,
    overlapHintSeconds,
    mixInSelection?.strategy
  );
  const validated = validateMixPoint(trackA, trackB, base, targetBpm, {
    allowDropIn: mixInSelection?.strategy === 'drop',
  });
  return validated;
}

function scoreMixQuality(
  plan: AutoDjPlan,
  trackInfos: TrackInfo[],
  targetBpm: number
): MixQualityReport {
  const transitionScores = plan.transitions.map((t, idx) => {
    let score = 100;
    const issues: string[] = [];
    if (t.bpmDiff && t.bpmDiff > 8) {
      score -= 15;
      issues.push(`Large BPM difference (${t.bpmDiff.toFixed(1)} BPM)`);
    }
    if (t.vocalCollision?.severity === 'major') {
      score -= 25;
      issues.push('Vocal collision detected');
    } else if (t.vocalCollision?.severity === 'minor') {
      score -= 10;
      issues.push('Possible vocal collision');
    }
    if (!t.mixPoint.phraseAligned) {
      score -= 5;
      issues.push('Not phrase-aligned');
    } else {
      score += 3;
    }

    const from = trackInfos.find((ti) => ti.id === t.fromId);
    const to = trackInfos.find((ti) => ti.id === t.toId);
    const fromBpm = from?.bpm ?? targetBpm;
    const toBpm = to?.bpm ?? targetBpm;
    const bpmDiff = Math.abs((fromBpm || targetBpm) - (toBpm || targetBpm));
    if (bpmDiff > 10) {
      score -= 10;
      issues.push('High BPM delta between tracks');
    }

    const genre = checkGenreCompatibility(
      (from as { genre?: string } | undefined)?.genre,
      (to as { genre?: string } | undefined)?.genre
    );
    if (!genre.compatible && genre.distance >= 3) {
      score -= 10;
      issues.push('Genre jump may be jarring');
    }

    return { index: idx, score: Math.max(0, Math.min(100, score)), issues };
  });

  const overallScore = transitionScores.length
    ? transitionScores.reduce((sum, s) => sum + s.score, 0) /
      transitionScores.length
    : 0;

  const suggestions: string[] = [];
  if (overallScore < 80)
    suggestions.push('Consider reordering to reduce BPM deltas');
  if (transitionScores.some((t) => t.issues.some((i) => i.includes('vocal'))))
    suggestions.push('Try instrumental bridge to avoid vocal collisions');
  if (transitionScores.some((t) => t.issues.some((i) => i.includes('phrase'))))
    suggestions.push('Re-run with phrase alignment enforced');
  if (transitionScores.some((t) => t.issues.some((i) => i.includes('Genre'))))
    suggestions.push('Consider adjacent-genre ordering');

  return { overallScore, transitionScores, suggestions };
}

/**
 * Get recommended transition style based on BPM and energy
 */
export function getRecommendedTransitionStyle(
  bpmDiff: number,
  energyDiff: number,
  hasStems: boolean = false
): AutoDjTransitionStyle {
  const absBpmDiff = Math.abs(bpmDiff);
  const absEnergyDiff = Math.abs(energyDiff);

  // If stems are available, prefer stem-based transitions
  if (hasStems) {
    if (absEnergyDiff > 0.3) {
      return 'three_band_swap'; // Major energy change
    }
    if (absBpmDiff > 10) {
      return 'filter_sweep'; // Major BPM change
    }
    return 'smooth'; // Normal transition
  }

  // Advanced transitions based on energy change
  if (energyDiff > 0.3) {
    // Big energy rise - use bass drop or noise riser
    return absBpmDiff > 5 ? 'noise_riser' : 'bass_drop';
  } else if (energyDiff > 0.1) {
    // Moderate energy rise - use snare roll
    return 'snare_roll';
  } else if (energyDiff < -0.3) {
    // Big energy drop - use tape stop
    return 'tape_stop';
  } else if (energyDiff < -0.1) {
    // Moderate energy drop - use echo reverb
    return 'echo_reverb';
  }

  // BPM-based transitions
  if (absBpmDiff > 10) {
    return 'backspin'; // Major BPM change
  } else if (absBpmDiff > 5) {
    return 'stutter_edit'; // Moderate BPM change
  } else if (absBpmDiff > 2) {
    return 'filter_sweep'; // Slight BPM change
  }

  // Default - smooth transition
  return 'smooth';
}

/**
 * Build filter sweep effect for transitions
 */
export function buildFilterSweep(config: FilterSweepConfig): string {
  const { startFreq, endFreq, duration, curveType } = config;

  let freqExpression: string;
  switch (curveType) {
    case 'exponential':
      freqExpression = `${startFreq}*(${endFreq}/${startFreq})^(t/${duration})`;
      break;
    case 'logarithmic':
      freqExpression = `exp(log(${startFreq})+(log(${endFreq})-log(${startFreq}))*t/${duration})`;
      break;
    case 'linear':
    default:
      freqExpression = `${startFreq}+(${endFreq}-${startFreq})*t/${duration}`;
  }

  // Highpass sweep opening up frequency range
  return `highpass=f=${freqExpression}`;
}

/**
 * Build vocal ducking filter for cleaner transitions
 */
export function buildVocalDuckFilter(config: VocalDuckConfig): string {
  const { duckAmount, duckDuration, releaseDuration } = config;

  // Duck phase - reduce vocals
  const duckCurve = `1-${duckAmount}*min(t/${duckDuration},1)`;
  // Release phase - restore vocals
  const releaseCurve = `1-${duckAmount}+${duckAmount}*min((t-${duckDuration})/${releaseDuration},1)`;

  // Combine duck and release phases
  const combinedCurve = `1-${duckAmount}*min(t/${duckDuration},1)+${duckAmount}*min(max(t-${duckDuration},0)/${releaseDuration},1)`;

  return `volume=${combinedCurve}`;
}

/**
 * Build transition filter for per-stem mixing
 */
export function buildTransitionFilterForStems(
  style: AutoDjTransitionStyle,
  duration: number,
  curve1: string,
  curve2: string
): string {
  switch (style) {
    case 'filter_sweep':
      // Add filter sweep to standard crossfade
      return `highpass=f='20+20000*t/${Math.max(
        duration,
        1
      )}',acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'echo_reverb':
      // Echo on fade out
      return `aecho=0.8:0.9:1000:0.3,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'backspin':
      // Reverse before fade
      return `areverse,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'tape_stop':
      // Slow down before fade
      return `asetrate=22050,aresample=44100,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'stutter_edit':
      // Rhythmic stutter
      return `atempo=1.5,atempo=0.66,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'three_band_swap':
      // Create 3-band EQ swap effect using multiband filter
      return `anequalizer=c0f=200:c0w=2:c0g=-10:c1f=2500:c1w=3:c1g=10:c2f=8000:c2w=4:c2g=-10,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'bass_drop':
      // Cut bass momentarily
      return `lowpass=f=200,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'snare_roll':
      // Boost high frequencies
      return `highpass=f=2000,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'noise_riser':
      // Generate white noise with rising envelope for build-up effect
      const riseTime = Math.floor(duration * 0.8);
      const fadeTime = Math.floor(duration * 0.2);
      return `anoisesrc=duration=${duration}:sample_rate=44100:color=white:seed=1,afade=t=in:st=0:d=${riseTime}:curve=cub,afade=t=out:st=${riseTime}:d=${fadeTime}:curve=exp,volume=0.3,acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;

    case 'smooth':
    case 'drop':
    case 'cut':
    case 'energy':
    default:
      // Standard crossfade
      return `acrossfade=d=${duration}:c1=${curve1}:c2=${curve2}`;
  }
}

function adjustFadeForEvent(
  eventType: AutoDjEventType | undefined,
  baseFade: number
) {
  if (!eventType) return baseFade;
  if (eventType === 'wedding' || eventType === 'birthday')
    return Math.min(8, baseFade + 1.5);
  if (eventType === 'club') return Math.max(1, baseFade - 0.5);
  return baseFade;
}

async function loadTrackBuffers(trackIds: string[]): Promise<TrackBuffer[]> {
  const storage = await getStorage();
  if (!storage.getFile) {
    throw new Error('Storage driver does not support reading files (getFile)');
  }

  const records = await db
    .select({
      id: uploadedTracks.id,
      storageUrl: uploadedTracks.storageUrl,
      mimeType: uploadedTracks.mimeType,
    })
    .from(uploadedTracks)
    .where(inArray(uploadedTracks.id, trackIds));

  const buffers: TrackBuffer[] = [];
  for (const record of records) {
    const fetched = await storage.getFile(record.storageUrl);
    if (!fetched?.buffer) {
      throw new Error(`Failed to fetch audio for track ${record.id}`);
    }
    buffers.push({
      id: record.id,
      buffer: fetched.buffer,
      mimeType: fetched.mimeType || record.mimeType || 'audio/mpeg',
    });
  }
  return buffers;
}

export async function renderTransitionPreview(
  config: TransitionPreviewConfig
): Promise<{
  audioUrl: string;
  durationSeconds: number;
  transitionStartAt: number;
}> {
  if (!configuredFfmpegPath) {
    throw new Error('ffmpeg-static binary not available for preview');
  }

  const trackInfos = await Promise.all([
    getTrackInfoForMixing(config.trackAId),
    getTrackInfoForMixing(config.trackBId),
  ]);
  const [trackAInfo, trackBInfo] = trackInfos;
  if (!trackAInfo || !trackBInfo)
    throw new Error('Track info missing for preview');

  const buffers = await loadTrackBuffers([config.trackAId, config.trackBId]);
  if (buffers.length !== 2)
    throw new Error('Unable to load both tracks for preview');

  const storage = await getStorage();

  const tempFs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];
  try {
    buffers.forEach((track, idx) => {
      const ext = track.mimeType.includes('wav') ? '.wav' : '.mp3';
      const tempPath = path.join(tempDir, `preview-${Date.now()}-${idx}${ext}`);
      tempFiles.push(tempPath);
    });
    await Promise.all(
      tempFiles.map((p, idx) => tempFs.writeFile(p, buffers[idx].buffer))
    );

    const transitionStyle = config.transitionStyle ?? 'smooth';
    const preset = CROSSFADE_PRESETS[transitionStyle];
    const targetBpm =
      config.targetBpm ?? trackAInfo.bpm ?? trackBInfo.bpm ?? 120;
    const mixPoint = config.mixPoint;
    const overlapSeconds = Math.max(
      1,
      Math.min(mixPoint.overlapSeconds ?? preset.duration, 30)
    );

    const previewDuration = 60;
    const command = ffmpeg();
    tempFiles.forEach((file) => command.input(file));

    const filters: string[] = [];
    const firstTrimStart = Math.max(
      0,
      (Number(trackAInfo.durationSeconds) || 120) - 30
    );
    const secondTrimEnd = Math.min(
      30,
      Number(trackBInfo.durationSeconds) || 30
    );

    const aTempo = buildAtempoChain(
      clampTempoRatio(calculateTempoRatio(trackAInfo.bpm, targetBpm))
    );
    const bTempo = buildAtempoChain(
      clampTempoRatio(calculateTempoRatio(trackBInfo.bpm, targetBpm))
    );

    const aChain = [
      'loudnorm=I=-14:TP=-1:LRA=11',
      aTempo,
      `atrim=start=${firstTrimStart.toFixed(2)}`,
      'asetpts=PTS-STARTPTS',
    ]
      .filter(Boolean)
      .join(',');
    const bChain = [
      'loudnorm=I=-14:TP=-1:LRA=11',
      bTempo,
      `atrim=end=${secondTrimEnd.toFixed(2)}`,
      'asetpts=PTS-STARTPTS',
    ]
      .filter(Boolean)
      .join(',');

    filters.push(`[0:a]${aChain}[pa]`);
    filters.push(`[1:a]${bChain}[pb]`);
    filters.push(
      `[pa][pb]acrossfade=d=${overlapSeconds.toFixed(2)}:c1=${
        preset.curve1
      }:c2=${preset.curve2}[mixed]`
    );

    command
      .complexFilter(filters, 'mixed')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        `-t ${previewDuration}`,
        '-b:a 192k',
      ])
      .format(OUTPUT_FORMAT);

    const chunks: Buffer[] = [];
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      command.on('error', reject);
      const out = command.pipe();
      out.on('data', (c) => chunks.push(c));
      out.on('end', () => resolve(Buffer.concat(chunks)));
      out.on('error', reject);
    });

    if (!buffer.length)
      throw new Error('Preview rendering produced empty output');

    const url = await storage.uploadFile(
      buffer,
      `preview-${config.trackAId}-${config.trackBId}.${OUTPUT_FORMAT}`,
      'audio/mpeg'
    );
    return {
      audioUrl: url,
      durationSeconds: previewDuration,
      transitionStartAt: 30 - overlapSeconds,
    };
  } finally {
    await Promise.all(tempFiles.map((p) => tempFs.unlink(p).catch(() => {})));
  }
}

export async function planAutoDjMix(
  trackInfos: TrackInfo[],
  config: AutoDjConfig
): Promise<AutoDjPlan> {
  const transitionStyle = config.transitionStyle ?? 'smooth';
  const preset = CROSSFADE_PRESETS[transitionStyle];
  const targetBpm =
    config.targetBpm ??
    median(trackInfos.map((t) => t.bpm || 0).filter(Boolean)) ??
    120;
  const cueCache = new Map<string, AutoCuePoints>();

  let ordered = config.keepOrder
    ? [...config.trackIds]
    : [...trackInfos]
        .sort((a, b) => {
          const abpm = a.bpm ? Math.abs((a.bpm as number) - targetBpm) : 999;
          const bbpm = b.bpm ? Math.abs((b.bpm as number) - targetBpm) : 999;
          return abpm - bbpm;
        })
        .map((t) => t.id);

  if (!config.keepOrder && config.energyMode === 'build') {
    ordered = [...trackInfos]
      .sort((a, b) => (a.bpm ?? targetBpm) - (b.bpm ?? targetBpm))
      .map((t) => t.id);
  }

  if (!config.keepOrder && config.energyMode === 'wave') {
    const sorted = [...trackInfos].sort(
      (a, b) => (a.bpm ?? targetBpm) - (b.bpm ?? targetBpm)
    );
    const low = sorted.filter((_, idx) => idx % 2 === 0);
    const high = sorted.filter((_, idx) => idx % 2 === 1).reverse();
    ordered = [...low, ...high].map((t) => t.id);
  }

  const transitions: PlannedTransition[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = trackInfos.find((t) => t.id === ordered[i]);
    const to = trackInfos.find((t) => t.id === ordered[i + 1]);
    if (!from || !to) continue;

    let incomingCuePoints = to.cuePoints ?? cueCache.get(to.id) ?? null;
    let newlyDetectedCuePoints = false;

    // Re-detect if no cue points OR if stored mixIn is suspiciously low (likely old bad data)
    const needsRedetection =
      !incomingCuePoints ||
      (incomingCuePoints.mixIn < 4 && Number(to.durationSeconds) > 60);

    if (needsRedetection) {
      log('info', 'autoDj.cuePoints.redetecting', {
        trackId: to.id,
        reason: !incomingCuePoints ? 'no_cue_points' : 'low_mixIn',
        oldMixIn: incomingCuePoints?.mixIn,
        duration: to.durationSeconds,
      });
      incomingCuePoints = detectCuePoints(to);
      newlyDetectedCuePoints = true;
      cueCache.set(to.id, incomingCuePoints);
    }

    if (newlyDetectedCuePoints) {
      try {
        await db
          .update(uploadedTracks)
          .set({ cuePoints: incomingCuePoints, updatedAt: new Date() })
          .where(eq(uploadedTracks.id, to.id));
      } catch (error) {
        log('warn', 'autoDj.cue.persist_failed', {
          trackId: to.id,
          error: (error as Error).message,
        });
      }
    }

    const presetFade = Math.min(
      adjustFadeForEvent(
        config.eventType,
        config.fadeDurationSeconds ?? preset.duration
      ),
      8
    );
    const energyPhase = getEnergyPhase(i, ordered.length, config.energyMode);
    const mixInSelection = selectMixInPoint(
      { ...to, cuePoints: incomingCuePoints },
      from,
      {
        transitionStyle,
        energyPhase,
        overlapDuration: presetFade,
      }
    );

    const fromBpm = from?.bpm ? Number(from.bpm) : targetBpm;
    const toBpm = to?.bpm ? Number(to.bpm) : targetBpm;
    const fromRatio = clampTempoRatio(calculateTempoRatio(fromBpm, targetBpm));
    const toRatio = clampTempoRatio(calculateTempoRatio(toBpm, targetBpm));
    const fromGrid = (from?.beatGrid ?? []).map((t) => t / fromRatio);
    const toGrid = (to?.beatGrid ?? []).map((t) => t / toRatio);
    const beatOffset = calculateBeatAlignment(
      fromGrid,
      toGrid,
      targetBpm,
      'downbeat'
    );
    const mixPoint = buildMixPoint(
      from,
      to,
      targetBpm,
      mixInSelection,
      presetFade
    );
    const fadeDuration = Math.max(
      0,
      Math.min(presetFade, mixPoint.overlapSeconds || presetFade)
    );
    const vocalCollision = detectVocalCollision(from, to, mixPoint, targetBpm);
    const bpmDiff = Math.abs((fromBpm || targetBpm) - (toBpm || targetBpm));
    const suggestedType = suggestTransitionType(vocalCollision, bpmDiff);

    transitions.push({
      fromId: ordered[i],
      toId: ordered[i + 1],
      style: transitionStyle,
      fadeDuration,
      beatOffsetSeconds: beatOffset,
      curve1: preset.curve1,
      curve2: preset.curve2,
      mixPoint,
      mixInPoint: mixInSelection,
      vocalCollision,
      bpmDiff,
      suggestedType,
    });
  }

  const plan: AutoDjPlan = { order: ordered, targetBpm, transitions };
  plan.quality = scoreMixQuality(plan, trackInfos, targetBpm);

  return plan;
}

export async function renderAutoDjMix(
  mashupId: string,
  config: AutoDjConfig & { plan?: AutoDjPlan }
): Promise<void> {
  if (!configuredFfmpegPath) {
    throw new Error('ffmpeg-static binary not available for mixing');
  }

  const startedAt = Date.now();
  const storage = await getStorage();

  const trackInfos: TrackInfo[] = [];
  for (const trackId of config.trackIds) {
    const info = await getTrackInfoForMixing(trackId);
    if (info) trackInfos.push(info);
  }
  if (trackInfos.length === 0) {
    throw new Error('No track info available for auto DJ mix');
  }

  const plan = config.plan ?? (await planAutoDjMix(trackInfos, config));

  if (config.preferStems) {
    log('info', 'autoDj.stems.preferred', { trackIds: config.trackIds });
    try {
      const { getAllStemBuffers, separateStemsParallel } = await import(
        './stems-service'
      );
      const hasStems = await Promise.all(
        config.trackIds.map(async (trackId) => {
          const stems = await getAllStemBuffers(trackId);
          return stems.size > 0;
        })
      );
      const allHaveStems = hasStems.every(Boolean);
      if (allHaveStems) {
        log('info', 'autoDj.stems.available', { trackIds: config.trackIds });
      } else {
        log('warn', 'autoDj.stems.partial', {
          trackIds: config.trackIds,
          hasStems,
          message: 'Some tracks lack stems, falling back to full tracks',
        });
      }
    } catch (error) {
      log('error', 'autoDj.stems.checkFailed', {
        error: (error as Error).message,
        message: 'Failed to check stem availability, using full tracks',
      });
    }
  }

  await db
    .update(mashups)
    .set({
      generationStatus: 'generating',
      mixMode: 'standard',
      recommendationContext: { plan, request: config },
      updatedAt: new Date(),
    })
    .where(eq(mashups.id, mashupId));

  const orderedBuffers = await loadTrackBuffers(plan.order);
  if (orderedBuffers.length === 0)
    throw new Error('No audio buffers loaded for auto DJ mix');

  const tempFs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];

  try {
    for (let i = 0; i < orderedBuffers.length; i++) {
      const track = orderedBuffers[i];
      const ext = track.mimeType.includes('wav') ? '.wav' : '.mp3';
      const tempPath = path.join(tempDir, `auto-dj-${Date.now()}-${i}${ext}`);
      await tempFs.writeFile(tempPath, track.buffer);
      tempFiles.push(tempPath);
    }

    const command = ffmpeg();
    tempFiles.forEach((filePath) => command.input(filePath));

    const filters: string[] = [];
    const targetBpm = plan.targetBpm;
    const fallbackDuration = Math.max(
      30,
      config.targetDurationSeconds / Math.max(1, orderedBuffers.length)
    );

    // Calculate segment duration for each track based on target duration
    // Formula: totalDuration = N * segmentDuration - (N-1) * fadeDuration
    // So: segmentDuration = (totalDuration + (N-1) * fadeDuration) / N
    const numTracks = orderedBuffers.length;
    const defaultFade =
      CROSSFADE_PRESETS[config.transitionStyle ?? 'smooth']?.duration ?? 4;
    const avgFade =
      plan.transitions.length > 0
        ? plan.transitions.reduce(
            (sum, t) => sum + (t.fadeDuration || defaultFade),
            0
          ) / plan.transitions.length
        : defaultFade;
    const targetSegmentDuration =
      numTracks > 1
        ? (config.targetDurationSeconds + (numTracks - 1) * avgFade) / numTracks
        : config.targetDurationSeconds;

    log('info', 'autoDj.segment.calc', {
      numTracks,
      targetDuration: config.targetDurationSeconds,
      avgFade: avgFade.toFixed(2),
      targetSegmentDuration: targetSegmentDuration.toFixed(2),
    });

    const playbackPlans: TrackPlaybackPlan[] = orderedBuffers.map(
      (track, idx) => {
        const info = trackInfos.find((t) => t.id === track.id);
        const bpm = info?.bpm ? Number(info.bpm) : targetBpm;

        // Determine effective target BPM based on BPM restoration setting
        // Default: restoration is enabled (opt-out with enableBpmRestoration: false)
        const bpmRestorationEnabled =
          config.enableBpmRestoration !== false && !config.tempoRampSeconds;
        let effectiveTargetBpm: number;
        if (idx === 0) {
          // First track: use global target BPM
          effectiveTargetBpm = targetBpm;
        } else if (bpmRestorationEnabled) {
          // Subsequent tracks with restoration enabled: match to previous track's ORIGINAL BPM
          const prevTrackInfo = trackInfos.find((t) => t.id === orderedBuffers[idx - 1].id);
          const prevTrackOriginalBpm = prevTrackInfo?.bpm ? Number(prevTrackInfo.bpm) : targetBpm;
          effectiveTargetBpm = prevTrackOriginalBpm;
        } else {
          // Restoration disabled: use global target BPM (current behavior)
          effectiveTargetBpm = targetBpm;
        }

        const tempoRatio = clampTempoRatio(calculateTempoRatio(bpm, effectiveTargetBpm));

        // Log BPM matching decision
        log('info', 'autoDj.bpm.matching', {
          trackId: track.id,
          trackIndex: idx,
          originalBpm: bpm,
          effectiveTargetBpm,
          tempoRatio: Number(tempoRatio.toFixed(4)),
          matchingTo: idx === 0 ? 'global-target' : bpmRestorationEnabled ? 'previous-track-original' : 'global-target'
        });
        const rawDuration = info?.durationSeconds
          ? Number(info.durationSeconds)
          : fallbackDuration;
        const adjustedDuration = rawDuration / (tempoRatio || 1);
        const validAdjustedDuration =
          Number.isFinite(adjustedDuration) && adjustedDuration > 0
            ? adjustedDuration
            : fallbackDuration;
        const mixInOriginal =
          idx === 0 ? 0 : plan.transitions[idx - 1]?.mixInPoint?.point ?? 0;
        const intendedStartOffset = mixInOriginal / (tempoRatio || 1);
        const safeStartOffset = Math.max(
          0,
          Math.min(intendedStartOffset, Math.max(validAdjustedDuration - 1, 0))
        );
        const fadeForTrack =
          idx === 0 ? 0 : plan.transitions[idx - 1]?.fadeDuration ?? avgFade;

        // Each track is limited to its segment duration (but can be shorter if track is shorter)
        const baseSegment = Math.min(
          validAdjustedDuration,
          targetSegmentDuration + safeStartOffset
        );
        const maxSegment = Math.min(
          validAdjustedDuration,
          Math.max(baseSegment, safeStartOffset + Math.max(fadeForTrack, 2))
        );

        return {
          id: track.id,
          tempoRatio,
          adjustedDuration: validAdjustedDuration,
          maxSegmentDuration: maxSegment,
          startOffset: Number(safeStartOffset.toFixed(3)),
          startOffsetSource: Number(mixInOriginal.toFixed(3)),
          startTime: 0,
          fadeInDuration: idx === 0 ? 0 : fadeForTrack,
          fadeOutStart: null,
          fadeOutDuration: 0,
          trimEnd: maxSegment,
        };
      }
    );

    // Build timing based on segment durations with crossfade overlaps
    // Track 0: plays 0 to segmentDuration
    // Track 1: starts at (segmentDuration - fadeDuration), plays segmentDuration
    // Track 2: starts at 2*(segmentDuration - fadeDuration), etc.
    for (let i = 0; i < playbackPlans.length; i++) {
      const currentPlan = playbackPlans[i];
      const transition = i > 0 ? plan.transitions[i - 1] : null;
      const fadeDuration = transition?.fadeDuration ?? avgFade;
      currentPlan.fadeInDuration = i === 0 ? 0 : fadeDuration;

      if (i === 0) {
        // First track starts at 0
        currentPlan.startTime = 0;
      } else {
        // Subsequent tracks start at previous track's fade-out point
        const prevPlan = playbackPlans[i - 1];
        const prevPlayable = Math.max(
          prevPlan.trimEnd - prevPlan.startOffset,
          0
        );
        const stepDuration = Math.max(prevPlayable - fadeDuration, 0);
        currentPlan.startTime = prevPlan.startTime + stepDuration;
      }

      // Set fade out (except for last track)
      if (i < playbackPlans.length - 1) {
        const nextTransition = plan.transitions[i];
        const nextFade = nextTransition?.fadeDuration ?? avgFade;
        const fadeOutStart = Math.max(
          currentPlan.startOffset,
          currentPlan.trimEnd - nextFade
        );
        currentPlan.fadeOutStart = fadeOutStart;
        currentPlan.fadeOutDuration = nextFade;
        currentPlan.trimEnd = Math.min(
          currentPlan.adjustedDuration,
          Math.max(currentPlan.trimEnd, fadeOutStart + nextFade)
        );
      } else {
        // Last track: no fade out, play to fill remaining duration
        const remaining = Math.max(
          currentPlan.maxSegmentDuration - currentPlan.startOffset,
          config.targetDurationSeconds - currentPlan.startTime
        );
        currentPlan.fadeOutStart = null;
        currentPlan.fadeOutDuration = 0;
        currentPlan.trimEnd = Math.min(
          currentPlan.adjustedDuration,
          currentPlan.startOffset + remaining
        );
      }
    }

    playbackPlans.forEach((plan) => {
      const info = trackInfos.find((t) => t.id === plan.id);
      const fadeProbe = plan.fadeOutStart ?? plan.trimEnd;
      const mixOutSection = info
        ? getStructureAt(
            info,
            (plan.startOffset + fadeProbe) * (plan.tempoRatio || 1)
          )
        : undefined;
      const logPayload = {
        trackId: plan.id,
        startTime: Number(plan.startTime.toFixed(2)),
        startOffset: Number(plan.startOffset.toFixed(2)),
        startOffsetOriginal: Number(plan.startOffsetSource.toFixed(2)),
        fadeIn: Number(plan.fadeInDuration.toFixed(2)),
        fadeOutStart: Number((plan.fadeOutStart ?? 0).toFixed(2)),
        fadeOutDuration: Number(plan.fadeOutDuration.toFixed(2)),
        trimEnd: Number(plan.trimEnd.toFixed(2)),
        mixOutSection,
      };
      log('info', 'autoDj.plan.track', logPayload);
    });

    // Build FFmpeg filter graph using phrase-aware timings
    playbackPlans.forEach((trackPlan, idx) => {
      // Tempo adjustment with optional BPM restoration
      // Note: BPM restoration is enabled by default (enableBpmRestoration !== false)
      const bpmRestorationEnabled =
        config.enableBpmRestoration !== false && !config.tempoRampSeconds;
      if (
        config.tempoRampSeconds &&
        config.enableBpmRestoration !== false &&
        idx === 0
      ) {
        log('warn', 'autoDj.config.conflict', {
          message:
            'tempoRampSeconds and enableBpmRestoration are mutually exclusive. Using tempoRampSeconds.',
          trackId: trackPlan.id,
        });
      }

      // Calculate restoration configuration
      const restorationConfig = calculateRestorationWindow(
        trackPlan,
        idx,
        config,
        bpmRestorationEnabled
      );

      // Initial loudness normalization (pre-processing)
      const normLabel = `norm${idx}`;
      filters.push(
        `[${idx}:a]loudnorm=I=-14:TP=-1:LRA=11[${normLabel}]`
      );

      // Apply base tempo adjustment
      const tempoLabel = `tempo${idx}`;
      const tempoFilter = config.tempoRampSeconds
        ? applyTempoRamp(trackPlan.tempoRatio, config.tempoRampSeconds)
        : buildAtempoChain(trackPlan.tempoRatio);
      if (tempoFilter) {
        filters.push(`[${normLabel}]${tempoFilter}[${tempoLabel}]`);
      } else {
        filters.push(`[${normLabel}]anull[${tempoLabel}]`);
      }

      const trimEnd = Math.max(trackPlan.startOffset + 0.1, trackPlan.trimEnd);
      const trimLabel = `trim${idx}`;
      filters.push(
        `[${tempoLabel}]atrim=start=${trackPlan.startOffset.toFixed(
          3
        )}:end=${trimEnd.toFixed(3)},asetpts=PTS-STARTPTS[${trimLabel}]`
      );

      let tempoOutputLabel = trimLabel;
      if (restorationConfig.shouldRestore) {
        tempoOutputLabel = appendBpmRestorationFilters(
          filters,
          trimLabel,
          trackPlan,
          restorationConfig,
          idx
        );
      }

      // Log restoration plan for debugging
      if (restorationConfig.shouldRestore) {
        const trackInfo = trackInfos.find((t) => t.id === trackPlan.id);
        const originalBpm = trackInfo?.bpm ? Number(trackInfo.bpm) : 120;
        log('info', 'autoDj.bpmRestoration.planned', {
          trackId: trackPlan.id,
          trackIndex: idx,
          fromBpm: (restorationConfig.targetRatio * originalBpm).toFixed(1),
          toBpm: originalBpm,
          fromRatio: restorationConfig.targetRatio,
          toRatio: 1.0,
          restorationStart: restorationConfig.restorationStartSeconds,
          restorationDuration: restorationConfig.restorationDurationSeconds,
        });
      }

      const transitionForThisTrack = playbackPlans[idx + 1]
        ? plan.transitions[idx]
        : null;
      const fullSegmentEffects: string[] = [];
      const transitionEffects: string[] = [];

      if (
        transitionForThisTrack?.style &&
        trackPlan.fadeOutDuration > 0 &&
        trackPlan.fadeOutStart !== null
      ) {
        const style = transitionForThisTrack.style;
        const duration = trackPlan.fadeOutDuration;
        const effectDuration = Math.max(0.5, duration);

        switch (style) {
          case 'backspin':
            // Reverse effect during transition window
            transitionEffects.push('areverse');
            break;

          case 'tape_stop':
            // Slow down effect during transition window
            transitionEffects.push('asetrate=22050,aresample=44100');
            break;

          case 'stutter_edit':
            // Rhythmic stutter during transition window
            transitionEffects.push('atempo=1.5,atempo=0.66');
            break;

          case 'filter_sweep':
            transitionEffects.push(
              `highpass=f='20+20000*t/${effectDuration.toFixed(3)}'`
            );
            break;

          case 'echo_reverb':
            transitionEffects.push(`aecho=0.8:0.9:1000:0.3`);
            break;

          case 'three_band_swap':
            transitionEffects.push(
              `anequalizer=c0f=200:c0w=2:c0g=-10:c1f=2500:c1w=3:c1g=10:c2f=8000:c2w=4:c2g=-10`
            );
            break;

          case 'bass_drop':
            transitionEffects.push(`lowpass=f=200`);
            break;

          case 'snare_roll':
            transitionEffects.push(`highpass=f=2000`);
            break;

          case 'noise_riser':
            transitionEffects.push(
              `highpass=f='500+4000*t/${effectDuration.toFixed(3)}'`
            );
            break;

          // NEW STEM-BASED TRANSITIONS
          case 'vocal_handoff':
            transitionEffects.push(`lowpass=f=4000`);
            transitionEffects.push(
              `volume='1-0.3*(t/${effectDuration.toFixed(3)})':eval=frame`
            );
            break;

          case 'bass_swap':
            transitionEffects.push(`highpass=f=200:p=2`);
            break;

          case 'reverb_wash':
            transitionEffects.push(
              `lowpass=f='20000-15000*t/${effectDuration.toFixed(3)}'`
            );
            transitionEffects.push(
              `volume='1-0.4*(t/${effectDuration.toFixed(3)})':eval=frame`
            );
            break;

          case 'echo_out':
            transitionEffects.push(
              `highpass=f='20+500*t/${effectDuration.toFixed(3)}'`
            );
            transitionEffects.push(
              `lowpass=f='20000-8000*t/${effectDuration.toFixed(3)}'`
            );
            break;

          case 'smooth':
          case 'drop':
          case 'cut':
          case 'energy':
          default:
            break;
        }
      }

      if (trackPlan.fadeOutDuration > 0 && trackPlan.fadeOutStart !== null) {
        const effectDuration = Math.max(0.5, trackPlan.fadeOutDuration);

        // Sidechain ducking for vocal clarity during transition
        if (config.enableSidechainDucking) {
          transitionEffects.push(
            `volume='1-0.3*(t/${effectDuration.toFixed(3)})':eval=frame`
          );
        }

        // Filter sweep effect during transition
        if (config.enableFilterSweep) {
          transitionEffects.push(
            `highpass=f='20+2000*t/${effectDuration.toFixed(3)}':p=1.2`
          );
        }
      }

      const postParts: string[] = [];

      // Dynamic EQ for frequency masking prevention
      if (config.enableDynamicEQ) {
        postParts.push(`equalizer=f=500:t=h:width=200:g=-2`); // Cut low-mids
        postParts.push(`equalizer=f=2500:t=h:width=1000:g=-2`); // Cut vocal presence
      }

      // Multiband compression for control
      if (config.enableMultibandCompression) {
        postParts.push(
          `lowpass=f=250,acompressor=threshold=-24db:ratio=2:attack=20ms:release=100ms`
        );
        postParts.push(
          `lowpass=f=2500,highpass=f=250,acompressor=threshold=-20db:ratio=3:attack=20ms:release=100ms`
        );
        postParts.push(
          `highpass=f=4000,acompressor=threshold=-18db:ratio=4:attack=20ms:release=100ms`
        );
      }

      if (trackPlan.fadeInDuration > 0) {
        postParts.push(
          `afade=t=in:st=0:d=${trackPlan.fadeInDuration.toFixed(3)}`
        );
      }

      postParts.push(...fullSegmentEffects);
      postParts.push('volume=1');

      const baseLabel = `base${idx}`;
      if (postParts.length > 0) {
        filters.push(`[${tempoOutputLabel}]${postParts.join(',')}[${baseLabel}]`);
      } else {
        filters.push(`[${tempoOutputLabel}]anull[${baseLabel}]`);
      }

      let outputLabel = baseLabel;

      if (trackPlan.fadeOutDuration > 0 && trackPlan.fadeOutStart !== null) {
        const effectStart = Math.max(
          0,
          trackPlan.fadeOutStart - trackPlan.startOffset
        );
        const trackLength = Math.max(
          0,
          trackPlan.trimEnd - trackPlan.startOffset
        );
        const effectEnd = Math.min(
          trackLength,
          effectStart + trackPlan.fadeOutDuration
        );
        const hasTransitionEffects =
          transitionEffects.length > 0 && effectEnd > effectStart + 0.001;

        if (hasTransitionEffects) {
          const preLabel = `pre${idx}`;
          const fxLabel = `fx${idx}`;
          const preTrimLabel = `pretrim${idx}`;
          const fxTrimLabel = `fxtrim${idx}`;
          const concatLabel = `p${idx}`;

          const effectChain = [
            `atrim=start=${effectStart.toFixed(3)}:end=${effectEnd.toFixed(3)}`,
            'asetpts=PTS-STARTPTS',
            ...transitionEffects,
            `afade=t=out:st=0:d=${trackPlan.fadeOutDuration.toFixed(3)}`,
          ].join(',');

          if (effectStart > 0.001) {
            filters.push(`[${outputLabel}]asplit=2[${preLabel}][${fxLabel}]`);
            filters.push(
              `[${preLabel}]atrim=start=0:end=${effectStart.toFixed(
                3
              )},asetpts=PTS-STARTPTS[${preTrimLabel}]`
            );
            filters.push(`[${fxLabel}]${effectChain}[${fxTrimLabel}]`);
            filters.push(
              `[${preTrimLabel}][${fxTrimLabel}]concat=n=2:v=0:a=1[${concatLabel}]`
            );
          } else {
            filters.push(`[${outputLabel}]${effectChain}[${concatLabel}]`);
          }

          outputLabel = concatLabel;
        } else {
          const fadeOutStart = Math.min(
            effectStart,
            Math.max(0, trackLength - trackPlan.fadeOutDuration)
          );
          filters.push(
            `[${outputLabel}]afade=t=out:st=${fadeOutStart.toFixed(
              3
            )}:d=${trackPlan.fadeOutDuration.toFixed(3)}[p${idx}]`
          );
          outputLabel = `p${idx}`;
        }
      } else {
        filters.push(`[${outputLabel}]anull[p${idx}]`);
        outputLabel = `p${idx}`;
      }

      const delayMs = Math.max(0, Math.round(trackPlan.startTime * 1000));
      filters.push(`[p${idx}]adelay=${delayMs}|${delayMs}[d${idx}]`);
    });

    const mixInputs = playbackPlans.map((_, i) => `[d${i}]`).join('');
    filters.push(
      `${mixInputs}amix=inputs=${playbackPlans.length}:duration=longest:normalize=0[mixed]`
    );

    const estimatedEnd = playbackPlans.reduce(
      (max, plan) =>
        Math.max(
          max,
          plan.startTime + Math.max(plan.trimEnd - plan.startOffset, 0)
        ),
      0
    );
    const safeDuration = Math.max(
      30,
      Math.round(Math.max(config.targetDurationSeconds, estimatedEnd))
    );
    const endFadeDuration = Math.min(
      4,
      Math.max(1, config.fadeDurationSeconds ?? 3)
    );
    const endFadeStart = Math.max(0, safeDuration - endFadeDuration);

    // Final processing chain (after all tracks are mixed)
    const finalFilters: string[] = [];

    // Fade out at end of mix to avoid hard cutoff
    if (endFadeDuration > 0) {
      finalFilters.push(
        `afade=t=out:st=${endFadeStart.toFixed(
          3
        )}:d=${endFadeDuration.toFixed(3)}`
      );
    }

    // Loudness normalization (two-pass style)
    if (config.loudnessNormalization === 'ebu_r128') {
      const target = config.targetLoudness ?? -23;
      finalFilters.push(
        `loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=summary`
      );
    } else if (config.loudnessNormalization === 'peak') {
      finalFilters.push(`loudnorm=TP=-1.5:I=-14:LRA=11`);
    }

    // Final limiter to prevent clipping
    finalFilters.push(`alimiter=level_in=1:level_out=0.95`);

    // Apply final filters
    if (finalFilters.length > 0) {
      const finalFilter = finalFilters.join(',');
      filters.push(`[mixed]${finalFilter}[final]`);
    }

    const executeMix = async (filterGraph: string[], duration: number) => {
      const cmd = ffmpeg();
      tempFiles.forEach((file) => cmd.input(file));

      // Check if final filters are applied
      const hasFinalFilters = filters.some((f) => f.includes('[final]'));
      const outputLabel = hasFinalFilters ? 'final' : 'mixed';

      cmd
        .complexFilter(filterGraph, outputLabel)
        .outputOptions([
          `-ac ${OUTPUT_CHANNELS}`,
          `-ar ${OUTPUT_SAMPLE_RATE}`,
          `-t ${duration}`,
          '-b:a 192k',
        ])
        .format(OUTPUT_FORMAT);
      const chunks: Buffer[] = [];
      return new Promise<Buffer>((resolve, reject) => {
        cmd.on('start', (cmdline) => {
          log('info', 'autoDj.ffmpeg.start', { cmdline });
        });
        cmd.on('stderr', (line) => {
          if (line.includes('Error') || line.includes('error')) {
            log('error', 'autoDj.ffmpeg.stderr', { stderrLine: line });
          }
        });
        cmd.on('error', (err) => reject(err));
        const out = cmd.pipe();
        out.on('data', (c) => chunks.push(c));
        out.on('end', () => resolve(Buffer.concat(chunks)));
        out.on('error', (err) => reject(err));
      });
    };

    const buildFallbackFilters = () => {
      const fallbackFilters: string[] = [];
      const fade = Math.min(4, config.fadeDurationSeconds ?? 2);
      const perSegment =
        plan.order.length > 1
          ? config.targetDurationSeconds / plan.order.length
          : config.targetDurationSeconds;
      orderedBuffers.forEach((_, idx) => {
        let eqOut = idx < orderedBuffers.length - 1 ? ',highpass=f=400' : '';
        let eqIn = idx > 0 ? ',lowpass=f=8000' : '';

        // Add dynamic EQ if enabled
        if (config.enableDynamicEQ) {
          eqOut += ',equalizer=f=500:t=h:width=200:g=-2';
          eqIn += ',equalizer=f=2500:t=h:width=1000:g=-2';
        }

        fallbackFilters.push(
          `[${idx}:a]atrim=0:${perSegment.toFixed(
            2
          )},asetpts=PTS-STARTPTS${eqIn}${eqOut},afade=t=in:st=0:d=${Math.min(
            fade,
            perSegment / 2
          ).toFixed(2)},afade=t=out:st=${Math.max(0, perSegment - fade).toFixed(
            2
          )}:d=${fade.toFixed(2)}[fb${idx}]`
        );
        const delayMs = Math.round(
          Math.max(0, idx * (perSegment - fade)) * 1000
        );
        fallbackFilters.push(
          `[fb${idx}]adelay=${delayMs}|${delayMs}[fbd${idx}]`
        );
      });
      const mixInputs = orderedBuffers.map((_, i) => `[fbd${i}]`).join('');
      fallbackFilters.push(
        `${mixInputs}amix=inputs=${orderedBuffers.length}:duration=longest:normalize=0[mixed]`
      );

      const fallbackFadeLabel = 'mixed_fade';
      if (endFadeDuration > 0) {
        fallbackFilters.push(
          `[mixed]afade=t=out:st=${endFadeStart.toFixed(
            3
          )}:d=${endFadeDuration.toFixed(3)}[${fallbackFadeLabel}]`
        );
      }
      const fallbackInputLabel =
        endFadeDuration > 0 ? fallbackFadeLabel : 'mixed';

      // Add final processing to fallback
      let fallbackFinalInput = fallbackInputLabel;
      if (config.loudnessNormalization === 'ebu_r128') {
        const target = config.targetLoudness ?? -23;
        fallbackFilters.push(
          `[${fallbackInputLabel}]loudnorm=I=${target}:TP=-1.5:LRA=11[fallback_norm]`
        );
        fallbackFinalInput = 'fallback_norm';
      } else if (config.loudnessNormalization === 'peak') {
        fallbackFilters.push(
          `[${fallbackInputLabel}]loudnorm=TP=-1.5:I=-14:LRA=11[fallback_norm]`
        );
        fallbackFinalInput = 'fallback_norm';
      }
      fallbackFilters.push(
        `[${fallbackFinalInput}]alimiter=level_in=1:level_out=0.95[final]`
      );

      return fallbackFilters;
    };

    let result: Buffer | null = null;
    try {
      result = await executeMix(filters, safeDuration);
    } catch (error) {
      log('warn', 'autoDj.ffmpeg.fallback', {
        error: (error as Error).message,
      });
      const fallbackFilters = buildFallbackFilters();
      result = await executeMix(fallbackFilters, safeDuration);
    }

    if (!result || result.length === 0) {
      throw new Error('Auto DJ render produced empty output');
    }

    const outputUrl = await storage.uploadFile(
      result,
      `${mashupId}.${OUTPUT_FORMAT}`,
      'audio/mpeg'
    );
    const processingTime = Date.now() - startedAt;

    await db
      .update(mashups)
      .set({
        generationStatus: 'completed',
        outputStorageUrl: outputUrl,
        publicPlaybackUrl: outputUrl,
        outputFormat: OUTPUT_FORMAT,
        generationTimeMs: processingTime,
        mixMode: 'standard',
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId));

    logTelemetry({
      name: 'autoDj.render.completed',
      properties: { mashupId, outputUrl, processingTimeMs: processingTime },
    });
  } catch (error) {
    handleAsyncError(error as Error, 'renderAutoDjMix');
    await db
      .update(mashups)
      .set({ generationStatus: 'failed', updatedAt: new Date() })
      .where(eq(mashups.id, mashupId));
    throw error;
  } finally {
    for (const tempPath of tempFiles) {
      await tempFs.unlink(tempPath).catch(() => {});
    }
  }
}
