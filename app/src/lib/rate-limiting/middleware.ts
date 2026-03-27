import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminUser } from '@/lib/auth/admin';

type RateLimitFn = (request: NextRequest) => Promise<NextResponse | null> | NextResponse | null;
type Handler<TArgs extends unknown[] = unknown[]> = (
  request: NextRequest,
  ...args: TArgs
) => Promise<NextResponse> | NextResponse;

export function withDistributedRateLimit(rateLimiter: RateLimitFn) {
  return function <TArgs extends unknown[]>(handler: Handler<TArgs>) {
    return async (request: NextRequest, ...args: TArgs) => {
      const user = await getSessionUser(request);
      if (user && isAdminUser(user)) {
        return handler(request, ...args);
      }

      const rateLimitResponse = await rateLimiter(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }

      return handler(request, ...args);
    };
  };
}
