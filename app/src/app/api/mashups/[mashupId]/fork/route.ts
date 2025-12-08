import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest, { params }: { params: Promise<{ mashupId: string }> }) {
  const user = await getSessionUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mashupId } = await params;
  if (!mashupId) return NextResponse.json({ error: 'mashupId is required' }, { status: 400 });

  const [source] = await db
    .select({ id: mashups.id, targetDurationSeconds: mashups.targetDurationSeconds, userId: mashups.userId, name: mashups.name })
    .from(mashups)
    .where(eq(mashups.id, mashupId))
    .limit(1);

  if (!source) return NextResponse.json({ error: 'Source mashup not found' }, { status: 404 });

  const inputs = await db
    .select({ uploadedTrackId: mashupInputTracks.uploadedTrackId })
    .from(mashupInputTracks)
    .where(eq(mashupInputTracks.mashupId, mashupId));

  if (inputs.length === 0) return NextResponse.json({ error: 'No input tracks to fork' }, { status: 400 });

  // Ensure tracks belong to requester or are public mashup (we allow fork from public)
  const trackIds = inputs.map(t => t.uploadedTrackId);
  const owned = await db
    .select({ id: uploadedTracks.id })
    .from(uploadedTracks)
    .where(and(eq(uploadedTracks.userId, user.id), eq(uploadedTracks.id, trackIds[0])));
  const canFork = source.userId === user.id || owned.length > 0;
  if (!canFork) return NextResponse.json({ error: 'Not allowed to fork' }, { status: 403 });

  const [created] = await db
    .insert(mashups)
    .values({
      userId: user.id,
      name: `${source.name} (Remix)`,
      targetDurationSeconds: source.targetDurationSeconds,
      generationStatus: 'pending',
      outputFormat: 'mp3',
      parentMashupId: source.id,
      isPublic: false,
    })
    .returning({ id: mashups.id, name: mashups.name, parentMashupId: mashups.parentMashupId, targetDurationSeconds: mashups.targetDurationSeconds });

  if (!created) return NextResponse.json({ error: 'Failed to fork mashup' }, { status: 500 });

  const relations = trackIds.map(trackId => ({ mashupId: created.id, uploadedTrackId: trackId }));
  await db.insert(mashupInputTracks).values(relations);

  return NextResponse.json({
    id: created.id,
    parent_id: source.id,
    name: created.name,
  });
}
