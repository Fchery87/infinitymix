import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import path from 'path';
import os from 'os';
import { log } from '@/lib/logger';
import {
  createAutomationWorkerJob,
  type AutomationWorkerJob,
  type AutomationWorkerProgress,
  type AutomationWorkerResult,
} from '@/lib/runtime/contracts';

interface WorkerInstance {
  worker: Worker;
  busy: boolean;
  currentJob: string | null;
}

const MAX_WORKERS = Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
const workers: WorkerInstance[] = [];
const jobQueue: AutomationWorkerJob[] = [];
const pendingJobs = new Map<string, {
  resolve: (result: AutomationWorkerResult) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: AutomationWorkerProgress) => void;
}>();

let isInitialized = false;

function initializeWorkers(): void {
  if (isInitialized || typeof window !== 'undefined') return;
  
  const workerPath = path.join(process.cwd(), 'src', 'lib', 'audio', 'worker', 'audio-worker.ts');
  
  for (let i = 0; i < MAX_WORKERS; i++) {
    try {
      const worker = new Worker(workerPath, {
        execArgv: ['--require', 'ts-node/register'],
        workerData: { workerId: i },
      });

      worker.on('message', (message: AutomationWorkerResult | AutomationWorkerProgress) => {
        if ('progress' in message) {
          const pending = pendingJobs.get(message.jobId);
          if (pending?.onProgress) {
            pending.onProgress(message);
          }
        } else {
          const pending = pendingJobs.get(message.jobId);
          if (pending) {
            pendingJobs.delete(message.jobId);
            if (message.success) {
              pending.resolve(message);
            } else {
              pending.reject(new Error(message.error || 'Worker job failed'));
            }
          }
          
          const workerInstance = workers.find(w => w.worker === worker);
          if (workerInstance) {
            workerInstance.busy = false;
            workerInstance.currentJob = null;
            processQueue();
          }
        }
      });

      worker.on('error', (error) => {
        log('error', 'audioWorker.workerError', { error: error.message });
        const workerInstance = workers.find(w => w.worker === worker);
        if (workerInstance?.currentJob) {
          const pending = pendingJobs.get(workerInstance.currentJob);
          if (pending) {
            pendingJobs.delete(workerInstance.currentJob);
            pending.reject(error);
          }
          workerInstance.busy = false;
          workerInstance.currentJob = null;
          processQueue();
        }
      });

      worker.on('exit', (code) => {
        log('warn', 'audioWorker.workerExit', { code });
        const idx = workers.findIndex(w => w.worker === worker);
        if (idx !== -1) {
          workers.splice(idx, 1);
        }
      });

      workers.push({ worker, busy: false, currentJob: null });
    } catch (error) {
      log('error', 'audioWorker.initFailed', { error: (error as Error).message });
    }
  }

  isInitialized = true;
  log('info', 'audioWorker.initialized', { workerCount: workers.length });
}

function processQueue(): void {
  if (jobQueue.length === 0) return;

  const availableWorker = workers.find(w => !w.busy);
  if (!availableWorker) return;

  jobQueue.sort((a, b) => b.priority - a.priority);
  const job = jobQueue.shift();
  if (!job) return;

  availableWorker.busy = true;
  availableWorker.currentJob = job.id;
  availableWorker.worker.postMessage(job);
}

export function submitAudioJob(
  job: Omit<AutomationWorkerJob, 'id' | 'createdAt' | 'owner'>,
  onProgress?: (progress: AutomationWorkerProgress) => void
): Promise<AutomationWorkerResult> {
  if (!isInitialized) {
    initializeWorkers();
  }
  const fullJob = createAutomationWorkerJob(job);
  const jobId = fullJob.id;

  return new Promise((resolve, reject) => {
    pendingJobs.set(jobId, { resolve, reject, onProgress });
    jobQueue.push(fullJob);
    processQueue();
  });
}

export function getQueueStats(): {
  pendingJobs: number;
  activeWorkers: number;
  totalWorkers: number;
} {
  return {
    pendingJobs: jobQueue.length,
    activeWorkers: workers.filter(w => w.busy).length,
    totalWorkers: workers.length,
  };
}

export async function shutdownWorkers(): Promise<void> {
  const shutdownPromises = workers.map(({ worker }) => 
    new Promise<void>((resolve) => {
      worker.on('exit', () => resolve());
      worker.terminate();
    })
  );
  
  await Promise.all(shutdownPromises);
  workers.length = 0;
  isInitialized = false;
}

export { isMainThread, parentPort, workerData };
