import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { uploadedTracks, mashups } from '@/lib/db/schema';
import { eq, count } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ isFirstTime: false, error: 'Not authenticated' }, { status: 401 });
    }

    const userId = session.user.id;

    const trackCount = await db
      .select({ count: count() })
      .from(uploadedTracks)
      .where(eq(uploadedTracks.userId, userId));

    const mashupCount = await db
      .select({ count: count() })
      .from(mashups)
      .where(eq(mashups.userId, userId));

    const hasContent = (trackCount[0]?.count ?? 0) > 0 || (mashupCount[0]?.count ?? 0) > 0;

    return NextResponse.json({
      isFirstTime: !hasContent,
      trackCount: trackCount[0]?.count ?? 0,
      mashupCount: mashupCount[0]?.count ?? 0,
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return NextResponse.json({ isFirstTime: false, error: 'Internal error' }, { status: 500 });
  }
}