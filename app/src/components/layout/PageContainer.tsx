// src/components/layout/PageContainer.tsx
import { cn } from '@/lib/utils/helpers';

interface PageContainerProps {
  children: React.ReactNode;
  size?: 'narrow' | 'default' | 'wide';
  className?: string;
}

export function PageContainer({ 
  children, 
  size = 'default',
  className 
}: PageContainerProps) {
  const sizes = {
    narrow: 'max-w-4xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  };

  return (
    <main className={cn(
      'pt-32 pb-16 px-4 sm:px-6 lg:px-8',
      sizes[size],
      'mx-auto',
      className
    )}>
      {children}
    </main>
  );
}
