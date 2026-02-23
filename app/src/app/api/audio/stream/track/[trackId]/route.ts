import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { getStorage } from '@/lib/storage';
import { and, eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const user = await getSessionUser(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [track] = await db
      .select({
        id: uploadedTracks.id,
        storageUrl: uploadedTracks.storageUrl,
        mimeType: uploadedTracks.mimeType,
      })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.id, trackId), eq(uploadedTracks.userId, user.id)))
      .limit(1);

    if (!track?.storageUrl) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const storage = await getStorage();
    if (!storage.getFile) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
    }

    const file = await storage.getFile(track.storageUrl);
    if (!file) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    return new NextResponse(file.buffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || track.mimeType || 'audio/mpeg',
        'Content-Length': file.buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Stream track error:', error);
    return NextResponse.json({ error: 'Failed to stream track audio' }, { status: 500 });
  }
}
