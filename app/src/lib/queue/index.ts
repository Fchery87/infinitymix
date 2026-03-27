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
import { createQueueDriver } from './factory';
import { cleanupRedisConnection } from './redis';

type JobPayload = AnalysisJobPayload | StemsJobPayload | MixJobPayload;

const { driver, name: driverName } = createQueueDriver();

driver.on('analysis', async (raw) => {
  const payload = raw as AnalysisJobPayload;
  await startTrackAnalysis({
    trackId: payload.trackId,
    buffer: payload.buffer,
    storageUrl: payload.storageUrl,
    mimeType: payload.mimeType,
    fileName: payload.fileName,
    browserAnalysisHint: payload.browserAnalysisHint,
  });
});

driver.on('stems', async (raw) => {
  const payload = raw as StemsJobPayload;
  await separateStems(payload.trackId, payload.quality ?? 'draft');
});

driver.on('mix', async (raw) => {
  const payload = raw as MixJobPayload;
  const config: {
    trackIds: string[];
    targetDurationSeconds: number;
    mixMode?: 'standard' | 'vocals_over_instrumental' | 'drum_swap';
  } = {
    trackIds: payload.inputTrackIds,
    targetDurationSeconds: payload.durationSeconds,
  };
  if (payload.mixMode) {
    config.mixMode = payload.mixMode;
  }
  if (payload.autoDjConfig) {
    Object.assign(config, payload.autoDjConfig);
  }
  await renderAutoDjMix(payload.mashupId, config);
});

if (driverName === 'bullmq' && 'initializeWorkers' in driver) {
  (driver as { initializeWorkers(): void }).initializeWorkers();
}

process.on('SIGTERM', async () => {
  if (driver.cleanup) await driver.cleanup();
  await cleanupRedisConnection();
});

process.on('SIGINT', async () => {
  if (driver.cleanup) await driver.cleanup();
  await cleanupRedisConnection();
});

export async function enqueueAnalysis(payload: Extract<JobPayload, { type: 'analysis' }>): Promise<AutomationEnqueueReceipt> {
  return driver.enqueue(payload);
}

export async function enqueueStems(payload: Extract<JobPayload, { type: 'stems' }>): Promise<AutomationEnqueueReceipt> {
  return driver.enqueue(payload);
}

export async function enqueueMix(payload: Extract<JobPayload, { type: 'mix' }>): Promise<AutomationEnqueueReceipt> {
  return driver.enqueue(payload);
}

export function queueDriver(): QueueDriver {
  return driverName as QueueDriver;
}

export function getQueueStats(): AutomationQueueStats | Promise<AutomationQueueStats> {
  return driver.getStats();
}
