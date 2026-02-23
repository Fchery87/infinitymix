import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
}

type RateLimiter = ((request: NextRequest) => NextResponse | null) & {
  config: Required<RateLimitConfig>;
};

type Handler<TArgs extends unknown[] = unknown[]> = (
  request: NextRequest,
  ...args: TArgs
) => Promise<NextResponse> | NextResponse;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupTimer(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, 60000);
}

if (typeof window === 'undefined') {
  startCleanupTimer();
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore: Map<string, RateLimitEntry> | undefined;
};

if (!globalForRateLimit.rateLimitStore) {
  globalForRateLimit.rateLimitStore = rateLimitStore;
}
const store = globalForRateLimit.rateLimitStore;

function defaultKeyGenerator(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown');
  return `ip:${ip}`;
}

export function createUserKeyGenerator(getUserId: (request: NextRequest) => string | null): (request: NextRequest) => string {
  return (request: NextRequest) => {
    const userId = getUserId(request);
    if (userId) return `user:${userId}`;
    return defaultKeyGenerator(request);
  };
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const {
    windowMs,
    maxRequests,
    message = `Too many requests. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator,
  } = config;

  const rateLimiter: RateLimiter = function rateLimit(request: NextRequest): NextResponse | null {
    const identifier = keyGenerator(request);
    const now = Date.now();

    let entry = store.get(identifier);
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(identifier, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const resetTime = entry.resetTime;
      const retryAfter = Math.ceil((resetTime - now) / 1000);

      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
            'Retry-After': retryAfter.toString(),
            'Cache-Control': 'no-store',
          },
        }
      );
    }
    return null;
  } as RateLimiter;

  rateLimiter.config = {
    windowMs,
    maxRequests,
    message,
    skipSuccessfulRequests,
    skipFailedRequests,
    keyGenerator,
  };

  return rateLimiter;
}

export function withRateLimit(rateLimiter: RateLimiter) {
  return function<TArgs extends unknown[]>(handler: Handler<TArgs>) {
    return async (request: NextRequest, ...args: TArgs) => {
      const rateLimitResponse = rateLimiter(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const response = await handler(request, ...args);

      if (response instanceof NextResponse) {
        const identifier = rateLimiter.config.keyGenerator(request);
        const entry = store.get(identifier);
        
        if (entry) {
          const remaining = Math.max(0, rateLimiter.config.maxRequests - entry.count);
          response.headers.set('X-RateLimit-Limit', rateLimiter.config.maxRequests.toString());
          response.headers.set('X-RateLimit-Remaining', remaining.toString());
          response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
        }
      }

      return response;
    };
  };
}

export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

export const generalApiRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Rate limit exceeded. Please try again later.',
});

export const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: 'Upload limit exceeded. Please try again later.',
});

export const mashupGenerateRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Mashup generation limit exceeded. Please try again later.',
});

export const heavyOperationRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
  message: 'Too many heavy operations. Please try again later.',
});
