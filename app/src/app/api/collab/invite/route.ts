import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { collabInvites } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const mashupId = body?.mashupId as string | undefined;
    const toUserId = body?.toUserId as string | undefined;
    const role = (body?.role as string | undefined) ?? 'contributor';
    if (!mashupId || !toUserId) {
      return NextResponse.json({ error: 'mashupId and toUserId are required' }, { status: 400 });
    }

    const [invite] = await db
      .insert(collabInvites)
      .values({ mashupId, fromUserId: user.id, toUserId, role, status: 'pending' })
      .onConflictDoUpdate({
        target: [collabInvites.mashupId, collabInvites.toUserId],
        set: { status: 'pending', updatedAt: new Date(), role },
      })
      .returning();

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('collab invite error', error);
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const inviteId = body?.inviteId as string | undefined;
    const decision = body?.status as 'accepted' | 'declined' | undefined;
    if (!inviteId || !decision) return NextResponse.json({ error: 'inviteId and status required' }, { status: 400 });

    const [invite] = await db
      .update(collabInvites)
      .set({ status: decision, updatedAt: new Date() })
      .where(eq(collabInvites.id, inviteId))
      .returning();

    if (!invite || invite.toUserId !== user.id) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });

    return NextResponse.json({ invite });
  } catch (error) {
    console.error('collab update error', error);
    return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 });
  }
}
