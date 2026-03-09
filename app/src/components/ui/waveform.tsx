// src/components/ui/waveform.tsx
'use client';

import { cn } from '@/lib/utils/helpers';

interface WaveformProps {
  data: number[];
  className?: string;
  barCount?: number;
  color?: string;
  height?: number;
}

export function Waveform({
  data,
  className,
  barCount = 50,
  color = 'primary',
  height = 40,
}: WaveformProps) {
  const normalized = normalizeData(data, barCount);
  const peak = Math.max(...normalized, 1);

  return (
    <div 
      className={cn('flex items-end gap-[2px]', className)}
      style={{ height }}
      role="img"
      aria-label="Audio waveform"
    >
      {normalized.map((value, index) => {
        const percentage = (value / peak) * 100;
        return (
          <div
            key={index}
            className={cn(
              'flex-1 rounded-sm transition-all duration-150',
              color === 'primary' && 'bg-gradient-to-t from-primary/30 via-primary/60 to-white/80',
              color === 'secondary' && 'bg-gradient-to-t from-gray-500/30 via-gray-500/60 to-white/80',
            )}
            style={{ 
              height: `${Math.max(4, percentage)}%`,
              minHeight: 4,
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
