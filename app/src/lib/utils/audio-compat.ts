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
