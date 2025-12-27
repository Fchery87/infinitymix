import { startTrackAnalysis } from '@/lib/audio/analysis-service';
import { separateStems } from '@/lib/audio/stems-service';
import { renderAutoDjMix } from '@/lib/audio/auto-dj-service';

type JobType = 'analysis' | 'stems' | 'mix';

type JobPayload =
  | { type: 'analysis'; trackId: string; buffer?: Buffer; storageUrl?: string; mimeType: string; fileName: string }
  | { type: 'stems'; trackId: string; quality?: 'draft' | 'hifi' }
  | { type: 'mix'; mashupId: string; inputTrackIds: string[]; durationSeconds: number; mixMode?: 'standard' | 'vocals_over_instrumental' | 'drum_swap' };

type Handler<T extends JobType> = (payload: Extract<JobPayload, { type: T }>) => Promise<void>;

class InMemoryQueue {
  private handlers = new Map<JobType, (payload: unknown) => Promise<void>>();
  private queue: JobPayload[] = [];
  private running = 0;
  private readonly concurrency: number;

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  on<T extends JobType>(type: T, handler: Handler<T>) {
    this.handlers.set(type, handler as (payload: unknown) => Promise<void>);
  }

  async add(job: JobPayload) {
    this.queue.push(job);
    this.pump();
  }

  private pump() {
    if (this.running >= this.concurrency) return;
    const job = this.queue.shift();
    if (!job) return;
    const handler = this.handlers.get(job.type);
    if (!handler) return;
    this.running += 1;
    void handler(job as Extract<JobPayload, { type: JobType }>)
      .catch(() => undefined)
      .finally(() => {
        this.running -= 1;
        setTimeout(() => this.pump(), 0);
      });
  }
}

const queue = new InMemoryQueue(4);

queue.on('analysis', async ({ trackId, buffer, storageUrl, mimeType, fileName }) => {
  await startTrackAnalysis({ trackId, buffer, storageUrl, mimeType, fileName });
});

queue.on('stems', async ({ trackId, quality }) => {
  await separateStems(trackId, quality ?? 'draft');
});

queue.on('mix', async ({ mashupId, inputTrackIds, durationSeconds, mixMode }) => {
  const config: { trackIds: string[]; targetDurationSeconds: number; mixMode?: 'standard' | 'vocals_over_instrumental' | 'drum_swap' } = {
    trackIds: inputTrackIds,
    targetDurationSeconds: durationSeconds,
  };
  if (mixMode) {
    config.mixMode = mixMode;
  }
  await renderAutoDjMix(mashupId, config);
});

export async function enqueueAnalysis(payload: Extract<JobPayload, { type: 'analysis' }>) {
  await queue.add(payload);
}

export async function enqueueStems(payload: Extract<JobPayload, { type: 'stems' }>) {
  await queue.add(payload);
}

export async function enqueueMix(payload: Extract<JobPayload, { type: 'mix' }>) {
  await queue.add(payload);
}

export function queueDriver() {
  return 'in-memory';
}
