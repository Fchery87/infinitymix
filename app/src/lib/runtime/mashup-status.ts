import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mashupInputTracks, mashups, uploadedTracks } from '@/lib/db/schema';
import { getLatestAutomationJobForResource } from '@/lib/runtime/jobs';

export type MashupStatusResponse = {
  id: string;
  user_id: string;
  name: string;
  duration_seconds: number | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  playback_path: string | null;
  output_format: string | null;
  playback_format: string;
  generation_time_ms: number | null;
  render_qa: unknown;
  playback_count: number;
  download_count: number;
  latest_automation_job: Awaited<ReturnType<typeof getLatestAutomationJobForResource>>;
  created_at: Date;
  updated_at: Date;
  input_tracks: Array<{
    id: string;
    originalFilename: string;
    bpm: string | null;
    keySignature: string | null;
  }>;
};

export async function getMashupStatusForUser(args: {
  mashupId: string;
  userId: string;
}): Promise<MashupStatusResponse | null> {
  const [mashup] = await db
    .select({
      id: mashups.id,
      userId: mashups.userId,
      name: mashups.name,
      targetDurationSeconds: mashups.targetDurationSeconds,
      generationStatus: mashups.generationStatus,
      outputStorageUrl: mashups.outputStorageUrl,
      publicPlaybackUrl: mashups.publicPlaybackUrl,
      outputFormat: mashups.outputFormat,
      generationTimeMs: mashups.generationTimeMs,
      recommendationContext: mashups.recommendationContext,
      playbackCount: mashups.playbackCount,
      downloadCount: mashups.downloadCount,
      createdAt: mashups.createdAt,
      updatedAt: mashups.updatedAt,
    })
    .from(mashups)
    .where(and(eq(mashups.id, args.mashupId), eq(mashups.userId, args.userId)))
    .limit(1);

  if (!mashup) {
    return null;
  }

  const inputTracks = await db
    .select({
      id: uploadedTracks.id,
      originalFilename: uploadedTracks.originalFilename,
      bpm: uploadedTracks.bpm,
      keySignature: uploadedTracks.keySignature,
    })
    .from(mashupInputTracks)
    .innerJoin(uploadedTracks, eq(mashupInputTracks.uploadedTrackId, uploadedTracks.id))
    .where(eq(mashupInputTracks.mashupId, args.mashupId));

  const latestAutomationJob = await getLatestAutomationJobForResource('mashup', args.mashupId);

  return {
    id: mashup.id,
    user_id: mashup.userId,
    name: mashup.name,
    duration_seconds: mashup.targetDurationSeconds,
    status: mashup.generationStatus,
    output_path: mashup.outputStorageUrl,
    playback_path: mashup.publicPlaybackUrl,
    output_format: mashup.outputFormat,
    playback_format:
      mashup.recommendationContext && typeof mashup.recommendationContext === 'object'
        ? (
            ((mashup.recommendationContext as Record<string, unknown>).outputVariants as
              | { playback?: { format?: string } }
              | undefined)?.playback?.format ?? 'mp3'
          )
        : 'mp3',
    generation_time_ms: mashup.generationTimeMs,
    render_qa:
      mashup.recommendationContext && typeof mashup.recommendationContext === 'object'
        ? (mashup.recommendationContext as Record<string, unknown>).renderQa ?? null
        : null,
    playback_count: mashup.playbackCount,
    download_count: mashup.downloadCount,
    latest_automation_job: latestAutomationJob,
    created_at: mashup.createdAt,
    updated_at: mashup.updatedAt,
    input_tracks: inputTracks,
  };
}
