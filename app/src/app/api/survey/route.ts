import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { playbackSurveys } from '@/lib/db/schema';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const mashupId = body?.mashupId as string | undefined;
    const rating = Number(body?.rating ?? 0);
    const answers = body?.answers as Record<string, unknown> | undefined;

    if (!mashupId || rating <= 0) return NextResponse.json({ error: 'mashupId and rating required' }, { status: 400 });

    const [record] = await db
      .insert(playbackSurveys)
      .values({ userId: user.id, mashupId, rating, answers })
      .returning();

    return NextResponse.json({ survey: record });
  } catch (error) {
    console.error('survey error', error);
    return NextResponse.json({ error: 'Failed to submit survey' }, { status: 500 });
  }
}
