import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { mashupGenerateSchema } from '@/lib/utils/validation';
import { generateMashupName } from '@/lib/utils/helpers';
import { renderMashup } from '@/lib/audio/mixing-service';
import { eq, and, inArray } from 'drizzle-orm';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { inputFileIds, durationPreset } = mashupGenerateSchema.parse(body);

    // Validate that all input files belong to the user and are analyzed
    const tracks = await db
      .select({
        id: uploadedTracks.id,
        analysisStatus: uploadedTracks.analysisStatus,
        bpm: uploadedTracks.bpm,
        keySignature: uploadedTracks.keySignature,
      })
      .from(uploadedTracks)
      .where(and(
        eq(uploadedTracks.userId, session.user.id),
        inArray(uploadedTracks.id, inputFileIds)
      ));

    if (tracks.length !== inputFileIds.length) {
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

    // Map duration preset to seconds
    const durationMap = {
      '1_minute': 60,
      '2_minutes': 120,
      '3_minutes': 180,
    };
    const durationSeconds = durationMap[durationPreset as keyof typeof durationMap];

    // Create mashup record
    const [mashup] = await db
      .insert(mashups)
      .values({
        userId: session.user.id,
        name: generateMashupName(),
        targetDurationSeconds: durationSeconds,
        generationStatus: 'pending',
        outputFormat: 'mp3',
      })
      .returning();

    // Link mashup to input tracks
    const trackRelations = inputFileIds.map(trackId => ({
      mashupId: mashup.id,
      uploadedTrackId: trackId,
    }));

    await db.insert(mashupInputTracks).values(trackRelations);

    // Start async generation process
    void renderMashup(mashup.id, inputFileIds, durationSeconds);

    return NextResponse.json({
      id: mashup.id,
      user_id: mashup.userId,
      duration_seconds: mashup.targetDurationSeconds,
      status: mashup.generationStatus,
      output_path: null,
      output_format: mashup.outputFormat,
      generation_time_ms: null,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    });
  } catch (error) {
    console.error('Generate mashup error:', error);
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate mashup' },
      { status: 500 }
    );
  }
}
