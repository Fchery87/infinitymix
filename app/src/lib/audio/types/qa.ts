export interface RenderQAMetrics {
  integratedLoudness?: number; // LUFS
  truePeak?: number; // dBTP
  dynamicRangeWarning?: boolean;
  clippingIncidence?: number;
}

export interface TransitionQARecord {
  fromTrackId: string;
  toTrackId: string;
  spectralClashScore?: number;
  loudnessJumpDb?: number;
}

export interface AutomationQAResults {
  mixMetrics?: RenderQAMetrics;
  transitions?: TransitionQARecord[];
  failedRules?: string[];
}
