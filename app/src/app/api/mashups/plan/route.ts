import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { planSequence } from '@/lib/audio/planner';
import type { PlanSequenceInput } from '@/lib/audio/types/planner';
import { uploadedTracks } from '@/lib/db/schema';
import { db } from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { log } from '@/lib/logger';

/**
 * POST /api/mashups/plan
 * 
 * Plan a sequence of tracks using the new sequence planner.
 * 
 * Request body:
 * {
 *   trackIds: string[],           // Required: tracks to sequence
 *   constraints: {
 *     targetDurationSeconds: number,
 *     eventArchetype?: 'party-peak' | 'warmup-journey' | 'peak-valley' | 'chill-vibe' | 'sunrise-set',
 *     preferStems?: boolean,
 *     maxTempoStretchPercent?: number,
 *   },
 *   policyOverrides?: {
 *     // Optional policy overrides
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trackIds, constraints, policyOverrides } = body;

    // Validation
    if (!Array.isArray(trackIds) || trackIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 trackIds are required' },
        { status: 400 }
      );
    }

    if (!constraints?.targetDurationSeconds) {
      return NextResponse.json(
        { error: 'targetDurationSeconds is required in constraints' },
        { status: 400 }
      );
    }

    // Verify track ownership
    const tracks = await db
      .select({ id: uploadedTracks.id })
      .from(uploadedTracks)
      .where(
        and(
          eq(uploadedTracks.userId, user.id),
          inArray(uploadedTracks.id, trackIds)
        )
      );

    if (tracks.length !== trackIds.length) {
      return NextResponse.json(
        { error: 'One or more tracks not found or not owned by user' },
        { status: 403 }
      );
    }

    // Build planning input
    const input: PlanSequenceInput = {
      trackIds,
      constraints: {
        targetDurationSeconds: constraints.targetDurationSeconds,
        eventArchetype: constraints.eventArchetype,
        preferStems: constraints.preferStems ?? true,
        maxTempoStretchPercent: constraints.maxTempoStretchPercent ?? 8,
      },
      policy: policyOverrides,
      userId: user.id,
    };

    log('info', 'sequence.planning.started', {
      userId: user.id,
      trackCount: trackIds.length,
      eventArchetype: constraints.eventArchetype,
    });

    // Run the planner
    const startTime = Date.now();
    const { plan, trace } = await planSequence(input);
    const duration = Date.now() - startTime;

    log('info', 'sequence.planning.completed', {
      userId: user.id,
      planId: plan.planId,
      durationMs: duration,
      qualityScore: plan.qualityScores.overallScore,
    });

    return NextResponse.json({
      plan: {
        planId: plan.planId,
        trackIds: plan.trackIds,
        sequence: plan.sequence,
        transitions: plan.transitions,
        totalDurationSeconds: plan.totalDurationSeconds,
        qualityScores: plan.qualityScores,
      },
      trace: {
        traceId: trace.traceId,
        totalPlanningDurationMs: trace.totalPlanningDurationMs,
        warnings: trace.warnings,
        decisions: trace.decisions.map(d => ({
          decisionType: d.decisionType,
          trackIds: d.trackIds,
          chosen: d.chosen,
          rationale: d.rationale,
          rejectedCount: d.rejected.length,
        })),
      },
    });
  } catch (error) {
    log('error', 'sequence.planning.failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to plan sequence',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
