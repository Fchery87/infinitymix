import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { log } from '@/lib/logger';
import { getMashupListForUser } from '@/lib/runtime/mashup-list';
import { withRateLimit, generalApiRateLimit } from '@/lib/utils/rate-limiting';
import { z } from 'zod';

const withGeneralRateLimit = withRateLimit(generalApiRateLimit);

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(25),
  search: z.string().optional(),
  status: z.enum(['all', 'completed', 'in-progress']).optional(),
});

async function handleGet(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = querySchema.safeParse({
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      status: searchParams.get('status'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { cursor, limit, search, status } = queryParams.data;
    const cacheControl = 'private, max-age=30';
    const mashupList = await getMashupListForUser({
      userId: user.id,
      cursor,
      limit,
      search,
      status,
    });

    const response = NextResponse.json(mashupList);
    response.headers.set('Cache-Control', cacheControl);
    return response;
  } catch (error) {
    console.error('List mashups error:', error);
    log('error', 'mashups.list.failed', { error: (error as Error)?.message });
    return NextResponse.json(
      { error: 'Failed to retrieve mashups' },
      { status: 500 }
    );
  }
}

export const GET = withGeneralRateLimit(handleGet);
