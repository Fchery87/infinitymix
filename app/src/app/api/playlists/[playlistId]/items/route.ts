import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { playlists, playlistItems, mashups } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';

const addItemSchema = z.object({
  mashupId: z.string().uuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, user.id)));

    if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

    const items = await db
      .select({
        id: playlistItems.id,
        sortOrder: playlistItems.sortOrder,
        createdAt: playlistItems.createdAt,
        mashup: {
          id: mashups.id,
          name: mashups.name,
          generationStatus: mashups.generationStatus,
          playbackCount: mashups.playbackCount,
          downloadCount: mashups.downloadCount,
          createdAt: mashups.createdAt,
        },
      })
      .from(playlistItems)
      .innerJoin(mashups, eq(playlistItems.mashupId, mashups.id))
      .where(eq(playlistItems.playlistId, playlistId))
      .orderBy(asc(playlistItems.sortOrder));

    return NextResponse.json({ ...playlist, items });
  } catch (error) {
    console.error('Get playlist items error:', error);
    return NextResponse.json({ error: 'Failed to get playlist items' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [playlist] = await db
      .select()
      .from(playlists)
      .where(and(eq(playlists.id, playlistId), eq(playlists.userId, user.id)));

    if (!playlist) return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });

    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const [mashup] = await db
      .select({ id: mashups.id })
      .from(mashups)
      .where(and(eq(mashups.id, parsed.data.mashupId), eq(mashups.userId, user.id)));

    if (!mashup) return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });

    const existingItems = await db
      .select({ sortOrder: playlistItems.sortOrder })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId))
      .orderBy(asc(playlistItems.sortOrder));

    const nextOrder = existingItems.length > 0
      ? Math.max(...existingItems.map((i) => i.sortOrder)) + 1
      : 0;

    const [item] = await db
      .insert(playlistItems)
      .values({
        playlistId,
        mashupId: parsed.data.mashupId,
        sortOrder: nextOrder,
      })
      .returning();

    await db
      .update(playlists)
      .set({ updatedAt: new Date() })
      .where(eq(playlists.id, playlistId));

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Add playlist item error:', error);
    return NextResponse.json({ error: 'Failed to add item to playlist' }, { status: 500 });
  }
}
