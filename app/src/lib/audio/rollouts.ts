import { getAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';

export type AudioRolloutDomain = 'section_tagging' | 'planner';
export type AudioRolloutVariant = 'control' | 'candidate';

export type AudioRolloutOverride = {
  domain: AudioRolloutDomain;
  variant: AudioRolloutVariant;
  reason?: string | null;
  updatedAt?: string | null;
  adminUserEmail?: string | null;
};

export type AudioRolloutConfig = {
  domain: AudioRolloutDomain;
  featureEnabled: boolean;
  candidatePercent: number;
  salt: string;
  defaultVariant: AudioRolloutVariant;
};

export type AudioRolloutAssignment = {
  domain: AudioRolloutDomain;
  variant: AudioRolloutVariant;
  source: 'feature_disabled' | 'override' | 'percentage';
  bucket: number | null;
  stableKey: string;
};

function parsePercent(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getAudioRolloutConfigs(): Record<AudioRolloutDomain, AudioRolloutConfig> {
  const flags = getAudioPipelineFeatureFlags();
  return {
    section_tagging: {
      domain: 'section_tagging',
      featureEnabled: flags.mlSectionTagging,
      candidatePercent: parsePercent(
        process.env.IMX_ROLLOUT_SECTION_TAGGING_CANDIDATE_PERCENT,
        flags.mlSectionTagging ? 100 : 0
      ),
      salt: process.env.IMX_ROLLOUT_SECTION_TAGGING_SALT || 'section-tagging-v1',
      defaultVariant: 'control',
    },
    planner: {
      domain: 'planner',
      featureEnabled: flags.ruleBasedPlanner,
      candidatePercent: parsePercent(
        process.env.IMX_ROLLOUT_PLANNER_CANDIDATE_PERCENT,
        flags.ruleBasedPlanner ? 100 : 0
      ),
      salt: process.env.IMX_ROLLOUT_PLANNER_SALT || 'planner-v1',
      defaultVariant: 'control',
    },
  };
}

export function assignAudioRolloutVariant(args: {
  domain: AudioRolloutDomain;
  stableKey: string;
  config: AudioRolloutConfig;
  override?: AudioRolloutOverride | null;
}): AudioRolloutAssignment {
  const { domain, stableKey, config, override } = args;
  if (!config.featureEnabled) {
    return {
      domain,
      variant: 'control',
      source: 'feature_disabled',
      bucket: null,
      stableKey,
    };
  }

  if (override?.variant) {
    return {
      domain,
      variant: override.variant,
      source: 'override',
      bucket: null,
      stableKey,
    };
  }

  const bucket = hashString(`${config.salt}:${domain}:${stableKey}`) % 100;
  return {
    domain,
    variant: bucket < config.candidatePercent ? 'candidate' : config.defaultVariant,
    source: 'percentage',
    bucket,
    stableKey,
  };
}

export function buildUploadRolloutStableKey(fileName: string, fileSizeBytes: number) {
  return `${fileName}:${fileSizeBytes}`;
}

export const __testables = {
  parsePercent,
  hashString,
};
