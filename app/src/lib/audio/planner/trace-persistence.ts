/**
 * Planner Trace Persistence Service
 * 
 * Persists planner traces to the database for observability and QA.
 */

import { db } from '@/lib/db';
import { plannerTraces } from '@/lib/db/schema';
import { eq, desc, sql, count, avg } from 'drizzle-orm';
import type { PlannerTrace } from '@/lib/audio/types/planner';

/**
 * Persist a planner trace to the database
 */
export async function persistPlannerTrace(
  trace: PlannerTrace,
  userId: string
): Promise<void> {
  try {
    await db.insert(plannerTraces).values({
      traceId: trace.traceId,
      planId: trace.planId,
      userId,
      trackIds: [], // Will be populated from constraints or separate query
      totalPlanningDurationMs: trace.totalPlanningDurationMs,
      graphBuildDurationMs: trace.graphBuildDurationMs,
      compatibilityScoringDurationMs: trace.compatibilityScoringDurationMs,
      sequenceOptimizationDurationMs: trace.sequenceOptimizationDurationMs,
      decisions: trace.decisions,
      rejectedCandidates: trace.rejectedCandidates,
      warnings: trace.warnings,
      constraints: trace.constraints,
      policy: trace.policy,
      qualityScore: null,
    });
  } catch (error) {
    console.error('Failed to persist planner trace:', error);
    // Don't throw - trace persistence shouldn't break planning
  }
}

/**
 * Update the quality score for a persisted trace
 */
export async function updatePlannerTraceQuality(
  traceId: string,
  qualityScore: number
): Promise<void> {
  try {
    await db
      .update(plannerTraces)
      .set({ qualityScore: qualityScore.toFixed(3) })
      .where(eq(plannerTraces.traceId, traceId));
  } catch (error) {
    console.error('Failed to update planner trace quality:', error);
  }
}

/**
 * Get planner traces for a user
 */
export async function getPlannerTracesForUser(
  userId: string,
  limit = 50
): Promise<Array<{
  traceId: string;
  planId: string;
  trackCount: number;
  totalPlanningDurationMs: number;
  qualityScore: number | null;
  createdAt: Date;
}>> {
  const traces = await db
    .select({
      traceId: plannerTraces.traceId,
      planId: plannerTraces.planId,
      trackIds: plannerTraces.trackIds,
      totalPlanningDurationMs: plannerTraces.totalPlanningDurationMs,
      qualityScore: plannerTraces.qualityScore,
      createdAt: plannerTraces.createdAt,
    })
    .from(plannerTraces)
    .where(eq(plannerTraces.userId, userId))
    .orderBy(desc(plannerTraces.createdAt))
    .limit(limit);

  return traces.map(t => ({
    traceId: t.traceId,
    planId: t.planId,
    trackCount: Array.isArray(t.trackIds) ? t.trackIds.length : 0,
    totalPlanningDurationMs: t.totalPlanningDurationMs,
    qualityScore: t.qualityScore ? Number(t.qualityScore) : null,
    createdAt: t.createdAt,
  }));
}

/**
 * Get aggregated planner statistics for observability
 */
export async function getPlannerStatistics(): Promise<{
  totalTraces: number;
  averagePlanningDurationMs: number;
  averageQualityScore: number;
  tracesWithWarnings: number;
}> {
  const [countResult, durationResult, qualityResult, warningsResult] = await Promise.all([
    db.select({ value: count() }).from(plannerTraces),
    db.select({ value: avg(plannerTraces.totalPlanningDurationMs) }).from(plannerTraces),
    db.select({ value: avg(plannerTraces.qualityScore) }).from(plannerTraces),
    db
      .select({ value: count() })
      .from(plannerTraces)
      .where(sql`${plannerTraces.warnings} != '[]'::jsonb`),
  ]);

  return {
    totalTraces: Number(countResult[0]?.value ?? 0),
    averagePlanningDurationMs: Number(durationResult[0]?.value ?? 0),
    averageQualityScore: Number(qualityResult[0]?.value ?? 0),
    tracesWithWarnings: Number(warningsResult[0]?.value ?? 0),
  };
}
