import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { logTelemetry } from '@/lib/telemetry';
import { log } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mashupId: string }> }
) {
  try {
    const { mashupId } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!mashupId) {
      return NextResponse.json({ error: 'Mashup ID is required' }, { status: 400 });
    }

    const [mashup] = await db
      .select({ id: mashups.id, generationStatus: mashups.generationStatus, outputStorageUrl: mashups.outputStorageUrl })
      .from(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, user.id)));

    if (!mashup) {
      return NextResponse.json({ error: 'Mashup not found' }, { status: 404 });
    }

    if (mashup.generationStatus !== 'completed' || !mashup.outputStorageUrl) {
      return NextResponse.json({ error: 'Mashup not ready for playback' }, { status: 409 });
    }

    const [updated] = await db
      .update(mashups)
      .set({
        playbackCount: sql`${mashups.playbackCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(mashups.id, mashupId))
      .returning({ playbackCount: mashups.playbackCount });

    logTelemetry({
      name: 'mashup.play',
      properties: {
        mashupId,
        userId: user.id,
        playbackCount: updated.playbackCount,
      },
    });
    log('info', 'mashup.play', { mashupId, userId: user.id, playbackCount: updated.playbackCount });

    return NextResponse.json({ playback_count: updated.playbackCount });
  } catch (error) {
    console.error('Playback increment error:', error);
    logTelemetry({ name: 'mashup.play.failed', level: 'error', properties: { error: (error as Error)?.message } });
    return NextResponse.json({ error: 'Failed to record playback' }, { status: 500 });
  }
}
