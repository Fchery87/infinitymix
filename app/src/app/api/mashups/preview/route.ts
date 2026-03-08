import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { mixToBuffer } from '@/lib/audio/mixing-service';
import { getStorage } from '@/lib/storage';
import { eq, and, inArray } from 'drizzle-orm';
import {
  buildPreviewGenerationIdempotencyKey,
  getAutomationRecoveryPolicy,
} from '@/lib/runtime/recovery';
import { convertPlannedTransitionsToContracts } from '@/lib/audio/execution';
import type { TransitionExecutionContract } from '@/lib/audio/types/transition';
import type { AutoDjTransitionStyle } from '@/lib/audio/auto-dj-service';

const MAX_DURATION = 30;

/**
 * Track data for mixing
 */
interface TrackForMixing {
  id: string;
  storageUrl: string;
  mimeType: string;
  bpm: number | null;
  buffer: Buffer;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
    }

    const { trackIds, durationSeconds, contract, plan, planId, mixMode = 'standard' } = await request.json();
    
    // Handle planId parameter - fetch plan and convert to contracts
    let effectiveContract: TransitionExecutionContract | undefined = contract;
    let effectiveTrackIds: string[] = trackIds;
    
    if (planId && !contract) {
      // Fetch plan from database (implementation depends on how plans are stored)
      // For now, we'll use the plan parameter if provided
      if (plan) {
        effectiveTrackIds = plan.trackIds;
        if (plan.transitions && plan.transitions.length > 0) {
          const contracts = convertPlannedTransitionsToContracts(plan.transitions);
          effectiveContract = contracts[0]; // Use first transition for now
        }
      }
    }
    
    if (!Array.isArray(effectiveTrackIds) || effectiveTrackIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 trackIds required' }, { status: 400 });
    }

    const safeDuration = effectiveContract ? effectiveContract.overlapDurationSeconds + 2 : Math.min(MAX_DURATION, Math.max(10, Number(durationSeconds) || 20));
    const previewIdempotencyKey = buildPreviewGenerationIdempotencyKey({
      userId: user.id,
      trackIds: effectiveTrackIds,
      durationSeconds: safeDuration,
      mixMode,
    });
    const recoveryPolicy = getAutomationRecoveryPolicy('preview');

    const records = await db
      .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl, mimeType: uploadedTracks.mimeType, userId: uploadedTracks.userId, bpm: uploadedTracks.bpm })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.userId, user.id), inArray(uploadedTracks.id, effectiveTrackIds)));

    if (records.length !== effectiveTrackIds.length) {
      return NextResponse.json({ error: 'One or more tracks not found' }, { status: 404 });
    }

    // Reorder records to match effectiveTrackIds
    const orderedRecords = effectiveTrackIds.map((id: string) => records.find((r) => r.id === id)!);

    const storage = await getStorage();
    if (!storage.getFile) return NextResponse.json({ error: 'Storage driver cannot read files' }, { status: 500 });

    const tracks: TrackForMixing[] = [];
    const buffers: Buffer[] = [];
    for (const r of orderedRecords) {
      const fetched = await storage.getFile(r.storageUrl);
      if (!fetched?.buffer) return NextResponse.json({ error: 'Failed to fetch track audio' }, { status: 500 });
      buffers.push(fetched.buffer);
      tracks.push({ id: r.id, storageUrl: r.storageUrl, mimeType: fetched.mimeType || r.mimeType, bpm: r.bpm ? Number(r.bpm) : null, buffer: fetched.buffer });
    }

    let mixingConfig: Parameters<typeof mixToBuffer>[1] = { duration: safeDuration };

    if (effectiveContract) {
      mixingConfig = {
        duration: safeDuration,
        inputConfigs: [
          { startSeconds: Math.max(0, effectiveContract.mixOutCueSeconds - 1) },
          { startSeconds: effectiveContract.mixInCueSeconds },
        ],
        transitions: [
          {
            fromIdx: 0,
            toIdx: 1,
            duration: effectiveContract.overlapDurationSeconds,
            style: (effectiveContract.transitionStyle as AutoDjTransitionStyle) || 'smooth',
          },
        ],
      };
    }

    const result = await mixToBuffer(buffers, mixingConfig);
    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
        'X-Preview-Idempotency-Key': previewIdempotencyKey,
        'X-Automation-Recovery-Policy': recoveryPolicy.execution,
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Failed to render preview' }, { status: 500 });
  }
}
