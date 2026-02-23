import { transfer, wrap, type Remote } from 'comlink';
import type { BrowserAnalysisHint } from '@/lib/audio/types/analysis';
import { emitAudioPipelineTelemetry } from '@/lib/audio/telemetry';
import type { BrowserAnalysisWorkerApi } from './browser-analysis.worker';

const MAX_ANALYSIS_SECONDS = 90;
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = unknown>(specifier: string) => Promise<T>;

let workerSingleton: Worker | null = null;
let workerApiSingleton: Remote<BrowserAnalysisWorkerApi> | null = null;

type WebAudioGlobal = typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function getWorker(): Worker {
  if (workerSingleton) return workerSingleton;
  workerSingleton = new Worker(new URL('./browser-analysis.worker.ts', import.meta.url), {
    type: 'module',
  });
  workerSingleton.onerror = (event) => {
    emitAudioPipelineTelemetry('browser_worker.error', {
      area: 'analysis',
      status: 'error',
      message: event.message,
    });
  };
  return workerSingleton;
}

function getWorkerApi(): Remote<BrowserAnalysisWorkerApi> {
  if (workerApiSingleton) return workerApiSingleton;
  workerApiSingleton = wrap<BrowserAnalysisWorkerApi>(getWorker());
  return workerApiSingleton;
}

async function decodeFileToMonoPcm(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor =
    globalThis.AudioContext ?? (globalThis as WebAudioGlobal).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('Web Audio API not available');
  }
  const ctx = new AudioContextCtor();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const sampleRate = decoded.sampleRate;
    const channelData = decoded.getChannelData(0);
    const maxFrames = Math.floor(sampleRate * MAX_ANALYSIS_SECONDS);
    const trimmed = channelData.length > maxFrames ? channelData.slice(0, maxFrames) : channelData.slice(0);
    return { audioBuffer: decoded, sampleRate, channelData: trimmed };
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

async function tryBeatDetectorBpm(audioBuffer: AudioBuffer): Promise<{ bpm: number | null; confidence: number | null }> {
  try {
    const mod = (await dynamicImport('web-audio-beat-detector')) as Record<string, unknown>;
    const analyze = (mod.analyze ?? (mod.default as { analyze?: unknown } | undefined)?.analyze) as
      | ((audioBuffer: AudioBuffer) => Promise<number>)
      | undefined;
    if (typeof analyze !== 'function') {
      return { bpm: null, confidence: null };
    }
    const bpm = await analyze(audioBuffer);
    return {
      bpm: Number.isFinite(bpm) ? Number(bpm.toFixed(2)) : null,
      confidence: Number.isFinite(bpm) ? 0.8 : null,
    };
  } catch {
    return { bpm: null, confidence: null };
  }
}

async function analyzeSingleFileInBrowser(
  file: File,
  options?: { mlSectionTagging?: boolean }
): Promise<BrowserAnalysisHint | null> {
  const startedAt = performance.now();
  const { audioBuffer, sampleRate, channelData } = await decodeFileToMonoPcm(file);
  const beatDetector = await tryBeatDetectorBpm(audioBuffer);

  const payload = {
    fileName: file.name,
    fileSizeBytes: file.size,
    mimeType: file.type,
    sampleRate,
    channelDataBuffer: channelData.buffer.slice(0) as ArrayBuffer,
    externalBpm: beatDetector.bpm,
    externalBpmConfidence: beatDetector.confidence,
    flags: options,
  };
  const result = await getWorkerApi().analyzePcm(transfer(payload, [payload.channelDataBuffer]));

  emitAudioPipelineTelemetry('browser_analysis.complete', {
    area: 'analysis',
    status: 'success',
    fileName: file.name,
    duration_ms: Math.round(performance.now() - startedAt),
    bpm: result.bpm,
    bpmConfidence: result.bpmConfidence,
    keySignature: result.keySignature,
    keyConfidence: result.keyConfidence,
    overallConfidence: result.confidence.overall,
  });

  return result;
}

export async function collectBrowserAnalysisHintsForUpload(
  files: File[],
  options?: { enabled?: boolean; mlSectionTagging?: boolean }
): Promise<BrowserAnalysisHint[]> {
  if (!options?.enabled || typeof window === 'undefined' || files.length === 0) {
    return [];
  }

  const hints: BrowserAnalysisHint[] = [];
  for (const file of files) {
    try {
      const hint = await analyzeSingleFileInBrowser(file, {
        mlSectionTagging: options.mlSectionTagging,
      });
      if (hint) hints.push(hint);
    } catch (error) {
      emitAudioPipelineTelemetry('browser_analysis.failed', {
        area: 'analysis',
        status: 'error',
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Unknown browser analysis error',
      });
    }
  }
  return hints;
}
