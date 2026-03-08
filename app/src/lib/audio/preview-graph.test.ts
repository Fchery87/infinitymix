import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTransitionAutomationPlan,
  ensurePreviewPlayerLoaded,
  getPreviewGraphCapabilities,
} from '@/lib/audio/preview-graph';
import { PREVIEW_RENDER_PARITY } from '@/lib/audio/preview-render-parity';

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

  it('has preview/render parity coverage for every supported transition style', () => {
    const styles = [
      'smooth',
      'drop',
      'energy',
      'cut',
      'filter_sweep',
      'echo_reverb',
      'backspin',
      'tape_stop',
      'stutter_edit',
      'three_band_swap',
      'bass_drop',
      'snare_roll',
      'noise_riser',
      'vocal_handoff',
      'bass_swap',
      'reverb_wash',
      'echo_out',
    ] as const;

    for (const style of styles) {
      expect(PREVIEW_RENDER_PARITY[style]).toBeDefined();
      expect(PREVIEW_RENDER_PARITY[style].controlMappings.length).toBeGreaterThan(0);
      expect(
        PREVIEW_RENDER_PARITY[style].controlMappings.some(
          (mapping) => mapping.previewControl === 'durationSeconds' || mapping.renderSetting === 'transitionStyle'
        )
      ).toBe(true);
    }
  });
});

describe('preview-graph capabilities', () => {
  const testGlobal = globalThis as typeof globalThis & {
    window?: (Window & typeof globalThis) | undefined;
  };
  const originalWindow = testGlobal.window;

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      Reflect.deleteProperty(testGlobal, 'window');
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
      } as unknown as typeof AudioContext,
    } as Window & typeof globalThis;

    const capabilities = getPreviewGraphCapabilities();
    expect(capabilities.available).toBe(true);
    expect(capabilities.webAudioAvailable).toBe(true);
  });

  it('detects webkitAudioContext fallback support', () => {
    testGlobal.window = {
      webkitAudioContext: function MockWebkitAudioContext() {
        return undefined;
      } as unknown,
    } as unknown as Window & typeof globalThis;

    const capabilities = getPreviewGraphCapabilities();
    expect(capabilities.available).toBe(true);
    expect(capabilities.webAudioAvailable).toBe(true);
  });
});

describe('ensurePreviewPlayerLoaded', () => {
  it('awaits load for players that are not yet loaded', async () => {
    let loaded = false;
    let loadCalls = 0;
    const player = {
      get loaded() {
        return loaded;
      },
      async load(url: string) {
        expect(url).toBe('/audio/test.mp3');
        loadCalls += 1;
        loaded = true;
      },
    };

    await ensurePreviewPlayerLoaded(player, '/audio/test.mp3');

    expect(loadCalls).toBe(1);
    expect(player.loaded).toBe(true);
  });

  it('does not reload players that already report loaded', async () => {
    let loadCalls = 0;
    const player = {
      loaded: true,
      async load() {
        loadCalls += 1;
      },
    };

    await ensurePreviewPlayerLoaded(player, '/audio/test.mp3');

    expect(loadCalls).toBe(0);
  });
});
