import { describe, expect, it } from 'vitest';
import {
  __testables,
  assignAudioRolloutVariant,
  buildUploadRolloutStableKey,
} from '@/lib/audio/rollouts';

describe('audio rollouts', () => {
  it('builds a stable upload rollout key from filename and file size', () => {
    expect(buildUploadRolloutStableKey('track-a.mp3', 1234)).toBe('track-a.mp3:1234');
  });

  it('keeps hash output deterministic', () => {
    expect(__testables.hashString('same-input')).toBe(__testables.hashString('same-input'));
  });

  it('falls back to control when the feature is disabled', () => {
    expect(
      assignAudioRolloutVariant({
        domain: 'section_tagging',
        stableKey: 'track-a.mp3:1234',
        config: {
          domain: 'section_tagging',
          featureEnabled: false,
          candidatePercent: 100,
          salt: 'section-tagging-v1',
          defaultVariant: 'control',
        },
      })
    ).toMatchObject({
      variant: 'control',
      source: 'feature_disabled',
      bucket: null,
    });
  });

  it('uses explicit overrides before percentage bucketing', () => {
    expect(
      assignAudioRolloutVariant({
        domain: 'planner',
        stableKey: 'mashup-1',
        config: {
          domain: 'planner',
          featureEnabled: true,
          candidatePercent: 0,
          salt: 'planner-v1',
          defaultVariant: 'control',
        },
        override: {
          domain: 'planner',
          variant: 'candidate',
        },
      })
    ).toMatchObject({
      variant: 'candidate',
      source: 'override',
      bucket: null,
    });
  });

  it('uses percentage bucketing when there is no override', () => {
    const assignment = assignAudioRolloutVariant({
      domain: 'planner',
      stableKey: 'mashup-1',
      config: {
        domain: 'planner',
        featureEnabled: true,
        candidatePercent: 100,
        salt: 'planner-v1',
        defaultVariant: 'control',
      },
    });

    expect(assignment.variant).toBe('candidate');
    expect(assignment.source).toBe('percentage');
    expect(typeof assignment.bucket).toBe('number');
  });

  it('clamps invalid percentage env values', () => {
    expect(__testables.parsePercent(undefined, 50)).toBe(50);
    expect(__testables.parsePercent('not-a-number', 50)).toBe(50);
    expect(__testables.parsePercent('-10', 50)).toBe(0);
    expect(__testables.parsePercent('200', 50)).toBe(100);
  });
});
