import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
});

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const targetMashups = await db
      .select({
        id: mashups.id,
        outputStorageUrl: mashups.outputStorageUrl,
        publicPlaybackUrl: mashups.publicPlaybackUrl,
        previewStorageUrl: mashups.previewStorageUrl,
      })
      .from(mashups)
      .where(and(eq(mashups.userId, user.id), inArray(mashups.id, parsed.data.ids)));

    const { getStorage } = await import('@/lib/storage');
    const { log } = await import('@/lib/logger');
    const storage = await getStorage();

    const deleted: string[] = [];
    for (const mashup of targetMashups) {
      for (const url of [mashup.outputStorageUrl, mashup.publicPlaybackUrl, mashup.previewStorageUrl]) {
        if (url) {
          try {
            await storage.deleteFile(url);
          } catch {
            log('warn', 'storage.delete.batch.failed', { mashupId: mashup.id, url });
          }
        }
      }
      await db.delete(mashups).where(eq(mashups.id, mashup.id));
      deleted.push(mashup.id);
    }

    log('info', 'mashups.batch_deleted', { count: deleted.length, userId: user.id });

    return NextResponse.json({ deleted, count: deleted.length });
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json({ error: 'Failed to delete mashups' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { isPublic } = body;
    if (typeof isPublic !== 'boolean') {
      return NextResponse.json({ error: 'isPublic boolean required' }, { status: 400 });
    }

    const updated = await db
      .update(mashups)
      .set({
        isPublic,
        publicSlug: isPublic ? crypto.randomUUID().slice(0, 8) : null,
      })
      .where(and(eq(mashups.userId, user.id), inArray(mashups.id, parsed.data.ids)))
      .returning({ id: mashups.id, isPublic: mashups.isPublic, publicSlug: mashups.publicSlug });

    return NextResponse.json({ updated, count: updated.length });
  } catch (error) {
    console.error('Batch visibility error:', error);
    return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
  }
}
