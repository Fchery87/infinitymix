import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks, trackStems } from '@/lib/db/schema';
import { generateMashupName } from '@/lib/utils/helpers';
import { logTelemetry, withTelemetry } from '@/lib/telemetry';
import { assertDurationQuota } from '@/lib/monetization';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { renderStemMashup } from '@/lib/audio/mixing-service';

const stemMashupSchema = z.object({
  vocalTrackId: z.string().uuid(),
  instrumentalTrackId: z.string().uuid(),
  targetBpm: z.number().min(60).max(200).optional(),
  autoKeyMatch: z.boolean().default(true),
  pitchShiftSemitones: z.number().min(-12).max(12).optional(),
  vocalVolume: z.number().min(0).max(1).optional(),
  instrumentalVolume: z.number().min(0).max(1).optional(),
  durationSeconds: z.number().min(30).max(600).optional(),
  name: z.string().min(1).max(255).optional(),
  beatAlign: z.boolean().default(true),
  beatAlignMode: z.enum(['downbeat', 'any']).default('downbeat'),
  crossfade: z
    .object({
      enabled: z.boolean(),
      duration: z.number().min(0).max(15).optional(),
      style: z.enum(['smooth', 'drop', 'cut', 'energy']).optional(),
      transitionAt: z.enum(['start', 'drop', 'chorus', 'auto']).optional(),
    })
    .optional(),
});

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
    const parsed = stemMashupSchema.parse(body);

    logTelemetry({
      name: 'stemMashup.generate.requested',
      properties: {
        userId: user.id,
        vocalTrackId: parsed.vocalTrackId,
        instrumentalTrackId: parsed.instrumentalTrackId,
        autoKeyMatch: parsed.autoKeyMatch,
      },
    });

    // Validate that both tracks belong to the user and are analyzed
    const trackIds = [parsed.vocalTrackId, parsed.instrumentalTrackId];
    const tracks = await db
      .select({
        id: uploadedTracks.id,
        analysisStatus: uploadedTracks.analysisStatus,
        hasStems: uploadedTracks.hasStems,
        bpm: uploadedTracks.bpm,
        camelotKey: uploadedTracks.camelotKey,
        durationSeconds: uploadedTracks.durationSeconds,
      })
      .from(uploadedTracks)
      .where(and(
        eq(uploadedTracks.userId, user.id),
        inArray(uploadedTracks.id, trackIds)
      ));

    if (tracks.length !== 2) {
      return NextResponse.json(
        { error: 'One or more tracks not found or not accessible' },
        { status: 404 }
      );
    }

    const unanalyzedTracks = tracks.filter(t => t.analysisStatus !== 'completed');
    if (unanalyzedTracks.length > 0) {
      return NextResponse.json(
        { error: 'Some tracks are still being analyzed' },
        { status: 400 }
      );
    }

    // Check that both tracks have stems generated
    const tracksWithoutStems = tracks.filter(t => !t.hasStems);
    if (tracksWithoutStems.length > 0) {
      return NextResponse.json(
        { error: 'Both tracks must have stems generated. Please generate stems first.' },
        { status: 400 }
      );
    }

    // Verify vocals exist for vocalTrackId
    const vocalStems = await db
      .select()
      .from(trackStems)
      .where(and(
        eq(trackStems.uploadedTrackId, parsed.vocalTrackId),
        eq(trackStems.stemType, 'vocals'),
        eq(trackStems.status, 'completed')
      ));

    if (vocalStems.length === 0) {
      return NextResponse.json(
        { error: 'No vocals stem found for the vocal track' },
        { status: 400 }
      );
    }

    // Verify instrumental/other exists for instrumentalTrackId
    const instStems = await db
      .select()
      .from(trackStems)
      .where(and(
        eq(trackStems.uploadedTrackId, parsed.instrumentalTrackId),
        eq(trackStems.stemType, 'other'),
        eq(trackStems.status, 'completed')
      ));

    if (instStems.length === 0) {
      return NextResponse.json(
        { error: 'No instrumental stem found for the instrumental track' },
        { status: 400 }
      );
    }

    // Calculate duration
    const vocalTrack = tracks.find(t => t.id === parsed.vocalTrackId);
    const instTrack = tracks.find(t => t.id === parsed.instrumentalTrackId);
    const durationSeconds = parsed.durationSeconds ?? Math.min(
      vocalTrack?.durationSeconds ? Number(vocalTrack.durationSeconds) : 180,
      instTrack?.durationSeconds ? Number(instTrack.durationSeconds) : 180,
      180
    );

    // Enforce plan quota
    await assertDurationQuota(user.id, durationSeconds);

    // Create mashup record with stem info
    const [mashup] = await db
      .insert(mashups)
      .values({
        userId: user.id,
        name: parsed.name || generateMashupName(),
        targetDurationSeconds: durationSeconds,
        generationStatus: 'pending',
        outputFormat: 'mp3',
        isPublic: false,
        mixMode: 'vocals_over_instrumental',
        vocalTrackId: parsed.vocalTrackId,
        instrumentalTrackId: parsed.instrumentalTrackId,
        targetBpm: parsed.targetBpm?.toString(),
        pitchShiftSemitones: parsed.pitchShiftSemitones ?? 0,
        autoKeyMatch: parsed.autoKeyMatch,
      })
      .returning({
        id: mashups.id,
        userId: mashups.userId,
        name: mashups.name,
        targetDurationSeconds: mashups.targetDurationSeconds,
        generationStatus: mashups.generationStatus,
        outputFormat: mashups.outputFormat,
        isPublic: mashups.isPublic,
        mixMode: mashups.mixMode,
        vocalTrackId: mashups.vocalTrackId,
        instrumentalTrackId: mashups.instrumentalTrackId,
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
      });

    if (!mashup) {
      return NextResponse.json({ error: 'Failed to create mashup' }, { status: 500 });
    }

    // Link mashup to input tracks (for compatibility with existing queries)
    const trackRelations = trackIds.map(trackId => ({
      mashupId: mashup.id,
      uploadedTrackId: trackId,
    }));
    await db.insert(mashupInputTracks).values(trackRelations);

    // Start async stem mashup generation
    void withTelemetry(
      'stemMashup.generate.render',
      () => renderStemMashup(mashup.id, {
        vocalTrackId: parsed.vocalTrackId,
        instrumentalTrackId: parsed.instrumentalTrackId,
        targetBpm: parsed.targetBpm,
        autoKeyMatch: parsed.autoKeyMatch,
        pitchShiftSemitones: parsed.pitchShiftSemitones,
        vocalVolume: parsed.vocalVolume,
        instrumentalVolume: parsed.instrumentalVolume,
        durationSeconds,
        beatAlign: parsed.beatAlign,
        beatAlignMode: parsed.beatAlignMode,
        crossfade: parsed.crossfade,
      }),
      {
        mashupId: mashup.id,
        vocalTrackId: parsed.vocalTrackId,
        instrumentalTrackId: parsed.instrumentalTrackId,
      }
    );

    logTelemetry({
      name: 'stemMashup.generate.accepted',
      properties: {
        mashupId: mashup.id,
        userId: user.id,
        durationSeconds,
        latencyMs: Date.now() - requestStarted,
      },
    });

    return NextResponse.json({
      id: mashup.id,
      name: mashup.name,
      user_id: mashup.userId,
      duration_seconds: mashup.targetDurationSeconds,
      status: mashup.generationStatus,
      output_path: null,
      output_format: mashup.outputFormat,
      mix_mode: mashup.mixMode,
      vocal_track_id: mashup.vocalTrackId,
      instrumental_track_id: mashup.instrumentalTrackId,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    });
  } catch (error) {
    console.error('Stem mashup generate error:', error);
    logTelemetry({ name: 'stemMashup.generate.failed', level: 'error', properties: { error: (error as Error)?.message } });
    const { reportError } = await import('@/lib/monitoring');
    reportError(error as Error, { scope: 'stemMashup.generate' });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.toLowerCase().includes('quota')) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { error: 'Failed to generate stem mashup' },
      { status: 500 }
    );
  }
}
