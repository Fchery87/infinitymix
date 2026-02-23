import { describe, expect, it } from 'vitest';
import type { BrowserAnalysisHint } from '@/lib/audio/types/analysis';
import { __testables } from '@/lib/audio/analysis-service';

function makeHint(overrides: Partial<BrowserAnalysisHint> = {}): BrowserAnalysisHint {
  return {
    source: 'browser-worker',
    version: 'browser-v1',
    fileName: 'track.mp3',
    fileSizeBytes: 1024,
    mimeType: 'audio/mpeg',
    generatedAt: new Date('2026-02-23T00:00:00.000Z').toISOString(),
    durationSeconds: 180,
    bpm: 124,
    bpmConfidence: 0.92,
    keySignature: 'Cmaj',
    keyConfidence: 0.81,
    phraseConfidence: 0.75,
    sectionConfidence: 0.7,
    beatGrid: [0, 0.5, 1, 1.5],
    phrases: [{ start: 0, end: 8, energy: 0.6 }],
    structure: [{ label: 'intro', start: 0, end: 16, confidence: 0.8 }],
    dropMoments: [32],
    waveformLite: [0.1, 0.2, 0.3],
    confidence: {
      overall: 0.9,
      tempo: 0.92,
      key: 0.81,
      phrase: 0.75,
      section: 0.7,
    },
    ...overrides,
  };
}

describe('analysis-service browser hint gating', () => {
  it('accepts a valid high-confidence browser hint when feature flag is enabled', () => {
    const hint = makeHint();
    expect(__testables.isBrowserAnalysisHint(hint)).toBe(true);
    expect(__testables.shouldUseBrowserHint(hint)).toBe(true);
    expect(__testables.resolveAcceptedBrowserHint(hint, true)).toEqual(hint);
  });

  it('falls back when overall confidence is below threshold', () => {
    const hint = makeHint({
      confidence: { overall: 0.69, tempo: 0.92, key: 0.81, phrase: 0.75, section: 0.7 },
    });

    expect(__testables.shouldUseBrowserHint(hint)).toBe(false);
    expect(__testables.resolveAcceptedBrowserHint(hint, true)).toBeNull();
  });

  it('falls back when BPM confidence is below threshold', () => {
    const hint = makeHint({ bpmConfidence: 0.64 });

    expect(__testables.shouldUseBrowserHint(hint)).toBe(false);
    expect(__testables.resolveAcceptedBrowserHint(hint, true)).toBeNull();
  });

  it('falls back when key confidence is below threshold or key is missing', () => {
    const lowKeyConfidence = makeHint({ keyConfidence: 0.49 });
    const missingKey = makeHint({ keySignature: null });

    expect(__testables.shouldUseBrowserHint(lowKeyConfidence)).toBe(false);
    expect(__testables.resolveAcceptedBrowserHint(lowKeyConfidence, true)).toBeNull();
    expect(__testables.shouldUseBrowserHint(missingKey)).toBe(false);
    expect(__testables.resolveAcceptedBrowserHint(missingKey, true)).toBeNull();
  });

  it('falls back when browser analysis worker feature flag is disabled', () => {
    const hint = makeHint();
    expect(__testables.resolveAcceptedBrowserHint(hint, false)).toBeNull();
  });

  it('returns exact decision reason codes for common fallback scenarios', () => {
    expect(__testables.getBrowserHintDecisionReason(undefined, true)).toBe('no_browser_hint');
    expect(__testables.getBrowserHintDecisionReason({ foo: 'bar' }, true)).toBe('invalid_browser_hint');
    expect(
      __testables.getBrowserHintDecisionReason(
        makeHint({
          confidence: { overall: 0.6, tempo: 0.92, key: 0.81, phrase: 0.75, section: 0.7 },
        }),
        true
      )
    ).toBe('low_overall_confidence');
    expect(__testables.getBrowserHintDecisionReason(makeHint({ bpm: null }), true)).toBe('missing_bpm');
    expect(__testables.getBrowserHintDecisionReason(makeHint({ bpmConfidence: 0.5 }), true)).toBe(
      'low_bpm_confidence'
    );
    expect(__testables.getBrowserHintDecisionReason(makeHint({ keySignature: null }), true)).toBe(
      'missing_key'
    );
    expect(__testables.getBrowserHintDecisionReason(makeHint({ keyConfidence: 0.2 }), true)).toBe(
      'low_key_confidence'
    );
    expect(__testables.getBrowserHintDecisionReason(makeHint(), false)).toBe('feature_disabled');
    expect(__testables.getBrowserHintDecisionReason(makeHint(), true)).toBe('accepted');
  });
});

describe('analysis-service browser hint db mapping', () => {
  it('derives camelot key and persists browser overall confidence', () => {
    const hint = makeHint({
      keySignature: 'Amin',
      analysisFeatures: {
        version: 'mir-v1',
        source: 'hybrid',
        extractionMs: 12.3,
        descriptors: {
          rms: 0.12,
          energy: 0.13,
          zcr: 0.04,
          spectralCentroid: 2100,
          spectralRolloff: 4800,
          flatnessDb: -8.2,
          crest: 7.1,
        },
      },
    });
    const dbUpdate = __testables.buildDbUpdateFromBrowserHint(hint);

    expect(dbUpdate.analysisQuality).toBe('browser_hint');
    expect(dbUpdate.analysisVersion).toBe('browser-v1');
    expect(dbUpdate.camelotKey).toBe('8A');
    expect(dbUpdate.browserAnalysisConfidence).toBe('0.9');
    expect(dbUpdate.browserHintDecisionReason).toBe('accepted');
    expect(dbUpdate.analysisFeatures).toEqual(hint.analysisFeatures);
  });

  it('rejects malformed values via type guard', () => {
    expect(__testables.isBrowserAnalysisHint(null)).toBe(false);
    expect(__testables.isBrowserAnalysisHint({})).toBe(false);
    expect(
      __testables.isBrowserAnalysisHint({
        source: 'browser-worker',
        fileName: 'x.mp3',
        fileSizeBytes: 1,
        confidence: {},
      })
    ).toBe(false);
  });
});
