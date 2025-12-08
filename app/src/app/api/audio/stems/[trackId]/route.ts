import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { separateStems, getStemsForTrack } from '@/lib/audio/stems-service';
import { AuthenticationError } from '@/lib/utils/error-handling';
import { eq, and } from 'drizzle-orm';
import { withRateLimit, generalRateLimit } from '@/lib/utils/rate-limiting';

async function ensureOwnership(trackId: string, userId: string) {
  const [record] = await db
    .select({ id: uploadedTracks.id })
    .from(uploadedTracks)
    .where(and(eq(uploadedTracks.id, trackId), eq(uploadedTracks.userId, userId)))
    .limit(1);

  return record;
}

export const POST = withRateLimit(generalRateLimit)(async (request: NextRequest, { params }: { params: { trackId: string } }) => {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const trackId = params.trackId;
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const owned = await ensureOwnership(trackId, user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Track not found or not accessible' }, { status: 404 });
    }

    const stems = await separateStems(trackId);
    return NextResponse.json({ stems });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, code: 'AUTHENTICATION_ERROR' }, { status: 401 });
    }
    console.error('Stem separation error:', error);
    return NextResponse.json({ error: 'Failed to generate stems' }, { status: 500 });
  }
});

export const GET = withRateLimit(generalRateLimit)(async (request: NextRequest, { params }: { params: { trackId: string } }) => {
  try {
    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const trackId = params.trackId;
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const owned = await ensureOwnership(trackId, user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Track not found or not accessible' }, { status: 404 });
    }

    const stems = await getStemsForTrack(trackId);
    return NextResponse.json({ stems });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, code: 'AUTHENTICATION_ERROR' }, { status: 401 });
    }
    console.error('Get stems error:', error);
    return NextResponse.json({ error: 'Failed to fetch stems' }, { status: 500 });
  }
});
