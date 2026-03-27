'use client';

/**
 * Analytics client for tracking user events.
 * Supports PostHog or custom analytics endpoints.
 * 
 * Configuration:
 * - Set NEXT_PUBLIC_ANALYTICS_PROVIDER to 'posthog' or 'custom'
 * - For PostHog: Set NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST
 * - For custom: Set NEXT_PUBLIC_ANALYTICS_ENDPOINT
 */

type AnalyticsProvider = 'posthog' | 'custom' | 'disabled';

interface AnalyticsConfig {
    provider: AnalyticsProvider;
    posthogKey?: string;
    posthogHost?: string;
    customEndpoint?: string;
}

interface AnalyticsEvent {
    name: string;
    properties?: Record<string, unknown>;
    timestamp?: number;
}

class AnalyticsClient {
    private config: AnalyticsConfig;
    private initialized = false;
    private queue: AnalyticsEvent[] = [];
    private posthog: any = null;

    constructor() {
        this.config = {
            provider: (process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER as AnalyticsProvider) || 'disabled',
            posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
            posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
            customEndpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
        };
    }

    async initialize(): Promise<void> {
        if (this.initialized) return;

        if (this.config.provider === 'posthog' && this.config.posthogKey) {
            try {
                // Dynamically import PostHog to avoid bundling if not used
                const posthogModule = await import('posthog-js');
                this.posthog = posthogModule.default;
                this.posthog.init(this.config.posthogKey, {
                    api_host: this.config.posthogHost,
                    capture_pageview: false, // We'll handle pageviews manually
                    capture_pageleave: true,
                    autocapture: false,
                });
                this.initialized = true;
                this.flushQueue();
            } catch (error) {
                console.warn('Failed to initialize PostHog:', error);
                this.config.provider = 'disabled';
            }
        } else if (this.config.provider === 'custom' && this.config.customEndpoint) {
            this.initialized = true;
            this.flushQueue();
        } else {
            this.config.provider = 'disabled';
            this.initialized = true;
        }
    }

    private async flushQueue(): Promise<void> {
        if (this.queue.length === 0) return;

        const events = [...this.queue];
        this.queue = [];

        for (const event of events) {
            await this.trackEvent(event);
        }
    }

    private async trackEvent(event: AnalyticsEvent): Promise<void> {
        if (!this.initialized) {
            this.queue.push(event);
            return;
        }

        if (this.config.provider === 'posthog' && this.posthog) {
            this.posthog.capture(event.name, event.properties);
        } else if (this.config.provider === 'custom' && this.config.customEndpoint) {
            try {
                await fetch(this.config.customEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: event.name,
                        properties: event.properties,
                        timestamp: event.timestamp || Date.now(),
                    }),
                    keepalive: true,
                });
            } catch (error) {
                console.warn('Failed to send analytics event:', error);
            }
        }
    }

    /**
     * Track a custom event
     */
    async track(name: string, properties?: Record<string, unknown>): Promise<void> {
        await this.trackEvent({
            name,
            properties,
            timestamp: Date.now(),
        });
    }

    /**
     * Track page view
     */
    async page(pageName: string, properties?: Record<string, unknown>): Promise<void> {
        await this.track('pageview', {
            page: pageName,
            ...properties,
        });
    }

    /**
     * Identify user (for PostHog)
     */
    async identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
        if (this.config.provider === 'posthog' && this.posthog) {
            this.posthog.identify(userId, traits);
        }
    }

    /**
     * Reset user identity (on logout)
     */
    async reset(): Promise<void> {
        if (this.config.provider === 'posthog' && this.posthog) {
            this.posthog.reset();
        }
    }

    /**
     * Check if analytics is enabled
     */
    isEnabled(): boolean {
        return this.config.provider !== 'disabled';
    }
}

// Singleton instance
export const analytics = new AnalyticsClient();

/**
 * Track key user actions
 */
export const trackEvents = {
    signupComplete: (userId: string, method: 'email' | 'github' | 'google') =>
        analytics.track('signup_complete', { userId, method }),

    firstUpload: (userId: string, trackCount: number) =>
        analytics.track('first_upload', { userId, trackCount }),

    firstMashup: (userId: string, mashupId: string) =>
        analytics.track('first_mashup', { userId, mashupId }),

    mashupGenerated: (userId: string, mashupId: string, durationSeconds: number, trackCount: number) =>
        analytics.track('mashup_generated', { userId, mashupId, durationSeconds, trackCount }),

    mashupPlayed: (userId: string, mashupId: string) =>
        analytics.track('mashup_played', { userId, mashupId }),

    mashupDownloaded: (userId: string, mashupId: string, variant: 'master' | 'playback') =>
        analytics.track('mashup_downloaded', { userId, mashupId, variant }),

    mashupShared: (userId: string, mashupId: string, platform: string) =>
        analytics.track('mashup_shared', { userId, mashupId, platform }),

    mashupRetried: (userId: string, mashupId: string) =>
        analytics.track('mashup_retried', { userId, mashupId }),

    feedbackSubmitted: (userId: string, mashupId: string, rating: number) =>
        analytics.track('feedback_submitted', { userId, mashupId, rating }),

    playlistCreated: (userId: string, playlistId: string) =>
        analytics.track('playlist_created', { userId, playlistId }),

    projectCreated: (userId: string, projectId: string) =>
        analytics.track('project_created', { userId, projectId }),

    collabInviteSent: (userId: string, mashupId: string, toUserId: string) =>
        analytics.track('collab_invite_sent', { userId, mashupId, toUserId }),

    challengeSubmitted: (userId: string, challengeId: string, mashupId: string) =>
        analytics.track('challenge_submitted', { userId, challengeId, mashupId }),
};
