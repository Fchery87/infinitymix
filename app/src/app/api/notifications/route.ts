import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { eq, desc, and, isNull, count } from 'drizzle-orm';

// GET /api/notifications - List notifications for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const cursor = searchParams.get('cursor');

    const conditions = [eq(notifications.userId, session.user.id)];
    if (unreadOnly) {
      conditions.push(isNull(notifications.readAt));
    }
    if (cursor) {
      conditions.push(desc(notifications.createdAt));
    }

    const items = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1);

    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, -1) : items;

    // Get unread count
    const [{ value: unreadCount }] = await db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          isNull(notifications.readAt)
        )
      );

    return NextResponse.json({
      notifications: result,
      unreadCount,
      nextCursor: hasMore ? result[result.length - 1].id : null,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
