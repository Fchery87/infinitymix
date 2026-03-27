'use client';

import { useEffect, ReactNode } from 'react';
import { analytics } from '@/lib/analytics/client';

interface AnalyticsProviderProps {
    children: ReactNode;
}

/**
 * Analytics Provider component
 * Initializes analytics on mount and provides analytics context to the app.
 * 
 * Usage:
 * ```tsx
 * // In your layout.tsx or _app.tsx
 * <AnalyticsProvider>
 *   {children}
 * </AnalyticsProvider>
 * ```
 * 
 * Environment variables:
 * - NEXT_PUBLIC_ANALYTICS_PROVIDER: 'posthog' | 'custom' | 'disabled'
 * - NEXT_PUBLIC_POSTHOG_KEY: PostHog API key (if using PostHog)
 * - NEXT_PUBLIC_POSTHOG_HOST: PostHog host (defaults to https://app.posthog.com)
 * - NEXT_PUBLIC_ANALYTICS_ENDPOINT: Custom analytics endpoint (if using custom)
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
    useEffect(() => {
        // Initialize analytics on client side
        analytics.initialize().catch((error) => {
            console.warn('Analytics initialization failed:', error);
        });
    }, []);

    return <>{children}</>;
}

/**
 * Hook to track page views automatically
 * Use this in your page components to track page views
 */
export function usePageView(pageName: string, properties?: Record<string, unknown>) {
    useEffect(() => {
        analytics.page(pageName, properties).catch((error) => {
            console.warn('Failed to track page view:', error);
        });
    }, [pageName, properties]);
}

/**
 * Hook to identify user
 * Call this after user login/signup
 */
export function useIdentifyUser(userId: string | null, traits?: Record<string, unknown>) {
    useEffect(() => {
        if (userId) {
            analytics.identify(userId, traits).catch((error) => {
                console.warn('Failed to identify user:', error);
            });
        }
    }, [userId, traits]);
}
