'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search,
  Music,
  Layers,
  FolderOpen,
  Clock,
  X,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebouncedCallback } from 'use-debounce';
import { cn } from '@/lib/utils/helpers';
import { useRecentSearches, type RecentSearch } from '@/hooks/use-recent-searches';

interface SearchResult {
  id: string;
  name: string;
  type: 'track' | 'mashup' | 'project';
  bpm?: string | null;
  key?: string | null;
  duration?: string | null;
  status?: string;
  createdAt: string;
}

interface SearchResponse {
  tracks: SearchResult[];
  mashups: SearchResult[];
  projects: SearchResult[];
}

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Music; label: string; color: string; path: (id: string) => string }
> = {
  track: {
    icon: Music,
    label: 'Track',
    color: 'text-blue-400',
    path: () => '/dashboard',
  },
  mashup: {
    icon: Layers,
    label: 'Mashup',
    color: 'text-orange-400',
    path: () => '/mashups',
  },
  project: {
    icon: FolderOpen,
    label: 'Project',
    color: 'text-emerald-400',
    path: (id) => `/projects/${id}`,
  },
};

function formatBpm(bpm: string | null | undefined): string | null {
  if (!bpm) return null;
  const num = parseFloat(bpm);
  return isNaN(num) ? null : `${Math.round(num)} BPM`;
}

function formatDurationStr(seconds: string | null | undefined): string | null {
  if (!seconds) return null;
  const num = parseFloat(seconds);
  if (isNaN(num)) return null;
  const m = Math.floor(num / 60);
  const s = Math.floor(num % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useRecentSearches();

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setError(null);
      // Small delay for animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Fetch search results
  const fetchResults = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: searchQuery, type: 'all' });
      const res = await fetch(`/api/search?${params}`);

      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }

      const data: SearchResponse = await res.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, 250);

  useEffect(() => {
    fetchResults(query);
  }, [query, fetchResults]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      const config = TYPE_CONFIG[result.type];
      addRecentSearch({
        query: result.name,
        type: result.type,
        resultId: result.id,
        resultName: result.name,
      });
      setOpen(false);
      router.push(config.path(result.id));
    },
    [router, addRecentSearch]
  );

  const navigateToRecent = useCallback(
    (search: RecentSearch) => {
      setOpen(false);
      if (search.resultId && search.type !== 'all') {
        const config = TYPE_CONFIG[search.type];
        router.push(config.path(search.resultId));
      } else {
        setQuery(search.query);
      }
    },
    [router]
  );

  const hasResults =
    results &&
    (results.tracks.length > 0 ||
      results.mashups.length > 0 ||
      results.projects.length > 0);

  const totalResults = results
    ? results.tracks.length + results.mashups.length + results.projects.length
    : 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-x-0 top-[15vh] z-[9999] mx-auto w-full max-w-2xl px-4"
          >
            <Command
              className={cn(
                'overflow-hidden rounded-2xl border border-white/10',
                'bg-[#111114]/95 backdrop-blur-2xl',
                'shadow-[0_0_80px_-12px_rgba(249,115,22,0.25),0_25px_60px_-15px_rgba(0,0,0,0.8)]'
              )}
              shouldFilter={false}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                <Search className="h-5 w-5 text-white/30 shrink-0" />
                <Command.Input
                  ref={inputRef}
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search tracks, mashups, projects..."
                  className="flex-1 bg-transparent text-base text-white placeholder:text-white/30 outline-none caret-orange-500"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="rounded-md p-1 text-white/30 hover:bg-white/5 hover:text-white/60 transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/30">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[50vh] overflow-y-auto overscroll-contain scroll-py-2 p-2">
                {/* Loading */}
                {loading && query.trim() && (
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/40">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                )}

                {/* Error */}
                {error && !loading && (
                  <div className="py-10 text-center text-sm text-red-400/80">
                    {error}
                  </div>
                )}

                {/* No results */}
                {!loading &&
                  !error &&
                  query.trim() &&
                  results &&
                  !hasResults && (
                    <div className="flex flex-col items-center gap-2 py-10">
                      <Sparkles className="h-6 w-6 text-white/15" />
                      <p className="text-sm text-white/40">
                        No results for &ldquo;{query}&rdquo;
                      </p>
                    </div>
                  )}

                {/* Recent searches (when empty) */}
                {!query.trim() && recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">
                        Recent
                      </span>
                      <button
                        onClick={clearRecentSearches}
                        className="text-[11px] text-white/20 hover:text-white/40 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                    {recentSearches.map((search, i) => {
                      const config =
                        search.type !== 'all'
                          ? TYPE_CONFIG[search.type]
                          : null;
                      const Icon = config?.icon ?? Clock;
                      return (
                        <Command.Item
                          key={`${search.query}-${search.resultId}-${i}`}
                          onSelect={() => navigateToRecent(search)}
                          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 cursor-pointer transition-colors data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white hover:bg-white/[0.04]"
                        >
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              config?.color ?? 'text-white/25'
                            )}
                          />
                          <span className="flex-1 truncate">
                            {search.resultName || search.query}
                          </span>
                          {search.resultName && search.query !== search.resultName && (
                            <span className="text-xs text-white/20 truncate max-w-[120px]">
                              {search.query}
                            </span>
                          )}
                          <ArrowRight className="h-3 w-3 shrink-0 text-white/15" />
                        </Command.Item>
                      );
                    })}
                  </div>
                )}

                {/* Search prompt (when no recent) */}
                {!query.trim() && recentSearches.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-12">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-orange-500/10 blur-xl" />
                      <Search className="relative h-8 w-8 text-white/15" />
                    </div>
                    <p className="text-sm text-white/30">
                      Search your music library
                    </p>
                    <p className="text-xs text-white/15">
                      Find tracks, mashups, and projects
                    </p>
                  </div>
                )}

                {/* Tracks */}
                {results && results.tracks.length > 0 && (
                  <ResultGroup
                    title="Tracks"
                    items={results.tracks}
                    onSelect={navigateToResult}
                  />
                )}

                {/* Mashups */}
                {results && results.mashups.length > 0 && (
                  <ResultGroup
                    title="Mashups"
                    items={results.mashups}
                    onSelect={navigateToResult}
                  />
                )}

                {/* Projects */}
                {results && results.projects.length > 0 && (
                  <ResultGroup
                    title="Projects"
                    items={results.projects}
                    onSelect={navigateToResult}
                  />
                )}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/25">
                      ↑↓
                    </kbd>
                    <span className="text-[10px] text-white/20">navigate</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/25">
                      ↵
                    </kbd>
                    <span className="text-[10px] text-white/20">open</span>
                  </div>
                </div>
                {hasResults && (
                  <span className="text-[10px] text-white/20">
                    {totalResults} result{totalResults !== 1 ? 's' : ''}
                  </span>
                )}
                {!hasResults && query.trim() && !loading && (
                  <span className="text-[10px] text-white/20">
                    powered by InfinityMix
                  </span>
                )}
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ResultGroup({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: SearchResult[];
  onSelect: (item: SearchResult) => void;
}) {
  return (
    <Command.Group
      heading={
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/25">
          {title}
        </span>
      }
      className="px-1"
    >
      {items.map((item) => {
        const config = TYPE_CONFIG[item.type];
        const Icon = config.icon;
        const meta = [formatBpm(item.bpm), item.key, formatDurationStr(item.duration)]
          .filter(Boolean)
          .join(' · ');

        return (
          <Command.Item
            key={item.id}
            value={`${item.type}-${item.id}-${item.name}`}
            onSelect={() => onSelect(item)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white hover:bg-white/[0.04] group"
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]',
                'transition-colors group-hover:bg-white/[0.08] group-hover:border-white/[0.1]'
              )}
            >
              <Icon className={cn('h-4 w-4', config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/90 truncate">{item.name}</p>
              {meta && (
                <p className="text-xs text-white/30 truncate">{meta}</p>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Command.Item>
        );
      })}
    </Command.Group>
  );
}
