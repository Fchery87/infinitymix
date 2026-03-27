'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'infinitymix:recent-searches';
const MAX_RECENT = 8;

export interface RecentSearch {
  query: string;
  timestamp: number;
  type: 'track' | 'mashup' | 'project' | 'all';
  resultId?: string;
  resultName?: string;
}

function loadFromStorage(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown): s is RecentSearch =>
        typeof s === 'object' &&
        s !== null &&
        'query' in s &&
        'timestamp' in s
    );
  } catch {
    return [];
  }
}

function saveToStorage(searches: RecentSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
  } catch {
    // storage full or disabled
  }
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setRecentSearches(loadFromStorage());
  }, []);

  const addRecentSearch = useCallback(
    (search: Omit<RecentSearch, 'timestamp'>) => {
      setRecentSearches((prev) => {
        const next: RecentSearch[] = [
          { ...search, timestamp: Date.now() },
          ...prev.filter(
            (s) =>
              !(s.query === search.query && s.resultId === search.resultId)
          ),
        ].slice(0, MAX_RECENT);
        saveToStorage(next);
        return next;
      });
    },
    []
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const removeRecentSearch = useCallback((query: string, resultId?: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter(
        (s) => !(s.query === query && s.resultId === resultId)
      );
      saveToStorage(next);
      return next;
    });
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    removeRecentSearch,
  };
}
