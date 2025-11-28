// Production monitoring and error tracking setup
// This file configures Sentry for production error monitoring

import * as Sentry from '@sentry/nextjs';

// Only initialize Sentry in production and if DSN is available
const SENTRY_DSN = process.env.SENTRY_DSN;

if (process.env.NODE_ENV === 'production' && SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    tracesSampleRate: 0.1, // 10% of transactions for performance
    
    // Set the sampling rate for session errors.
    errorSampleRate: 1.0, // 100% of errors
    
    // Configure integrations
    integrations: [
      // Add HTTP requests breadcrumbs
      new Sentry.Integrations.Http({ tracing: true }),
      
      // Capture unhandled promise rejections
      new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
    ],

    // Environment information
    environment: process.env.NODE_ENV,
    release: process.env.npm_package_version || '0.1.0',

    // Before send hook to filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive headers
      if (event.request?.headers) {
        const headers = { ...event.request.headers };
        delete headers.authorization;
        delete headers.cookie;
        event.request.headers = headers;
      }

      // Filter out common non-critical errors
      const error = hint.originalException;
      if (error instanceof Error) {
        // Don't send network errors that are expected in development
        if (error.message.includes('Network Error') || 
            error.message.includes('fetch')) {
          return null;
        }
      }

      return event;
    },

    // Custom tags for better filtering
    beforeSendTransaction(event) {
      // Add custom tags
      event.tags = {
        ...event.tags,
        service: 'infinitymix-web',
        version: process.env.npm_package_version || '0.1.0',
      };
      return event;
    },
  });

  console.log('🔍 Sentry initialized for production monitoring');
} else {
  console.log('🚰 Sentry disabled (development or no DSN configured)');
}

// Export a wrapper for custom error reporting
export const reportError = (error: Error, context?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'production' && SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach(key => {
          scope.setTag(key, context[key]);
        });
        scope.setExtra('context', context);
      }
      Sentry.captureException(error);
    });
  } else {
    console.error('Error (not sent to Sentry):', error);
  }
};

// Export performance monitoring
export const reportPerformance = (name: string, start: number, attributes?: Record<string, any>) => {
  if (process.env.NODE_ENV === 'production' && SENTRY_DSN) {
    const duration = Date.now() - start;
    Sentry.getGlobalScope().setTag('duration', duration);
    Sentry.addBreadcrumb({
      message: name,
      level: 'info',
      data: {
        duration_ms: duration,
        ...attributes,
      },
    });
  }
};
