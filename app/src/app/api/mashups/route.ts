import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { log } from '@/lib/logger';
import { getMashupListForUser } from '@/lib/runtime/mashup-list';
import { withRateLimit, generalApiRateLimit } from '@/lib/utils/rate-limiting';

const withGeneralRateLimit = withRateLimit(generalApiRateLimit);

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const cacheControl = 'private, max-age=30';
    const mashupList = await getMashupListForUser({ userId: user.id, page, limit });

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
