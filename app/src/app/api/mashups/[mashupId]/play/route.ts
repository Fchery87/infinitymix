import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { logTelemetry } from '@/lib/telemetry';

export async function POST(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any
) {
  try {
    const { params } = context || {};
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const mashupId = params?.mashupId;

    if (!mashupId) {
      return NextResponse.json({ error: 'Mashup ID is required' }, { status: 400 });
    }

    const [mashup] = await db
      .select({ id: mashups.id, generationStatus: mashups.generationStatus, outputStorageUrl: mashups.outputStorageUrl })
      .from(mashups)
      .where(and(eq(mashups.id, mashupId), eq(mashups.userId, session.user.id)));

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
        userId: session.user.id,
        playbackCount: updated.playbackCount,
      },
    });

    return NextResponse.json({ playback_count: updated.playbackCount });
  } catch (error) {
    console.error('Playback increment error:', error);
    logTelemetry({ name: 'mashup.play.failed', level: 'error', properties: { error: (error as Error)?.message } });
    return NextResponse.json({ error: 'Failed to record playback' }, { status: 500 });
  }
}
