// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils/helpers';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circle' | 'text';
}

export function Skeleton({ className, variant = 'default' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-white/10',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 rounded',
        variant === 'default' && 'rounded-lg',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-card/20 p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

export function TrackSkeleton() {
  return (
    <div className="p-4 bg-card/40 border border-white/5 rounded-xl space-y-3">
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
