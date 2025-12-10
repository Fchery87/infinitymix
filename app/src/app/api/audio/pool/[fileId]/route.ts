import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks, trackStems } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getStorage } from '@/lib/storage';
import { log } from '@/lib/logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      );
    }

    // Check if the file belongs to the current user
    const [track] = await db
      .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.id, fileId), eq(uploadedTracks.userId, user.id)))
      .limit(1);

    if (!track) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const storage = await getStorage();

    // Get all stems associated with this track before deletion
    const stems = await db
      .select({ id: trackStems.id, storageUrl: trackStems.storageUrl })
      .from(trackStems)
      .where(eq(trackStems.uploadedTrackId, fileId));

    // Delete stem files from R2
    for (const stem of stems) {
      if (stem.storageUrl) {
        try {
          await storage.deleteFile(stem.storageUrl);
          log('info', 'storage.delete.stem', { trackId: fileId, stemId: stem.id, url: stem.storageUrl });
        } catch (error) {
          log('warn', 'storage.delete.stem.failed', { 
            trackId: fileId, 
            stemId: stem.id, 
            url: stem.storageUrl,
            error: (error as Error).message 
          });
        }
      }
    }

    // Delete main track file from R2
    if (track.storageUrl) {
      try {
        await storage.deleteFile(track.storageUrl);
        log('info', 'storage.delete.track', { trackId: fileId, url: track.storageUrl });
      } catch (error) {
        log('warn', 'storage.delete.track.failed', { 
          trackId: fileId, 
          url: track.storageUrl,
          error: (error as Error).message 
        });
      }
    }

    // Delete from database (cascade will handle trackStems and mashupInputTracks)
    await db
      .delete(uploadedTracks)
      .where(and(eq(uploadedTracks.id, fileId), eq(uploadedTracks.userId, user.id)));

    log('info', 'track.deleted', { trackId: fileId, userId: user.id, stemsDeleted: stems.length });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete track error:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
