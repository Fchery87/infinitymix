type Camelot = {
  num: number | null;
  mode: 'A' | 'B' | null;
};

type CompatibilityInput = {
  bpm: number | null | undefined;
  camelotKey?: string | null;
  beatGrid?: number[] | null;
  waveformLite?: number[] | null;
  bpmConfidence?: number | null;
  keyConfidence?: number | null;
  analysisFeatures?: {
    version: 'mir-v1';
    source: 'essentia' | 'meyda' | 'hybrid';
    extractionMs?: number | null;
    descriptors: {
      rms?: number | null;
      energy?: number | null;
      zcr?: number | null;
      spectralCentroid?: number | null;
      spectralRolloff?: number | null;
      flatnessDb?: number | null;
      crest?: number | null;
    };
  } | null;
};

type MirDescriptorBundle = NonNullable<
  NonNullable<CompatibilityInput['analysisFeatures']>['descriptors']
>;

type CompatibilityComponentScores = {
  bpm: number | null;
  key: number | null;
  energy: number | null;
  timbre: number | null;
  rhythm: number | null;
  confidence: number | null;
};

function parseCamelot(value: string | null | undefined): Camelot {
  if (!value) return { num: null, mode: null };
  const match = value.match(/^(\d{1,2})([AB])$/i);
  if (!match) return { num: null, mode: null };
  const num = Number(match[1]);
  const mode = match[2].toUpperCase() as 'A' | 'B';
  if (Number.isNaN(num)) return { num: null, mode: null };
  return { num, mode };
}

export function bpmCompatibility(target: number | null | undefined, candidate: number | null | undefined) {
  if (!target || !candidate || target <= 0 || candidate <= 0) return { diff: null, score: 0 };
  const diff = Math.abs(target - candidate);
  const pct = diff / target;
  let score = 1 - Math.min(1, pct);
  score = Number(score.toFixed(3));
  return { diff, score };
}

export function camelotCompatible(a: string | null | undefined, b: string | null | undefined) {
  const ca = parseCamelot(a);
  const cb = parseCamelot(b);
  if (!ca.num || !cb.num || !ca.mode || !cb.mode) return false;
  if (ca.num === cb.num && ca.mode === cb.mode) return true;
  if (ca.num === cb.num && ca.mode !== cb.mode) return true;
  if (Math.abs(ca.num - cb.num) === 1 && ca.mode === cb.mode) return true;
  // wrap-around 12↔1
  if ((ca.num === 12 && cb.num === 1) || (cb.num === 12 && ca.num === 1)) {
    return ca.mode === cb.mode;
  }
  return false;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function normalizedWaveform(values: number[] | null | undefined, length = 64) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const truncated = values.slice(0, length).map((v) => Math.abs(Number(v) || 0));
  const peak = Math.max(1e-9, ...truncated);
  return truncated.map((v) => v / peak);
}

function waveformEnergySimilarity(a: number[] | null | undefined, b: number[] | null | undefined) {
  const wa = normalizedWaveform(a);
  const wb = normalizedWaveform(b);
  if (!wa || !wb) return null;
  const n = Math.min(wa.length, wb.length);
  if (n === 0) return null;
  let diff = 0;
  for (let i = 0; i < n; i++) diff += Math.abs(wa[i] - wb[i]);
  return Number(clamp01(1 - diff / n).toFixed(3));
}

function waveformTimbreProxySimilarity(a: number[] | null | undefined, b: number[] | null | undefined) {
  const wa = normalizedWaveform(a, 96);
  const wb = normalizedWaveform(b, 96);
  if (!wa || !wb) return null;
  const aStats = { avg: mean(wa), spread: stdDev(wa) };
  const bStats = { avg: mean(wb), spread: stdDev(wb) };
  const avgDiff = Math.abs(aStats.avg - bStats.avg);
  const spreadDiff = Math.abs(aStats.spread - bStats.spread);
  const score = 1 - Math.min(1, avgDiff * 2 + spreadDiff * 2);
  return Number(clamp01(score).toFixed(3));
}

function beatIntervals(beatGrid: number[] | null | undefined) {
  if (!Array.isArray(beatGrid) || beatGrid.length < 3) return null;
  const intervals = beatGrid
    .slice(1)
    .map((t, i) => (Number(t) || 0) - (Number(beatGrid[i]) || 0))
    .filter((v) => Number.isFinite(v) && v > 0.05 && v < 5);
  return intervals.length >= 2 ? intervals : null;
}

function rhythmicStabilitySimilarity(
  anchorBeatGrid: number[] | null | undefined,
  candidateBeatGrid: number[] | null | undefined
) {
  const aIntervals = beatIntervals(anchorBeatGrid);
  const bIntervals = beatIntervals(candidateBeatGrid);
  if (!aIntervals || !bIntervals) return null;
  const aMean = mean(aIntervals);
  const bMean = mean(bIntervals);
  const aCv = aMean > 0 ? stdDev(aIntervals) / aMean : 1;
  const bCv = bMean > 0 ? stdDev(bIntervals) / bMean : 1;
  const meanDiffPct = aMean > 0 ? Math.abs(aMean - bMean) / aMean : 1;
  const cvDiff = Math.abs(aCv - bCv);
  const score = 1 - Math.min(1, meanDiffPct * 0.7 + cvDiff * 2.5);
  return Number(clamp01(score).toFixed(3));
}

function confidenceSimilarity(
  anchor: Pick<CompatibilityInput, 'bpmConfidence' | 'keyConfidence'>,
  candidate: Pick<CompatibilityInput, 'bpmConfidence' | 'keyConfidence'>
) {
  const values = [
    anchor.bpmConfidence,
    anchor.keyConfidence,
    candidate.bpmConfidence,
    candidate.keyConfidence,
  ].filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return null;
  return Number(clamp01(mean(values)).toFixed(3));
}

function mirDescriptorSimilarity(
  anchorMir: CompatibilityInput['analysisFeatures'],
  candidateMir: CompatibilityInput['analysisFeatures']
) {
  if (!anchorMir?.descriptors || !candidateMir?.descriptors) return null;

  const descriptorDefs: Array<{
    key: keyof MirDescriptorBundle;
    tolerance: number;
  }> = [
    { key: 'rms', tolerance: 0.25 },
    { key: 'energy', tolerance: 0.35 },
    { key: 'zcr', tolerance: 0.2 },
    { key: 'spectralCentroid', tolerance: 2200 },
    { key: 'spectralRolloff', tolerance: 3000 },
    { key: 'flatnessDb', tolerance: 12 },
    { key: 'crest', tolerance: 20 },
  ];

  const scores: number[] = [];
  const anchorDescriptors = anchorMir.descriptors as MirDescriptorBundle;
  const candidateDescriptors = candidateMir.descriptors as MirDescriptorBundle;
  for (const def of descriptorDefs) {
    const a = anchorDescriptors[def.key];
    const b = candidateDescriptors[def.key];
    if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) {
      continue;
    }
    const diff = Math.abs(a - b);
    const score = clamp01(1 - diff / def.tolerance);
    scores.push(score);
  }
  if (scores.length === 0) return null;
  return Number(mean(scores).toFixed(3));
}

export function overallCompatibility(
  anchorBpm: number | null | undefined,
  anchorCamelot: string | null | undefined,
  candidate: CompatibilityInput,
  anchorFeatures?: Omit<CompatibilityInput, 'bpm' | 'camelotKey'>
) {
  const { diff, score: bpmScore } = bpmCompatibility(anchorBpm, candidate.bpm);
  const keyOk = camelotCompatible(anchorCamelot, candidate.camelotKey ?? null);
  const keyScore = keyOk ? 1 : 0;
  const components: CompatibilityComponentScores = {
    bpm: bpmScore,
    key: keyScore,
    energy: waveformEnergySimilarity(anchorFeatures?.waveformLite, candidate.waveformLite),
    timbre:
      mirDescriptorSimilarity(anchorFeatures?.analysisFeatures, candidate.analysisFeatures) ??
      waveformTimbreProxySimilarity(anchorFeatures?.waveformLite, candidate.waveformLite),
    rhythm: rhythmicStabilitySimilarity(anchorFeatures?.beatGrid, candidate.beatGrid),
    confidence: confidenceSimilarity(
      {
        bpmConfidence: anchorFeatures?.bpmConfidence ?? null,
        keyConfidence: anchorFeatures?.keyConfidence ?? null,
      },
      {
        bpmConfidence: candidate.bpmConfidence ?? null,
        keyConfidence: candidate.keyConfidence ?? null,
      }
    ),
  };

  const weights: Record<keyof CompatibilityComponentScores, number> = {
    bpm: 0.4,
    key: 0.3,
    energy: 0.1,
    timbre: 0.07,
    rhythm: 0.08,
    confidence: 0.05,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  (Object.keys(components) as Array<keyof CompatibilityComponentScores>).forEach((key) => {
    const value = components[key];
    if (value == null) return;
    weightedSum += value * weights[key];
    totalWeight += weights[key];
  });

  // Backward compatibility: if only BPM + key are available, preserve the legacy 60/40 behavior.
  if (
    components.energy == null &&
    components.timbre == null &&
    components.rhythm == null &&
    components.confidence == null
  ) {
    const score = Number(((bpmScore * 0.6) + (keyScore * 0.4)).toFixed(2));
    return { score, bpmDiff: diff, keyOk, components };
  }

  const score = Number((totalWeight > 0 ? weightedSum / totalWeight : 0).toFixed(2));
  return { score, bpmDiff: diff, keyOk, components };
}

/**
 * Calculate the semitones needed to pitch-shift from one Camelot key to another
 * Each Camelot number represents a perfect fifth (7 semitones)
 * Returns the shortest path on the Camelot wheel
 */
export function calculatePitchShiftSemitones(fromCamelot: string | null | undefined, toCamelot: string | null | undefined): number {
  const from = parseCamelot(fromCamelot);
  const to = parseCamelot(toCamelot);
  
  if (!from.num || !to.num || !from.mode || !to.mode) return 0;
  
  // If already compatible, no shift needed
  if (camelotCompatible(fromCamelot, toCamelot)) return 0;
  
  // Calculate the difference in Camelot numbers
  let diff = to.num - from.num;
  
  // Find shortest path on circular wheel (1-12)
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  
  // Each step on Camelot wheel = 7 semitones (perfect fifth)
  // But we want the smallest pitch change, so we use modulo 12
  let semitones = (diff * 7) % 12;
  
  // Normalize to range -6 to +6 for smallest shift
  if (semitones > 6) semitones -= 12;
  if (semitones < -6) semitones += 12;
  
  // Handle mode change (A to B or B to A) - add 3 semitones (relative major/minor)
  if (from.mode !== to.mode) {
    // Minor (A) to Major (B) = +3 semitones
    // Major (B) to Minor (A) = -3 semitones
    const modeShift = from.mode === 'A' ? 3 : -3;
    semitones = (semitones + modeShift) % 12;
    if (semitones > 6) semitones -= 12;
    if (semitones < -6) semitones += 12;
  }
  
  return semitones;
}

/**
 * Convert semitones to pitch ratio for FFmpeg rubberband filter
 * pitch = 2^(semitones/12)
 */
export function semitonesToPitchRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Calculate tempo ratio for time-stretching
 */
export function calculateTempoRatio(sourceBpm: number | null | undefined, targetBpm: number | null | undefined): number {
  if (!sourceBpm || !targetBpm || sourceBpm <= 0 || targetBpm <= 0) return 1;
  return targetBpm / sourceBpm;
}

export type BeatAlignMode = 'downbeat' | 'any';

/**
 * Calculate beat offset to align two tracks' downbeats or nearest beats
 */
export function calculateBeatAlignment(
  vocalBeatGrid: number[],
  instBeatGrid: number[],
  vocalBpm: number,
  mode: BeatAlignMode = 'downbeat'
): number {
  if (!vocalBeatGrid.length || !instBeatGrid.length) return 0;
  if (!vocalBpm || vocalBpm <= 0) return 0;

  const vocalDownbeat = vocalBeatGrid[0];
  const instDownbeat = instBeatGrid[0];
  const beatInterval = 60 / vocalBpm;
  const barInterval = beatInterval * 4;

  let anchorBeat = vocalDownbeat;
  if (mode === 'any' && vocalBeatGrid.length > 1) {
    const nearest = vocalBeatGrid.reduce(
      (best, beat) => {
        const diff = Math.abs(beat - instDownbeat);
        return diff < best.diff ? { beat, diff } : best;
      },
      { beat: vocalDownbeat, diff: Math.abs(vocalDownbeat - instDownbeat) }
    );
    anchorBeat = nearest.beat;
  }

  let offset = instDownbeat - anchorBeat;
  offset = Math.round(offset / beatInterval) * beatInterval;

  while (offset > barInterval / 2) offset -= barInterval;
  while (offset < -barInterval / 2) offset += barInterval;

  return offset;
}
