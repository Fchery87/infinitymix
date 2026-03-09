// src/components/ui/progress.tsx
'use client';

import { cn } from '@/lib/utils/helpers';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
}

export function Progress({
  value,
  max = 100,
  className,
  size = 'md',
  variant = 'default',
  showValue = false,
}: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  const variantClasses = {
    default: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full bg-white/10 rounded-full overflow-hidden', sizeClasses[size])}>
        <div
          className={cn('h-full transition-all duration-300 ease-out rounded-full', variantClasses[variant])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showValue && (
        <p className="text-xs text-gray-500 mt-1 text-right">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}
