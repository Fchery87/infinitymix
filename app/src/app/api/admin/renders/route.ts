import { NextResponse } from 'next/server';
import { requireServerAdminUser } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { mashups, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const adminUser = await requireServerAdminUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const recentRenders = await db
      .select({
        id: mashups.id,
        userId: mashups.userId,
        userEmail: users.email,
        generationStatus: mashups.generationStatus,
        qaResults: mashups.qaResults,
        retryReason: mashups.retryReason,
        generationTimeMs: mashups.generationTimeMs,
        createdAt: mashups.createdAt,
      })
      .from(mashups)
      .leftJoin(users, eq(mashups.userId, users.id))
      .orderBy(desc(mashups.createdAt))
      .limit(limit);

    return NextResponse.json({ renders: recentRenders });
  } catch (error) {
    console.error('Failed to fetch admin renders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
