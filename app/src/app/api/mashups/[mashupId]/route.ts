import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  try {
    const { mashupId } = await params;
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!mashupId) return NextResponse.json({ error: 'Mashup ID is required' }, { status: 400 });

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
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

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
    return NextResponse.json({ error: 'Failed to retrieve mashup' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  try {
    const { mashupId } = await params;
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!mashupId) return NextResponse.json({ error: 'Mashup ID is required' }, { status: 400 });

    const [mashup] = await db
      .select({ id: mashups.id, outputStorageUrl: mashups.outputStorageUrl })
      .from(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

    await db
      .delete(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete mashup error:', error);
    return NextResponse.json({ error: 'Failed to delete mashup' }, { status: 500 });
  }
}
