import { db } from '@/lib/db';
import { uploadedTracks } from '@/lib/db/schema';
import { handleAsyncError } from '@/lib/utils/error-handling';
import { getStorage } from '@/lib/storage';
import { log } from '@/lib/logger';
import { eq } from 'drizzle-orm';
import { parseBuffer } from 'music-metadata';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable } from 'node:stream';
import { YIN } from 'pitchfinder';

const TARGET_SAMPLE_RATE = 44100;
const ANALYSIS_VERSION = 'phase1-v1';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const camelotMajor = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B'];
const camelotMinor = ['5A', '12A', '7A', '2A', '9A', '4A', '11A', '6A', '1A', '8A', '3A', '10A'];

type AnalysisResult = {
  bpm: number | null;
  bpmConfidence: number | null;
  keySignature: string | null;
  camelotKey: string | null;
  keyConfidence: number | null;
  durationSeconds: number | null;
  beatGrid: number[];
  hasStems: boolean;
};

function rotateProfile(profile: number[], shift: number) {
  return profile.map((_, idx) => profile[(idx + shift) % profile.length]);
}

function normalize(arr: number[]) {
  const sum = arr.reduce((a, b) => a + b, 0) || 1;
  return arr.map(v => v / sum);
}

function correlate(hist: number[], profile: number[]) {
  return hist.reduce((acc, val, idx) => acc + val * profile[idx], 0);
}

function mapCamelot(noteIndex: number, mode: 'major' | 'minor') {
  return mode === 'major' ? camelotMajor[noteIndex] : camelotMinor[noteIndex];
}

async function decodeToPCM(buffer: Buffer, mimeType: string) {
  if (!ffmpegStatic) {
    throw new Error('ffmpeg-static binary not available for audio decoding');
  }

  const chunks: Buffer[] = [];

  return new Promise<{ samples: Float32Array; sampleRate: number }>((resolve, reject) => {
    const command = ffmpeg()
      .input(Readable.from(buffer))
      .audioChannels(1)
      .audioFrequency(TARGET_SAMPLE_RATE)
      .format('f32le');

    if (mimeType?.includes('wav')) {
      command.inputFormat('wav');
    }

    command.on('error', reject);

    const output = command.pipe();
    output.on('data', chunk => chunks.push(chunk));
    output.on('error', reject);
    output.on('end', () => {
      const merged = Buffer.concat(chunks);
      const samples = new Float32Array(merged.buffer, merged.byteOffset, merged.length / 4);
      resolve({ samples, sampleRate: TARGET_SAMPLE_RATE });
    });
  });
}

function estimateBpm(samples: Float32Array, sampleRate: number) {
  const frameSize = 1024;
  const hopSize = 512;
  const energies: number[] = [];

  for (let i = 0; i + frameSize < samples.length; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      const v = samples[i + j];
      sum += v * v;
    }
    energies.push(sum / frameSize);
  }

  const envelope: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    envelope.push(diff > 0 ? diff : 0);
  }

  if (envelope.length < 4) return { bpm: null, confidence: null, beatGrid: [] };

  const minBpm = 70;
  const maxBpm = 180;
  const minLag = Math.max(1, Math.floor((60 / maxBpm) * (sampleRate / hopSize)));
  const maxLag = Math.max(minLag + 1, Math.floor((60 / minBpm) * (sampleRate / hopSize)));

  let bestLag = minLag;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i + lag < envelope.length; i++) {
      const a = envelope[i];
      const b = envelope[i + lag];
      score += a * b;
      normA += a * a;
      normB += b * b;
    }
    const denom = Math.sqrt(normA * normB) || 1;
    const corr = score / denom;
    if (corr > bestScore) {
      bestScore = corr;
      bestLag = lag;
    }
  }

  const bpm = 60 * (sampleRate / hopSize) / bestLag;
  const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));

  return { bpm, confidence, beatGrid: [] as number[] };
}

function generateBeatGrid(bpm: number, durationSeconds: number) {
  if (!bpm || !durationSeconds || bpm <= 0 || durationSeconds <= 0) return [] as number[];
  const secondsPerBeat = 60 / bpm;
  const grid: number[] = [];
  for (let t = 0; t <= durationSeconds; t += secondsPerBeat) {
    grid.push(Number(t.toFixed(3)));
    if (grid.length >= 512) break;
  }
  return grid;
}

function estimateKey(samples: Float32Array, sampleRate: number) {
  const detector = YIN({ sampleRate });
  const frameSize = 2048;
  const hopSize = 1024;
  const histogram = new Array(12).fill(0);

  for (let i = 0; i + frameSize < samples.length; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    const freq = detector(frame as unknown as number[]);
    if (freq && Number.isFinite(freq)) {
      const midi = Math.round(12 * Math.log2(freq / 440) + 69);
      const cls = ((midi % 12) + 12) % 12;
      histogram[cls] += 1;
    }
  }

  const totalHits = histogram.reduce((a, b) => a + b, 0);
  if (totalHits === 0) return { key: null, camelot: null, confidence: null };

  const histNorm = normalize(histogram);
  let best: { mode: 'major' | 'minor'; root: number; score: number } | null = null;
  let runnerUp = -Infinity;

  for (let root = 0; root < 12; root++) {
    const majorScore = correlate(histNorm, normalize(rotateProfile(MAJOR_PROFILE, root)));
    const minorScore = correlate(histNorm, normalize(rotateProfile(MINOR_PROFILE, root)));

    const topScore = Math.max(majorScore, minorScore);
    const mode: 'major' | 'minor' = majorScore >= minorScore ? 'major' : 'minor';
    if (!best || topScore > best.score) {
      runnerUp = best?.score ?? -Infinity;
      best = { mode, root, score: topScore };
    } else if (topScore > runnerUp) {
      runnerUp = topScore;
    }
  }

  if (!best) return { key: null, camelot: null, confidence: null };

  const note = NOTE_NAMES[best.root];
  const keySignature = `${note}${best.mode === 'major' ? 'maj' : 'min'}`;
  const camelot = mapCamelot(best.root, best.mode);
  const confidence = best.score <= 0 ? 0 : Math.max(0, Math.min(1, (best.score - Math.max(runnerUp, 0)) / (best.score || 1)));

  return { key: keySignature, camelot, confidence };
}

async function analyze(buffer: Buffer, mimeType: string, fileName: string): Promise<AnalysisResult> {
  const { samples, sampleRate } = await decodeToPCM(buffer, mimeType);

  let durationSeconds: number | null = null;
  try {
    const metadata = await parseBuffer(buffer, mimeType, { duration: true });
    durationSeconds = metadata.format.duration ?? null;
  } catch {
    durationSeconds = samples.length > 0 ? samples.length / sampleRate : null;
  }

  const { bpm, confidence: bpmConfidence } = estimateBpm(samples, sampleRate);
  const { key, camelot, confidence: keyConfidence } = estimateKey(samples, sampleRate);
  const beatGrid = bpm && durationSeconds ? generateBeatGrid(bpm, durationSeconds) : [];

  log('info', 'audio.analysis.complete', {
    fileName,
    bpm,
    bpmConfidence,
    key,
    camelot,
    durationSeconds,
  });

  return {
    bpm: bpm ? Number(bpm.toFixed(2)) : null,
    bpmConfidence: bpmConfidence ? Number(bpmConfidence.toFixed(3)) : null,
    keySignature: key,
    camelotKey: camelot,
    keyConfidence: keyConfidence ? Number(keyConfidence.toFixed(3)) : null,
    durationSeconds: durationSeconds ? Number(durationSeconds.toFixed(2)) : null,
    beatGrid,
    hasStems: false,
  };
}

type AnalysisParams = {
  trackId: string;
  buffer?: Buffer;
  storageUrl?: string;
  mimeType: string;
  fileName: string;
};

export async function startTrackAnalysis({ trackId, buffer, storageUrl, mimeType, fileName }: AnalysisParams) {
  try {
    await db
      .update(uploadedTracks)
      .set({ analysisStatus: 'analyzing', updatedAt: new Date() })
      .where(eq(uploadedTracks.id, trackId));

    let audioBuffer = buffer;
    if (!audioBuffer && storageUrl) {
      const storage = await getStorage();
      const fetched = storage.getFile ? await storage.getFile(storageUrl) : null;
      audioBuffer = fetched?.buffer;
    }

    if (!audioBuffer) {
      throw new Error('Audio buffer not available for analysis');
    }

    const result = await analyze(audioBuffer, mimeType, fileName);

    await db
      .update(uploadedTracks)
      .set({
        analysisStatus: 'completed',
        bpm: result.bpm,
        bpmConfidence: result.bpmConfidence,
        keySignature: result.keySignature,
        camelotKey: result.camelotKey,
        keyConfidence: result.keyConfidence,
        durationSeconds: result.durationSeconds,
        hasStems: result.hasStems,
        beatGrid: result.beatGrid,
        analysisVersion: ANALYSIS_VERSION,
        updatedAt: new Date(),
      })
      .where(eq(uploadedTracks.id, trackId));
  } catch (error) {
    handleAsyncError(error as Error, 'startTrackAnalysis');
    await db
      .update(uploadedTracks)
      .set({ analysisStatus: 'failed', updatedAt: new Date() })
      .where(eq(uploadedTracks.id, trackId));
  }
}
