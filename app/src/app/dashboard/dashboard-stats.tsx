'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalMashups: number;
  publicMashups: number;
  totalPlays: number;
  storageUsedBytes: number;
  quotaMinutesUsed: number;
  monthlyMinutes: number;
  planTier: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const statCards = [
  {
    key: 'totalMashups',
    label: 'Total Mashups',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    ),
    accent: 'from-orange-500/20 to-orange-600/5',
    accentText: 'text-orange-400',
    getValue: (s: DashboardStats) => formatNumber(s.totalMashups),
  },
  {
    key: 'publicMashups',
    label: 'Public',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    accent: 'from-emerald-500/20 to-emerald-600/5',
    accentText: 'text-emerald-400',
    getValue: (s: DashboardStats) => formatNumber(s.publicMashups),
  },
  {
    key: 'totalPlays',
    label: 'Total Plays',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
    ),
    accent: 'from-violet-500/20 to-violet-600/5',
    accentText: 'text-violet-400',
    getValue: (s: DashboardStats) => formatNumber(s.totalPlays),
  },
  {
    key: 'storage',
    label: 'Storage Used',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
      </svg>
    ),
    accent: 'from-cyan-500/20 to-cyan-600/5',
    accentText: 'text-cyan-400',
    getValue: (s: DashboardStats) => formatBytes(s.storageUsedBytes),
  },
  {
    key: 'quota',
    label: 'Quota Remaining',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    accent: 'from-rose-500/20 to-rose-600/5',
    accentText: 'text-rose-400',
    getValue: (s: DashboardStats) => `${s.monthlyMinutes - s.quotaMinutesUsed} min`,
    getSub: (s: DashboardStats) => `of ${s.monthlyMinutes} min (${s.planTier})`,
  },
];

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/users/me/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-card p-4 space-y-3 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
              <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {statCards.map((card, index) => (
        <div
          key={card.key}
          className="group relative glass-card p-4 rounded-xl overflow-hidden transition-all duration-300 hover:border-white/15 hover:shadow-lg hover:shadow-orange-500/5"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`${card.accentText} opacity-70 group-hover:opacity-100 transition-opacity`}>
                {card.icon}
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className={`text-2xl font-bold ${card.accentText} tracking-tight`}>
              {card.getValue(stats)}
            </p>
            {card.getSub && (
              <p className="text-xs text-gray-500 mt-1">
                {card.getSub(stats)}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
