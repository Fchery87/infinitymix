type Camelot = {
  num: number | null;
  mode: 'A' | 'B' | null;
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

export function overallCompatibility(anchorBpm: number | null | undefined, anchorCamelot: string | null | undefined, candidate: { bpm: number | null | undefined; camelotKey?: string | null }) {
  const { diff, score: bpmScore } = bpmCompatibility(anchorBpm, candidate.bpm);
  const keyOk = camelotCompatible(anchorCamelot, candidate.camelotKey ?? null);
  const keyScore = keyOk ? 1 : 0;
  const score = Number(((bpmScore * 0.6) + (keyScore * 0.4)).toFixed(2));
  return { score, bpmDiff: diff, keyOk };
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
