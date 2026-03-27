'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Music, Play, Download, Trash2, AlertCircle, FileAudio, Sparkles, Search, ListMusic } from 'lucide-react';
import { formatDuration, getStatusText } from '@/lib/utils/helpers';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioPlayer } from '@/components/audio-player';
import { SatisfactionSurvey } from '@/components/satisfaction-survey';
import { MiniWaveform } from '@/components/ui/mini-waveform';
import { ShareButtons } from '@/components/share-buttons';
import { BatchOperations, MashupCheckbox } from '@/components/batch-operations';
import { PlaylistModal } from '@/components/playlist-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Link from 'next/link';
import { Navigation } from '@/components/navigation';
import { useDebouncedCallback } from 'use-debounce';
import { trackEvents } from '@/lib/analytics/client';

type Mashup = {
  id: string;
  name: string;
  duration_seconds: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  output_format: string | null;
  playback_path?: string | null;
  playback_format?: string | null;
  generation_time_ms: number | null;
  playback_count: number;
  download_count: number;
  is_public?: boolean;
  public_slug?: string | null;
  parent_mashup_id?: string | null;
  created_at: string;
  latest_automation_job?: {
    id: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
    last_error?: string | null;
  } | null;
};

type MashupListResponse = {
  data: Mashup[];
  nextCursor: string | null;
  total: number;
};

const MASHUP_REFRESH_FALLBACK_MS = 4000;

type TrendingMashup = {
  id: string;
  name: string;
  publicSlug: string | null;
  playbackCount: number;
  downloadCount: number;
  outputStorageUrl: string | null;
  ownerName: string | null;
  ownerImage: string | null;
};

export default function MashupsPage() {
  const [mashups, setMashups] = useState<Mashup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [playingMashupId, setPlayingMashupId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [surveyMashupId, setSurveyMashupId] = useState<string | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [submittedFeedback, setSubmittedFeedback] = useState<Record<string, boolean>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [trending, setTrending] = useState<TrendingMashup[]>([]);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'in-progress'>('all');
  const [hasMore, setHasMore] = useState(true);

  // Batch operations state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchUpdatingVisibility, setBatchUpdatingVisibility] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  // Playlist state
  const [playlistModalMashupId, setPlaylistModalMashupId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});

  const applyMashupListPayload = useCallback((payload: MashupListResponse, append = false) => {
    if (append) {
      setMashups(prev => [...prev, ...(payload.data || [])]);
    } else {
      setMashups(payload.data || []);
    }
    setNextCursor(payload.nextCursor);
    setHasMore(!!payload.nextCursor);
  }, []);

  const fetchMashups = useCallback(async (options?: { append?: boolean; skipLoader?: boolean }) => {
    const { append = false, skipLoader = false } = options ?? {};
    try {
      if (!skipLoader && !append) {
        setLoading(true);
      } else if (append) {
        setLoadingMore(true);
      }
      setErrorMessage(null);

      const params = new URLSearchParams();
      params.set('limit', '25');
      if (append && nextCursor) params.set('cursor', nextCursor);
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/mashups?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load mashups');
      }

      applyMashupListPayload({
        data: (payload.data || []) as Mashup[],
        nextCursor: payload.nextCursor,
        total: payload.total ?? 0,
      }, append);
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load mashups');
    } finally {
      if (!skipLoader && !append) {
        setLoading(false);
      } else if (append) {
        setLoadingMore(false);
      }
    }
  }, [applyMashupListPayload, searchQuery, statusFilter, nextCursor]);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch('/api/mashups/trending', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json().catch(() => ({}));
      const items = (payload.mashups || []) as TrendingMashup[];
      setTrending(items.slice(0, 6));
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    void fetchMashups();
    void fetchTrending();
  }, [fetchMashups, fetchTrending]);

  const debouncedSearch = useDebouncedCallback(() => {
    setNextCursor(null);
    void fetchMashups();
  }, 500);

  useEffect(() => {
    debouncedSearch();
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    let stream: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let fallbackStarted = false;
    let receivedStreamUpdate = false;
    let cancelled = false;

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const closeStream = () => {
      if (stream) {
        stream.close();
        stream = null;
      }
    };

    const startPollingFallback = () => {
      if (fallbackStarted || cancelled) return;
      fallbackStarted = true;
      void fetchMashups({ skipLoader: true });
      pollInterval = setInterval(() => {
        void fetchMashups({ skipLoader: true });
      }, MASHUP_REFRESH_FALLBACK_MS);
    };

    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      startPollingFallback();
    } else {
      stream = new EventSource('/api/mashups/events');
      stream.addEventListener('mashups', (event) => {
        if (cancelled) return;
        try {
          receivedStreamUpdate = true;
          applyMashupListPayload(
            JSON.parse((event as MessageEvent<string>).data) as MashupListResponse
          );
          setLoading(false);
          setErrorMessage(null);
        } catch (error) {
          console.error(error);
        }
      });
      stream.addEventListener('error', () => {
        closeStream();
        startPollingFallback();
      });

      window.setTimeout(() => {
        if (!cancelled && !fallbackStarted && !receivedStreamUpdate) {
          startPollingFallback();
        }
      }, MASHUP_REFRESH_FALLBACK_MS);
    }

    return () => {
      cancelled = true;
      stopPolling();
      closeStream();
    };
  }, [applyMashupListPayload, fetchMashups]);

  useEffect(() => {
    if (surveyMashupId) return;
    const nextCandidate = mashups.find((m) => m.status === 'completed' && !submittedFeedback[m.id]);
    if (nextCandidate) {
      setSurveyMashupId(nextCandidate.id);
    }
  }, [mashups, surveyMashupId, submittedFeedback]);

  const stats = useMemo(() => {
    const completed = mashups.filter((m) => m.status === 'completed');
    const inProgress = mashups.filter((m) => m.status !== 'completed' && m.status !== 'failed');
    const totalDuration = completed.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
    const plays = mashups.reduce((acc, m) => acc + (m.playback_count || 0), 0);
    const downloads = mashups.reduce((acc, m) => acc + (m.download_count || 0), 0);
    return { completed: completed.length, inProgress: inProgress.length, totalDuration, plays, downloads };
  }, [mashups]);

  const currentMashup = useMemo(
    () => mashups.find((m) => m.id === playingMashupId) || null,
    [mashups, playingMashupId]
  );

  const audioSource = useMemo(() => {
    if (!currentMashup || !currentMashup.output_path) return null;
    return `/api/mashups/${currentMashup.id}/download?stream=true`;
  }, [currentMashup]);

  const completedMashups = useMemo(
    () => mashups.filter((m) => m.status === 'completed'),
    [mashups]
  );

  // --- Batch operations ---
  const handleSelectAll = () => {
    setSelectedIds(new Set(completedMashups.map((m) => m.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = () => {
    const count = selectedIds.size;
    setConfirmDialog({
      open: true,
      title: `Delete ${count} mashup${count > 1 ? 's' : ''}?`,
      description: 'This action cannot be undone. All selected mashups and their files will be permanently deleted.',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        setBatchDeleting(true);
        try {
          const res = await fetch('/api/mashups/batch', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) }),
          });
          if (!res.ok) throw new Error('Batch delete failed');
          setMashups((prev) => prev.filter((m) => !selectedIds.has(m.id)));
          setSelectedIds(new Set());
        } catch (error) {
          console.error(error);
          alert('Failed to delete selected mashups');
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  };

  const handleBatchDownload = async () => {
    setBatchDownloading(true);
    try {
      for (const id of selectedIds) {
        const mashup = mashups.find((m) => m.id === id);
        if (!mashup || mashup.status !== 'completed') continue;
        const response = await fetch(`/api/mashups/${id}/download?variant=playback`);
        if (!response.ok) continue;
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${mashup.name}.${mashup.playback_format || 'mp3'}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setBatchDownloading(false);
    }
  };

  const handleBatchVisibility = async (isPublic: boolean) => {
    setBatchUpdatingVisibility(true);
    try {
      const res = await fetch('/api/mashups/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), isPublic }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error('Batch visibility update failed');
      setMashups((prev) =>
        prev.map((m) => {
          const update = payload.updated?.find((u: { id: string; is_public: boolean; public_slug: string | null }) => u.id === m.id);
          if (update) return { ...m, is_public: update.is_public, public_slug: update.public_slug };
          return m;
        })
      );
    } catch (error) {
      console.error(error);
      alert('Failed to update visibility');
    } finally {
      setBatchUpdatingVisibility(false);
    }
  };

  // --- Single mashup actions ---
  const handlePlay = async (mashupId: string) => {
    const mashup = mashups.find((m) => m.id === mashupId);
    if (!mashup || mashup.status !== 'completed' || !mashup.output_path) {
      alert('Mashup is not ready for playback yet.');
      return;
    }

    if (playingMashupId === mashupId) {
      setIsPlaying((prev) => !prev);
    } else {
      setPlayingMashupId(mashupId);
      setIsPlaying(true);
      setAudioProgress((prev) => ({ ...prev, [mashupId]: 0 }));
    }

    try {
      await fetch(`/api/mashups/${mashupId}/play`, { method: 'POST' });
      void fetchMashups({ skipLoader: true });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownload = async (
    mashupId: string,
    variant: 'master' | 'playback'
  ) => {
    const mashup = mashups.find((m) => m.id === mashupId);
    if (!mashup || mashup.status !== 'completed' || !mashup.output_path) {
      alert('Mashup is not ready for download yet.');
      return;
    }

    try {
      const downloadKey = `${mashupId}:${variant}`;
      setDownloadingId(downloadKey);
      const response = await fetch(
        `/api/mashups/${mashupId}/download?variant=${variant}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to download mashup');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension =
        variant === 'master'
          ? mashup.output_format || 'wav'
          : mashup.playback_format || 'mp3';
      link.download = `${mashup.name}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      void fetchMashups({ skipLoader: true });
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to download mashup');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleTogglePublic = async (mashupId: string, nextValue: boolean) => {
    try {
      setTogglingId(mashupId);
      const res = await fetch(`/api/mashups/visibility/${mashupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextValue }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to update visibility');
      setMashups((prev) => prev.map((m) => m.id === mashupId ? {
        ...m,
        is_public: payload.is_public,
        public_slug: payload.public_slug,
      } : m));
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to update visibility');
    } finally {
      setTogglingId(null);
    }
  };

  const handleFork = async (mashupId: string) => {
    try {
      setForkingId(mashupId);
      const res = await fetch(`/api/mashups/${mashupId}/fork`, { method: 'POST' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to fork mashup');
      await fetchMashups({ skipLoader: true });
      alert('Remix created! Check your mashup list.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to fork mashup');
    } finally {
      setForkingId(null);
    }
  };

  const handleRetry = async (mashupId: string) => {
    try {
      setRetryingId(mashupId);
      const res = await fetch(`/api/mashups/${mashupId}/retry`, { method: 'POST' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed to retry mashup');

      // Track retry event
      trackEvents.mashupRetried('user', mashupId).catch(() => { });

      await fetchMashups({ skipLoader: true });
      alert('Mashup retry initiated! It will be processed shortly.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to retry mashup');
    } finally {
      setRetryingId(null);
    }
  };

  const handleCopyLink = async (label: string, url?: string | null) => {
    if (!url) {
      alert('No shareable link available yet. Make sure the mashup is public.');
      return;
    }
    try {
      setCopyingId(label);
      await navigator.clipboard.writeText(url);
      alert('Link copied to clipboard');
    } catch (error) {
      console.error(error);
      alert('Failed to copy link');
    } finally {
      setCopyingId(null);
    }
  };

  const handleDelete = async (mashupId: string) => {
    if (!confirm('Are you sure you want to delete this mashup?')) return;
    try {
      setDeletingId(mashupId);
      const response = await fetch(`/api/mashups/${mashupId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to delete mashup');
      }
      setMashups((prev) => prev.filter((m) => m.id !== mashupId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(mashupId);
        return next;
      });
      if (playingMashupId === mashupId) {
        setPlayingMashupId(null);
        setIsPlaying(false);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to delete mashup');
    } finally {
      setDeletingId(null);
    }
  };

  const handleFeedbackSubmit = async (rating: number, feedback: string) => {
    if (!surveyMashupId || feedbackSubmitting) return;
    try {
      setFeedbackSubmitting(true);
      const response = await fetch(`/api/mashups/${surveyMashupId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comments: feedback }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to submit feedback');
      }
      setSubmittedFeedback((prev) => ({ ...prev, [surveyMashupId]: true }));
      setSurveyMashupId(null);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen font-sans text-foreground relative pb-32">
      <Navigation />

      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Your Sonic Library</h1>
          <p className="text-gray-400">
            All your AI-generated masterpieces in one place.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Completed</span>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.completed}</div>
              <p className="text-xs text-gray-500 mt-1">Ready for playback & download</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">In Progress</span>
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              </div>
              <div className="text-3xl font-bold text-white">{stats.inProgress}</div>
              <p className="text-xs text-gray-500 mt-1">Queued, pending, or generating</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-white/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-sm">Engagement</span>
                <Music className="w-4 h-4 text-primary" />
              </div>
              <div className="text-lg font-semibold text-white">{stats.plays} plays &middot; {stats.downloads} downloads</div>
              <p className="text-xs text-gray-500 mt-1">Avg length {stats.completed ? formatDuration(Math.max(1, Math.floor(stats.totalDuration / stats.completed))) : '\u2014'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Trending */}
        {trending.length > 0 && (
          <Card className="bg-card/50 border-white/5 mb-8">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Trending (public)</p>
                  <p className="text-lg text-white font-semibold">Hot right now</p>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                {trending.map((item) => (
                  <div key={item.id} className="rounded-lg border border-white/5 bg-black/30 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <p className="text-white font-medium truncate" title={item.name}>{item.name}</p>
                      <span className="text-[11px] text-gray-500">{item.playbackCount}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">by {item.ownerName || 'Anonymous'}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{item.playbackCount} plays</span>
                      <span className="w-1 h-1 rounded-full bg-gray-700" />
                      <span>{item.downloadCount} saves</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyLink(item.id, item.outputStorageUrl)}
                      disabled={copyingId === item.id}
                      className="justify-start text-primary hover:text-primary"
                    >
                      {copyingId === item.id ? 'Copying...' : 'Copy link'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {errorMessage && (
          <Card className="bg-destructive/10 border-red-500/30 mb-6">
            <CardContent className="p-4 text-red-200 text-sm">{errorMessage}</CardContent>
          </Card>
        )}

        {/* Search + Filters + Batch */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Search mashups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-card/50 border-white/10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className="border-white/10"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('completed')}
                className="border-white/10"
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === 'in-progress' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('in-progress')}
                className="border-white/10"
              >
                In Progress
              </Button>
            </div>
          </div>

          {/* Batch Operations Bar */}
          {completedMashups.length > 0 && (
            <BatchOperations
              selectedIds={Array.from(selectedIds)}
              totalCount={completedMashups.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onToggleSelect={handleToggleSelect}
              onBatchDelete={handleBatchDelete}
              onBatchDownload={handleBatchDownload}
              onBatchMakePublic={() => handleBatchVisibility(true)}
              onBatchMakePrivate={() => handleBatchVisibility(false)}
              isDeleting={batchDeleting}
              isDownloading={batchDownloading}
              isUpdatingVisibility={batchUpdatingVisibility}
            />
          )}
        </div>

        {/* Mashup List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-card/20 rounded-xl animate-pulse border border-white/5" />
            ))}
          </div>
        ) : mashups.length === 0 ? (
          <Card className="bg-card/40 border-dashed border-white/10">
            <CardContent className="text-center py-16">
              <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center mx-auto mb-6">
                <Music className="w-10 h-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">No mashups yet</h3>
              <p className="text-gray-500 mb-8">
                Create your first mashup to see it here
              </p>
              <Link href="/create">
                <Button variant="glow" size="lg">Create Your First Mashup</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <AnimatePresence>
              {mashups.map((mashup, index) => (
                <motion.div
                  key={mashup.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className={`bg-card/40 border-white/5 hover:border-primary/20 hover:bg-card/60 transition-all duration-300 backdrop-blur-md group ${selectedIds.has(mashup.id) ? 'border-primary/40 bg-primary/5' : ''
                    }`}>
                    <CardContent className="p-6">
                      {/* Top Row: Checkbox + Info + Actions */}
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        {mashup.status === 'completed' && (
                          <div className="pt-1">
                            <MashupCheckbox
                              checked={selectedIds.has(mashup.id)}
                              onChange={() => handleToggleSelect(mashup.id)}
                            />
                          </div>
                        )}

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                              <div className={`w-11 h-11 rounded-lg flex items-center justify-center bg-black/40 border border-white/5 flex-shrink-0 ${mashup.status === 'completed' ? 'text-primary' : 'text-gray-500'
                                }`}>
                                <FileAudio className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <h3 className="font-bold text-base text-white group-hover:text-primary transition-colors truncate">{mashup.name}</h3>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-gray-400 border border-white/5 whitespace-nowrap">
                                    {formatDuration(mashup.duration_seconds)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-white/5 text-gray-400 border border-white/5 whitespace-nowrap">
                                    {getStatusText(mashup.status)}
                                  </span>
                                  {mashup.latest_automation_job?.status === 'queued' && mashup.status !== 'completed' && mashup.status !== 'failed' && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-200 border border-amber-500/20">
                                      Queued
                                    </span>
                                  )}
                                  {mashup.is_public && (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                                      Public
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                  <span>{new Date(mashup.created_at).toLocaleString()}</span>
                                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                                  <span>{mashup.playback_count} Plays</span>
                                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                                  <span>{mashup.download_count} Downloads</span>
                                  {mashup.generation_time_ms && (
                                    <>
                                      <span className="w-1 h-1 rounded-full bg-gray-700" />
                                      <span>{(mashup.generation_time_ms / 1000).toFixed(1)}s render</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status / Actions */}
                            <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                              {mashup.status === 'completed' ? (
                                <>
                                  <Button
                                    variant={playingMashupId === mashup.id ? "default" : "outline"}
                                    size="sm"
                                    className={`border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 ${playingMashupId === mashup.id ? "bg-primary text-primary-foreground border-primary" : ""
                                      }`}
                                    onClick={() => handlePlay(mashup.id)}
                                  >
                                    {playingMashupId === mashup.id && isPlaying ? (
                                      <div className="flex items-center">
                                        <div className="flex space-x-0.5 mr-2 h-3 items-end">
                                          <motion.div animate={{ height: [4, 12, 6] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-current rounded-full" />
                                          <motion.div animate={{ height: [8, 4, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-current rounded-full" />
                                          <motion.div animate={{ height: [6, 10, 4] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-0.5 bg-current rounded-full" />
                                        </div>
                                        Playing
                                      </div>
                                    ) : (
                                      <>
                                        <Play className="w-4 h-4 mr-2" />
                                        Play
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPlaylistModalMashupId(mashup.id)}
                                    className="text-gray-300 hover:text-primary"
                                  >
                                    <ListMusic className="w-4 h-4 mr-1.5" />
                                    Playlist
                                  </Button>
                                  <ShareButtons
                                    mashupId={mashup.id}
                                    mashupName={mashup.name}
                                    isPublic={!!mashup.is_public}
                                    publicSlug={mashup.public_slug}
                                  />
                                </>
                              ) : mashup.status === 'failed' ? (
                                <div className="flex items-center gap-2 px-4">
                                  <div className="flex items-center text-red-500">
                                    <AlertCircle className="w-4 h-4 mr-2" />
                                    Failed
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetry(mashup.id)}
                                    disabled={retryingId === mashup.id}
                                    className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 h-8 text-xs"
                                  >
                                    {retryingId === mashup.id ? (
                                      <div className="flex items-center">
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                                        Retrying...
                                      </div>
                                    ) : (
                                      <>
                                        <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                        Retry
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center text-primary px-4">
                                  <div className="w-4 h-4 border-2 border-t-primary border-primary/30 rounded-full animate-spin mr-2" />
                                  {mashup.latest_automation_job?.status === 'queued'
                                    ? 'Queued'
                                    : getStatusText(mashup.status)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Mini Waveform - inline for completed mashups */}
                          {mashup.status === 'completed' && (
                            <div className="mt-2">
                              <MiniWaveform
                                mashupId={mashup.id}
                                isPlaying={playingMashupId === mashup.id && isPlaying}
                                progress={playingMashupId === mashup.id ? (audioProgress[mashup.id] || 0) : 0}
                                onSeek={(percent) => {
                                  if (playingMashupId === mashup.id) {
                                    const audio = document.querySelector('audio');
                                    if (audio && audio.duration) {
                                      audio.currentTime = percent * audio.duration;
                                    }
                                  } else {
                                    handlePlay(mashup.id);
                                  }
                                }}
                                height={28}
                                barCount={50}
                              />
                            </div>
                          )}

                          {/* Bottom Row: Secondary Actions */}
                          {mashup.status === 'completed' && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(mashup.id, 'master')}
                                disabled={downloadingId === `${mashup.id}:master`}
                                className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 h-8 text-xs"
                              >
                                {downloadingId === `${mashup.id}:master` ? (
                                  <div className="flex items-center">
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                                    Preparing
                                  </div>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    WAV
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownload(mashup.id, 'playback')}
                                disabled={downloadingId === `${mashup.id}:playback`}
                                className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 h-8 text-xs"
                              >
                                {downloadingId === `${mashup.id}:playback` ? (
                                  <div className="flex items-center">
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5" />
                                    Preparing
                                  </div>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    MP3
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTogglePublic(mashup.id, !mashup.is_public)}
                                disabled={togglingId === mashup.id}
                                className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30 h-8 text-xs"
                              >
                                {togglingId === mashup.id ? 'Saving...' : mashup.is_public ? 'Make Private' : 'Make Public'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFork(mashup.id)}
                                disabled={forkingId === mashup.id}
                                className="text-gray-300 hover:text-primary h-8 text-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                {forkingId === mashup.id ? 'Remixing...' : 'Remix'}
                              </Button>
                              {!submittedFeedback[mashup.id] && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSurveyMashupId(mashup.id)}
                                  className="text-gray-300 hover:text-primary h-8 text-xs"
                                >
                                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                  Rate
                                </Button>
                              )}
                              {mashup.is_public && mashup.public_slug && (
                                <button
                                  className="text-primary/80 hover:text-primary underline decoration-dotted text-xs ml-1"
                                  onClick={() => handleCopyLink(mashup.id, `${window.location.origin}/api/mashups/public?slug=${mashup.public_slug}`)}
                                >
                                  Copy link
                                </button>
                              )}
                              <div className="flex-1" />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(mashup.id)}
                                disabled={deletingId === mashup.id}
                                className="text-gray-600 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                                aria-label={`Delete mashup ${mashup.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Load More */}
        {hasMore && !loading && mashups.length > 0 && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              size="lg"
              onClick={() => fetchMashups({ append: true })}
              disabled={loadingMore}
              className="border-white/10 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
            >
              {loadingMore ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </Button>
          </div>
        )}

        {/* Feedback Survey */}
        {surveyMashupId && (
          <div className="mt-10">
            <SatisfactionSurvey onSubmit={handleFeedbackSubmit} className="max-w-3xl mx-auto" />
            {feedbackSubmitting && <p className="text-center text-sm text-gray-400 mt-2">Submitting feedback...</p>}
          </div>
        )}

        {/* Audio Player */}
        <AnimatePresence>
          {currentMashup && (
            <AudioPlayer
              trackName={currentMashup.name}
              duration={currentMashup.duration_seconds}
              isPlaying={isPlaying}
              src={audioSource}
              onClose={() => {
                setPlayingMashupId(null);
                setIsPlaying(false);
              }}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onEnded={() => setIsPlaying(false)}
            />
          )}
        </AnimatePresence>

        {/* Playlist Modal */}
        <AnimatePresence>
          {playlistModalMashupId && (
            <PlaylistModal
              isOpen={!!playlistModalMashupId}
              onClose={() => setPlaylistModalMashupId(null)}
              mashupId={playlistModalMashupId}
              onAdded={() => { }}
            />
          )}
        </AnimatePresence>

        {/* Confirm Dialog */}
        <ConfirmDialog
          isOpen={confirmDialog.open}
          onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Delete"
          variant="destructive"
        />
      </main>
    </div>
  );
}
