import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { trackStems, uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stemId: string }> }
) {
  try {
    const { stemId } = await params;
    const user = await getSessionUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get stem and verify ownership
    const [stem] = await db
      .select({
        id: trackStems.id,
        storageUrl: trackStems.storageUrl,
        stemType: trackStems.stemType,
        uploadedTrackId: trackStems.uploadedTrackId,
      })
      .from(trackStems)
      .where(eq(trackStems.id, stemId))
      .limit(1);

    if (!stem || !stem.storageUrl) {
      return NextResponse.json({ error: 'Stem not found' }, { status: 404 });
    }

    // Verify user owns the track
    const [track] = await db
      .select({ id: uploadedTracks.id })
      .from(uploadedTracks)
      .where(and(
        eq(uploadedTracks.id, stem.uploadedTrackId),
        eq(uploadedTracks.userId, user.id)
      ))
      .limit(1);

    if (!track) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch the audio file from storage
    const storage = await getStorage();
    if (!storage.getFile) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const file = await storage.getFile(stem.storageUrl);
    if (!file) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    // Return audio with proper headers
    return new NextResponse(file.buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'audio/mpeg',
        'Content-Length': file.buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Stream stem error:', error);
    return NextResponse.json({ error: 'Failed to stream audio' }, { status: 500 });
  }
}
