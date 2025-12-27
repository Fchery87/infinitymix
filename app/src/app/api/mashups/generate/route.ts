import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { mashupGenerateSchema } from '@/lib/utils/validation';
import { generateMashupName } from '@/lib/utils/helpers';
import { enqueueMix } from '@/lib/queue';
import { logTelemetry, withTelemetry } from '@/lib/telemetry';
import { assertDurationQuota } from '@/lib/monetization';
import { eq, and, inArray } from 'drizzle-orm';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 }
      );
    }

    const requestStarted = Date.now();
    const body = await request.json();
    const {
      inputFileIds,
      durationPreset,
      mixMode = 'standard',
      projectId,
    } = mashupGenerateSchema.parse(body);

    logTelemetry({
      name: 'mashup.generate.requested',
      properties: {
        userId: user.id,
        trackCount: inputFileIds.length,
        durationPreset,
      },
    });

    // Validate that all input files belong to the user and are analyzed
    const tracks = await db
      .select({
        id: uploadedTracks.id,
        analysisStatus: uploadedTracks.analysisStatus,
        bpm: uploadedTracks.bpm,
        keySignature: uploadedTracks.keySignature,
      })
      .from(uploadedTracks)
      .where(
        and(
          eq(uploadedTracks.userId, user.id),
          inArray(uploadedTracks.id, inputFileIds)
        )
      );

    if (tracks.length !== inputFileIds.length) {
      return NextResponse.json(
        { error: 'One or more tracks not found or not accessible' },
        { status: 404 }
      );
    }

    const unanalyzedTracks = tracks.filter(
      (t) => t.analysisStatus !== 'completed'
    );
    if (unanalyzedTracks.length > 0) {
      return NextResponse.json(
        { error: 'Some tracks are still being analyzed' },
        { status: 400 }
      );
    }

    // Map duration preset to seconds
    const durationMap = {
      '1_minute': 60,
      '2_minutes': 120,
      '3_minutes': 180,
    };
    const durationSeconds =
      durationMap[durationPreset as keyof typeof durationMap];

    // Enforce plan quota
    await assertDurationQuota(user.id, durationSeconds);

    // Create mashup record
    const [mashup] = await db
      .insert(mashups)
      .values({
        userId: user.id,
        name: generateMashupName(),
        targetDurationSeconds: durationSeconds,
        generationStatus: 'pending',
        outputFormat: 'mp3',
        isPublic: false,
        mixMode,
        projectId: projectId || null,
      })
      .returning({
        id: mashups.id,
        userId: mashups.userId,
        targetDurationSeconds: mashups.targetDurationSeconds,
        generationStatus: mashups.generationStatus,
        outputFormat: mashups.outputFormat,
        isPublic: mashups.isPublic,
        mixMode: mashups.mixMode,
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
      });

    if (!mashup) {
      return NextResponse.json(
        { error: 'Failed to create mashup' },
        { status: 500 }
      );
    }

    // Link mashup to input tracks
    const trackRelations = inputFileIds.map((trackId) => ({
      mashupId: mashup.id,
      uploadedTrackId: trackId,
    }));

    await db.insert(mashupInputTracks).values(trackRelations);

    // Start async generation process (queued)
    void withTelemetry(
      'mashup.generate.render',
      () =>
        enqueueMix({
          type: 'mix',
          mashupId: mashup.id,
          inputTrackIds: inputFileIds,
          durationSeconds,
          mixMode,
        }),
      {
        mashupId: mashup.id,
        trackCount: inputFileIds.length,
        mixMode,
        durationSeconds,
      }
    );

    logTelemetry({
      name: 'mashup.generate.accepted',
      properties: {
        mashupId: mashup.id,
        userId: user.id,
        durationSeconds,
        trackCount: inputFileIds.length,
        latencyMs: Date.now() - requestStarted,
      },
    });

    return NextResponse.json({
      id: mashup.id,
      user_id: mashup.userId,
      duration_seconds: mashup.targetDurationSeconds,
      status: mashup.generationStatus,
      output_path: null,
      output_format: mashup.outputFormat,
      generation_time_ms: null,
      mix_mode: mashup.mixMode,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    });
  } catch (error) {
    console.error('Generate mashup error:', error);
    logTelemetry({
      name: 'mashup.generate.failed',
      level: 'error',
      properties: { error: (error as Error)?.message },
    });
    const { reportError } = await import('@/lib/monitoring');
    reportError(error as Error, { scope: 'mashup.generate' });

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('quota')
    ) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: 'Failed to generate mashup' },
      { status: 500 }
    );
  }
}
