import { NextResponse } from 'next/server';
import { getPublicAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import { getAudioRolloutConfigs } from '@/lib/audio/rollouts';
import { getAudioRolloutOverrides } from '@/lib/audio/rollout-overrides';

export async function GET() {
  const overrides = await getAudioRolloutOverrides();
  const configs = getAudioRolloutConfigs();

  return NextResponse.json({
    featureFlags: getPublicAudioPipelineFeatureFlags(),
    rollouts: {
      section_tagging: {
        domain: configs.section_tagging.domain,
        featureEnabled: configs.section_tagging.featureEnabled,
        candidatePercent: configs.section_tagging.candidatePercent,
        salt: configs.section_tagging.salt,
        override: overrides.section_tagging,
      },
    },
  });
}
