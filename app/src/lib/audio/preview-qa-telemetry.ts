export type PreviewQaEventType =
  | 'capability_detected'
  | 'capability_probe'
  | 'capability_unavailable'
  | 'preview_started'
  | 'preview_failed';

type PreviewQaRecord = {
  total: number;
  events: Partial<Record<PreviewQaEventType, number>>;
  reasons: Record<string, number>;
  lastSeenAt: number;
};

export type PreviewQaStore = {
  version: 1;
  browsers: Record<string, PreviewQaRecord>;
};

const STORAGE_KEY = 'imx_preview_qa_metrics_v1';

function getBrowserLabelFromUa(ua: string): string {
  const value = ua.toLowerCase();
  if (value.includes('edg/')) return 'Edge';
  if (value.includes('chrome/') && !value.includes('edg/')) return 'Chrome';
  if (value.includes('firefox/')) return 'Firefox';
  if (value.includes('safari/') && !value.includes('chrome/')) return 'Safari';
  return 'Other';
}

function getCurrentBrowserLabel() {
  if (typeof navigator === 'undefined') return 'server';
  return getBrowserLabelFromUa(navigator.userAgent || '');
}

function readStore(): PreviewQaStore {
  if (typeof window === 'undefined') {
    return { version: 1, browsers: {} };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, browsers: {} };
    const parsed = JSON.parse(raw) as PreviewQaStore;
    if (parsed?.version !== 1 || typeof parsed.browsers !== 'object' || !parsed.browsers) {
      return { version: 1, browsers: {} };
    }
    return parsed;
  } catch {
    return { version: 1, browsers: {} };
  }
}

function writeStore(store: PreviewQaStore) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // no-op
  }
}

export function recordPreviewQaTelemetry(event: PreviewQaEventType, reason?: string) {
  if (typeof window === 'undefined') return;
  const store = readStore();
  const browser = getCurrentBrowserLabel();
  const record: PreviewQaRecord = store.browsers[browser] ?? {
    total: 0,
    events: {},
    reasons: {},
    lastSeenAt: 0,
  };
  record.total += 1;
  record.events[event] = (record.events[event] ?? 0) + 1;
  if (reason) {
    record.reasons[reason] = (record.reasons[reason] ?? 0) + 1;
  }
  record.lastSeenAt = Date.now();
  store.browsers[browser] = record;
  writeStore(store);
}

export function getPreviewQaTelemetryStore(): PreviewQaStore {
  return readStore();
}

export function resetPreviewQaTelemetryStore() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
