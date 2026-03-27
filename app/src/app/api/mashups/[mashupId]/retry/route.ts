import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks } from '@/lib/db/schema';
import { enqueueMix } from '@/lib/queue';
import { logTelemetry } from '@/lib/telemetry';
import { eq, and } from 'drizzle-orm';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ mashupId: string }> }
) {
    try {
        const { mashupId } = await params;
        const user = await getSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!mashupId) {
            return NextResponse.json({ error: 'Mashup ID is required' }, { status: 400 });
        }

        // Get the mashup and verify ownership
        const [mashup] = await db
            .select({
                id: mashups.id,
                userId: mashups.userId,
                generationStatus: mashups.generationStatus,
                targetDurationSeconds: mashups.targetDurationSeconds,
                mixMode: mashups.mixMode,
            })
            .from(mashups)
            .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

        if (!mashup) {
            return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });
        }

        // Only allow retry for failed mashups
        if (mashup.generationStatus !== 'failed') {
            return NextResponse.json(
                { error: 'Only failed mashups can be retried' },
                { status: 400 }
            );
        }

        // Get input tracks for the mashup
        const inputTracks = await db
            .select({ uploadedTrackId: mashupInputTracks.uploadedTrackId })
            .from(mashupInputTracks)
            .where(eq(mashupInputTracks.mashupId, mashupId));

        if (inputTracks.length === 0) {
            return NextResponse.json(
                { error: 'No input tracks found for this mashup' },
                { status: 400 }
            );
        }

        const inputTrackIds = inputTracks.map((t) => t.uploadedTrackId);

        // Reset mashup status to pending
        await db
            .update(mashups)
            .set({
                generationStatus: 'pending',
                updatedAt: new Date(),
            })
            .where(eq(mashups.id, mashupId));

        // Re-queue the mashup generation
        const queueReceipt = await enqueueMix({
            type: 'mix',
            mashupId: mashup.id,
            inputTrackIds,
            durationSeconds: mashup.targetDurationSeconds,
            mixMode: mashup.mixMode,
        });

        logTelemetry({
            name: 'mashup.retry.requested',
            properties: {
                mashupId: mashup.id,
                userId: user.id,
                durationSeconds: mashup.targetDurationSeconds,
                trackCount: inputTrackIds.length,
            },
        });

        return NextResponse.json({
            success: true,
            mashupId: mashup.id,
            automation_job_id: queueReceipt.jobId,
            queue_driver: queueReceipt.driver,
        });
    } catch (error) {
        console.error('Retry mashup error:', error);
        logTelemetry({
            name: 'mashup.retry.failed',
            level: 'error',
            properties: { error: (error as Error)?.message },
        });

        return NextResponse.json(
            { error: 'Failed to retry mashup' },
            { status: 500 }
        );
    }
}
