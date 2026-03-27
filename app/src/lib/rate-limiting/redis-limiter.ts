import { NextRequest, NextResponse } from 'next/server';
import { getRedisConnection } from '@/lib/queue/redis';

interface RedisRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  limit: number;
}

export async function checkRateLimitRedis(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RedisRateLimitResult> {
  const redis = getRedisConnection() as any;
  const now = Date.now();
  const windowStart = now - windowMs;
  const redisKey = `ratelimit:${key}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(redisKey, 0, windowStart);
  pipeline.zcard(redisKey);
  pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
  pipeline.pexpire(redisKey, windowMs);

  const results = await pipeline.exec();
  const currentCount = (results?.[1]?.[1] as number) ?? 0;

  const allowed = currentCount < maxRequests;
  const remaining = Math.max(0, maxRequests - currentCount - 1);
  const resetMs = now + windowMs;

  if (!allowed) {
    await redis.zrem(redisKey, `${now}-${Math.random()}`);
  }

  return { allowed, remaining, resetMs, limit: maxRequests };
}

export function createRedisRateLimiter(config: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (request: NextRequest) => string;
}) {
  const {
    windowMs,
    maxRequests,
    message = `Too many requests. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
    keyGenerator,
  } = config;

  return async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
    const identifier = keyGenerator
      ? keyGenerator(request)
      : defaultKeyGenerator(request);

    const result = await checkRateLimitRedis(identifier, maxRequests, windowMs);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetMs - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Too Many Requests', message, retryAfter },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetMs.toString(),
            'Retry-After': retryAfter.toString(),
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return null;
  };
}

function defaultKeyGenerator(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = realIp || (forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown');
  return `ip:${ip}`;
}
