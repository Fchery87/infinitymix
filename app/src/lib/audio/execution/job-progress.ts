/**
 * Job Progress Tracking System
 * 
 * Tracks the progress and status of long-running audio generation jobs.
 * Supports both SSE (real-time) and polling-based status updates.
 */

import { db } from '@/lib/db';
import { automationJobs } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type JobStatus = 
  | 'queued'
  | 'validating'
  | 'analyzing'
  | 'planning'
  | 'rendering'
  | 'mixing'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobProgress = {
  jobId: string;
  status: JobStatus;
  progressPercent: number;
  currentStep: string;
  estimatedTimeRemainingSeconds: number | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
};

export type JobProgressUpdate = {
  status?: JobStatus;
  progressPercent?: number;
  currentStep?: string;
  estimatedTimeRemainingSeconds?: number | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Create a new job progress tracker
 */
export async function createJobProgress(
  kind: 'preview' | 'mashup',
  resourceId: string,
  userId: string,
  metadata: Record<string, unknown> = {}
): Promise<JobProgress> {
  const jobId = nanoid();
  
  await db.insert(automationJobs).values({
    id: jobId,
    kind: kind === 'preview' ? 'mix' : 'mix', // Using 'mix' for both for now
    status: 'queued' as const,
    resourceKind: kind,
    resourceId,
    payload: {
      userId,
      ...metadata,
    },
    ownerRuntime: 'app',
    idempotencyKey: jobId,
  });
  
  return {
    jobId,
    status: 'queued',
    progressPercent: 0,
    currentStep: 'Waiting to start',
    estimatedTimeRemainingSeconds: null,
    startedAt: null,
    completedAt: null,
    errorMessage: null,
    metadata,
  };
}

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  update: JobProgressUpdate
): Promise<void> {
  const existing = await getJobProgress(jobId);
  if (!existing) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  const updates: Partial<typeof automationJobs.$inferInsert> = {};
  
  if (update.status) {
    updates.status = mapJobStatusToEnum(update.status);
    
    // Auto-set timestamps based on status
    if (update.status === 'completed' || update.status === 'failed') {
      updates.completedAt = new Date();
    }
  }
  
  if (update.errorMessage) {
    updates.lastError = update.errorMessage;
  }
  
  // Merge metadata
  if (update.metadata) {
    updates.payload = {
      ...existing.metadata,
      ...update.metadata,
      progressPercent: update.progressPercent ?? existing.progressPercent,
      currentStep: update.currentStep ?? existing.currentStep,
      estimatedTimeRemainingSeconds: update.estimatedTimeRemainingSeconds ?? existing.estimatedTimeRemainingSeconds,
    };
  }
  
  await db
    .update(automationJobs)
    .set(updates)
    .where(eq(automationJobs.id, jobId));
}

/**
 * Get job progress by ID
 */
export async function getJobProgress(jobId: string): Promise<JobProgress | null> {
  const jobs = await db
    .select({
      id: automationJobs.id,
      status: automationJobs.status,
      payload: automationJobs.payload,
      startedAt: automationJobs.startedAt,
      completedAt: automationJobs.completedAt,
      lastError: automationJobs.lastError,
    })
    .from(automationJobs)
    .where(eq(automationJobs.id, jobId))
    .limit(1);
  
  if (jobs.length === 0) {
    return null;
  }
  
  const job = jobs[0];
  const payload = (job.payload as Record<string, unknown>) || {};
  
  return {
    jobId: job.id,
    status: mapEnumToJobStatus(job.status),
    progressPercent: (payload.progressPercent as number) ?? 0,
    currentStep: (payload.currentStep as string) ?? 'Unknown',
    estimatedTimeRemainingSeconds: (payload.estimatedTimeRemainingSeconds as number) ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorMessage: job.lastError,
    metadata: payload,
  };
}

/**
 * Get all jobs for a user
 */
export async function getUserJobs(
  userId: string,
  limit = 50
): Promise<JobProgress[]> {
  const jobs = await db
    .select({
      id: automationJobs.id,
      status: automationJobs.status,
      payload: automationJobs.payload,
      startedAt: automationJobs.startedAt,
      completedAt: automationJobs.completedAt,
      lastError: automationJobs.lastError,
    })
    .from(automationJobs)
    .where(sql`${automationJobs.payload}->>'userId' = ${userId}`)
    .orderBy(desc(automationJobs.createdAt))
    .limit(limit);
  
  return jobs.map(job => {
    const payload = (job.payload as Record<string, unknown>) || {};
    return {
      jobId: job.id,
      status: mapEnumToJobStatus(job.status),
      progressPercent: (payload.progressPercent as number) ?? 0,
      currentStep: (payload.currentStep as string) ?? 'Unknown',
      estimatedTimeRemainingSeconds: (payload.estimatedTimeRemainingSeconds as number) ?? null,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      errorMessage: job.lastError,
      metadata: payload,
    };
  });
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  await db
    .update(automationJobs)
    .set({
      status: 'cancelled' as const,
      completedAt: new Date(),
    })
    .where(eq(automationJobs.id, jobId));
}

/**
 * Map job status enum to string
 */
function mapEnumToJobStatus(status: string): JobStatus {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'running':
      return 'rendering'; // Map generic 'running' to a specific status
    case 'succeeded':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'queued';
  }
}

/**
 * Map string status to enum
 */
function mapJobStatusToEnum(status: JobStatus): 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' {
  switch (status) {
    case 'queued':
      return 'queued';
    case 'completed':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      // All intermediate states map to 'running'
      return 'running';
  }
}
