import { submitAudioJob, type AudioWorkerProgress } from './worker';
import { log } from '@/lib/logger';
import type { AutoDjConfig } from './auto-dj-service';

export interface RenderWithWorkerOptions extends AutoDjConfig {
  mashupId: string;
  onProgress?: (progress: AudioWorkerProgress) => void;
}

export async function renderAutoDjMixWithWorker(
  options: RenderWithWorkerOptions
): Promise<{ success: boolean; error?: string }> {
  const { mashupId, onProgress, ...config } = options;
  
  try {
    const result = await submitAudioJob(
      {
        type: 'auto-dj',
        input: {
          config: {
            mashupId,
            ...config,
          },
        },
        priority: 1,
      },
      onProgress
    );

    if (result.success) {
      log('info', 'autoDj.worker.complete', {
        mashupId,
        duration: result.duration,
      });
      return { success: true };
    }

    log('error', 'autoDj.worker.failed', {
      mashupId,
      error: result.error,
    });
    return { success: false, error: result.error };
  } catch (error) {
    log('error', 'autoDj.worker.error', {
      mashupId,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

export async function analyzeTrackWithWorker(options: {
  trackId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  onProgress?: (progress: AudioWorkerProgress) => void;
}): Promise<{ success: boolean; error?: string }> {
  const { trackId, buffer, mimeType, fileName, onProgress } = options;
  
  try {
    const result = await submitAudioJob(
      {
        type: 'analysis',
        input: {
          buffer,
          config: {
            trackId,
            mimeType,
            fileName,
          },
        },
        priority: 2,
      },
      onProgress
    );

    if (result.success) {
      log('info', 'analysis.worker.complete', {
        trackId,
        duration: result.duration,
      });
      return { success: true };
    }

    log('error', 'analysis.worker.failed', {
      trackId,
      error: result.error,
    });
    return { success: false, error: result.error };
  } catch (error) {
    log('error', 'analysis.worker.error', {
      trackId,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

export async function separateStemsWithWorker(options: {
  trackId: string;
  engine?: 'draft' | 'hifi';
  onProgress?: (progress: AudioWorkerProgress) => void;
}): Promise<{ success: boolean; error?: string }> {
  const { trackId, engine, onProgress } = options;
  
  try {
    const result = await submitAudioJob(
      {
        type: 'stems',
        input: {
          config: {
            trackId,
            engine,
          },
        },
        priority: 1,
      },
      onProgress
    );

    if (result.success) {
      log('info', 'stems.worker.complete', {
        trackId,
        duration: result.duration,
      });
      return { success: true };
    }

    log('error', 'stems.worker.failed', {
      trackId,
      error: result.error,
    });
    return { success: false, error: result.error };
  } catch (error) {
    log('error', 'stems.worker.error', {
      trackId,
      error: (error as Error).message,
    });
    return { success: false, error: (error as Error).message };
  }
}

export { getQueueStats } from './worker';
