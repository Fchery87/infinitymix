import type { PreviewQaStore } from '@/lib/audio/preview-qa-telemetry';

export const PHASE_2_TARGET_BROWSERS = ['Chrome', 'Edge', 'Safari'] as const;

export type Phase2TargetBrowser = (typeof PHASE_2_TARGET_BROWSERS)[number];

export type PreviewQaSignoffStatus =
  | 'pass'
  | 'pass_with_fallback'
  | 'needs_data'
  | 'fail';

export type PreviewQaBrowserSignoff = {
  browser: Phase2TargetBrowser;
  status: PreviewQaSignoffStatus;
  capabilitySignals: number;
  unavailable: number;
  previewStarted: number;
  previewFailed: number;
  unavailableRate: number;
  failureRate: number;
  reason: string;
};

export type PreviewQaSignoffSummary = {
  overallPassed: boolean;
  browsers: PreviewQaBrowserSignoff[];
};

function safeRate(num: number, den: number) {
  if (den <= 0) return 0;
  return num / den;
}

function getBrowserRecord(store: PreviewQaStore, browser: Phase2TargetBrowser) {
  return store.browsers[browser] ?? {
    total: 0,
    events: {},
    reasons: {},
    lastSeenAt: 0,
  };
}

export function evaluatePreviewQaSignoff(store: PreviewQaStore): PreviewQaSignoffSummary {
  const browsers = PHASE_2_TARGET_BROWSERS.map((browser) => {
    const record = getBrowserRecord(store, browser);
    const capabilitySignals =
      (record.events.capability_detected ?? 0) +
      (record.events.capability_probe ?? 0) +
      (record.events.capability_unavailable ?? 0);
    const unavailable = record.events.capability_unavailable ?? 0;
    const previewStarted = record.events.preview_started ?? 0;
    const previewFailed = record.events.preview_failed ?? 0;
    const unavailableRate = safeRate(unavailable, capabilitySignals);
    const failureRate = safeRate(previewFailed, previewStarted + previewFailed);

    let status: PreviewQaSignoffStatus = 'needs_data';
    let reason = 'No target-browser QA data captured yet.';

    if (previewFailed > 0) {
      status = 'fail';
      reason = 'Preview failures were recorded for this browser.';
    } else if (previewStarted > 0) {
      status = 'pass';
      reason = 'Preview started successfully with no recorded failures.';
    } else if (capabilitySignals > 0 && unavailable > 0) {
      status = 'pass_with_fallback';
      reason = 'Capability fallback was observed and no blocking preview failures were recorded.';
    }

    return {
      browser,
      status,
      capabilitySignals,
      unavailable,
      previewStarted,
      previewFailed,
      unavailableRate,
      failureRate,
      reason,
    };
  });

  return {
    overallPassed: browsers.every(
      (browser) => browser.status === 'pass' || browser.status === 'pass_with_fallback'
    ),
    browsers,
  };
}
