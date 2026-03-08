import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getMashupStatusForUser } from '@/lib/runtime/mashup-status';
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

    const mashup = await getMashupStatusForUser({ mashupId, userId: user.id });
    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

    return NextResponse.json(mashup);
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
      .select({ 
        id: mashups.id, 
        outputStorageUrl: mashups.outputStorageUrl,
        publicPlaybackUrl: mashups.publicPlaybackUrl,
        previewStorageUrl: mashups.previewStorageUrl,
      })
      .from(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

    // Delete files from R2 storage
    const { getStorage } = await import('@/lib/storage');
    const { log } = await import('@/lib/logger');
    const storage = await getStorage();

    // Delete output file from R2
    if (mashup.outputStorageUrl) {
      try {
        await storage.deleteFile(mashup.outputStorageUrl);
        log('info', 'storage.delete.mashup.output', { mashupId, url: mashup.outputStorageUrl });
      } catch (error) {
        log('warn', 'storage.delete.mashup.output.failed', { 
          mashupId, 
          url: mashup.outputStorageUrl,
          error: (error as Error).message 
        });
      }
    }

    if (mashup.publicPlaybackUrl) {
      try {
        await storage.deleteFile(mashup.publicPlaybackUrl);
        log('info', 'storage.delete.mashup.playback', {
          mashupId,
          url: mashup.publicPlaybackUrl,
        });
      } catch (error) {
        log('warn', 'storage.delete.mashup.playback.failed', {
          mashupId,
          url: mashup.publicPlaybackUrl,
          error: (error as Error).message,
        });
      }
    }

    // Delete preview file from R2 (if exists)
    if (mashup.previewStorageUrl) {
      try {
        await storage.deleteFile(mashup.previewStorageUrl);
        log('info', 'storage.delete.mashup.preview', { mashupId, url: mashup.previewStorageUrl });
      } catch (error) {
        log('warn', 'storage.delete.mashup.preview.failed', { 
          mashupId, 
          url: mashup.previewStorageUrl,
          error: (error as Error).message 
        });
      }
    }

    // Delete from database (cascade will handle mashupInputTracks, playbackSurveys, etc.)
    await db
      .delete(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    log('info', 'mashup.deleted', { mashupId, userId: user.id });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Delete mashup error:', error);
    return NextResponse.json({ error: 'Failed to delete mashup' }, { status: 500 });
  }
}
