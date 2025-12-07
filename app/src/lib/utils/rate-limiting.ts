import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

type RateLimiter = ((request: NextRequest) => NextResponse | null) & {
  config: Required<RateLimitConfig>;
};

type Handler<TArgs extends unknown[] = unknown[]> = (
  request: NextRequest,
  ...args: TArgs
) => Promise<NextResponse | null | undefined> | NextResponse | null | undefined;

// Simple in-memory rate limiter for development
// In production, you'd want to use Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const {
    windowMs,
    maxRequests,
    message = `Too many requests. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  const rateLimiter: RateLimiter = function rateLimit(request: NextRequest): NextResponse | null {
    const identifier = getIdentifier(request);
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }

    // Get or create rate limit entry for this identifier
    let entry = rateLimitStore.get(identifier);
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(identifier, entry);
    }

    // Increment count
    entry.count++;

    // Check if over limit
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
  };

  return rateLimiter;
}

// Get identifier for rate limiting
function getIdentifier(request: NextRequest): string {
  // Try to get IP address
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = realIp || (forwardedFor ? forwardedFor.split(',')[0] : 'unknown');

  // Try to get user ID from session (if available)
  // This would require passing session info, for now just use IP
  const identifier = `ip:${ip}`;
  return identifier;
}

// Rate limiting middleware wrapper
export function withRateLimit(rateLimiter: RateLimiter) {
  return function<TArgs extends unknown[]>(handler: Handler<TArgs>) {
    return async (request: NextRequest, ...args: TArgs) => {
      const rateLimitResponse = rateLimiter(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      const response = await handler(request, ...args);

      // Add rate limit headers to successful responses
      if (response instanceof NextResponse) {
        const identifier = getIdentifier(request);
        const entry = rateLimitStore.get(identifier);
        
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

// Pre-configured rate limiters for different use cases
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 requests per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

export const generalRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
  message: 'Rate limit exceeded. Please try again later.',
});

export const uploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 20, // 20 uploads per hour
  message: 'Upload limit exceeded. Please try again later.',
});
