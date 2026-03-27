import { count, desc, eq, like, and, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mashups } from '@/lib/db/schema';
import { getLatestAutomationJobsForResources } from '@/lib/runtime/jobs';

export type MashupListItem = {
  id: string;
  user_id: string;
  name: string;
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
  data: MashupListItem[];
  nextCursor: string | null;
  total: number;
};

export type MashupListParams = {
  userId: string;
  cursor?: string;
  limit?: number;
  search?: string;
  status?: 'all' | 'completed' | 'in-progress';
};

export async function getMashupListForUser(
  args: MashupListParams
): Promise<MashupListResponse> {
  const limit = Math.min(50, Math.max(1, args.limit ?? 25));
  const search = args.search?.trim();
  const status = args.status;

  const conditions: ReturnType<typeof eq>[] = [eq(mashups.userId, args.userId)];

  if (search) {
    conditions.push(like(mashups.name, `%${search}%`));
  }

  let whereClause;

  if (status === 'completed') {
    whereClause = and(...conditions, eq(mashups.generationStatus, 'completed' as const)) ?? undefined;
  } else if (status === 'in-progress') {
    whereClause = and(...conditions, or(eq(mashups.generationStatus, 'pending' as const), eq(mashups.generationStatus, 'generating' as const))) ?? undefined;
  } else {
    whereClause = and(...conditions) ?? undefined;
  }

  const [totalCount] = await db
    .select({ count: count() })
    .from(mashups)
    .where(whereClause ?? undefined);

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
    .where(
      args.cursor && whereClause
        ? and(whereClause, lt(mashups.id, args.cursor as string))
        : whereClause
    )
    .orderBy(desc(mashups.id))
    .limit(limit + 1);

  const hasMore = userMashups.length > limit;
  const data = hasMore ? userMashups.slice(0, -1) : userMashups;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  const latestJobs = await getLatestAutomationJobsForResources(
    'mashup',
    data.map((mashup) => mashup.id)
  );

  return {
    data: data.map((mashup) => ({
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
    nextCursor,
    total: totalCount.count,
  };
}
