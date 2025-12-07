// Production monitoring and error tracking setup
// This file configures Sentry for production error monitoring without hard dependency during build

const SENTRY_DSN = process.env.SENTRY_DSN;
const shouldInitSentry = process.env.NODE_ENV === 'production' && Boolean(SENTRY_DSN);
let sentryPromise: Promise<typeof import('@sentry/nextjs')> | null = null;

const loadSentry = async () => {
  if (!sentryPromise) {
    sentryPromise = import('@sentry/nextjs');
  }
  return sentryPromise;
};

if (shouldInitSentry) {
  void loadSentry()
    .then((Sentry) => {
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
        release: process.env.npm_package_version || '0.1.0',
        beforeSend(event, hint) {
          if (event.request?.headers) {
            const headers = { ...event.request.headers };
            delete headers.authorization;
            delete headers.cookie;
            event.request.headers = headers;
          }

          const error = hint.originalException;
          if (error instanceof Error) {
            if (error.message.includes('Network Error') || error.message.includes('fetch')) {
              return null;
            }
          }

          return event;
        },
        beforeSendTransaction(event) {
          event.tags = {
            ...event.tags,
            service: 'infinitymix-web',
            version: process.env.npm_package_version || '0.1.0',
          };
          return event;
        },
      });
      console.log('🔍 Sentry initialized for production monitoring');
    })
    .catch((error) => {
      console.error('Failed to initialize Sentry', error);
    });
} else {
  console.log('🚰 Sentry disabled (development or no DSN configured)');
}

// Export a wrapper for custom error reporting
export const reportError = (error: Error, context?: Record<string, unknown>) => {
  if (!shouldInitSentry) {
    console.error('Error (not sent to Sentry):', error);
    return;
  }

  void loadSentry().then((Sentry) => {
    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setTag(key, String(context[key]));
        });
        scope.setExtra('context', context);
      }
      Sentry.captureException(error);
    });
  });
};

// Export performance monitoring
export const reportPerformance = (name: string, start: number, attributes?: Record<string, unknown>) => {
  if (!shouldInitSentry) return;

  const duration = Date.now() - start;
  void loadSentry().then((Sentry) => {
    const scope = Sentry.getGlobalScope();
    scope.setTag('duration', duration);
    Sentry.addBreadcrumb({
      message: name,
      level: 'info',
      data: {
        duration_ms: duration,
        ...attributes,
      },
    });
  });
};
