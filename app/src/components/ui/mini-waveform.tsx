'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils/helpers';

interface MiniWaveformProps {
  mashupId: string;
  isPlaying?: boolean;
  progress?: number;
  onSeek?: (percent: number) => void;
  className?: string;
  barCount?: number;
  height?: number;
}

export function MiniWaveform({
  mashupId,
  isPlaying = false,
  progress = 0,
  onSeek,
  className,
  barCount = 40,
  height = 28,
}: MiniWaveformProps) {
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/mashups/${mashupId}/waveform`, { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('No waveform');
        return res.json();
      })
      .then((payload: { waveform: number[] }) => {
        if (!cancelled) {
          setWaveformData(payload.waveform);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWaveformData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mashupId]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onSeek || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      onSeek(percent);
    },
    [onSeek]
  );

  if (loading) {
    return (
      <div
        className={cn('flex items-end gap-[1.5px]', className)}
        style={{ height }}
      >
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-white/10 animate-pulse"
            style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 20}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!waveformData || waveformData.length === 0) {
    return (
      <div
        className={cn('flex items-end gap-[1.5px] opacity-30', className)}
        style={{ height }}
      >
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-white/20"
            style={{ height: `${15 + Math.sin(i * 0.5) * 25}%` }}
          />
        ))}
      </div>
    );
  }

  const normalized = normalizeData(waveformData, barCount);
  const peak = Math.max(...normalized, 1);
  const progressIndex = Math.floor((progress / 100) * barCount);

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-end gap-[1.5px] cursor-pointer group',
        className
      )}
      style={{ height }}
      onClick={handleClick}
      role="slider"
      aria-label="Audio waveform"
      aria-valuenow={Math.round(progress)}
      tabIndex={0}
    >
      {normalized.map((value, index) => {
        const percentage = (value / peak) * 100;
        const isPlayed = index <= progressIndex;
        return (
          <div
            key={index}
            className={cn(
              'flex-1 rounded-[1px] transition-all duration-100',
              isPlayed
                ? 'bg-gradient-to-t from-primary/50 via-primary/80 to-orange-200/90'
                : 'bg-gradient-to-t from-white/10 via-white/20 to-white/30',
              isPlaying && !isPlayed && 'group-hover:bg-white/40'
            )}
            style={{
              height: `${Math.max(12, percentage)}%`,
              minHeight: 3,
            }}
          />
        );
      })}
    </div>
  );
}

function normalizeData(data: number[], targetLength: number): number[] {
  if (data.length === 0) return Array(targetLength).fill(0);
  if (data.length === targetLength) return data;

  const result: number[] = [];
  const step = data.length / targetLength;

  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = data.slice(start, end);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    result.push(avg);
  }

  return result;
}
