import { db } from '@/lib/db';
import { automationJobs, mashups, uploadedTracks } from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export type FormattedAutomationJob = {
  id: string;
  kind: 'analysis' | 'stems' | 'mix';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  resource_kind: string;
  resource_id: string;
  driver: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  available_at: string;
  locked_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function formatAutomationJob(
  job: typeof automationJobs.$inferSelect | null | undefined
): FormattedAutomationJob | null {
  if (!job) return null;
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    resource_kind: job.resourceKind,
    resource_id: job.resourceId,
    driver: job.driver,
    attempts: job.attempts,
    max_attempts: job.maxAttempts,
    last_error: job.lastError ?? null,
    available_at: job.availableAt.toISOString(),
    locked_at: job.lockedAt?.toISOString() ?? null,
    started_at: job.startedAt?.toISOString() ?? null,
    completed_at: job.completedAt?.toISOString() ?? null,
    created_at: job.createdAt.toISOString(),
    updated_at: job.updatedAt.toISOString(),
  };
}

export async function getLatestAutomationJobForResource(
  resourceKind: 'track' | 'mashup',
  resourceId: string
) {
  const [job] = await db
    .select()
    .from(automationJobs)
    .where(
      and(
        eq(automationJobs.resourceKind, resourceKind),
        eq(automationJobs.resourceId, resourceId)
      )
    )
    .orderBy(desc(automationJobs.createdAt))
    .limit(1);

  return formatAutomationJob(job);
}

export async function getLatestAutomationJobsForResources(
  resourceKind: 'track' | 'mashup',
  resourceIds: string[]
) {
  if (resourceIds.length === 0) return new Map<string, FormattedAutomationJob>();

  const jobs = await db
    .select()
    .from(automationJobs)
    .where(
      and(
        eq(automationJobs.resourceKind, resourceKind),
        inArray(automationJobs.resourceId, resourceIds)
      )
    )
    .orderBy(desc(automationJobs.createdAt));

  const latestByResource = new Map<string, FormattedAutomationJob>();
  for (const job of jobs) {
    if (!latestByResource.has(job.resourceId)) {
      latestByResource.set(job.resourceId, formatAutomationJob(job)!);
    }
  }
  return latestByResource;
}

export async function getAutomationJobForUser(args: {
  jobId: string;
  userId: string;
}) {
  const [job] = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.id, args.jobId))
    .limit(1);

  if (!job) return null;

  if (job.resourceKind === 'mashup') {
    const [mashup] = await db
      .select({ id: mashups.id })
      .from(mashups)
      .where(and(eq(mashups.id, job.resourceId), eq(mashups.userId, args.userId)))
      .limit(1);
    if (!mashup) return null;
    return formatAutomationJob(job);
  }

  if (job.resourceKind === 'track') {
    const [track] = await db
      .select({ id: uploadedTracks.id })
      .from(uploadedTracks)
      .where(
        and(eq(uploadedTracks.id, job.resourceId), eq(uploadedTracks.userId, args.userId))
      )
      .limit(1);
    if (!track) return null;
    return formatAutomationJob(job);
  }

  return null;
}

export async function getAutomationJobsForUserResource(args: {
  resourceKind: 'track' | 'mashup';
  resourceId: string;
  userId: string;
  limit?: number;
}) {
  if (args.resourceKind === 'mashup') {
    const [mashup] = await db
      .select({ id: mashups.id })
      .from(mashups)
      .where(and(eq(mashups.id, args.resourceId), eq(mashups.userId, args.userId)))
      .limit(1);
    if (!mashup) return [];
  } else {
    const [track] = await db
      .select({ id: uploadedTracks.id })
      .from(uploadedTracks)
      .where(
        and(eq(uploadedTracks.id, args.resourceId), eq(uploadedTracks.userId, args.userId))
      )
      .limit(1);
    if (!track) return [];
  }

  const jobs = await db
    .select()
    .from(automationJobs)
    .where(
      and(
        eq(automationJobs.resourceKind, args.resourceKind),
        eq(automationJobs.resourceId, args.resourceId)
      )
    )
    .orderBy(desc(automationJobs.createdAt))
    .limit(args.limit ?? 20);

  return jobs.map((job) => formatAutomationJob(job)!);
}
