import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { mashups, mashupInputTracks, uploadedTracks } from '@/lib/db/schema';
import { assertDurationQuota } from '@/lib/monetization';
import { generateMashupName } from '@/lib/utils/helpers';
import { logTelemetry, withTelemetry } from '@/lib/telemetry';
import { and, eq, inArray } from 'drizzle-orm';
import { renderAutoDjMix, planAutoDjMix, AutoDjTransitionStyle, AutoDjEnergyMode, AutoDjEventType } from '@/lib/audio/auto-dj-service';

/**
 * GET endpoint - Return available transition styles and configuration
 */
export async function GET() {
  return NextResponse.json({
    transitionStyles: [
      {
        id: 'smooth',
        name: 'Smooth Crossfade',
        description: 'Standard linear crossfade for seamless blending',
        category: 'basic',
      },
      {
        id: 'drop',
        name: 'Drop Cut',
        description: 'Quick cut synced to the drop of the incoming track',
        category: 'basic',
      },
      {
        id: 'cut',
        name: 'Quick Cut',
        description: 'Instant cut between tracks',
        category: 'basic',
      },
      {
        id: 'energy',
        name: 'Energy Crossfade',
        description: 'Sine curve crossfade for energetic blends',
        category: 'basic',
      },
      {
        id: 'filter_sweep',
        name: 'Filter Sweep',
        description: 'Highpass to lowpass frequency sweep for dramatic effect',
        category: 'advanced',
      },
      {
        id: 'echo_reverb',
        name: 'Echo + Reverb',
        description: 'Echo out the first track while bringing in the second',
        category: 'advanced',
      },
      {
        id: 'backspin',
        name: 'Backspin Effect',
        description: 'Reverse the first track then spin into the second',
        category: 'advanced',
      },
      {
        id: 'tape_stop',
        name: 'Tape Stop',
        description: 'Slow down the first track like a tape stopping',
        category: 'advanced',
      },
      {
        id: 'stutter_edit',
        name: 'Stutter Edit',
        description: 'Rhythmic stutters on the first track before transition',
        category: 'advanced',
      },
      {
        id: 'three_band_swap',
        name: 'Three-Band Swap',
        description: 'Swap low/mid/high frequency ranges between tracks',
        category: 'stem',
      },
      {
        id: 'bass_drop',
        name: 'Bass Drop',
        description: 'Drop the bass on transition for impact',
        category: 'advanced',
      },
      {
        id: 'snare_roll',
        name: 'Snare Roll',
        description: 'Build tension with snare rolls before transition',
        category: 'advanced',
      },
      {
        id: 'noise_riser',
        name: 'Noise Riser',
        description: 'White noise riser leading into the drop',
        category: 'advanced',
      },
    ] as const,
    energyModes: [
      { id: 'steady', name: 'Steady', description: 'Consistent energy throughout' },
      { id: 'build', name: 'Build', description: 'Gradually increase energy' },
      { id: 'wave', name: 'Wave', description: 'Energy rises and falls in waves' },
    ] as const,
    eventTypes: [
      { id: 'wedding', name: 'Wedding', description: 'Smooth, long transitions for weddings' },
      { id: 'birthday', name: 'Birthday', description: 'Energetic, fun transitions' },
      { id: 'sweet16', name: 'Sweet 16', description: 'Pop-friendly, energetic transitions' },
      { id: 'club', name: 'Club', description: 'High energy, quick transitions' },
      { id: 'default', name: 'Default', description: 'Standard mixing approach' },
    ] as const,
    processingOptions: [
      {
        id: 'enableMultibandCompression',
        name: 'Multiband Compression',
        description: 'Split audio into 3 bands with individual compression',
        category: 'dynamics',
      },
      {
        id: 'enableSidechainDucking',
        name: 'Sidechain Ducking',
        description: 'Duck vocals during transitions for cleaner blends',
        category: 'dynamics',
      },
      {
        id: 'enableDynamicEQ',
        name: 'Dynamic EQ',
        description: 'Automatic frequency masking prevention',
        category: 'equalization',
      },
      {
        id: 'loudnessNormalization',
        name: 'Loudness Normalization',
        description: 'EBU R128 or peak normalization',
        category: 'mastering',
        options: ['ebu_r128', 'peak', 'none'],
      },
      {
        id: 'enableFilterSweep',
        name: 'Filter Sweep',
        description: 'Dynamic highpass sweep for transitions',
        category: 'effects',
      },
      {
        id: 'tempoRampSeconds',
        name: 'Tempo Ramp',
        description: 'Smooth tempo transition duration (0-10 seconds)',
        category: 'timing',
      },
    ] as const,
    loudnessTargets: {
      spotify: -14,
      apple_music: -16,
      youtube: -14,
      youtube_music: -14,
      pandora: -16,
      ebu_r128: -23,
      broadcast: -23,
    },
  });
}

const djMixSchema = z.object({
  trackIds: z.array(z.string().uuid()).min(2),
  targetDurationSeconds: z.number().min(30).max(3600),
  targetBpm: z.number().min(60).max(200).optional(),
  transitionStyle: z.enum([
    'smooth', 'drop', 'energy', 'cut',
    'filter_sweep', 'echo_reverb', 'backspin',
    'tape_stop', 'stutter_edit', 'three_band_swap',
    'bass_drop', 'snare_roll', 'noise_riser',
  ]).optional(),
  fadeDurationSeconds: z.number().min(0).max(20).optional(),
  energyMode: z.enum(['steady', 'build', 'wave']).optional(),
  keepOrder: z.boolean().optional(),
  preferStems: z.boolean().optional(),
  eventType: z.enum(['wedding', 'birthday', 'sweet16', 'club', 'default']).optional(),
  name: z.string().min(1).max(255).optional(),
  
  // New advanced processing options
  enableMultibandCompression: z.boolean().optional(),
  enableSidechainDucking: z.boolean().optional(),
  enableDynamicEQ: z.boolean().optional(),
  loudnessNormalization: z.enum(['ebu_r128', 'peak', 'none']).optional(),
  targetLoudness: z.number().min(-70).max(-5).optional(),
  enableFilterSweep: z.boolean().optional(),
  tempoRampSeconds: z.number().min(0).max(10).optional(),
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
      enableFilterSweep: parsed.enableFilterSweep,
      tempoRampSeconds: parsed.tempoRampSeconds,
      enableMultibandCompression: parsed.enableMultibandCompression,
      enableSidechainDucking: parsed.enableSidechainDucking,
      enableDynamicEQ: parsed.enableDynamicEQ,
      loudnessNormalization: parsed.loudnessNormalization,
      targetLoudness: parsed.targetLoudness,
    });

    await db
      .update(mashups)
      .set({ recommendationContext: { plan, request: parsed } })
      .where(eq(mashups.id, mashup.id));

    (async () => {
      try {
        await withTelemetry(
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
              enableMultibandCompression: parsed.enableMultibandCompression,
              enableSidechainDucking: parsed.enableSidechainDucking,
              enableDynamicEQ: parsed.enableDynamicEQ,
              loudnessNormalization: parsed.loudnessNormalization,
              targetLoudness: parsed.targetLoudness,
              enableFilterSweep: parsed.enableFilterSweep,
              tempoRampSeconds: parsed.tempoRampSeconds,
            }),
          { mashupId: mashup.id }
        );
      } catch (error) {
        console.error('Auto DJ mix render error:', error);
        await db
          .update(mashups)
          .set({ 
            generationStatus: 'failed',
            updatedAt: new Date() 
          })
          .where(eq(mashups.id, mashup.id));
        logTelemetry({ 
          name: 'autoDj.render.failed', 
          properties: { mashupId: mashup.id, error: (error as Error).message } 
        });
      }
    })();

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
