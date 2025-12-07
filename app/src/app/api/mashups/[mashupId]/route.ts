import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { mashupId: string } }
) {
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

    const { mashupId } = params;

    // Get mashup details including input tracks
    const [mashup] = await db
      .select({
        id: mashups.id,
        userId: mashups.userId,
        name: mashups.name,
        targetDurationSeconds: mashups.targetDurationSeconds,
        generationStatus: mashups.generationStatus,
        outputStorageUrl: mashups.outputStorageUrl,
        outputFormat: mashups.outputFormat,
        generationTimeMs: mashups.generationTimeMs,
        playbackCount: mashups.playbackCount,
        downloadCount: mashups.downloadCount,
        createdAt: mashups.createdAt,
        updatedAt: mashups.updatedAt,
      })
      .from(mashups)
      .where(and(
        eq(mashups.id, mashupId),
        eq(mashups.userId, session.user.id)
      ));

    if (!mashup) {
      return NextResponse.json(
        { error: 'Mashup not found' },
        { status: 404 }
      );
    }

    // Get input tracks for this mashup
    const inputTracks = await db
      .select({
        id: uploadedTracks.id,
        originalFilename: uploadedTracks.originalFilename,
        bpm: uploadedTracks.bpm,
        keySignature: uploadedTracks.keySignature,
      })
      .from(mashupInputTracks)
      .innerJoin(uploadedTracks, eq(mashupInputTracks.uploadedTrackId, uploadedTracks.id))
      .where(eq(mashupInputTracks.mashupId, mashupId));

    return NextResponse.json({
      id: mashup.id,
      user_id: mashup.userId,
      name: mashup.name,
      duration_seconds: mashup.targetDurationSeconds,
      status: mashup.generationStatus,
      output_path: mashup.outputStorageUrl,
      output_format: mashup.outputFormat,
      generation_time_ms: mashup.generationTimeMs,
      playback_count: mashup.playbackCount,
      download_count: mashup.downloadCount,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
      input_tracks: inputTracks,
    });
  } catch (error) {
    console.error('Get mashup error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve mashup' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { mashupId: string } }
) {
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

    const { mashupId } = params;

    // Check if mashup exists and belongs to user
    const [mashup] = await db
      .select({ id: mashups.id, outputStorageUrl: mashups.outputStorageUrl })
      .from(mashups)
      .where(and(
        eq(mashups.id, mashupId),
        eq(mashups.userId, session.user.id)
      ));

    if (!mashup) {
      return NextResponse.json(
        { error: 'Mashup not found' },
        { status: 404 }
      );
    }

    // TODO: Delete file from cloud storage if it exists
    // if (mashup.outputStorageUrl) {
    //   await deleteFromCloudStorage(mashup.outputStorageUrl);
    // }

    // Delete mashup (cascade will delete related records)
    await db
      .delete(mashups)
      .where(and(
        eq(mashups.id, mashupId),
        eq(mashups.userId, session.user.id)
      ));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete mashup error:', error);
    return NextResponse.json(
      { error: 'Failed to delete mashup' },
      { status: 500 }
    );
  }
}
