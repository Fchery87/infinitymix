export type BrowserHintThresholds = {
  overallConfidence: number;
  bpmConfidence: number;
  keyConfidence: number;
};

const DEFAULT_BROWSER_HINT_THRESHOLDS: BrowserHintThresholds = {
  overallConfidence: 0.7,
  bpmConfidence: 0.65,
  keyConfidence: 0.5,
};

function parseThreshold(value: string | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0 || parsed > 1) return fallback;
  return parsed;
}

export function getBrowserHintThresholds(): BrowserHintThresholds {
  return {
    overallConfidence: parseThreshold(
      process.env.IMX_BROWSER_HINT_CONFIDENCE_THRESHOLD,
      DEFAULT_BROWSER_HINT_THRESHOLDS.overallConfidence
    ),
    bpmConfidence: parseThreshold(
      process.env.IMX_BROWSER_HINT_TEMPO_CONFIDENCE_THRESHOLD,
      DEFAULT_BROWSER_HINT_THRESHOLDS.bpmConfidence
    ),
    keyConfidence: parseThreshold(
      process.env.IMX_BROWSER_HINT_KEY_CONFIDENCE_THRESHOLD,
      DEFAULT_BROWSER_HINT_THRESHOLDS.keyConfidence
    ),
  };
}

export const __testables = {
  DEFAULT_BROWSER_HINT_THRESHOLDS,
  parseThreshold,
};
