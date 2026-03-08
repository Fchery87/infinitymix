'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  exportPreviewQaTelemetryStore,
  getPreviewQaTelemetryStore,
  resetPreviewQaTelemetryStore,
  type PreviewQaStore,
} from '@/lib/audio/preview-qa-telemetry';
import { evaluatePreviewQaSignoff } from '@/lib/audio/preview-qa-signoff';

function pct(num: number, den: number) {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function downloadTextFile(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AudioPreviewQaDashboard() {
  const [store, setStore] = useState<PreviewQaStore>({ version: 1, browsers: {} });

  const refresh = () => {
    setStore(getPreviewQaTelemetryStore());
  };

  useEffect(() => {
    refresh();
  }, []);

  const rows = useMemo(
    () =>
      Object.entries(store.browsers)
        .map(([browser, record]) => {
          const capabilitySignals =
            (record.events.capability_detected ?? 0) +
            (record.events.capability_probe ?? 0) +
            (record.events.capability_unavailable ?? 0);
          const unavailable = record.events.capability_unavailable ?? 0;
          const previewStarted = record.events.preview_started ?? 0;
          const previewFailed = record.events.preview_failed ?? 0;
          return {
            browser,
            record,
            capabilitySignals,
            unavailable,
            previewStarted,
            previewFailed,
          };
        })
        .sort((a, b) => b.record.lastSeenAt - a.record.lastSeenAt),
    [store]
  );
  const signoff = useMemo(() => evaluatePreviewQaSignoff(store), [store]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Audio Preview QA (Local Browser Telemetry)</h1>
            <p className="text-sm text-gray-400">
              Local-only aggregation from browser preview capability probes and fallback events.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/audio-observability" className="text-sm text-primary hover:text-primary/80">
              Back to observability
            </Link>
            <Button variant="outline" onClick={refresh} className="border-white/10 bg-black/20">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                downloadTextFile(`imx-phase2-preview-qa-${stamp}.json`, exportPreviewQaTelemetryStore());
              }}
              className="border-white/10 bg-black/20"
            >
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetPreviewQaTelemetryStore();
                refresh();
              }}
              className="border-white/10 bg-black/20"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Reset Local Data
            </Button>
          </div>
        </div>

        <Card className="bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Phase 2 Browser Signoff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm text-gray-400">Overall Result</div>
              <div className={signoff.overallPassed ? 'text-lg font-semibold text-emerald-300' : 'text-lg font-semibold text-amber-300'}>
                {signoff.overallPassed ? 'Pass' : 'Incomplete'}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                A browser passes if preview starts cleanly with no recorded failures, or if fallback is observed without blocking errors.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Export the local JSON evidence from this page and feed it into the Phase 2 signoff report script.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {signoff.browsers.map((browser) => (
                <div key={browser.browser} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-white">{browser.browser}</div>
                    <div
                      className={
                        browser.status === 'pass'
                          ? 'text-xs font-medium text-emerald-300'
                          : browser.status === 'pass_with_fallback'
                            ? 'text-xs font-medium text-sky-300'
                            : browser.status === 'fail'
                              ? 'text-xs font-medium text-red-300'
                              : 'text-xs font-medium text-amber-300'
                      }
                    >
                      {browser.status}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-gray-300">
                    <div>Capability signals: {browser.capabilitySignals}</div>
                    <div>Unavailable: {browser.unavailable}</div>
                    <div>Preview started: {browser.previewStarted}</div>
                    <div>Preview failed: {browser.previewFailed}</div>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">{browser.reason}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Per-Browser Rates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 bg-black/60">
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3 font-medium">Browser</th>
                      <th className="px-4 py-3 font-medium">Capability Signals</th>
                      <th className="px-4 py-3 font-medium">Unavailable</th>
                      <th className="px-4 py-3 font-medium">Unavailable Rate</th>
                      <th className="px-4 py-3 font-medium">Preview Started</th>
                      <th className="px-4 py-3 font-medium">Preview Failed</th>
                      <th className="px-4 py-3 font-medium">Failure Rate</th>
                      <th className="px-4 py-3 font-medium">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.browser} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 font-medium text-white">{row.browser}</td>
                        <td className="px-4 py-3 text-gray-300">{row.capabilitySignals}</td>
                        <td className="px-4 py-3 text-gray-300">{row.unavailable}</td>
                        <td className="px-4 py-3 text-gray-300">{pct(row.unavailable, row.capabilitySignals)}</td>
                        <td className="px-4 py-3 text-gray-300">{row.previewStarted}</td>
                        <td className="px-4 py-3 text-gray-300">{row.previewFailed}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {pct(row.previewFailed, row.previewStarted + row.previewFailed)}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {row.record.lastSeenAt ? new Date(row.record.lastSeenAt).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                          No local QA telemetry captured yet. Trigger browser preview probes from `Create` or `StemPlayer`.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-white">Reason Samples</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={`${row.browser}-reasons`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="mb-2 text-sm font-medium text-white">{row.browser}</div>
                <div className="space-y-2">
                  {Object.entries(row.record.reasons).length === 0 && (
                    <p className="text-xs text-gray-400">No reasons recorded.</p>
                  )}
                  {Object.entries(row.record.reasons)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between text-xs">
                        <span className="truncate text-gray-300">{reason}</span>
                        <span className="ml-3 text-white">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
