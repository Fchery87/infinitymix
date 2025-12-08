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
const ANALYSIS_VERSION = 'phase2-v1';

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
  phrases: Array<{ start: number; end: number; energy: number }>;
  structure: Array<{ label: string; start: number; end: number; confidence: number }>;
  drops: number[];
  waveformLite: number[];
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

function computeEnergyEnvelope(samples: Float32Array, sampleRate: number) {
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

  const scale = sampleRate / TARGET_SAMPLE_RATE;
  const normalizedEnvelope = envelope.map((v) => v * scale);

  return { energies, envelope: normalizedEnvelope, hopSize, frameSize };
}

function smoothArray(values: number[], window = 4) {
  if (values.length === 0) return values;
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    let acc = 0;
    let count = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(values.length - 1, i + window); j++) {
      acc += values[j];
      count += 1;
    }
    result.push(acc / Math.max(1, count));
  }
  return result;
}

function computeWaveformLite(samples: Float32Array, targetBins = 256) {
  const binSize = Math.max(1, Math.floor(samples.length / targetBins));
  const bins: number[] = [];
  for (let i = 0; i < samples.length; i += binSize) {
    const slice = samples.subarray(i, Math.min(samples.length, i + binSize));
    let sum = 0;
    for (let j = 0; j < slice.length; j++) sum += Math.abs(slice[j]);
    bins.push(Number((sum / Math.max(1, slice.length)).toFixed(6)));
  }
  return bins;
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

function estimateBpm(envelope: number[], sampleRate: number, hopSize: number) {
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

function detectPhrases(envelope: number[], hopSize: number, sampleRate: number) {
  const hopDuration = hopSize / sampleRate;
  if (envelope.length === 0) return [] as Array<{ start: number; end: number; energy: number }>;
  const smoothed = smoothArray(envelope, 6);
  const mean = smoothed.reduce((a, b) => a + b, 0) / smoothed.length;
  const hi = mean * 1.15;
  const lo = mean * 0.75;
  const phrases: Array<{ start: number; end: number; energy: number }> = [];

  let activeStart: number | null = null;
  let accumEnergy = 0;
  for (let i = 0; i < smoothed.length; i++) {
    const val = smoothed[i];
    const t = i * hopDuration;
    if (activeStart === null && val >= hi) {
      activeStart = t;
      accumEnergy = val;
    } else if (activeStart !== null) {
      accumEnergy += val;
      if (val <= lo || i === smoothed.length - 1) {
        const end = t;
        phrases.push({ start: Number(activeStart.toFixed(2)), end: Number(end.toFixed(2)), energy: Number((accumEnergy / Math.max(1, (end - activeStart))).toFixed(4)) });
        activeStart = null;
        accumEnergy = 0;
      }
    }
  }

  return phrases;
}

function detectDrops(envelope: number[], hopSize: number, sampleRate: number) {
  const hopDuration = hopSize / sampleRate;
  const smoothed = smoothArray(envelope, 10);
  const mean = smoothed.reduce((a, b) => a + b, 0) / Math.max(1, smoothed.length);
  const drops: number[] = [];

  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1];
    const curr = smoothed[i];
    const next = smoothed[i + 1];
    const rising = curr > prev * 1.1;
    const peak = curr >= next && curr >= prev;
    if (peak && rising && curr >= mean * 1.4) {
      drops.push(Number((i * hopDuration).toFixed(2)));
    }
  }

  return drops.slice(0, 3);
}

function buildStructure(phrases: Array<{ start: number; end: number; energy: number }>, drops: number[], durationSeconds: number | null) {
  if (!durationSeconds) return [] as Array<{ label: string; start: number; end: number; confidence: number }>;
  const structure: Array<{ label: string; start: number; end: number; confidence: number }> = [];
  const sortedPhrases = [...phrases].sort((a, b) => a.start - b.start);
  const labelsCycle = ['verse', 'chorus'];
  let labelIdx = 0;

  if (sortedPhrases.length === 0) {
    structure.push({ label: 'intro', start: 0, end: Number(Math.min(durationSeconds, 15).toFixed(2)), confidence: 0.4 });
    structure.push({ label: 'body', start: Number(Math.min(durationSeconds, 15).toFixed(2)), end: Number(durationSeconds.toFixed(2)), confidence: 0.4 });
    return structure;
  }

  sortedPhrases.forEach((phrase, idx) => {
    const label = idx === 0 ? 'intro' : labelsCycle[labelIdx % labelsCycle.length];
    labelIdx += 1;
    structure.push({ label, start: phrase.start, end: phrase.end, confidence: Math.min(1, phrase.energy * 2) });
  });

  const dropStart = drops[0];
  if (typeof dropStart === 'number') {
    const dropEnd = Math.min(durationSeconds, dropStart + 6);
    structure.push({ label: 'drop', start: Number(Math.max(0, dropStart - 1).toFixed(2)), end: Number(dropEnd.toFixed(2)), confidence: 0.8 });
  }

  const lastEnd = Math.max(...structure.map(s => s.end), 0);
  if (durationSeconds - lastEnd > 4) {
    structure.push({ label: 'outro', start: Number(lastEnd.toFixed(2)), end: Number(durationSeconds.toFixed(2)), confidence: 0.5 });
  }

  return structure
    .sort((a, b) => a.start - b.start)
    .map(section => ({ ...section, start: Number(section.start.toFixed(2)), end: Number(section.end.toFixed(2)) }));
}

function estimateKey(samples: Float32Array, sampleRate: number) {
  const detector = YIN({ sampleRate });
  const frameSize = 2048;
  const hopSize = 1024;
  const histogram = new Array(12).fill(0);

  for (let i = 0; i + frameSize < samples.length; i += hopSize) {
    const frame = samples.slice(i, i + frameSize);
    const freq = detector(frame as unknown as Float32Array);
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
  const { envelope, hopSize } = computeEnergyEnvelope(samples, sampleRate);
  const waveformLite = computeWaveformLite(samples);

  let durationSeconds: number | null = null;
  try {
    const metadata = await parseBuffer(buffer, mimeType, { duration: true });
    durationSeconds = metadata.format.duration ?? null;
  } catch {
    durationSeconds = samples.length > 0 ? samples.length / sampleRate : null;
  }

  const { bpm, confidence: bpmConfidence } = estimateBpm(envelope, sampleRate, hopSize);
  const { key, camelot, confidence: keyConfidence } = estimateKey(samples, sampleRate);
  const beatGrid = bpm && durationSeconds ? generateBeatGrid(bpm, durationSeconds) : [];
  const phrases = detectPhrases(envelope, hopSize, sampleRate);
  const drops = detectDrops(envelope, hopSize, sampleRate);
  const structure = buildStructure(phrases, drops, durationSeconds);

  log('info', 'audio.analysis.complete', {
    fileName,
    bpm,
    bpmConfidence,
    key,
    camelot,
    durationSeconds,
    drops,
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
    phrases,
    structure,
    drops,
    waveformLite,
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
        bpm: result.bpm !== null ? result.bpm.toString() : null,
        bpmConfidence: result.bpmConfidence !== null ? result.bpmConfidence.toString() : null,
        keySignature: result.keySignature,
        camelotKey: result.camelotKey,
        keyConfidence: result.keyConfidence !== null ? result.keyConfidence.toString() : null,
        durationSeconds: result.durationSeconds !== null ? result.durationSeconds.toString() : null,
        hasStems: result.hasStems,
        beatGrid: result.beatGrid,
        phrases: result.phrases,
        structure: result.structure,
        dropMoments: result.drops,
        waveformLite: result.waveformLite,
        analysisQuality: 'structured',
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
