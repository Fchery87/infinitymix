import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, uploadedTracks, userPlans, plans } from '@/lib/db/schema';
import { eq, count, sql, sum } from 'drizzle-orm';

// GET /api/users/me/stats - Get current user mashup statistics
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [mashupStats] = await db
      .select({
        totalMashups: count(),
        publicMashups: sql<number>`count(*) filter (where ${mashups.isPublic} = true)`,
        totalPlays: sql<number>`coalesce(sum(${mashups.playbackCount}), 0)`,
      })
      .from(mashups)
      .where(eq(mashups.userId, user.id));

    const [trackStats] = await db
      .select({
        storageUsed: sql<number>`coalesce(sum(${uploadedTracks.fileSizeBytes}), 0)`,
      })
      .from(uploadedTracks)
      .where(eq(uploadedTracks.userId, user.id));

    // Get user plan info for quota
    const [userPlan] = await db
      .select({
        quotaMinutesUsed: userPlans.quotaMinutesUsed,
        monthlyMinutes: plans.monthlyMinutes,
        tier: plans.tier,
      })
      .from(userPlans)
      .innerJoin(plans, eq(userPlans.planId, plans.id))
      .where(eq(userPlans.userId, user.id))
      .limit(1);

    const quotaMinutesUsed = userPlan?.quotaMinutesUsed ?? 0;
    const monthlyMinutes = userPlan?.monthlyMinutes ?? 120;
    const planTier = userPlan?.tier ?? 'free';

    return NextResponse.json({
      totalMashups: mashupStats.totalMashups,
      publicMashups: Number(mashupStats.publicMashups),
      totalPlays: Number(mashupStats.totalPlays),
      storageUsedBytes: Number(trackStats.storageUsed),
      quotaMinutesUsed,
      monthlyMinutes,
      planTier,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
