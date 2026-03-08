import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRateLimiter,
  withRateLimit,
} from '@/lib/utils/rate-limiting';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: vi.fn(),
}));

vi.mock('@/lib/auth/admin', () => ({
  isAdminUser: vi.fn(),
}));

import { getSessionUser } from '@/lib/auth/session';
import { isAdminUser } from '@/lib/auth/admin';

function createMockRequest(ip: string = '127.0.0.1'): NextRequest {
  return new NextRequest('http://localhost/test', {
    headers: {
      'x-forwarded-for': ip,
    },
  });
}

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getSessionUser).mockResolvedValue(null);
    vi.mocked(isAdminUser).mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createRateLimiter', () => {
    it('allows requests within limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const request = createMockRequest();

      for (let i = 0; i < 5; i++) {
        const result = limiter(request);
        expect(result).toBeNull();
      }
    });

    it('blocks requests exceeding limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
      });

      const request = createMockRequest('192.168.1.100');

      expect(limiter(request)).toBeNull();
      expect(limiter(request)).toBeNull();
      
      const blocked = limiter(request);
      expect(blocked).not.toBeNull();
      expect(blocked?.status).toBe(429);
    });

    it('resets after window expires', () => {
      const limiter = createRateLimiter({
        windowMs: 1000,
        maxRequests: 1,
      });

      const request = createMockRequest('192.168.1.101');

      expect(limiter(request)).toBeNull();
      expect(limiter(request)?.status).toBe(429);

      vi.advanceTimersByTime(1001);

      expect(limiter(request)).toBeNull();
    });

    it('tracks different IPs separately', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      const request1 = createMockRequest('192.168.1.1');
      const request2 = createMockRequest('192.168.1.2');

      expect(limiter(request1)).toBeNull();
      expect(limiter(request2)).toBeNull();

      expect(limiter(request1)?.status).toBe(429);
      expect(limiter(request2)?.status).toBe(429);
    });

    it('returns proper headers on rate limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        message: 'Too many requests!',
      });

      const request = createMockRequest('192.168.1.102');
      limiter(request);
      const blocked = limiter(request);

      expect(blocked).not.toBeNull();
      expect(blocked?.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(blocked?.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(blocked?.headers.get('Retry-After')).toBeTruthy();
    });
  });

  describe('withRateLimit', () => {
    it('wraps handler and allows requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      const wrappedHandler = withRateLimit(limiter)(async () => {
        return NextResponse.json({ success: true });
      });

      const request = createMockRequest('192.168.1.103');
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
    });

    it('blocks requests when rate limited', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      const wrappedHandler = withRateLimit(limiter)(async () => {
        return NextResponse.json({ success: true });
      });

      const request = createMockRequest('192.168.1.104');
      await wrappedHandler(request);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(429);
    });

    it('bypasses rate limits for admin users', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
      });

      vi.mocked(getSessionUser).mockResolvedValue({
        id: 'admin-user',
        email: 'admin@example.com',
      } as never);
      vi.mocked(isAdminUser).mockReturnValue(true);

      const wrappedHandler = withRateLimit(limiter)(async () => {
        return NextResponse.json({ success: true });
      });

      const request = createMockRequest('192.168.1.105');
      const first = await wrappedHandler(request);
      const second = await wrappedHandler(request);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });
  });
});
