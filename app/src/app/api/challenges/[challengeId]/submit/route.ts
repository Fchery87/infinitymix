import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { challenges, challengeSubmissions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ challengeId: string }> }) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { challengeId } = await params;
    if (!challengeId) return NextResponse.json({ error: 'challengeId required' }, { status: 400 });

    const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
    if (!challenge || challenge.status !== 'active') {
      return NextResponse.json({ error: 'Challenge not active' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const mashupId = body?.mashupId as string | undefined;
    if (!mashupId) return NextResponse.json({ error: 'mashupId required' }, { status: 400 });

    const [submission] = await db
      .insert(challengeSubmissions)
      .values({ challengeId, userId: user.id, mashupId, status: 'submitted', score: 0 })
      .onConflictDoUpdate({
        target: [challengeSubmissions.challengeId, challengeSubmissions.userId],
        set: { mashupId, status: 'submitted', updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json({ submission });
  } catch (error) {
    console.error('challenge submit error', error);
    return NextResponse.json({ error: 'Failed to submit challenge entry' }, { status: 500 });
  }
}
