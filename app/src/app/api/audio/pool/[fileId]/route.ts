import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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
    const track = await db
      .select({ id: uploadedTracks.id, storageUrl: uploadedTracks.storageUrl })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.id, fileId), eq(uploadedTracks.userId, user.id)))
      .limit(1);

    if (track.length === 0) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // TODO: Delete file from cloud storage
    // await deleteFromCloudStorage(track[0].storageUrl);

    // Delete from database
    await db
      .delete(uploadedTracks)
      .where(and(eq(uploadedTracks.id, fileId), eq(uploadedTracks.userId, user.id)));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete track error:', error);
    return NextResponse.json(
      { error: 'Failed to delete track' },
      { status: 500 }
    );
  }
}
