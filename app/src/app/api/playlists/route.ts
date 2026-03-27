import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { playlists, playlistItems, mashups } from '@/lib/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { z } from 'zod';

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userPlaylists = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        description: playlists.description,
        isPublic: playlists.isPublic,
        createdAt: playlists.createdAt,
        updatedAt: playlists.updatedAt,
      })
      .from(playlists)
      .where(eq(playlists.userId, user.id))
      .orderBy(desc(playlists.updatedAt));

    const withCounts = await Promise.all(
      userPlaylists.map(async (playlist) => {
        const items = await db
          .select({ id: playlistItems.id })
          .from(playlistItems)
          .where(eq(playlistItems.playlistId, playlist.id));
        return { ...playlist, itemCount: items.length };
      })
    );

    return NextResponse.json({ playlists: withCounts });
  } catch (error) {
    console.error('Get playlists error:', error);
    return NextResponse.json({ error: 'Failed to get playlists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = createPlaylistSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const [playlist] = await db
      .insert(playlists)
      .values({
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        isPublic: parsed.data.isPublic ?? false,
      })
      .returning();

    return NextResponse.json(playlist, { status: 201 });
  } catch (error) {
    console.error('Create playlist error:', error);
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}
