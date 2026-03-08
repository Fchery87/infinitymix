import { db } from '@/lib/db';
import { automationJobs } from '@/lib/db/schema';
import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import {
  createAutomationJob,
  type AutomationEnqueueReceipt,
  type AnalysisJobPayload,
  type AutomationJobKind,
  type AutomationQueueStats,
  type MixJobPayload,
  type QueueDriver,
  type StemsJobPayload,
} from '@/lib/runtime/contracts';
import { eq, sql } from 'drizzle-orm';

type JobPayload = AnalysisJobPayload | StemsJobPayload | MixJobPayload;
type ClaimedAutomationJob = typeof automationJobs.$inferSelect & { lockToken: string | null };
type Handler<T extends AutomationJobKind> = (
  payload: Extract<JobPayload, { type: T }>
) => Promise<void>;

const DEFAULT_CONCURRENCY = 2;
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_LEASE_TIMEOUT_MS = 60 * 60 * 1000;

function backoffDelayMs(attempts: number) {
  const schedule = [1000, 3000, 10000];
  return schedule[Math.min(Math.max(0, attempts - 1), schedule.length - 1)];
}

function serializePayloadForStorage(payload: JobPayload): Record<string, unknown> {
  if (payload.type === 'analysis') {
    return {
      ...payload,
      buffer: undefined,
    };
  }
  return payload as unknown as Record<string, unknown>;
}

export class DurableAutomationQueueDriver {
  private handlers = new Map<AutomationJobKind, (payload: unknown) => Promise<void>>();
  private running = 0;
  private started = false;
  private pumpScheduled = false;
  private interval: NodeJS.Timeout | null = null;
  private readonly workerId = `app-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

  constructor(
    private readonly concurrency: number = DEFAULT_CONCURRENCY,
    private readonly pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
    private readonly leaseTimeoutMs: number = DEFAULT_LEASE_TIMEOUT_MS
  ) {}

  on<T extends AutomationJobKind>(type: T, handler: Handler<T>) {
    this.handlers.set(type, handler as (payload: unknown) => Promise<void>);
  }

  async enqueue(payload: JobPayload) {
    this.ensureStarted();
    const job = createAutomationJob(payload);

    const [inserted] = await db.insert(automationJobs).values({
      kind: job.type,
      status: 'queued',
      resourceKind: job.resource.kind,
      resourceId: job.resource.id,
      payload: serializePayloadForStorage(payload),
      ownerRuntime: job.owner.runtime,
      ownerLegacyMode: job.owner.legacyMode,
      driver: 'durable',
      retryable: job.retryable,
      attempts: 0,
      maxAttempts: 3,
      idempotencyKey: job.idempotencyKey,
      availableAt: new Date(),
      createdAt: new Date(job.createdAt),
      updatedAt: new Date(),
    }).returning({ id: automationJobs.id });

    log('info', 'queue.durable.enqueued', {
      jobKind: job.type,
      resourceKind: job.resource.kind,
      resourceId: job.resource.id,
      idempotencyKey: job.idempotencyKey,
    });
    logTelemetry({
      name: 'queue.durable.enqueued',
      properties: {
        jobKind: job.type,
        resourceKind: job.resource.kind,
      },
    });

    this.schedulePump();
    return {
      driver: 'durable',
      status: 'queued',
      resource: job.resource,
      jobId: inserted?.id ?? null,
      idempotencyKey: job.idempotencyKey,
    } satisfies AutomationEnqueueReceipt;
  }

  getStats(): AutomationQueueStats {
    this.ensureStarted();
    return {
      driver: 'durable',
      pendingJobs: 0,
      runningJobs: this.running,
      concurrency: this.concurrency,
    };
  }

  driver(): QueueDriver {
    return 'durable';
  }

  private ensureStarted() {
    if (this.started || typeof window !== 'undefined') return;
    this.started = true;
    this.interval = setInterval(() => {
      void this.pump();
    }, this.pollIntervalMs);
    this.interval.unref?.();
    this.schedulePump();
  }

  private schedulePump() {
    if (this.pumpScheduled) return;
    this.pumpScheduled = true;
    setTimeout(() => {
      this.pumpScheduled = false;
      void this.pump();
    }, 0);
  }

  private async pump() {
    while (this.running < this.concurrency) {
      const claimed = await this.claimNextJob();
      if (!claimed) return;

      const handler = this.handlers.get(claimed.kind);
      if (!handler) {
        await this.markJobFailed(
          claimed.id,
          claimed.lockToken,
          `No handler registered for ${claimed.kind}`,
          false
        );
        continue;
      }

      this.running += 1;
      void handler(claimed.payload as Extract<JobPayload, { type: AutomationJobKind }>)
        .then(async () => {
          const [updated] = await db
            .update(automationJobs)
            .set({
              status: 'succeeded',
              completedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
              lockToken: null,
              lastError: null,
              updatedAt: new Date(),
            })
            .where(
              sql`${automationJobs.id} = ${claimed.id} and ${automationJobs.lockToken} = ${claimed.lockToken}`
            )
            .returning({ id: automationJobs.id });

          if (!updated) {
            log('warn', 'queue.durable.completeLeaseLost', {
              jobId: claimed.id,
              workerId: this.workerId,
            });
          }
        })
        .catch(async (error) => {
          await this.markJobFailed(
            claimed.id,
            claimed.lockToken,
            error instanceof Error ? error.message : 'Unknown job error',
            claimed.retryable,
            claimed.attempts,
            claimed.maxAttempts
          );
        })
        .finally(() => {
          this.running -= 1;
          this.schedulePump();
        });
    }
  }

  private async claimNextJob() {
    const leaseCutoff = new Date(Date.now() - this.leaseTimeoutMs).toISOString();
    const lockToken = crypto.randomUUID();
    const claimed = await db.execute(sql`
      with candidate as (
        select id
        from automation_jobs
        where
          (
            status = 'queued'
            and available_at <= now()
          )
          or (
            status = 'running'
            and locked_at <= ${leaseCutoff}::timestamp
          )
        order by available_at asc, created_at asc
        for update skip locked
        limit 1
      )
      update automation_jobs as jobs
      set
        status = 'running',
        attempts = jobs.attempts + 1,
        started_at = coalesce(jobs.started_at, now()),
        locked_at = now(),
        locked_by = ${this.workerId},
        lock_token = ${lockToken},
        updated_at = now(),
        last_error = null
      from candidate
      where jobs.id = candidate.id
      returning jobs.*;
    `);

    return (claimed.rows[0] as ClaimedAutomationJob | undefined) ?? null;
  }

  private async markJobFailed(
    jobId: string,
    lockToken: string | null,
    errorMessage: string,
    retryable: boolean,
    attempts?: number,
    maxAttempts?: number
  ) {
    const [existing] = await db
      .select({
        attempts: automationJobs.attempts,
        maxAttempts: automationJobs.maxAttempts,
      })
      .from(automationJobs)
      .where(eq(automationJobs.id, jobId))
      .limit(1);

    const currentAttempts = attempts ?? existing?.attempts ?? 0;
    const allowedAttempts = maxAttempts ?? existing?.maxAttempts ?? 3;
    const shouldRetry = retryable && currentAttempts < allowedAttempts;

    const [updated] = await db
      .update(automationJobs)
      .set({
        status: shouldRetry ? 'queued' : 'failed',
        availableAt: shouldRetry
          ? new Date(Date.now() + backoffDelayMs(currentAttempts))
          : new Date(),
        lockedAt: null,
        lockedBy: null,
        lockToken: null,
        completedAt: shouldRetry ? null : new Date(),
        lastError: errorMessage,
        updatedAt: new Date(),
      })
      .where(
        lockToken
          ? sql`${automationJobs.id} = ${jobId} and ${automationJobs.lockToken} = ${lockToken}`
          : eq(automationJobs.id, jobId)
      )
      .returning({ id: automationJobs.id });

    if (!updated) {
      log('warn', 'queue.durable.failLeaseLost', {
        jobId,
        workerId: this.workerId,
        shouldRetry,
      });
      return;
    }

    log('warn', 'queue.durable.jobFailed', {
      jobId,
      shouldRetry,
      attempts: currentAttempts,
      maxAttempts: allowedAttempts,
      error: errorMessage,
    });
  }
}
