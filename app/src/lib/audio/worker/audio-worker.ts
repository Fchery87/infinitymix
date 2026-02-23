import { parentPort, workerData } from 'worker_threads';
import type { AudioWorkerJob, AudioWorkerResult, AudioWorkerProgress } from './audio-worker-pool';

void workerData;

function sendProgress(jobId: string, progress: number, stage: string, message?: string): void {
  const progressMsg: AudioWorkerProgress = { jobId, progress, stage, message };
  parentPort?.postMessage(progressMsg);
}

function sendResult(result: AudioWorkerResult): void {
  parentPort?.postMessage(result);
}

async function processAnalysisJob(job: AudioWorkerJob): Promise<AudioWorkerResult> {
  const startTime = Date.now();
  
  try {
    sendProgress(job.id, 0, 'decoding', 'Decoding audio to PCM');
    
    const { startTrackAnalysis } = await import('../analysis-service');
    
    if (job.input.buffer && job.input.config.trackId) {
      await startTrackAnalysis({
        trackId: job.input.config.trackId as string,
        buffer: job.input.buffer as Buffer,
        mimeType: job.input.config.mimeType as string,
        fileName: job.input.config.fileName as string,
      });
      
      sendProgress(job.id, 100, 'complete', 'Analysis complete');
      
      return {
        jobId: job.id,
        success: true,
        data: { trackId: job.input.config.trackId },
        duration: Date.now() - startTime,
      };
    }
    
    throw new Error('Missing buffer or trackId for analysis job');
  } catch (error) {
    return {
      jobId: job.id,
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
    };
  }
}

async function processMixingJob(job: AudioWorkerJob): Promise<AudioWorkerResult> {
  const startTime = Date.now();
  
  try {
    sendProgress(job.id, 0, 'loading', 'Loading audio tracks');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoDjModule = await import('../auto-dj-service') as any;
    const renderAutoDjMix = autoDjModule.renderAutoDjMix;
    const config = job.input.config;
    const mashupId = config.mashupId as string;
    
    sendProgress(job.id, 10, 'planning', 'Planning mix transitions');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await renderAutoDjMix(mashupId, config as any);
    
    sendProgress(job.id, 100, 'complete', 'Mix rendering complete');
    
    return {
      jobId: job.id,
      success: true,
      data: { mashupId },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      jobId: job.id,
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
    };
  }
}

async function processStemsJob(job: AudioWorkerJob): Promise<AudioWorkerResult> {
  const startTime = Date.now();
  
  try {
    sendProgress(job.id, 0, 'loading', 'Loading audio for stem separation');
    
    const { separateStems } = await import('../stems-service');
    const config = job.input.config as {
      trackId: string;
      engine?: 'draft' | 'hifi';
    };
    
    await separateStems(config.trackId, config.engine);
    
    sendProgress(job.id, 100, 'complete', 'Stem separation complete');
    
    return {
      jobId: job.id,
      success: true,
      data: { trackId: config.trackId },
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      jobId: job.id,
      success: false,
      error: (error as Error).message,
      duration: Date.now() - startTime,
    };
  }
}

async function processAutoDjJob(job: AudioWorkerJob): Promise<AudioWorkerResult> {
  return processMixingJob(job);
}

parentPort?.on('message', async (job: AudioWorkerJob) => {
  let result: AudioWorkerResult;
  
  try {
    switch (job.type) {
      case 'analysis':
        result = await processAnalysisJob(job);
        break;
      case 'mixing':
        result = await processMixingJob(job);
        break;
      case 'stems':
        result = await processStemsJob(job);
        break;
      case 'auto-dj':
        result = await processAutoDjJob(job);
        break;
      default:
        result = {
          jobId: job.id,
          success: false,
          error: `Unknown job type: ${job.type}`,
          duration: 0,
        };
    }
  } catch (error) {
    result = {
      jobId: job.id,
      success: false,
      error: (error as Error).message,
      duration: 0,
    };
  }
  
  sendResult(result);
});
