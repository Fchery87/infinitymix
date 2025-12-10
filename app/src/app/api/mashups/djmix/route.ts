import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { assertDurationQuota } from '@/lib/monetization';
import { generateMashupName } from '@/lib/utils/helpers';
import { logTelemetry, withTelemetry } from '@/lib/telemetry';
import { and, eq, inArray } from 'drizzle-orm';
import { renderAutoDjMix, planAutoDjMix } from '@/lib/audio/auto-dj-service';

const djMixSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(2),
  targetDurationSeconds: z.number().min(30).max(3600),
  targetBpm: z.number().min(60).max(200).optional(),
  transitionStyle: z.enum(['smooth', 'drop', 'energy', 'cut']).optional(),
  fadeDurationSeconds: z.number().min(0).max(20).optional(),
  energyMode: z.enum(['steady', 'build', 'wave']).optional(),
  keepOrder: z.boolean().optional(),
  preferStems: z.boolean().optional(),
  eventType: z.enum(['wedding', 'birthday', 'sweet16', 'club', 'default']).optional(),
  name: z.string().min(1).max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = djMixSchema.parse(body);

    const tracks = await db
      .select({
        id: uploadedTracks.id,
        analysisStatus: uploadedTracks.analysisStatus,
        hasStems: uploadedTracks.hasStems,
        bpm: uploadedTracks.bpm,
        camelotKey: uploadedTracks.camelotKey,
        durationSeconds: uploadedTracks.durationSeconds,
      })
      .from(uploadedTracks)
      .where(and(eq(uploadedTracks.userId, user.id), inArray(uploadedTracks.id, parsed.trackIds)));

    if (tracks.length !== parsed.trackIds.length) {
      return NextResponse.json({ error: 'Some tracks are missing or inaccessible' }, { status: 404 });
    }

    const unanalyzed = tracks.filter((t) => t.analysisStatus !== 'completed');
    if (unanalyzed.length > 0) {
      return NextResponse.json({ error: 'Some tracks are still being analyzed' }, { status: 400 });
    }

    await assertDurationQuota(user.id, parsed.targetDurationSeconds);

    const mashupName = parsed.name || generateMashupName();

    const [mashup] = await db
      .insert(mashups)
      .values({
        userId: user.id,
        name: mashupName,
        targetDurationSeconds: Math.round(parsed.targetDurationSeconds),
        generationStatus: 'pending',
        outputFormat: 'mp3',
        isPublic: false,
        mixMode: 'standard',
        targetBpm: parsed.targetBpm ? parsed.targetBpm.toString() : null,
        autoKeyMatch: false,
      })
      .returning();

    if (!mashup) {
      return NextResponse.json({ error: 'Failed to create mix job' }, { status: 500 });
    }

    const relations = parsed.trackIds.map((trackId) => ({ mashupId: mashup.id, uploadedTrackId: trackId }));
    await db.insert(mashupInputTracks).values(relations);

    const infoResults = await Promise.all(parsed.trackIds.map((id) => getTrackInfo(id)));
    const trackInfos = infoResults.filter(Boolean) as NonNullable<typeof infoResults[number]>[];

    if (trackInfos.length === 0) {
      return NextResponse.json({ error: 'No analysis info available for selected tracks' }, { status: 400 });
    }

    const plan = await planAutoDjMix(trackInfos, {
      trackIds: parsed.trackIds,
      targetDurationSeconds: parsed.targetDurationSeconds,
      targetBpm: parsed.targetBpm,
      transitionStyle: parsed.transitionStyle,
      fadeDurationSeconds: parsed.fadeDurationSeconds,
      energyMode: parsed.energyMode,
      keepOrder: parsed.keepOrder,
      preferStems: parsed.preferStems,
      eventType: parsed.eventType,
    });

    await db
      .update(mashups)
      .set({ recommendationContext: { plan, request: parsed } })
      .where(eq(mashups.id, mashup.id));

    void withTelemetry(
      'autoDj.render.start',
      () =>
        renderAutoDjMix(mashup.id, {
          trackIds: parsed.trackIds,
          targetDurationSeconds: parsed.targetDurationSeconds,
          targetBpm: parsed.targetBpm,
          transitionStyle: parsed.transitionStyle,
          fadeDurationSeconds: parsed.fadeDurationSeconds,
          energyMode: parsed.energyMode,
          keepOrder: parsed.keepOrder,
          preferStems: parsed.preferStems,
          eventType: parsed.eventType,
          plan,
        }),
      { mashupId: mashup.id }
    );

    logTelemetry({ name: 'autoDj.request.accepted', properties: { mashupId: mashup.id, trackCount: parsed.trackIds.length } });

    return NextResponse.json({
      id: mashup.id,
      name: mashup.name,
      status: mashup.generationStatus,
      duration_seconds: mashup.targetDurationSeconds,
      mix_mode: mashup.mixMode,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('Auto DJ mix error:', error);
    logTelemetry({ name: 'autoDj.request.failed', level: 'error', properties: { error: (error as Error)?.message } });
    return NextResponse.json({ error: 'Failed to start auto DJ mix' }, { status: 500 });
  }
}

async function getTrackInfo(trackId: string) {
  const { getTrackInfoForMixing } = await import('@/lib/audio/stems-service');
  return getTrackInfoForMixing(trackId);
}
