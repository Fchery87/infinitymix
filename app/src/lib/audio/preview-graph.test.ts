import { afterEach, describe, expect, it } from 'vitest';
import { buildTransitionAutomationPlan, getPreviewGraphCapabilities } from '@/lib/audio/preview-graph';

describe('preview-graph transition plan mapping', () => {
  it('maps cut transitions to a short cut curve', () => {
    const plan = buildTransitionAutomationPlan('cut', 4);
    expect(plan.crossfadeCurve).toBe('cut');
    expect(plan.durationSeconds).toBeLessThanOrEqual(0.15);
  });

  it('adds filter sweep and exponential curve for drop-like transitions', () => {
    const plan = buildTransitionAutomationPlan('drop', 4);
    expect(plan.crossfadeCurve).toBe('exp');
    expect(plan.filterSweep).toEqual(
      expect.objectContaining({
        fromHz: 14000,
        toHz: 180,
      })
    );
  });

  it('preserves style-specific metadata used for scheduled envelope presets', () => {
    const plan = buildTransitionAutomationPlan('echo_reverb', 4);
    expect(plan.style).toBe('echo_reverb');
    expect(plan.delaySend).toBeGreaterThan(0.2);
    expect(plan.reverbSend).toBeGreaterThan(0.2);
  });

  it('adds delay/reverb sends for echo-style transitions', () => {
    const plan = buildTransitionAutomationPlan('echo_reverb', 4);
    expect(plan.crossfadeCurve).toBe('log');
    expect(plan.delaySend).toBeGreaterThan(0);
    expect(plan.reverbSend).toBeGreaterThan(0);
  });
});

describe('preview-graph capabilities', () => {
  const testGlobal = globalThis as typeof globalThis & { window?: unknown };
  const originalWindow = testGlobal.window;

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      testGlobal.window = undefined;
    } else {
      testGlobal.window = originalWindow;
    }
  });

  it('fails open in non-browser environments', () => {
    const capabilities = getPreviewGraphCapabilities();
    expect(capabilities.available).toBe(false);
    expect(capabilities.reason).toBeDefined();
  });

  it('detects standard AudioContext support', () => {
    testGlobal.window = {
      AudioContext: function MockAudioContext() {
        return undefined;
      },
    };

    const capabilities = getPreviewGraphCapabilities();
    expect(capabilities.available).toBe(true);
    expect(capabilities.webAudioAvailable).toBe(true);
  });

  it('detects webkitAudioContext fallback support', () => {
    testGlobal.window = {
      webkitAudioContext: function MockWebkitAudioContext() {
        return undefined;
      },
    };

    const capabilities = getPreviewGraphCapabilities();
    expect(capabilities.available).toBe(true);
    expect(capabilities.webAudioAvailable).toBe(true);
  });
});
