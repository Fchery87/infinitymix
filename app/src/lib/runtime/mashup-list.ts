import { count, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getLatestAutomationJobsForResources } from '@/lib/runtime/jobs';

export type MashupListItem = {
  id: string;
  user_id: string;
  duration_seconds: number;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  output_path: string | null;
  playback_path: string | null;
  output_format: string | null;
  playback_format: string;
  generation_time_ms: number | null;
  render_qa: unknown;
  playback_count: number;
  download_count: number;
  latest_automation_job: ReturnType<typeof getLatestAutomationJobsForResources> extends Promise<infer T>
    ? T extends Map<string, infer V>
      ? V | null
      : null
    : null;
  is_public: boolean | null;
  public_slug: string | null;
  parent_mashup_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type MashupListResponse = {
  page: number;
  limit: number;
  total: number;
  data: MashupListItem[];
};

export async function getMashupListForUser(args: {
  userId: string;
  page: number;
  limit: number;
}): Promise<MashupListResponse> {
  const offset = (args.page - 1) * args.limit;

  const [totalCount] = await db
    .select({ count: count() })
    .from(mashups)
    .where(eq(mashups.userId, args.userId));

  const userMashups = await db
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
      isPublic: mashups.isPublic,
      publicSlug: mashups.publicSlug,
      parentMashupId: mashups.parentMashupId,
      createdAt: mashups.createdAt,
      updatedAt: mashups.updatedAt,
    })
    .from(mashups)
    .where(eq(mashups.userId, args.userId))
    .orderBy(desc(mashups.createdAt))
    .limit(args.limit)
    .offset(offset);

  const latestJobs = await getLatestAutomationJobsForResources(
    'mashup',
    userMashups.map((mashup) => mashup.id)
  );

  return {
    page: args.page,
    limit: args.limit,
    total: totalCount.count,
    data: userMashups.map((mashup) => ({
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
      latest_automation_job: latestJobs.get(mashup.id) ?? null,
      is_public: mashup.isPublic,
      public_slug: mashup.publicSlug,
      parent_mashup_id: mashup.parentMashupId,
      created_at: mashup.createdAt,
      updated_at: mashup.updatedAt,
    })),
  };
}
