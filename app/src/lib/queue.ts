import { startTrackAnalysis } from '@/lib/audio/analysis-service';
import { separateStems } from '@/lib/audio/stems-service';
import { renderAutoDjMix } from '@/lib/audio/auto-dj-service';
import {
  type AutomationEnqueueReceipt,
  type AnalysisJobPayload,
  type AutomationJobKind,
  type AutomationQueueStats,
  type MixJobPayload,
  type QueueDriver,
  type StemsJobPayload,
} from '@/lib/runtime/contracts';
import { InMemoryAutomationQueueDriver } from '@/lib/runtime/in-memory-queue-driver';
import { DurableAutomationQueueDriver } from '@/lib/runtime/durable-queue-driver';

type JobType = AutomationJobKind;
type JobPayload = AnalysisJobPayload | StemsJobPayload | MixJobPayload;
type Handler<T extends JobType> = (payload: Extract<JobPayload, { type: T }>) => Promise<void>;

function resolveQueueDriver(): QueueDriver {
  const configured = process.env.IMX_QUEUE_DRIVER?.trim().toLowerCase();
  if (configured === 'in-memory') return 'in-memory';
  return 'durable';
}

const selectedDriver = resolveQueueDriver();
const queue =
  selectedDriver === 'in-memory'
    ? new InMemoryAutomationQueueDriver(4)
    : new DurableAutomationQueueDriver();

queue.on('analysis', async ({ trackId, buffer, storageUrl, mimeType, fileName, browserAnalysisHint }) => {
  await startTrackAnalysis({ trackId, buffer, storageUrl, mimeType, fileName, browserAnalysisHint });
});

queue.on('stems', async ({ trackId, quality }) => {
  await separateStems(trackId, quality ?? 'draft');
});

queue.on('mix', async (payload) => {
  const { mashupId, inputTrackIds, durationSeconds, mixMode } = payload;
  const config: { trackIds: string[]; targetDurationSeconds: number; mixMode?: 'standard' | 'vocals_over_instrumental' | 'drum_swap' } = {
    trackIds: inputTrackIds,
    targetDurationSeconds: durationSeconds,
  };
  if (mixMode) {
    config.mixMode = mixMode;
  }
  if (payload.autoDjConfig) {
    Object.assign(config, payload.autoDjConfig);
  }
  await renderAutoDjMix(mashupId, config);
});

export async function enqueueAnalysis(payload: Extract<JobPayload, { type: 'analysis' }>) {
  return queue.enqueue(payload) as Promise<AutomationEnqueueReceipt>;
}

export async function enqueueStems(payload: Extract<JobPayload, { type: 'stems' }>) {
  return queue.enqueue(payload) as Promise<AutomationEnqueueReceipt>;
}

export async function enqueueMix(payload: Extract<JobPayload, { type: 'mix' }>) {
  return queue.enqueue(payload) as Promise<AutomationEnqueueReceipt>;
}

export function queueDriver(): QueueDriver {
  return selectedDriver;
}

export function getQueueStats(): AutomationQueueStats {
  return queue.getStats();
}
