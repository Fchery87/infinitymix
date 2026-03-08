export {
  submitAudioJob,
  getQueueStats,
  shutdownWorkers,
} from './audio-worker-pool';
export type {
  AutomationWorkerJob as AudioWorkerJob,
  AutomationWorkerProgress as AudioWorkerProgress,
  AutomationWorkerResult as AudioWorkerResult,
} from '@/lib/runtime/contracts';
