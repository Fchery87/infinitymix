'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface InProgressMashup {
  id: string;
  name: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  createdAt: string;
}

export function ContinueSection() {
  const [mashup, setMashup] = useState<InProgressMashup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInProgress() {
      try {
        const res = await fetch('/api/mashups?status=in-progress&limit=1');
        if (res.ok) {
          const data = await res.json();
          if (data.data?.length > 0) {
            setMashup(data.data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch in-progress mashup:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInProgress();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/5 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="h-10 w-28 bg-white/5 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!mashup) return null;

  const statusLabel = mashup.status === 'generating' ? 'Generating...' : 'Pending';
  const timeAgo = getTimeAgo(new Date(mashup.createdAt));

  return (
    <div className="group relative glass-card p-6 rounded-xl overflow-hidden transition-all duration-300 hover:border-orange-500/30">
      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">
              Continue where you left off
            </p>
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 truncate">
            &ldquo;{mashup.name}&rdquo; &middot; Started {timeAgo}
          </p>
        </div>

        <Link
          href={`/mashups/${mashup.id}`}
          className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white text-sm font-semibold shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:shadow-[0_0_25px_rgba(249,115,22,0.5)] transition-all duration-300 hover:bg-orange-400 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          Continue
        </Link>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
