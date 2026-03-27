import { Queue, Worker, type JobsOptions } from 'bullmq';
import {
  createAutomationJob,
  buildAutomationJobIdempotencyKey,
  type AutomationEnqueueReceipt,
  type AutomationJobKind,
  type AutomationQueueStats,
  type AutomationJobPayload,
} from '@/lib/runtime/contracts';
import { log } from '@/lib/logger';
import type { JobHandler } from './types';
import { getRedisConnectionOptions } from './redis';

const QUEUE_NAMES: Record<AutomationJobKind, string> = {
  analysis: 'audio-analysis',
  stems: 'stem-separation',
  mix: 'mashup-generation',
};

const DLQ_NAMES: Record<AutomationJobKind, string> = {
  analysis: 'audio-analysis:dlq',
  stems: 'stem-separation:dlq',
  mix: 'mashup-generation:dlq',
};

const WORKER_CONCURRENCY: Record<AutomationJobKind, number> = {
  analysis: 4,
  stems: 2,
  mix: 2,
};

const BACKOFF_SCHEDULE = [5000, 15000, 45000];

function customBackoff(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, BACKOFF_SCHEDULE.length - 1);
  return BACKOFF_SCHEDULE[Math.max(0, index)];
}

function serializePayload(payload: AutomationJobPayload): Record<string, unknown> {
  if (payload.type === 'analysis') {
    const { buffer: _buffer, ...rest } = payload;
    return rest as unknown as Record<string, unknown>;
  }
  return payload as unknown as Record<string, unknown>;
}

type BullMQConnection = ConstructorParameters<typeof Queue>[1] extends { connection: infer C }
  ? C
  : never;

export class BullMQQueueDriver {
  private connection: BullMQConnection;
  private queues = new Map<AutomationJobKind, Queue>();
  private dlQueues = new Map<AutomationJobKind, Queue>();
  private workers = new Map<AutomationJobKind, Worker>();
  private handlers = new Map<AutomationJobKind, JobHandler>();

  constructor() {
    this.connection = getRedisConnectionOptions() as BullMQConnection;

    const jobOpts: JobsOptions = {
      attempts: 3,
      backoff: { type: 'custom' },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    };

    for (const kind of Object.keys(QUEUE_NAMES) as AutomationJobKind[]) {
      this.queues.set(
        kind,
        new Queue(QUEUE_NAMES[kind], {
          connection: this.connection,
          defaultJobOptions: jobOpts,
        })
      );
      this.dlQueues.set(
        kind,
        new Queue(DLQ_NAMES[kind], {
          connection: this.connection,
          defaultJobOptions: {
            removeOnComplete: { count: 10000 },
            removeOnFail: false,
          },
        })
      );
    }
  }

  on(kind: AutomationJobKind, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  initializeWorkers(): void {
    for (const [kind, queue] of this.queues) {
      const handler = this.handlers.get(kind);
      if (!handler) continue;
      const dlQueue = this.dlQueues.get(kind);

      const worker = new Worker(
        queue.name,
        async (job) => {
          log('info', 'queue.bullmq.processing', {
            jobKind: kind,
            bullmqJobId: job.id,
            attempt: job.attemptsMade + 1,
          });
          await handler(job.data);
        },
        {
          connection: this.connection,
          concurrency: WORKER_CONCURRENCY[kind],
          stalledInterval: 30000,
        }
      );

      worker.on('failed', async (job, err) => {
        if (!job) return;

        const permanentlyFailed = job.attemptsMade >= (job.opts.attempts ?? 3);

        if (permanentlyFailed && dlQueue) {
          await dlQueue.add(
            `${job.name}:failed`,
            {
              originalJobId: job.id,
              originalQueue: queue.name,
              data: job.data,
              error: err.message,
              attempts: job.attemptsMade,
              failedAt: new Date().toISOString(),
            },
            { jobId: `dlq:${queue.name}:${job.id}` }
          );

          log('error', 'queue.bullmq.deadLettered', {
            jobKind: kind,
            bullmqJobId: job.id,
            attempts: job.attemptsMade,
            error: err.message,
          });
        } else {
          log('warn', 'queue.bullmq.jobFailed', {
            jobKind: kind,
            bullmqJobId: job.id,
            attempt: job.attemptsMade,
            error: err.message,
            willRetry: !permanentlyFailed,
          });
        }
      });

      worker.on('completed', (job) => {
        log('info', 'queue.bullmq.jobCompleted', {
          jobKind: kind,
          bullmqJobId: job.id,
        });
      });

      this.workers.set(kind, worker);
    }
  }

  async enqueue(payload: AutomationJobPayload): Promise<AutomationEnqueueReceipt> {
    const job = createAutomationJob(payload);
    const queue = this.queues.get(payload.type);
    if (!queue) throw new Error(`No queue registered for job type: ${payload.type}`);

    const opts: JobsOptions = {
      priority: 5,
      jobId: buildAutomationJobIdempotencyKey(payload),
      backoff: { type: 'custom' },
    };

    const bullJob = await queue.add(payload.type, serializePayload(payload), opts);

    log('info', 'queue.bullmq.enqueued', {
      jobKind: payload.type,
      resourceKind: job.resource.kind,
      resourceId: job.resource.id,
      idempotencyKey: job.idempotencyKey,
      bullmqJobId: bullJob.id,
    });

    return {
      driver: 'bullmq',
      status: 'queued',
      resource: job.resource,
      jobId: bullJob.id ?? null,
      idempotencyKey: job.idempotencyKey,
    };
  }

  async getStats(): Promise<AutomationQueueStats> {
    let totalPending = 0;
    let totalActive = 0;
    let totalDeadLettered = 0;

    for (const [kind, queue] of this.queues) {
      const [waiting, active] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
      ]);
      totalPending += waiting;
      totalActive += active;

      const dlq = this.dlQueues.get(kind);
      if (dlq) {
        totalDeadLettered += await dlq.getWaitingCount();
      }
    }

    return {
      driver: 'bullmq',
      pendingJobs: totalPending,
      runningJobs: totalActive,
      concurrency: Object.values(WORKER_CONCURRENCY).reduce((a, b) => a + b, 0),
    };
  }

  async cleanup(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    this.workers.clear();
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    for (const queue of this.dlQueues.values()) {
      await queue.close();
    }
  }
}
