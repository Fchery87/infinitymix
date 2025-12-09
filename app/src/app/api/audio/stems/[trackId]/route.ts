import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { getStemsForTrack } from '@/lib/audio/stems-service';
import { enqueueStems } from '@/lib/queue';
import { ensureStemsQuality } from '@/lib/monetization';
import { AuthenticationError } from '@/lib/utils/error-handling';
import { eq, and } from 'drizzle-orm';
import { generalRateLimit } from '@/lib/utils/rate-limiting';

async function ensureOwnership(trackId: string, userId: string) {
  const [record] = await db
    .select({ id: uploadedTracks.id })
    .from(uploadedTracks)
    .where(and(eq(uploadedTracks.id, trackId), eq(uploadedTracks.userId, userId)))
    .limit(1);

  return record;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  try {
    const limited = generalRateLimit(request);
    if (limited) return limited;

    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const { trackId } = await params;
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const owned = await ensureOwnership(trackId, user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Track not found or not accessible' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({} as { quality?: 'draft' | 'hifi' }));
    const quality = body?.quality === 'hifi' ? 'hifi' : 'draft';

    await ensureStemsQuality(user.id, quality);

    void enqueueStems({ type: 'stems', trackId, quality });

    return NextResponse.json({ status: 'accepted', quality });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, code: 'AUTHENTICATION_ERROR' }, { status: 401 });
    }
    if (error instanceof Error && error.message.toLowerCase().includes('plan')) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error('Stem separation error:', error);
    return NextResponse.json({ error: 'Failed to generate stems' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ trackId: string }> }) {
  try {
    const limited = generalRateLimit(request);
    if (limited) return limited;

    const user = await getSessionUser(request);
    if (!user) throw new AuthenticationError('Authentication required');

    const { trackId } = await params;
    if (!trackId) {
      return NextResponse.json({ error: 'trackId is required' }, { status: 400 });
    }

    const owned = await ensureOwnership(trackId, user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Track not found or not accessible' }, { status: 404 });
    }

    const stems = await getStemsForTrack(trackId);

    // Generate playable URLs using the stream proxy endpoint
    const stemsWithUrls = stems.map((stem) => {
      let playUrl: string | undefined;
      if (stem.storageUrl && stem.status === 'completed') {
        // Use the proxy endpoint to avoid CORS issues
        playUrl = `/api/audio/stream/${stem.id}`;
      }
      return {
        id: stem.id,
        stemType: stem.stemType,
        status: stem.status,
        quality: stem.quality,
        engine: stem.engine,
        playUrl,
      };
    });

    return NextResponse.json({ stems: stemsWithUrls });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message, code: 'AUTHENTICATION_ERROR' }, { status: 401 });
    }
    console.error('Get stems error:', error);
    return NextResponse.json({ error: 'Failed to fetch stems' }, { status: 500 });
  }
}
