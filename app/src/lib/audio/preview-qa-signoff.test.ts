import { describe, expect, it } from 'vitest';
import { evaluatePreviewQaSignoff } from '@/lib/audio/preview-qa-signoff';
import type { PreviewQaStore } from '@/lib/audio/preview-qa-telemetry';

function createStore(browsers: PreviewQaStore['browsers']): PreviewQaStore {
  return { version: 1, browsers };
}

describe('evaluatePreviewQaSignoff', () => {
  it('passes when all target browsers either preview successfully or fall back cleanly', () => {
    const summary = evaluatePreviewQaSignoff(
      createStore({
        Chrome: {
          total: 2,
          events: { capability_probe: 1, preview_started: 1 },
          reasons: {},
          lastSeenAt: Date.now(),
        },
        Edge: {
          total: 2,
          events: { capability_probe: 1, preview_started: 1 },
          reasons: {},
          lastSeenAt: Date.now(),
        },
        Safari: {
          total: 1,
          events: { capability_unavailable: 1 },
          reasons: { 'Web Audio API unavailable': 1 },
          lastSeenAt: Date.now(),
        },
      })
    );

    expect(summary.overallPassed).toBe(true);
    expect(summary.browsers.find((browser) => browser.browser === 'Safari')?.status).toBe(
      'pass_with_fallback'
    );
  });

  it('fails when a target browser records preview failures', () => {
    const summary = evaluatePreviewQaSignoff(
      createStore({
        Chrome: {
          total: 2,
          events: { capability_probe: 1, preview_failed: 1 },
          reasons: { init_failed: 1 },
          lastSeenAt: Date.now(),
        },
      })
    );

    expect(summary.overallPassed).toBe(false);
    expect(summary.browsers.find((browser) => browser.browser === 'Chrome')?.status).toBe('fail');
  });
});
