import { expose } from 'comlink';
import { YIN } from 'pitchfinder';
import type { BrowserAnalysisHint } from '@/lib/audio/types/analysis';

type AnalyzePayload = {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  sampleRate: number;
  channelDataBuffer: ArrayBuffer;
  externalBpm?: number | null;
  externalBpmConfidence?: number | null;
  flags?: {
    mlSectionTagging?: boolean;
  };
};

type OptionalImport = <T = unknown>(specifier: string) => Promise<T>;

const dynamicImport: OptionalImport = new Function(
  'specifier',
  'return import(specifier)'
) as OptionalImport;

type EssentiaModule = {
  Essentia: new (wasm: unknown, isDebug?: boolean) => {
    version?: string;
    arrayToVector(input: Float32Array): unknown;
    RMS(input: unknown): { rms?: number };
    ZeroCrossingRate(input: unknown, threshold?: number): { zeroCrossingRate?: number };
    SpectralCentroidTime(input: unknown, sampleRate?: number): { centroid?: number };
    [key: string]: unknown;
    shutdown?: () => void;
    delete?: () => void;
  };
  EssentiaWASM: unknown;
  EssentiaExtractor?: unknown;
};

type SectionTagLabel =
  | 'vocal-dominant'
  | 'percussive'
  | 'build'
  | 'drop-like'
  | 'ambient';

type SectionTag = {
  start: number;
  end: number;
  tag: SectionTagLabel;
  confidence: number;
  source: 'ml' | 'heuristic';
};

type SectionTaggingCapability = {
  enabled: boolean;
  transformersAvailable: boolean;
  webgpuAvailable: boolean;
  backend: 'webgpu' | 'wasm' | 'heuristic' | 'none';
};

type SectionTaggingResult = {
  enabled: boolean;
  attempted: boolean;
  backend: 'webgpu' | 'wasm' | 'heuristic' | 'none';
  status: 'success' | 'fallback' | 'disabled' | 'unavailable';
  timing?: {
    totalMs?: number | null;
    modelLoadMs?: number | null;
    inferenceMs?: number | null;
  };
  fallbackReason?: string | null;
  model?: string | null;
  error?: string | null;
  tags: SectionTag[];
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function rotateProfile(profile: number[], shift: number) {
  return profile.map((_, idx) => profile[(idx + shift) % profile.length]);
}

function normalize(values: number[]) {
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  return values.map((v) => v / sum);
}

function correlate(hist: number[], profile: number[]) {
  return hist.reduce((acc, val, idx) => acc + val * profile[idx], 0);
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

function computeWaveformLite(samples: Float32Array, targetBins = 128) {
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

function computeEnergyEnvelope(samples: Float32Array) {
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

  return { envelope, hopSize };
}

function estimateBpmFallback(envelope: number[], sampleRate: number, hopSize: number) {
  if (envelope.length < 4) return { bpm: null as number | null, confidence: null as number | null };

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
    const corr = score / (Math.sqrt(normA * normB) || 1);
    if (corr > bestScore) {
      bestScore = corr;
      bestLag = lag;
    }
  }

  const bpm = 60 * (sampleRate / hopSize) / bestLag;
  const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));
  return { bpm, confidence };
}

function generateBeatGrid(bpm: number | null, durationSeconds: number | null) {
  if (!bpm || !durationSeconds || bpm <= 0 || durationSeconds <= 0) return [] as number[];
  const secondsPerBeat = 60 / bpm;
  const grid: number[] = [];
  for (let t = 0; t <= durationSeconds; t += secondsPerBeat) {
    grid.push(Number(t.toFixed(3)));
    if (grid.length >= 256) break;
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
    const freq = detector(frame as unknown as Float32Array);
    if (freq && Number.isFinite(freq)) {
      const midi = Math.round(12 * Math.log2(freq / 440) + 69);
      const cls = ((midi % 12) + 12) % 12;
      histogram[cls] += 1;
    }
  }

  const totalHits = histogram.reduce((a, b) => a + b, 0);
  if (totalHits === 0) return { keySignature: null, confidence: null as number | null };

  const histNorm = normalize(histogram);
  let best: { mode: 'major' | 'minor'; root: number; score: number } | null = null;
  let runnerUp = -Infinity;

  for (let root = 0; root < 12; root++) {
    const majorScore = correlate(histNorm, normalize(rotateProfile(MAJOR_PROFILE, root)));
    const minorScore = correlate(histNorm, normalize(rotateProfile(MINOR_PROFILE, root)));
    const topScore = Math.max(majorScore, minorScore);
    const mode = majorScore >= minorScore ? 'major' : 'minor';
    if (!best || topScore > best.score) {
      runnerUp = best?.score ?? -Infinity;
      best = { mode, root, score: topScore };
    } else if (topScore > runnerUp) {
      runnerUp = topScore;
    }
  }

  if (!best) return { keySignature: null, confidence: null as number | null };
  const note = NOTE_NAMES[best.root];
  const confidence =
    best.score <= 0 ? 0 : Math.max(0, Math.min(1, (best.score - Math.max(runnerUp, 0)) / (best.score || 1)));
  return {
    keySignature: `${note}${best.mode === 'major' ? 'maj' : 'min'}`,
    confidence: Number(confidence.toFixed(3)),
  };
}

function estimatePhrasesAndSections(envelope: number[], hopSize: number, sampleRate: number, durationSeconds: number | null) {
  const hopDuration = hopSize / sampleRate;
  const smoothed = smoothArray(envelope, 6);
  const mean = smoothed.reduce((a, b) => a + b, 0) / Math.max(1, smoothed.length);
  const hi = mean * 1.15;
  const lo = mean * 0.75;
  const phrases: Array<{ start: number; end: number; energy: number }> = [];
  const drops: number[] = [];
  let activeStart: number | null = null;
  let accumEnergy = 0;

  for (let i = 0; i < smoothed.length; i++) {
    const val = smoothed[i];
    const t = i * hopDuration;
    if (i > 0 && i < smoothed.length - 1 && val > smoothed[i - 1] * 1.1 && val >= smoothed[i + 1] && val >= mean * 1.4) {
      drops.push(Number(t.toFixed(2)));
    }
    if (activeStart === null && val >= hi) {
      activeStart = t;
      accumEnergy = val;
    } else if (activeStart !== null) {
      accumEnergy += val;
      if (val <= lo || i === smoothed.length - 1) {
        const end = t;
        phrases.push({
          start: Number(activeStart.toFixed(2)),
          end: Number(end.toFixed(2)),
          energy: Number((accumEnergy / Math.max(1, end - activeStart)).toFixed(4)),
        });
        activeStart = null;
        accumEnergy = 0;
      }
    }
  }

  const structure: Array<{ label: string; start: number; end: number; confidence: number }> = [];
  if (durationSeconds && phrases.length > 0) {
    phrases.slice(0, 6).forEach((phrase, idx) => {
      structure.push({
        label: idx === 0 ? 'intro' : idx % 2 === 0 ? 'verse' : 'chorus',
        start: phrase.start,
        end: phrase.end,
        confidence: Number(Math.max(0.2, Math.min(0.95, phrase.energy)).toFixed(3)),
      });
    });
    if (typeof durationSeconds === 'number' && durationSeconds > 4) {
      const lastEnd = structure.length > 0 ? structure[structure.length - 1].end : 0;
      if (durationSeconds - lastEnd > 4) {
        structure.push({
          label: 'outro',
          start: Number(lastEnd.toFixed(2)),
          end: Number(durationSeconds.toFixed(2)),
          confidence: 0.4,
        });
      }
    }
  }

  const phraseConfidence =
    phrases.length > 0 ? Number(Math.min(0.95, 0.3 + phrases.length * 0.08).toFixed(3)) : 0.15;
  const sectionConfidence =
    structure.length > 0
      ? Number(
          (
            structure.reduce((sum, section) => sum + section.confidence, 0) / Math.max(1, structure.length)
          ).toFixed(3)
        )
      : 0.15;

  return {
    phrases: phrases.slice(0, 12),
    structure: structure.slice(0, 12),
    drops: drops.slice(0, 4),
    phraseConfidence,
    sectionConfidence,
  };
}

function detectSectionTaggingCapability(enabled: boolean): SectionTaggingCapability {
  if (!enabled) {
    return {
      enabled: false,
      transformersAvailable: false,
      webgpuAvailable: false,
      backend: 'none',
    };
  }
  const webgpuAvailable =
    typeof navigator !== 'undefined' &&
    'gpu' in navigator &&
    Boolean((navigator as unknown as { gpu?: unknown }).gpu);
  return {
    enabled: true,
    transformersAvailable: true,
    webgpuAvailable,
    backend: webgpuAvailable ? 'webgpu' : 'wasm',
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function averageWindow(values: number[], startIdx: number, endIdx: number) {
  const start = Math.max(0, startIdx);
  const end = Math.min(values.length, endIdx);
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += values[i];
  return sum / Math.max(1, end - start);
}

function buildHeuristicSectionTags(args: {
  structure: Array<{ label: string; start: number; end: number; confidence: number }>;
  waveformLite: number[];
  dropMoments: number[];
  sampleRate: number;
  durationSeconds: number | null;
  descriptors: {
    zcr?: number | null;
    spectralCentroid?: number | null;
    flatnessDb?: number | null;
    rms?: number | null;
  };
}): SectionTag[] {
  const { structure, waveformLite, dropMoments, durationSeconds, descriptors } = args;
  if (structure.length === 0) return [];
  const totalDuration = durationSeconds ?? Math.max(...structure.map((s) => s.end), 0);
  const maxWave = Math.max(1e-6, ...waveformLite, 1e-6);
  const normalizedWave = waveformLite.map((v) => v / maxWave);

  return structure.map((section, idx) => {
    const startRatio = totalDuration > 0 ? section.start / totalDuration : 0;
    const endRatio = totalDuration > 0 ? section.end / totalDuration : 0;
    const waveStart = Math.floor(startRatio * normalizedWave.length);
    const waveEnd = Math.max(waveStart + 1, Math.ceil(endRatio * normalizedWave.length));
    const sectionEnergy = averageWindow(normalizedWave, waveStart, waveEnd);
    const dropNear = dropMoments.some((d) => d >= section.start - 2 && d <= section.end + 2);

    const zcr = descriptors.zcr ?? 0;
    const centroid = descriptors.spectralCentroid ?? 0;
    const flatnessDb = descriptors.flatnessDb ?? -12;
    const rms = descriptors.rms ?? 0;

    let tag: SectionTagLabel = 'ambient';
    let confidence = clamp01(section.confidence * 0.7 + sectionEnergy * 0.3);

    if (dropNear && sectionEnergy > 0.5) {
      tag = 'drop-like';
      confidence = clamp01(0.65 + sectionEnergy * 0.25 + (dropNear ? 0.1 : 0));
    } else if (idx > 0 && sectionEnergy > 0.45 && sectionEnergy < 0.7) {
      tag = 'build';
      confidence = clamp01(0.55 + (0.7 - Math.abs(0.58 - sectionEnergy)) * 0.2);
    } else if (zcr > 0.09 || centroid > 3000 || flatnessDb > -5) {
      tag = 'percussive';
      confidence = clamp01(0.5 + zcr * 1.5 + Math.min(0.2, centroid / 20000));
    } else if (rms > 0.05 && centroid > 1200 && centroid < 3200 && zcr < 0.12) {
      tag = 'vocal-dominant';
      confidence = clamp01(0.55 + rms * 1.5);
    } else {
      tag = 'ambient';
      confidence = clamp01(0.45 + (1 - sectionEnergy) * 0.2);
    }

    return {
      start: section.start,
      end: section.end,
      tag,
      confidence: Number(confidence.toFixed(3)),
      source: 'heuristic',
    };
  });
}

async function tryTransformersSectionTags(
  enabled: boolean,
  samples: Float32Array,
  sampleRate: number,
  structure: Array<{ label: string; start: number; end: number; confidence: number }>,
  heuristicTags: SectionTag[]
): Promise<SectionTaggingResult> {
  const startedAt = performance.now();
  if (!enabled) {
    return {
      enabled: false,
      attempted: false,
      backend: 'none',
      status: 'disabled',
      timing: { totalMs: 0, modelLoadMs: 0, inferenceMs: 0 },
      fallbackReason: 'feature_disabled',
      tags: heuristicTags,
    };
  }

  const capability = detectSectionTaggingCapability(true);
  if (structure.length === 0) {
    return {
      enabled: true,
      attempted: false,
      backend: capability.backend,
      status: 'unavailable',
      timing: {
        totalMs: Number((performance.now() - startedAt).toFixed(2)),
        modelLoadMs: 0,
        inferenceMs: 0,
      },
      fallbackReason: 'no_sections_available',
      error: 'No sections available for tagging',
      tags: [],
    };
  }

  try {
    const modelLoadStartedAt = performance.now();
    const mod = (await dynamicImport('@huggingface/transformers')) as Record<string, unknown>;
    const env = mod.env as Record<string, unknown> | undefined;
    if (env && typeof env === 'object') {
      (env as Record<string, unknown>).allowLocalModels = false;
    }

    // We intentionally keep this optional and bounded. If model loading fails or is too heavy,
    // the heuristic tags remain authoritative for the current release.
    const pipelineFactory = mod.pipeline as
      | ((
          task: string,
          model?: string,
          options?: Record<string, unknown>
        ) => Promise<unknown>)
      | undefined;

    if (typeof pipelineFactory !== 'function') {
      return {
        enabled: true,
        attempted: false,
        backend: 'heuristic',
        status: 'fallback',
        timing: {
          totalMs: Number((performance.now() - startedAt).toFixed(2)),
          modelLoadMs: Number((performance.now() - modelLoadStartedAt).toFixed(2)),
          inferenceMs: 0,
        },
        fallbackReason: 'pipeline_factory_unavailable',
        error: 'Transformers pipeline factory unavailable',
        tags: heuristicTags,
      };
    }

    const model = 'Xenova/yamnet';
    // Bounded attempt: warm the pipeline and classify at most 2 sections, then blend only if successful.
    const classifier = (await pipelineFactory('audio-classification', model, {
      device: capability.backend === 'webgpu' ? 'webgpu' : 'wasm',
      quantized: true,
    })) as ((audio: Float32Array, opts?: Record<string, unknown>) => Promise<Array<{ label: string; score: number }>>);
    const modelLoadMs = Number((performance.now() - modelLoadStartedAt).toFixed(2));

    const tags = [...heuristicTags];
    const maxMlSections = Math.min(2, structure.length);
    const inferenceStartedAt = performance.now();
    for (let i = 0; i < maxMlSections; i++) {
      const s = structure[i];
      const start = Math.max(0, Math.floor(s.start * sampleRate));
      const end = Math.min(samples.length, Math.ceil(s.end * sampleRate));
      const clip = samples.subarray(start, Math.min(end, start + sampleRate * 8));
      if (clip.length < 1024) continue;
      const out = await classifier(clip, { topk: 5 });
      const mapped = mapAudioClassificationToSectionTag(out);
      if (mapped) {
        tags[i] = {
          ...tags[i],
          tag: mapped.tag,
          confidence: Number(Math.max(tags[i].confidence, mapped.confidence).toFixed(3)),
          source: 'ml',
        };
      }
    }

    return {
      enabled: true,
      attempted: true,
      backend: capability.backend,
      status: 'success',
      timing: {
        totalMs: Number((performance.now() - startedAt).toFixed(2)),
        modelLoadMs,
        inferenceMs: Number((performance.now() - inferenceStartedAt).toFixed(2)),
      },
      fallbackReason: null,
      model,
      tags,
    };
  } catch (error) {
    return {
      enabled: true,
      attempted: true,
      backend: capability.backend,
      status: 'fallback',
      timing: {
        totalMs: Number((performance.now() - startedAt).toFixed(2)),
        modelLoadMs: null,
        inferenceMs: null,
      },
      fallbackReason: error instanceof Error ? error.message : 'transformers_section_tagging_failed',
      error: error instanceof Error ? error.message : 'Transformers section tagging failed',
      tags: heuristicTags,
    };
  }
}

function mapAudioClassificationToSectionTag(
  labels: Array<{ label: string; score: number }>
): { tag: SectionTagLabel; confidence: number } | null {
  if (!Array.isArray(labels) || labels.length === 0) return null;
  const joined = labels
    .slice(0, 5)
    .map((x) => `${x.label}`.toLowerCase())
    .join(' | ');
  const topScore = Math.max(...labels.map((l) => l.score || 0), 0);

  if (/(speech|singing|vocal|choir|voice)/.test(joined)) {
    return { tag: 'vocal-dominant', confidence: Number(clamp01(0.45 + topScore * 0.5).toFixed(3)) };
  }
  if (/(drum|percussion|snare|kick|hi-hat)/.test(joined)) {
    return { tag: 'percussive', confidence: Number(clamp01(0.45 + topScore * 0.5).toFixed(3)) };
  }
  if (/(ambient|pad|drone)/.test(joined)) {
    return { tag: 'ambient', confidence: Number(clamp01(0.45 + topScore * 0.5).toFixed(3)) };
  }
  if (/(electronic|dance|house|techno)/.test(joined)) {
    return { tag: 'drop-like', confidence: Number(clamp01(0.4 + topScore * 0.45).toFixed(3)) };
  }
  return null;
}

function fuseSectionTagsIntoStructure(
  structure: Array<{ label: string; start: number; end: number; confidence: number }>,
  tags: SectionTag[]
) {
  return structure.map((section) => {
    const tag = tags.find((t) => Math.abs(t.start - section.start) < 0.05 && Math.abs(t.end - section.end) < 0.05);
    if (!tag) return section;

    let nextLabel = section.label;
    if (tag.tag === 'drop-like') nextLabel = 'chorus';
    else if (tag.tag === 'build') nextLabel = section.label === 'intro' ? 'build' : section.label;
    else if (tag.tag === 'ambient' && section.start < 15) nextLabel = 'intro';
    else if (tag.tag === 'vocal-dominant' && section.label === 'verse') nextLabel = 'chorus';

    const fusedConfidence = Number(
      clamp01(section.confidence * 0.65 + tag.confidence * 0.35).toFixed(3)
    );
    return { ...section, label: nextLabel, confidence: fusedConfidence };
  });
}

async function tryMeydaFeatures(samples: Float32Array) {
  try {
    const mod = (await dynamicImport('meyda')) as Record<string, unknown>;
    const meyda = (mod.default ?? mod) as {
      extract?: (features: string[], signal: Float32Array) => Record<string, number> | null;
    };
    if (typeof meyda.extract !== 'function') {
      return { meydaAvailable: false, rms: null, spectralCentroid: null, zcr: null };
    }

    const frameSize = 2048;
    const frame = samples.length >= frameSize ? samples.subarray(0, frameSize) : samples;
    const extracted = meyda.extract(['rms', 'spectralCentroid', 'zcr'], frame) ?? {};
    return {
      meydaAvailable: true,
      rms: typeof extracted.rms === 'number' ? Number(extracted.rms.toFixed(6)) : null,
      spectralCentroid:
        typeof extracted.spectralCentroid === 'number' ? Number(extracted.spectralCentroid.toFixed(3)) : null,
      zcr: typeof extracted.zcr === 'number' ? Number(extracted.zcr.toFixed(6)) : null,
    };
  } catch {
    return { meydaAvailable: false, rms: null, spectralCentroid: null, zcr: null };
  }
}

async function tryEssentiaAdapter(samples?: Float32Array, sampleRate?: number) {
  try {
    const mod = ((await dynamicImport('essentia.js')) as { default?: EssentiaModule } & Partial<EssentiaModule>);
    const essentiaPkg = (mod.default ?? mod) as EssentiaModule;
    const exportKeys = Object.keys(essentiaPkg as unknown as Record<string, unknown>);
    const essentiaExports = exportKeys.slice(0, 8);
    const essentiaAdapterReady =
      exportKeys.includes('Essentia') &&
      exportKeys.includes('EssentiaWASM') &&
      exportKeys.includes('EssentiaExtractor');
    let essentiaRms: number | null = null;
    let essentiaZcr: number | null = null;
    let essentiaSpectralCentroid: number | null = null;
    let essentiaSpectralRolloff: number | null = null;
    let essentiaFlatnessDb: number | null = null;
    let essentiaCrest: number | null = null;
    let essentiaEnergy: number | null = null;
    let essentiaVersion: string | null = null;
    let extractionMs: number | null = null;

    if (essentiaAdapterReady && samples && samples.length > 0 && sampleRate) {
      const frame = samples.length > 8192 ? samples.subarray(0, 8192) : samples;
      const inst = new essentiaPkg.Essentia(essentiaPkg.EssentiaWASM);
      try {
        const started = performance.now();
        essentiaVersion = typeof inst.version === 'string' ? inst.version : null;
        const vector = inst.arrayToVector(frame);
        const rms = inst.RMS(vector);
        const zcr = inst.ZeroCrossingRate(vector);
        const centroid = inst.SpectralCentroidTime(vector, sampleRate);
        const maybeCall = (name: string, ...args: unknown[]) => {
          const fn = inst[name];
          if (typeof fn !== 'function') return null;
          try {
            return (fn as (...fnArgs: unknown[]) => unknown)(...args);
          } catch {
            return null;
          }
        };
        const rolloff =
          maybeCall('RollOff', vector, sampleRate) ??
          maybeCall('SpectralRolloff', vector, sampleRate);
        const flatness = maybeCall('FlatnessDB', vector) ?? maybeCall('Flatness', vector);
        const crest = maybeCall('Crest', vector);
        const energy = maybeCall('Energy', vector);
        essentiaRms = typeof rms?.rms === 'number' ? Number(rms.rms.toFixed(6)) : null;
        essentiaZcr =
          typeof zcr?.zeroCrossingRate === 'number'
            ? Number(zcr.zeroCrossingRate.toFixed(6))
            : null;
        essentiaSpectralCentroid =
          typeof centroid?.centroid === 'number'
            ? Number(centroid.centroid.toFixed(3))
            : null;
        essentiaSpectralRolloff =
          typeof (rolloff as { rollOff?: number } | null)?.rollOff === 'number'
            ? Number(((rolloff as { rollOff: number }).rollOff).toFixed(3))
            : typeof (rolloff as { spectralRolloff?: number } | null)?.spectralRolloff === 'number'
              ? Number(((rolloff as { spectralRolloff: number }).spectralRolloff).toFixed(3))
              : null;
        essentiaFlatnessDb =
          typeof (flatness as { flatnessDB?: number } | null)?.flatnessDB === 'number'
            ? Number(((flatness as { flatnessDB: number }).flatnessDB).toFixed(6))
            : typeof (flatness as { flatness?: number } | null)?.flatness === 'number'
              ? Number(((flatness as { flatness: number }).flatness).toFixed(6))
              : null;
        essentiaCrest =
          typeof (crest as { crest?: number } | null)?.crest === 'number'
            ? Number(((crest as { crest: number }).crest).toFixed(6))
            : null;
        essentiaEnergy =
          typeof (energy as { energy?: number } | null)?.energy === 'number'
            ? Number(((energy as { energy: number }).energy).toFixed(6))
            : null;
        extractionMs = Number((performance.now() - started).toFixed(2));
      } finally {
        try {
          inst.shutdown?.();
          inst.delete?.();
        } catch {
          // no-op: adapter cleanup should not fail browser analysis
        }
      }
    }

    return {
      essentiaAvailable: true,
      essentiaAdapterReady,
      essentiaExports,
      essentiaVersion,
      essentiaRms,
      essentiaZcr,
      essentiaSpectralCentroid,
      essentiaSpectralRolloff,
      essentiaFlatnessDb,
      essentiaCrest,
      essentiaEnergy,
      extractionMs,
    };
  } catch {
    return {
      essentiaAvailable: false,
      essentiaAdapterReady: false,
      essentiaExports: [] as string[],
      essentiaVersion: null,
      essentiaRms: null,
      essentiaZcr: null,
      essentiaSpectralCentroid: null,
      essentiaSpectralRolloff: null,
      essentiaFlatnessDb: null,
      essentiaCrest: null,
      essentiaEnergy: null,
      extractionMs: null,
    };
  }
}

async function analyzePcm(payload: AnalyzePayload): Promise<BrowserAnalysisHint> {
  const samples = new Float32Array(payload.channelDataBuffer);
  const sampleRate = payload.sampleRate;
  const durationSeconds = samples.length > 0 ? Number((samples.length / sampleRate).toFixed(2)) : null;

  const { envelope, hopSize } = computeEnergyEnvelope(samples);
  const waveformLite = computeWaveformLite(samples);
  const fallbackBpm = estimateBpmFallback(envelope, sampleRate, hopSize);
  const key = estimateKey(samples, sampleRate);
  const phraseSection = estimatePhrasesAndSections(envelope, hopSize, sampleRate, durationSeconds);
  const meyda = await tryMeydaFeatures(samples);
  const essentia = await tryEssentiaAdapter(samples, sampleRate);
  const heuristicSectionTags = buildHeuristicSectionTags({
    structure: phraseSection.structure,
    waveformLite,
    dropMoments: phraseSection.drops,
    sampleRate,
    durationSeconds,
    descriptors: {
      zcr: essentia.essentiaZcr ?? meyda.zcr ?? null,
      spectralCentroid: essentia.essentiaSpectralCentroid ?? meyda.spectralCentroid ?? null,
      flatnessDb: essentia.essentiaFlatnessDb ?? null,
      rms: essentia.essentiaRms ?? meyda.rms ?? null,
    },
  });
  const sectionTagging = await tryTransformersSectionTags(
    Boolean(payload.flags?.mlSectionTagging),
    samples,
    sampleRate,
    phraseSection.structure,
    heuristicSectionTags
  );
  const fusedStructure = fuseSectionTagsIntoStructure(phraseSection.structure, sectionTagging.tags);
  const analysisFeaturesSource =
    essentia.essentiaAdapterReady && (
      essentia.essentiaSpectralCentroid != null ||
      essentia.essentiaSpectralRolloff != null ||
      essentia.essentiaFlatnessDb != null
    )
      ? 'hybrid'
      : meyda.meydaAvailable
        ? 'meyda'
        : essentia.essentiaAvailable
          ? 'essentia'
          : 'meyda';

  const bpm = payload.externalBpm ?? (fallbackBpm.bpm ? Number(fallbackBpm.bpm.toFixed(2)) : null);
  const bpmConfidence =
    payload.externalBpmConfidence ??
    (fallbackBpm.confidence ? Number(fallbackBpm.confidence.toFixed(3)) : null);

  const keyConfidence = key.confidence ?? null;
  const overall = Number(
    (
      (bpmConfidence ?? 0.2) * 0.45 +
      (keyConfidence ?? 0.15) * 0.35 +
      (phraseSection.phraseConfidence ?? 0.15) * 0.1 +
      (phraseSection.sectionConfidence ?? 0.15) * 0.1
    ).toFixed(3)
  );

  return {
    source: 'browser-worker',
    version: 'browser-v1',
    fileName: payload.fileName,
    fileSizeBytes: payload.fileSizeBytes,
    mimeType: payload.mimeType,
    generatedAt: new Date().toISOString(),
    durationSeconds,
    bpm,
    bpmConfidence,
    keySignature: key.keySignature,
    keyConfidence,
    phraseConfidence: phraseSection.phraseConfidence,
    sectionConfidence: phraseSection.sectionConfidence,
    beatGrid: generateBeatGrid(bpm, durationSeconds),
    phrases: phraseSection.phrases,
    structure: fusedStructure,
    dropMoments: phraseSection.drops,
    waveformLite,
    analysisFeatures: {
      version: 'mir-v1',
      source: analysisFeaturesSource,
      extractionMs: essentia.extractionMs ?? null,
      sectionTagging: sectionTagging,
      descriptors: {
        rms: essentia.essentiaRms ?? meyda.rms,
        energy: essentia.essentiaEnergy ?? meyda.rms,
        zcr: essentia.essentiaZcr ?? meyda.zcr,
        spectralCentroid: essentia.essentiaSpectralCentroid ?? meyda.spectralCentroid,
        spectralRolloff: essentia.essentiaSpectralRolloff ?? null,
        flatnessDb: essentia.essentiaFlatnessDb ?? null,
        crest: essentia.essentiaCrest ?? null,
      },
    },
    featureSummary: {
      rms: meyda.rms,
      spectralCentroid: meyda.spectralCentroid,
      zcr: meyda.zcr,
      meydaAvailable: meyda.meydaAvailable,
      essentiaAvailable: essentia.essentiaAvailable,
      essentiaAdapterReady: essentia.essentiaAdapterReady,
      essentiaExports: essentia.essentiaExports,
      essentiaVersion: essentia.essentiaVersion,
      essentiaRms: essentia.essentiaRms,
      essentiaZcr: essentia.essentiaZcr,
      essentiaSpectralCentroid: essentia.essentiaSpectralCentroid,
      essentiaSpectralRolloff: essentia.essentiaSpectralRolloff,
      essentiaFlatnessDb: essentia.essentiaFlatnessDb,
      essentiaCrest: essentia.essentiaCrest,
      essentiaEnergy: essentia.essentiaEnergy,
      mlSectionTaggingEnabled: Boolean(payload.flags?.mlSectionTagging),
      mlSectionTaggingBackend: sectionTagging.backend,
      mlSectionTaggingStatus: sectionTagging.status,
      mlSectionTaggingTotalMs: sectionTagging.timing?.totalMs ?? null,
      mlSectionTaggingModelLoadMs: sectionTagging.timing?.modelLoadMs ?? null,
      mlSectionTaggingInferenceMs: sectionTagging.timing?.inferenceMs ?? null,
      mlSectionTaggingFallbackReason: sectionTagging.fallbackReason ?? null,
      beatDetectorAvailable: payload.externalBpm != null,
    },
    confidence: {
      overall,
      tempo: bpmConfidence,
      key: keyConfidence,
      phrase: phraseSection.phraseConfidence,
      section: phraseSection.sectionConfidence,
    },
  };
}

export type BrowserAnalysisWorkerApi = {
  analyzePcm(payload: AnalyzePayload): Promise<BrowserAnalysisHint>;
};

const api: BrowserAnalysisWorkerApi = {
  analyzePcm,
};

expose(api);

export {};
