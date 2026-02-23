type AudioPipelineFeatureFlags = {
  browserAnalysisWorker: boolean;
  mlSectionTagging: boolean;
  toneJsPreviewGraph: boolean;
  ruleBasedPlanner: boolean;
  twoPassLoudnorm: boolean;
  resumableUploads: boolean;
};

function parseFlag(value: string | undefined, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveFlag(
  serverValue: string | undefined,
  clientValue: string | undefined,
  fallback = false
): boolean {
  return parseFlag(serverValue ?? clientValue, fallback);
}

export function getAudioPipelineFeatureFlags(): AudioPipelineFeatureFlags {
  return {
    browserAnalysisWorker: resolveFlag(
      process.env.IMX_FEATURE_BROWSER_ANALYSIS_WORKER,
      process.env.NEXT_PUBLIC_IMX_FEATURE_BROWSER_ANALYSIS_WORKER
    ),
    mlSectionTagging: resolveFlag(
      process.env.IMX_FEATURE_ML_SECTION_TAGGING,
      process.env.NEXT_PUBLIC_IMX_FEATURE_ML_SECTION_TAGGING
    ),
    toneJsPreviewGraph: resolveFlag(
      process.env.IMX_FEATURE_TONEJS_PREVIEW_GRAPH,
      process.env.NEXT_PUBLIC_IMX_FEATURE_TONEJS_PREVIEW_GRAPH
    ),
    ruleBasedPlanner: parseFlag(process.env.IMX_FEATURE_RULE_BASED_PLANNER),
    twoPassLoudnorm: parseFlag(process.env.IMX_FEATURE_TWO_PASS_LOUDNORM),
    resumableUploads: resolveFlag(
      process.env.IMX_FEATURE_RESUMABLE_UPLOADS,
      process.env.NEXT_PUBLIC_IMX_FEATURE_RESUMABLE_UPLOADS
    ),
  };
}

export function getPublicAudioPipelineFeatureFlags() {
  const flags = getAudioPipelineFeatureFlags();
  return {
    browserAnalysisWorker: flags.browserAnalysisWorker,
    mlSectionTagging: flags.mlSectionTagging,
    toneJsPreviewGraph: flags.toneJsPreviewGraph,
    resumableUploads: flags.resumableUploads,
  };
}
