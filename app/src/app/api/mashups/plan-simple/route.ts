import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { planSequence } from '@/lib/audio/planner';
import type { EventArchetype } from '@/lib/audio/types/planner';

/**
 * POST /api/mashups/plan-simple
 * 
 * Simplified sequence planning endpoint for non-expert users.
 * Accepts high-level parameters and maps them to planner constraints.
 * 
 * Request body:
 * {
 *   trackIds: string[],
 *   eventType: 'party-peak' | 'warmup-journey' | 'chill-vibe' | 'sunrise-set' | 'peak-valley',
 *   durationMinutes: number, // 15, 30, 45, 60
 *   energyLevel: number, // 0-100
 *   preferStems?: boolean
 * }
 * 
 * Response: Same as /api/mashups/plan
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      trackIds, 
      eventType, 
      durationMinutes, 
      energyLevel,
      preferStems = true 
    } = body;

    // Validation
    if (!Array.isArray(trackIds) || trackIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 trackIds are required' },
        { status: 400 }
      );
    }

    if (!eventType || !isValidEventType(eventType)) {
      return NextResponse.json(
        { error: 'Valid eventType is required' },
        { status: 400 }
      );
    }

    if (!durationMinutes || durationMinutes < 5 || durationMinutes > 120) {
      return NextResponse.json(
        { error: 'durationMinutes must be between 5 and 120' },
        { status: 400 }
      );
    }

    if (energyLevel === undefined || energyLevel < 0 || energyLevel > 100) {
      return NextResponse.json(
        { error: 'energyLevel must be between 0 and 100' },
        { status: 400 }
      );
    }

    // Map simplified parameters to planner constraints
    const targetDurationSeconds = durationMinutes * 60;
    
    // Calculate max tracks based on duration (assume ~3-4 min per track average)
    const maxTracks = Math.min(trackIds.length, Math.floor(durationMinutes / 3));
    const minTracks = Math.min(2, trackIds.length);

    // Energy level affects tempo stretch tolerance
    // Higher energy = more tolerance for aggressive mixing
    const maxTempoStretchPercent = energyLevel > 70 ? 12 : 8;

    // Call the main planner
    const { plan, trace } = await planSequence({
      trackIds,
      constraints: {
        targetDurationSeconds,
        eventArchetype: eventType as EventArchetype,
        preferStems,
        maxTempoStretchPercent,
        minTracks,
        maxTracks,
      },
      userId: user.id,
    });

    // Enhance response with simplified explanations
    const enhancedPlan = {
      ...plan,
      configuration: {
        eventType,
        durationMinutes,
        energyLevel,
        preferStems,
      },
      summary: generatePlanSummary(plan, eventType as EventArchetype, energyLevel),
    };

    return NextResponse.json({
      plan: enhancedPlan,
      trace: {
        traceId: trace.traceId,
        totalPlanningDurationMs: trace.totalPlanningDurationMs,
        warnings: trace.warnings,
      },
    });
  } catch (error) {
    console.error('Simple plan error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function isValidEventType(type: string): boolean {
  const validTypes = [
    'party-peak',
    'warmup-journey', 
    'chill-vibe',
    'sunrise-set',
    'peak-valley'
  ];
  return validTypes.includes(type);
}

function generatePlanSummary(
  plan: any, 
  eventType: EventArchetype, 
  energyLevel: number
): string {
  const eventDescriptions: Record<EventArchetype, string> = {
    'party-peak': 'a high-energy party mix',
    'warmup-journey': 'a journey that builds energy',
    'chill-vibe': 'a relaxed, steady mix',
    'sunrise-set': 'a mix that builds and settles',
    'peak-valley': 'a dynamic mix with variety',
  };

  const energyDesc = energyLevel < 30 ? 'chill' : 
                     energyLevel < 60 ? 'moderate' : 
                     energyLevel < 80 ? 'energetic' : 'intense';

  return `Created ${eventDescriptions[eventType]} with ${plan.trackIds.length} tracks. ` +
         `Expected duration: ${Math.round(plan.totalDurationSeconds / 60)} minutes. ` +
         `Overall ${energyDesc} energy level.`;
}
