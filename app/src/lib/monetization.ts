import { db } from '@/lib/db';
import { plans, userPlans } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type PlanInfo = {
  id: string;
  slug: string;
  tier: 'free' | 'pro' | 'studio';
  monthlyMinutes: number;
  maxStemsQuality: 'draft' | 'hifi';
  queuePriority: number;
};

async function ensureFreePlan(): Promise<PlanInfo> {
  const [existing] = await db.select().from(plans).where(eq(plans.slug, 'free')).limit(1);
  if (existing) {
    return {
      id: existing.id,
      slug: existing.slug,
      tier: existing.tier,
      monthlyMinutes: existing.monthlyMinutes,
      maxStemsQuality: existing.maxStemsQuality,
      queuePriority: existing.queuePriority,
    };
  }

  const [created] = await db
    .insert(plans)
    .values({
      slug: 'free',
      name: 'Free',
      tier: 'free',
      monthlyMinutes: 120,
      maxStemsQuality: 'draft',
      queuePriority: 1,
      priceCents: 0,
    })
    .returning();

  return {
    id: created.id,
    slug: created.slug,
    tier: created.tier,
    monthlyMinutes: created.monthlyMinutes,
    maxStemsQuality: created.maxStemsQuality,
    queuePriority: created.queuePriority,
  };
}

export async function getUserPlan(userId: string): Promise<PlanInfo> {
  const [userPlan] = await db.select({
    planId: userPlans.planId,
    quotaMinutesUsed: userPlans.quotaMinutesUsed,
  }).from(userPlans).where(eq(userPlans.userId, userId)).limit(1);

  if (userPlan) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, userPlan.planId)).limit(1);
    if (plan) {
      return {
        id: plan.id,
        slug: plan.slug,
        tier: plan.tier,
        monthlyMinutes: plan.monthlyMinutes,
        maxStemsQuality: plan.maxStemsQuality,
        queuePriority: plan.queuePriority,
      };
    }
  }

  const freePlan = await ensureFreePlan();
  const [created] = await db
    .insert(userPlans)
    .values({ userId, planId: freePlan.id, quotaMinutesUsed: 0 })
    .onConflictDoNothing({ target: userPlans.userId })
    .returning();

  if (created) {
    return freePlan;
  }

  return freePlan;
}

export async function assertDurationQuota(userId: string, durationSeconds: number) {
  const plan = await getUserPlan(userId);
  const [userPlan] = await db.select().from(userPlans).where(eq(userPlans.userId, userId)).limit(1);
  const usedMinutes = userPlan?.quotaMinutesUsed ?? 0;
  const requestedMinutes = durationSeconds / 60;
  if (usedMinutes + requestedMinutes > plan.monthlyMinutes) {
    throw new Error('Plan quota exceeded. Upgrade to continue generating.');
  }
  await db
    .update(userPlans)
    .set({ quotaMinutesUsed: Math.ceil(usedMinutes + requestedMinutes) })
    .where(eq(userPlans.userId, userId));
  return plan;
}

export async function ensureStemsQuality(userId: string, quality: 'draft' | 'hifi') {
  const plan = await getUserPlan(userId);
  if (quality === 'hifi' && plan.maxStemsQuality !== 'hifi') {
    throw new Error('Upgrade plan to render hi-fidelity stems.');
  }
  return plan;
}
