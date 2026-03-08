import {
  createAutomationJob,
  type AutomationEnqueueReceipt,
  type AnalysisJobPayload,
  type AutomationJob,
  type AutomationJobKind,
  type AutomationQueueStats,
  type MixJobPayload,
  type StemsJobPayload,
} from '@/lib/runtime/contracts';

type JobPayload = AnalysisJobPayload | StemsJobPayload | MixJobPayload;
type Handler<T extends AutomationJobKind> = (
  payload: Extract<JobPayload, { type: T }>
) => Promise<void>;

export class InMemoryAutomationQueueDriver {
  private handlers = new Map<AutomationJobKind, (payload: unknown) => Promise<void>>();
  private queue: AutomationJob[] = [];
  private running = 0;

  constructor(private readonly concurrency: number = 4) {}

  on<T extends AutomationJobKind>(type: T, handler: Handler<T>) {
    this.handlers.set(type, handler as (payload: unknown) => Promise<void>);
  }

  async enqueue(payload: JobPayload) {
    const job = createAutomationJob(payload);
    this.queue.push(job);
    this.pump();
    return {
      driver: 'in-memory',
      status: 'queued',
      resource: job.resource,
      jobId: null,
      idempotencyKey: job.idempotencyKey,
    } satisfies AutomationEnqueueReceipt;
  }

  getStats(): AutomationQueueStats {
    return {
      driver: 'in-memory',
      pendingJobs: this.queue.length,
      runningJobs: this.running,
      concurrency: this.concurrency,
    };
  }

  private pump() {
    if (this.running >= this.concurrency) return;

    const job = this.queue.shift();
    if (!job) return;

    const handler = this.handlers.get(job.type);
    if (!handler) return;

    this.running += 1;
    job.executionStatus = 'running';
    void handler(job as Extract<JobPayload, { type: AutomationJobKind }>)
      .then(() => {
        job.executionStatus = 'succeeded';
      })
      .catch(() => {
        job.executionStatus = 'failed';
      })
      .finally(() => {
        this.running -= 1;
        setTimeout(() => this.pump(), 0);
      });
  }
}
