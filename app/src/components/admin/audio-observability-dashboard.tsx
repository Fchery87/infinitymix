'use client';

import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, Database, RefreshCw, Shield, SlidersHorizontal, TrendingUp, Wand2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/helpers';

type ObservabilityMetricsResponse = {
  status: string;
  timestamp: number;
  metrics: {
    audioPipeline: {
      featureFlags: Record<string, boolean>;
      analysis: {
        qualityCounts: Record<string, number>;
        browserHintDecisionReasonCounts: Record<string, number>;
        completedTracks: number;
        browserHintTracks: number;
        browserHintAcceptanceRate: number | null;
        trends: {
          hourly24h: TrendPoint[];
          daily7d: TrendPoint[];
        };
      } | null;
    };
  };
};

type AdminTrack = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  original_filename: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis_quality: string | null;
  analysis_version: string | null;
  bpm: number | null;
  musical_key: string | null;
  camelot_key: string | null;
  bpm_confidence: number | null;
  key_confidence: number | null;
  browser_analysis_confidence: number | null;
  browser_hint_decision_reason: string | null;
  duration_seconds: number | null;
  has_stems: boolean;
  created_at: string;
  updated_at: string;
};

type AdminTracksResponse = {
  tracks: AdminTrack[];
  filters: {
    analysisQuality: string | null;
    analysisStatus: string | null;
    userId: string | null;
    search: string | null;
  };
  debug: {
    qualityCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    decisionReasonCounts: Record<string, number>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
};

type DashboardProps = {
  adminUser: {
    id?: string | null;
    email?: string | null;
    name?: string | null;
  };
};

type AdminAuditLogEntry = {
  id: string;
  admin_user_id: string | null;
  admin_user_email: string | null;
  action: string;
  resource_type: string;
  resource_ids: string[];
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AdminAuditLogsResponse = {
  logs: AdminAuditLogEntry[];
};

type TrendPoint = {
  bucket: string;
  label: string;
  completedTracks: number;
  browserHintTracks: number;
  acceptedTracks: number;
  fallbackTracks: number;
  acceptanceRate: number | null;
  reasonCounts: Record<string, number>;
};

function formatPct(value: number | null) {
  if (value == null) return 'N/A';
  return `${Math.round(value * 100)}%`;
}

function statusPill(status: AdminTrack['analysis_status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    case 'failed':
      return 'bg-red-500/10 text-red-300 border-red-500/20';
    case 'analyzing':
      return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    default:
      return 'bg-white/5 text-gray-300 border-white/10';
  }
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const escapeCell = (value: unknown) => {
    if (value == null) return '';
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TinyAcceptanceChart({ points, title }: { points: TrendPoint[]; title: string }) {
  const maxCompleted = Math.max(1, ...points.map((p) => p.completedTracks));
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <div className="rounded-lg border border-white/5 bg-black/20 p-3">
        <div className="flex h-24 items-end gap-1">
          {points.map((point) => {
            const rate = point.acceptanceRate ?? 0;
            const barHeight = Math.max(4, Math.round(rate * 100));
            const opacity = Math.max(0.25, point.completedTracks / maxCompleted);
            return (
              <div key={point.bucket} className="group flex-1">
                <div
                  className="w-full rounded-t-sm bg-gradient-to-t from-primary/60 to-orange-300/80 transition-opacity"
                  style={{ height: `${barHeight}%`, opacity }}
                  title={`${point.label}: ${Math.round(rate * 100)}% (${point.browserHintTracks}/${point.completedTracks})`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-gray-500">
          <span>{points[0]?.label ?? '--'}</span>
          <span>{points[Math.floor(points.length / 2)]?.label ?? '--'}</span>
          <span>{points[points.length - 1]?.label ?? '--'}</span>
        </div>
      </div>
    </div>
  );
}

function TinyFallbackStackChart({ points, title }: { points: TrendPoint[]; title: string }) {
  const topReasons = Array.from(
    points.reduce((acc, point) => {
      for (const [reason, count] of Object.entries(point.reasonCounts ?? {})) {
        if (reason === 'accepted' || count <= 0) continue;
        acc.set(reason, (acc.get(reason) ?? 0) + count);
      }
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  const palette = ['bg-blue-400/80', 'bg-amber-400/80', 'bg-pink-400/80'];
  const maxFallback = Math.max(1, ...points.map((p) => p.fallbackTracks));

  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">{title}</p>
      <div className="rounded-lg border border-white/5 bg-black/20 p-3">
        <div className="flex h-24 items-end gap-1">
          {points.map((point) => (
            <div key={point.bucket} className="flex flex-1 flex-col justify-end">
              <div className="flex h-full flex-col justify-end gap-[1px]">
                {topReasons.map((reason, idx) => {
                  const count = point.reasonCounts?.[reason] ?? 0;
                  if (count <= 0) return null;
                  const totalHeight = Math.max(4, Math.round((point.fallbackTracks / maxFallback) * 100));
                  const segmentHeight = Math.max(2, Math.round((count / Math.max(1, point.fallbackTracks)) * totalHeight));
                  return (
                    <div
                      key={`${point.bucket}-${reason}`}
                      className={cn('w-full rounded-sm', palette[idx] ?? 'bg-white/40')}
                      style={{ height: `${segmentHeight}%` }}
                      title={`${point.label}: ${reason} (${count})`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {topReasons.length === 0 && <span className="text-[10px] text-gray-500">No fallback reasons in range</span>}
          {topReasons.map((reason, idx) => (
            <span key={reason} className="inline-flex items-center gap-1 text-[10px] text-gray-400">
              <span className={cn('inline-block h-2 w-2 rounded-full', palette[idx] ?? 'bg-white/40')} />
              {reason}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AudioObservabilityDashboard({ adminUser }: DashboardProps) {
  const [metrics, setMetrics] = useState<ObservabilityMetricsResponse | null>(null);
  const [tracksResponse, setTracksResponse] = useState<AdminTracksResponse | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [analysisQualityFilter, setAnalysisQualityFilter] = useState<'all' | 'browser_hint' | 'standard'>('all');
  const [analysisStatusFilter, setAnalysisStatusFilter] = useState<'all' | 'pending' | 'analyzing' | 'completed' | 'failed'>('all');
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput.trim());
  const [page, setPage] = useState(1);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isRequeueing, setIsRequeueing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [quickReasonCode, setQuickReasonCode] = useState<string>('low_overall_confidence');
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [analysisQualityFilter, analysisStatusFilter, deferredSearch]);

  useEffect(() => {
    setSelectedTrackIds((current) => {
      const visibleIds = new Set((tracksResponse?.tracks ?? []).map((t) => t.id));
      return current.filter((id) => visibleIds.has(id));
    });
  }, [tracksResponse]);

  useEffect(() => {
    let cancelled = false;
    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      try {
        const res = await fetch('/api/observability/metrics', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load observability metrics');
        const json = (await res.json()) as ObservabilityMetricsResponse;
        if (!cancelled) setMetrics(json);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setMetrics(null);
        }
      } finally {
        if (!cancelled) setIsLoadingMetrics(false);
      }
    };
    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    const loadAuditLogs = async () => {
      setIsLoadingAuditLogs(true);
      try {
        const res = await fetch('/api/admin/audit/logs?limit=15', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load admin audit logs');
        const json = (await res.json()) as AdminAuditLogsResponse;
        if (!cancelled) setAuditLogs(json.logs ?? []);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setAuditLogs([]);
        }
      } finally {
        if (!cancelled) setIsLoadingAuditLogs(false);
      }
    };
    void loadAuditLogs();
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;
    const loadTracks = async () => {
      setIsLoadingTracks(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '25');
        if (analysisQualityFilter !== 'all') params.set('analysisQuality', analysisQualityFilter);
        if (analysisStatusFilter !== 'all') params.set('analysisStatus', analysisStatusFilter);
        if (deferredSearch) params.set('search', deferredSearch);

        const res = await fetch(`/api/admin/audio/tracks?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load admin track data');
        const json = (await res.json()) as AdminTracksResponse;
        if (!cancelled) setTracksResponse(json);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setTracksResponse(null);
        }
      } finally {
        if (!cancelled) setIsLoadingTracks(false);
      }
    };
    void loadTracks();
    return () => {
      cancelled = true;
    };
  }, [page, analysisQualityFilter, analysisStatusFilter, deferredSearch, refreshTick]);

  const featureFlags = metrics?.metrics.audioPipeline.featureFlags ?? {};
  const analysisMetrics = metrics?.metrics.audioPipeline.analysis ?? null;
  const enabledFlagCount = useMemo(
    () => Object.values(featureFlags).filter(Boolean).length,
    [featureFlags]
  );
  const visibleTracks = tracksResponse?.tracks ?? [];
  const selectedTracks = useMemo(
    () => visibleTracks.filter((track) => selectedTrackIds.includes(track.id)),
    [visibleTracks, selectedTrackIds]
  );
  const quickReasonOptions = useMemo(() => {
    const seen = new Set<string>();
    const values = [
      ...Object.keys(tracksResponse?.debug.decisionReasonCounts ?? {}),
      ...Object.keys(analysisMetrics?.browserHintDecisionReasonCounts ?? {}),
    ].filter((key) => key && key !== 'unknown' && key !== 'accepted');
    const ordered = values.filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return ordered.length > 0 ? ordered : ['low_overall_confidence'];
  }, [tracksResponse?.debug.decisionReasonCounts, analysisMetrics?.browserHintDecisionReasonCounts]);
  useEffect(() => {
    if (!quickReasonOptions.includes(quickReasonCode)) {
      setQuickReasonCode(quickReasonOptions[0] ?? 'low_overall_confidence');
    }
  }, [quickReasonCode, quickReasonOptions]);
  const allVisibleSelected = visibleTracks.length > 0 && selectedTrackIds.length === visibleTracks.length;
  const fallbackSummary = useMemo(() => {
    const rows = visibleTracks;
    let browserAccepted = 0;
    let serverCompleted = 0;
    let pendingOrAnalyzing = 0;
    let failed = 0;
    for (const track of rows) {
      if (track.analysis_status === 'failed') {
        failed += 1;
        continue;
      }
      if (track.analysis_status === 'pending' || track.analysis_status === 'analyzing') {
        pendingOrAnalyzing += 1;
        continue;
      }
      if (track.analysis_quality === 'browser_hint') {
        browserAccepted += 1;
      } else if (track.analysis_status === 'completed') {
        serverCompleted += 1;
      }
    }
    const reasonCounts = rows.reduce<Record<string, number>>((acc, track) => {
      const key = track.browser_hint_decision_reason ?? 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return { browserAccepted, serverCompleted, pendingOrAnalyzing, failed, reasonCounts };
  }, [visibleTracks]);

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedTrackIds([]);
      return;
    }
    setSelectedTrackIds(visibleTracks.map((track) => track.id));
  };

  const toggleTrackSelection = (trackId: string) => {
    setSelectedTrackIds((current) =>
      current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [...current, trackId]
    );
  };

  const handleRequeueSelected = async () => {
    await requeueTrackIds(selectedTrackIds, 'selected');
  };

  const requeueTrackIds = async (trackIds: string[], source: 'selected' | 'failed_visible' | 'reason_visible') => {
    if (trackIds.length === 0) return;
    setIsRequeueing(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/audio/tracks/requeue-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackIds,
          metadata: {
            source,
            page,
            analysisQualityFilter,
            analysisStatusFilter,
            search: deferredSearch || null,
            reasonCode: source === 'reason_visible' ? quickReasonCode : undefined,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to requeue analysis');
      }
      setActionMessage(`Requeued ${json.enqueued}/${json.requested} analysis job(s).`);
      setRefreshTick((v) => v + 1);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Failed to requeue analysis');
    } finally {
      setIsRequeueing(false);
    }
  };

  const handleRequeueFailedVisible = async () => {
    const failedVisibleIds = visibleTracks
      .filter((track) => track.analysis_status === 'failed')
      .map((track) => track.id);
    await requeueTrackIds(failedVisibleIds, 'failed_visible');
  };

  const handleRequeueVisibleByReason = async () => {
    const reasonMatchedIds = visibleTracks
      .filter((track) => track.browser_hint_decision_reason === quickReasonCode)
      .map((track) => track.id);
    await requeueTrackIds(reasonMatchedIds, 'reason_visible');
  };

  const handleExportCsv = () => {
    const rows = visibleTracks.map((track) => ({
      id: track.id,
      original_filename: track.original_filename,
      user_email: track.user_email ?? '',
      user_name: track.user_name ?? '',
      analysis_status: track.analysis_status,
      analysis_quality: track.analysis_quality ?? '',
      analysis_version: track.analysis_version ?? '',
      bpm: track.bpm ?? '',
      musical_key: track.musical_key ?? '',
      camelot_key: track.camelot_key ?? '',
      bpm_confidence: track.bpm_confidence ?? '',
      key_confidence: track.key_confidence ?? '',
      browser_analysis_confidence: track.browser_analysis_confidence ?? '',
      browser_hint_decision_reason: track.browser_hint_decision_reason ?? '',
      duration_seconds: track.duration_seconds ?? '',
      has_stems: track.has_stems,
      created_at: track.created_at,
      updated_at: track.updated_at,
    }));
    downloadCsv(`infinitymix-admin-audio-tracks-page-${page}.csv`, rows);
    setActionMessage(`Exported ${rows.length} row(s) to CSV.`);
    void fetch('/api/admin/audit/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'audio_tracks.export_csv',
        resourceType: 'uploaded_track',
        resourceIds: visibleTracks.map((track) => track.id),
        metadata: {
          page,
          visibleCount: visibleTracks.length,
          analysisQualityFilter,
          analysisStatusFilter,
          search: deferredSearch || null,
        },
      }),
    }).then(() => setRefreshTick((v) => v + 1)).catch(() => undefined);
  };

  return (
    <div className="min-h-screen text-foreground">
      <div className="fixed inset-0 -z-10 bg-background" />
      <div className="fixed -z-10 top-0 left-1/2 -translate-x-1/2 h-[360px] w-[1100px] rounded-full bg-primary/15 blur-[110px]" />
      <div className="fixed -z-10 bottom-0 right-0 h-[420px] w-[720px] rounded-full bg-blue-500/10 blur-[90px]" />

      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/60 backdrop-blur-lg">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-orange-500 shadow-lg shadow-primary/20">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">InfinityMix Admin</p>
              <p className="text-xs text-gray-400">Audio Observability & Control Plane</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create">
              <Button variant="ghost" className="text-gray-300 hover:text-white">Create</Button>
            </Link>
            <Button
              variant="glow"
              className="gap-2"
              onClick={() => setRefreshTick((v) => v + 1)}
              disabled={isLoadingMetrics || isLoadingTracks}
            >
              <RefreshCw className={cn('h-4 w-4', (isLoadingMetrics || isLoadingTracks) && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <section className="mb-8">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              Admin-only
            </div>
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-300">
              {adminUser.email ?? adminUser.id}
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Audio Pipeline Observability
          </h1>
          <p className="mt-3 max-w-3xl text-gray-400">
            Monitor browser pre-analysis adoption, inspect track-level analysis quality, and debug confidence/fallback behavior across all users.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-primary/20 bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <BarChart3 className="h-4 w-4 text-primary" />
                Browser Hint Acceptance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">
                {formatPct(analysisMetrics?.browserHintAcceptanceRate ?? null)}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {analysisMetrics?.browserHintTracks ?? 0} browser-hint tracks / {analysisMetrics?.completedTracks ?? 0} completed tracks
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <Database className="h-4 w-4 text-blue-300" />
                Quality Counts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(analysisMetrics?.qualityCounts ?? {}).length === 0 ? (
                <p className="text-gray-400">No data yet</p>
              ) : (
                Object.entries(analysisMetrics?.qualityCounts ?? {}).map(([key, count]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-gray-300">{key}</span>
                    <span className="font-semibold text-white">{count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <SlidersHorizontal className="h-4 w-4 text-orange-300" />
                Feature Flags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{enabledFlagCount}</p>
              <p className="mt-2 text-xs text-gray-400">
                enabled of {Object.keys(featureFlags).length || 0} audio pipeline flags
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                <Activity className="h-4 w-4 text-emerald-300" />
                Data Freshness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-white">
                {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleString() : 'Loading...'}
              </p>
              <p className="mt-2 text-xs text-gray-400">
                {isLoadingMetrics || isLoadingTracks ? 'Refreshing now…' : 'Latest admin fetch'}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-4 xl:grid-cols-2">
          <Card className="bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <TrendingUp className="h-4 w-4 text-primary" />
                Acceptance Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TinyAcceptanceChart
                title="Hourly (Last 24h)"
                points={analysisMetrics?.trends.hourly24h ?? []}
              />
              <TinyAcceptanceChart
                title="Daily (Last 7d)"
                points={analysisMetrics?.trends.daily7d ?? []}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Wand2 className="h-4 w-4 text-amber-300" />
                Fallback Reason Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TinyFallbackStackChart
                title="Hourly (Last 24h)"
                points={analysisMetrics?.trends.hourly24h ?? []}
              />
              <TinyFallbackStackChart
                title="Daily (Last 7d)"
                points={analysisMetrics?.trends.daily7d ?? []}
              />
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card className="bg-card/60">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-lg text-white">Global Track Analysis Explorer</CardTitle>
                  <p className="mt-1 text-sm text-gray-400">
                    Filter all uploaded tracks by source quality, status, and filename to inspect browser-hint adoption.
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  {tracksResponse?.pagination.total ?? 0} total tracks
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search filename..."
                  className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-primary/40"
                />
                <select
                  value={analysisQualityFilter}
                  onChange={(e) => setAnalysisQualityFilter(e.target.value as typeof analysisQualityFilter)}
                  className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-primary/40"
                >
                  <option value="all">All Sources</option>
                  <option value="browser_hint">Browser Hint</option>
                  <option value="standard">Server / Standard</option>
                </select>
                <select
                  value={analysisStatusFilter}
                  onChange={(e) => setAnalysisStatusFilter(e.target.value as typeof analysisStatusFilter)}
                  className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-primary/40"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="analyzing">Analyzing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-400">
                  Selected: <span className="font-semibold text-white">{selectedTrackIds.length}</span>
                  {' • '}
                  Selected (loaded): <span className="font-semibold text-white">{selectedTracks.length}</span>
                  {' • '}
                  Visible: <span className="font-semibold text-white">{visibleTracks.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    onClick={toggleSelectAllVisible}
                    disabled={visibleTracks.length === 0}
                  >
                    {allVisibleSelected ? 'Clear Selection' : 'Select Visible'}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    onClick={handleExportCsv}
                    disabled={visibleTracks.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    onClick={handleRequeueFailedVisible}
                    disabled={isRequeueing || !visibleTracks.some((track) => track.analysis_status === 'failed')}
                  >
                    Requeue Failed (Visible)
                  </Button>
                  <select
                    value={quickReasonCode}
                    onChange={(e) => setQuickReasonCode(e.target.value)}
                    className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-primary/40"
                  >
                    {quickReasonOptions.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    onClick={handleRequeueVisibleByReason}
                    disabled={
                      isRequeueing ||
                      !visibleTracks.some((track) => track.browser_hint_decision_reason === quickReasonCode)
                    }
                  >
                    Requeue By Reason
                  </Button>
                  <Button
                    variant="glow"
                    onClick={handleRequeueSelected}
                    disabled={selectedTrackIds.length === 0 || isRequeueing}
                    className="gap-2"
                  >
                    <RefreshCw className={cn('h-4 w-4', isRequeueing && 'animate-spin')} />
                    Requeue Analysis
                  </Button>
                </div>
              </div>
              {actionMessage && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                  {actionMessage}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[920px] text-left text-sm">
                    <thead className="sticky top-0 bg-black/60 backdrop-blur">
                      <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-3 font-medium">
                          <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleSelectAllVisible}
                            className="h-4 w-4 accent-primary"
                            aria-label="Select all visible tracks"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Track</th>
                        <th className="px-4 py-3 font-medium">Owner</th>
                        <th className="px-4 py-3 font-medium">Source / Reason</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Tempo / Key</th>
                        <th className="px-4 py-3 font-medium">Confidence</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tracksResponse?.tracks ?? []).map((track) => (
                        <tr key={track.id} className="border-b border-white/5 align-top hover:bg-white/5">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedTrackIds.includes(track.id)}
                              onChange={() => toggleTrackSelection(track.id)}
                              className="mt-1 h-4 w-4 accent-primary"
                              aria-label={`Select ${track.original_filename}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{track.original_filename}</div>
                            <div className="mt-1 text-xs text-gray-500">{track.id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-200">{track.user_name ?? 'Unknown User'}</div>
                            <div className="mt-1 text-xs text-gray-500">{track.user_email ?? track.user_id}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div
                              className={cn(
                                'inline-flex rounded-full border px-2 py-1 text-xs font-medium',
                                track.analysis_quality === 'browser_hint'
                                  ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                  : 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                              )}
                            >
                              {track.analysis_quality ?? 'unknown'}
                              {track.analysis_quality === 'browser_hint' &&
                                track.browser_analysis_confidence != null &&
                                ` ${Math.round(track.browser_analysis_confidence * 100)}%`}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">{track.analysis_version ?? 'n/a'}</div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              reason: <span className="text-gray-400">{track.browser_hint_decision_reason ?? 'unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className={cn('inline-flex rounded-full border px-2 py-1 text-xs font-medium', statusPill(track.analysis_status))}>
                              {track.analysis_status}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-300">
                            <div>{track.bpm != null ? `${track.bpm} BPM` : 'BPM TBD'}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {track.camelot_key ?? track.musical_key ?? 'Key TBD'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-300">
                            <div>BPM {track.bpm_confidence != null ? `${Math.round(track.bpm_confidence * 100)}%` : '—'}</div>
                            <div className="mt-1">Key {track.key_confidence != null ? `${Math.round(track.key_confidence * 100)}%` : '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">
                            {new Date(track.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {(tracksResponse?.tracks ?? []).length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                            {isLoadingTracks ? 'Loading tracks…' : 'No tracks match the current filters.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-400">
                  Page {tracksResponse?.pagination.page ?? page} of {Math.max(1, tracksResponse?.pagination.totalPages ?? 1)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    disabled={page <= 1 || isLoadingTracks}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 bg-black/20"
                    disabled={!tracksResponse?.pagination.hasMore || isLoadingTracks}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Audio Feature Flags</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(featureFlags).map(([flag, enabled]) => (
                  <div key={flag} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm">
                    <span className="text-gray-300">{flag}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        enabled
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      )}
                    >
                      {enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                ))}
                {Object.keys(featureFlags).length === 0 && (
                  <p className="text-sm text-gray-400">Feature flags unavailable.</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Fallback Inspection (Exact Reasons)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-gray-300">Browser hint accepted</span>
                    <span className="font-semibold text-white">{fallbackSummary.browserAccepted}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-gray-300">Server-completed (fallback / no browser hint / feature off)</span>
                    <span className="font-semibold text-white">{fallbackSummary.serverCompleted}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-gray-300">Pending / analyzing</span>
                    <span className="font-semibold text-white">{fallbackSummary.pendingOrAnalyzing}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                    <span className="text-gray-300">Failed</span>
                    <span className="font-semibold text-white">{fallbackSummary.failed}</span>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Visible Decision Reasons</p>
                  <div className="space-y-2">
                    {Object.entries(fallbackSummary.reasonCounts).length === 0 && (
                      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs text-gray-400">
                        No visible tracks
                      </div>
                    )}
                    {Object.entries(fallbackSummary.reasonCounts).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <span className="text-gray-300">{key}</span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Analysis Quality</p>
                  <div className="space-y-2">
                    {Object.entries(tracksResponse?.debug.qualityCounts ?? {}).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <span className="text-gray-300">{key}</span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Analysis Status</p>
                  <div className="space-y-2">
                    {Object.entries(tracksResponse?.debug.statusCounts ?? {}).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <span className="text-gray-300">{key}</span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">Global Decision Reasons</p>
                  <div className="space-y-2">
                    {Object.entries(tracksResponse?.debug.decisionReasonCounts ?? {}).map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                        <span className="text-gray-300">{key}</span>
                        <span className="font-semibold text-white">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Admin Activity Trail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoadingAuditLogs && auditLogs.length === 0 && (
                  <p className="text-sm text-gray-400">Loading audit logs...</p>
                )}
                {!isLoadingAuditLogs && auditLogs.length === 0 && (
                  <p className="text-sm text-gray-400">No admin actions recorded yet.</p>
                )}
                {auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-white/5 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-white">{entry.action}</div>
                      <div className="text-[11px] text-gray-500">{new Date(entry.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {entry.admin_user_email ?? entry.admin_user_id ?? 'unknown admin'} • {entry.resource_type}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      resources: {entry.resource_ids.length}
                    </div>
                    {entry.metadata && (
                      <pre className="mt-2 max-h-28 overflow-auto rounded-md border border-white/5 bg-black/30 p-2 text-[11px] text-gray-400">
{JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Admin Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <a href="/api/observability/metrics" className="block rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-gray-300 hover:text-white">
                  `/api/observability/metrics`
                </a>
                <a href="/api/admin/audio/tracks?analysisQuality=browser_hint" className="block rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-gray-300 hover:text-white">
                  `/api/admin/audio/tracks?analysisQuality=browser_hint`
                </a>
                <a href="/api/admin/audit/logs?limit=25" className="block rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-gray-300 hover:text-white">
                  `/api/admin/audit/logs?limit=25`
                </a>
                <a href="/admin/audio-preview-qa" className="block rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-primary hover:text-white">
                  `/admin/audio-preview-qa` (local browser preview QA telemetry)
                </a>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
