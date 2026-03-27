'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface FeatureErrorBoundaryProps {
  children: React.ReactNode;
  feature: string;
  fallback?: React.ReactNode;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class FeatureErrorBoundary extends React.Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.feature}] Error:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="glass-card p-6 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto" />
          <h3 className="font-semibold text-white">
            {this.props.feature} Error
          </h3>
          <p className="text-gray-400 text-sm">
            {this.state.error?.message ?? 'Something went wrong'}
          </p>
          <Button
            size="sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AudioErrorBoundary({ children }: { children: React.ReactNode }) {
  return <FeatureErrorBoundary feature="Audio Player">{children}</FeatureErrorBoundary>;
}

export function MashupErrorBoundary({ children }: { children: React.ReactNode }) {
  return <FeatureErrorBoundary feature="Mashup">{children}</FeatureErrorBoundary>;
}

export function UploadErrorBoundary({ children }: { children: React.ReactNode }) {
  return <FeatureErrorBoundary feature="Upload">{children}</FeatureErrorBoundary>;
}

export function StemErrorBoundary({ children }: { children: React.ReactNode }) {
  return <FeatureErrorBoundary feature="Stem Player">{children}</FeatureErrorBoundary>;
}
