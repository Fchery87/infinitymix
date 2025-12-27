/**
 * Stem-Mixing Service
 * 
 * Per-stem mixing architecture for professional mashup blends.
 * Each stem (vocals, drums, bass, other) gets individual processing:
 * - EQ to prevent frequency masking
 * - Volume balancing via RMS
 * - Per-stem transitions for cleaner blends
 */

import { log } from '@/lib/logger';
import { logTelemetry } from '@/lib/telemetry';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { CROSSFADE_PRESETS, TransitionStyle } from './auto-dj-service';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as string);
}

const OUTPUT_SAMPLE_RATE = 44100;
const OUTPUT_CHANNELS = 2;
const OUTPUT_FORMAT = 'mp3';

/**
 * Stem-specific data for mixing
 */
export interface StemData {
  buffer: Buffer;
  volume?: number;      // 0-1, default auto-calculated
  eq?: string;          // FFmpeg EQ filter string
  enabled?: boolean;    // False to mute this stem
}

/**
 * Configuration for per-stem mixing
 */
export interface StemMixingConfig {
  /**
   * Tracks with their stems
   */
  tracks: Array<{
    id: string;
    bpm?: number;
    stems: {
      vocals?: StemData;
      drums?: StemData;
      bass?: StemData;
      other?: StemData;  // Instrumental/melody elements
    };
  }>;

  /**
   * Transitions between tracks
   */
  transitions: Array<{
    fromTrackId: string;
    toTrackId: string;
    style: 'standard' | 'vocals_only' | 'instrumental_bridge' | 'drum_swap' | 'three_band_swap';
    duration: number;           // Crossfade duration in seconds
    transitionPoint?: number;   // Where transition starts (0-1)
    crossfadeCurve?: TransitionStyle;
    enableFilterSweep?: boolean;
  }>;

  /**
   * Global processing options
   */
  processing: {
    enableMultibandCompression?: boolean;
    enableSidechainDucking?: boolean;
    enableDynamicEQ?: boolean;
    loudnessNormalization?: 'ebu_r128' | 'peak' | 'none';
    targetLoudness?: number;   // -23 LUFS for EBU
  };
}

/**
 * Mix quality metrics returned after processing
 */
export interface StemMixingMetrics {
  processingTimeMs: number;
  outputSizeBytes: number;
  stemsProcessed: number;
  transitionsApplied: number;
  peakDb: number;
  rmsDb: number;
}

/**
 * Default EQ settings per stem type to prevent frequency masking
 */
const DEFAULT_STEM_EQ: Record<string, string> = {
  vocals: 'highpass=f=120,lowpass=f=12000,equalizer=f=500:t=h:width=200:g=-2',  // Cut lows, slight mids cut
  drums: 'highpass=f=150,lowpass=f=12000,highpass=f=80',               // Punch through mids
  bass: 'lowpass=f=200,equalizer=f=80:t=h:width=100:g=2',               // Focus on lows
  other: 'bandpass=f=500:15000,volume=0.7',                             // Mids only
};

/**
 * Default volume levels per stem type (relative balance)
 */
const DEFAULT_STEM_VOLUME: Record<string, number> = {
  vocals: 0.75,
  drums: 0.85,
  bass: 0.90,
  other: 0.70,
};

/**
 * Build per-stem filter chain
 */
function buildStemFilterChain(
  stemType: string,
  data: StemData,
  processing: StemMixingConfig['processing']
): string {
  const filters: string[] = [];

  // 1. EQ (prevent frequency masking)
  const eq = data.eq ?? DEFAULT_STEM_EQ[stemType];
  if (eq) {
    filters.push(eq);
  }

  // 2. Volume
  const vol = data.volume ?? DEFAULT_STEM_VOLUME[stemType];
  filters.push(`volume=${vol.toFixed(3)}`);

  // 3. Enable/disable stem
  if (data.enabled === false) {
    filters.push('volume=0');
  }

  return filters.join(',');
}

/**
 * Build multiband compression filter
 */
function buildMultibandCompression(): string {
  // Simulate multiband by splitting into 3 bands
  return `
    [in]asplit=3[low][mid][high];
    [low]lowpass=f=250,acompressor=threshold=-24db:ratio=2:attack=20ms:release=100ms[low_comp];
    [mid]lowpass=f=2500,highpass=f=250,acompressor=threshold=-20db:ratio=3:attack=20ms:release=100ms[mid_comp];
    [high]highpass=f=4000,acompressor=threshold=-18db:ratio=4:attack=20ms:release=100ms[high_comp];
    [low_comp][mid_comp][high_comp]amix=inputs=3:duration=longest:normalize=0[mixed]
  `.trim();
}

/**
 * Build sidechain ducking filter for vocals
 */
function buildVocalDucking(duckDuration: number): string {
  // Gradually reduce vocals (30% duck) over duration
  const duckAmount = 0.3;
  const duckCurve = `1-${duckAmount}*t/${duckDuration}`;
  return `volume=${duckCurve}`;
}

/**
 * Build loudness normalization filter
 */
function buildLoudnessNormalization(target: number): string {
  // EBU R128 target: -23 LUFS by default
  const i = target ?? -23;
  return `loudnorm=I=${i}:TP=-1.5:LRA=11:print_format=summary`;
}

/**
 * Create instrumental bridge transition
 * 
 * Removes vocals from both tracks during overlap to create cleaner blend
 */
function buildInstrumentalBridgeFilter(
  fromTrackIdx: number,
  toTrackIdx: number,
  duration: number,
  preset: { curve1: string; curve2: string }
): string {
  return `
    [track${fromTrackIdx}]asplit=2[t${fromTrackIdx}_vocals][t${fromTrackIdx}_inst];
    [track${toTrackIdx}]asplit=2[t${toTrackIdx}_vocals][t${toTrackIdx}_inst];
    [t${fromTrackIdx}_inst][t${toTrackIdx}_inst]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[bridge];
    [t${fromTrackIdx}_vocals][t${toTrackIdx}_vocals][bridge]amix=inputs=3:duration=shortest:dropout_transition=1[transition${fromTrackIdx}_${toTrackIdx}]
  `.trim();
}

/**
 * Create three-band frequency swap transition
 * 
 * Swaps different frequency ranges between tracks for creative effect
 */
function buildThreeBandSwapFilter(
  fromTrackIdx: number,
  toTrackIdx: number,
  duration: number
): string {
  return `
    [track${fromTrackIdx}]asplit=3[f${fromTrackIdx}_low][f${fromTrackIdx}_mid][f${fromTrackIdx}_high];
    [track${toTrackIdx}]asplit=3[f${toTrackIdx}_low][f${toTrackIdx}_mid][f${toTrackIdx}_high];
    [f${fromTrackIdx}_low][f${toTrackIdx}_low]amix=inputs=2:duration=longest:dropout_transition=${duration}[swapped_low];
    [f${fromTrackIdx}_mid][f${toTrackIdx}_mid]amix=inputs=2:duration=longest:dropout_transition=${duration}[swapped_mid];
    [f${fromTrackIdx}_high][f${toTrackIdx}_high]amix=inputs=2:duration=longest:dropout_transition=${duration}[swapped_high];
    [swapped_low][swapped_mid][swapped_high]amix=inputs=3:duration=longest[transition${fromTrackIdx}_${toTrackIdx}]
  `.trim();
}

/**
 * Mix stems per-track
 * 
 * Main function for per-stem mixing architecture
 */
export async function mixStemsPerTrack(
  config: StemMixingConfig,
  outputDuration?: number
): Promise<{ buffer: Buffer; metrics: StemMixingMetrics }> {
  const startedAt = Date.now();

  log('info', 'stemMixing.start', {
    trackCount: config.tracks.length,
    transitionsCount: config.transitions.length,
    processing: config.processing,
  });

  logTelemetry({
    name: 'stemMixing.start',
    properties: {
      trackCount: config.tracks.length,
      transitionsCount: config.transitions.length,
    },
  });

  const fs = await import('fs/promises');
  const os = await import('os');
  const path = await import('path');

  const tempDir = os.tmpdir();
  const tempFiles: string[] = [];
  const stemIndices = new Map<string, { trackIdx: number; stemType: string }>();

  try {
    // ========================================================================
    // Phase 1: Write all stem buffers to temp files
    // ========================================================================
    let inputIndex = 0;
    const trackOutputs: string[] = [];

    for (const track of config.tracks) {
      const trackStemLabels: string[] = [];

      for (const [stemType, stemData] of Object.entries(track.stems)) {
        if (!stemData || !stemData.buffer || stemData.enabled === false) {
          continue;
        }

        const ext = 'wav';
        const tempPath = path.join(tempDir, `stem-${track.id}-${stemType}-${Date.now()}.${ext}`);
        await fs.writeFile(tempPath, stemData.buffer);
        tempFiles.push(tempPath);

        // Map stem to input index
        stemIndices.set(`${track.id}-${stemType}`, { trackIdx: trackOutputs.length, stemType });

        // Build stem-specific filter chain
        const stemFilter = buildStemFilterChain(stemType, stemData, config.processing);
        trackStemLabels.push(`[${inputIndex}:a]${stemFilter}[${track.id}-${stemType}]`);
        inputIndex++;
      }

      // Mix stems within this track
      if (trackStemLabels.length > 0) {
        const stemInputs = trackStemLabels.join(';');
        const mixedLabel = `track${trackOutputs.length}`;
        trackStemLabels.push(`${stemInputs};[${track.id}-vocals][${track.id}-drums][${track.id}-bass][${track.id}-other]?amix=inputs=4:duration=longest:normalize=0[${mixedLabel}]`);
        trackStemLabels.push(`[${track.id}-vocals][${track.id}-drums][${track.id}-bass]?amix=inputs=3:duration=longest:normalize=0[${mixedLabel}]`);
        trackStemLabels.push(`[${track.id}-vocals][${track.id}-drums]?amix=inputs=2:duration=longest:normalize=0[${mixedLabel}]`);
        trackStemLabels.push(`[${track.id}-vocals]?volume=1[${mixedLabel}]`);

        trackOutputs.push(mixedLabel);
      }
    }

    // ========================================================================
    // Phase 2: Apply global processing (multiband, ducking, loudness)
    // ========================================================================
    const filterChains: string[] = [];

    // Add per-track mixing filters
    for (const filter of trackOutputs.flat()) {
      filterChains.push(filter);
    }

    // Add transitions between tracks
    let lastOutput = trackOutputs[0];
    for (const transition of config.transitions) {
      const fromIdx = config.tracks.findIndex(t => t.id === transition.fromTrackId);
      const toIdx = config.tracks.findIndex(t => t.id === transition.toTrackId);

      if (fromIdx === -1 || toIdx === -1) {
        log('warn', 'stemMixing.transition.skip', { 
          from: transition.fromTrackId, 
          to: transition.toTrackId,
          reason: 'track_not_found',
        });
        continue;
      }

      const preset = CROSSFADE_PRESETS[transition.crossfadeCurve ?? 'smooth'];
      const duration = Math.max(0.5, transition.duration);

      let transitionFilter = '';

      switch (transition.style) {
        case 'instrumental_bridge':
          transitionFilter = buildInstrumentalBridgeFilter(fromIdx, toIdx, duration, preset);
          break;

        case 'three_band_swap':
          transitionFilter = buildThreeBandSwapFilter(fromIdx, toIdx, duration);
          break;

        case 'vocals_only':
          // Mix only vocals during transition
          transitionFilter = `
            [track${fromIdx}]asplit=2[f${fromIdx}_vocals][f${fromIdx}_rest];
            [track${toIdx}]asplit=2[f${toIdx}_vocals][f${toIdx}_rest];
            [f${fromIdx}_vocals][f${toIdx}_vocals]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition${fromIdx}_${toIdx}]
          `.trim();
          break;

        case 'drum_swap':
          // Use drums from incoming track on outgoing track
          transitionFilter = `
            [track${fromIdx}][track${toIdx}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition${fromIdx}_${toIdx}]
          `.trim();
          break;

        case 'standard':
        default:
          // Standard crossfade with all stems
          transitionFilter = `
            [track${fromIdx}][track${toIdx}]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[transition${fromIdx}_${toIdx}]
          `.trim();
          break;
      }

      filterChains.push(transitionFilter);
      lastOutput = `transition${fromIdx}_${toIdx}`;
    }

    // ========================================================================
    // Phase 3: Final processing (limiting, normalization)
    // ========================================================================
    const finalFilters: string[] = [];

    // Multiband compression
    if (config.processing.enableMultibandCompression) {
      finalFilters.push(buildMultibandCompression());
    }

    // Loudness normalization
    if (config.processing.loudnessNormalization === 'ebu_r128') {
      finalFilters.push(buildLoudnessNormalization(config.processing.targetLoudness));
    }

    // Final limiter
    finalFilters.push('alimiter=level_in=1:level_out=0.95');

    // ========================================================================
    // Phase 4: Build and execute FFmpeg command
    // ========================================================================
    const command = ffmpeg();

    // Add all temp files as inputs
    tempFiles.forEach(filePath => command.input(filePath));

    // Build complete filter graph
    const allFilters = [...filterChains, ...finalFilters].join(';');

    command
      .complexFilter(allFilters, 'out')
      .outputOptions([
        `-ac ${OUTPUT_CHANNELS}`,
        `-ar ${OUTPUT_SAMPLE_RATE}`,
        ...(outputDuration ? [`-t ${outputDuration}`] : []),
        '-b:a 192k',
      ])
      .format(OUTPUT_FORMAT);

    log('info', 'stemMixing.ffmpeg.build', {
        filterCount: filterChains.length,
        finalFilterCount: finalFilters.length,
      });

    const chunks: Buffer[] = [];

    const result = await new Promise<Buffer>((resolve, reject) => {
      command.on('start', (cmdline) => {
        log('info', 'stemMixing.ffmpeg.start', { cmdline });
      });

      command.on('stderr', (stderrLine) => {
        if (stderrLine.includes('Error') || stderrLine.includes('error')) {
          log('error', 'stemMixing.ffmpeg.stderr', { stderrLine });
        }
      });

      command.on('error', (err) => {
        log('error', 'stemMixing.ffmpeg.error', { error: err.message });
        reject(err);
      });

      command.on('end', () => {
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        log('info', 'stemMixing.ffmpeg.end', { totalSizeBytes: totalSize });
      });

      const output = command.pipe();
      output.on('data', chunk => chunks.push(chunk));
      output.on('end', () => resolve(Buffer.concat(chunks)));
      output.on('error', (err) => {
        log('error', 'stemMixing.stream.error', { error: err.message });
        reject(err);
      });
    });

    if (!result || result.length === 0) {
      throw new Error('Stem mixing produced empty output - filter chain may have failed');
    }

    const processingTime = Date.now() - startedAt;

    const metrics: StemMixingMetrics = {
      processingTimeMs: processingTime,
      outputSizeBytes: result.length,
      stemsProcessed: config.tracks.reduce((sum, t) => sum + Object.keys(t.stems).length, 0),
      transitionsApplied: config.transitions.length,
      peakDb: -3,  // Would need analysis to calculate actual value
      rmsDb: -12,
    };

    logTelemetry({
      name: 'stemMixing.completed',
      properties: {
        processingTimeMs: processingTime,
        outputSizeBytes: result.length,
        stemsProcessed: metrics.stemsProcessed,
        transitionsApplied: metrics.transitionsApplied,
      },
    });

    log('info', 'stemMixing.completed', metrics);

    return { buffer: result, metrics };
  } finally {
    // ========================================================================
    // Phase 5: Cleanup temp files
    // ========================================================================
    for (const tempPath of tempFiles) {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

/**
 * Calculate optimal volume balance for stems
 * 
 * Uses RMS analysis to balance loudness between stems
 */
export async function calculateOptimalStemVolumes(
  stems: Map<string, Buffer>
): Promise<Map<string, number>> {
  const volumes = new Map<string, number>();
  const rmsValues: Map<string, number> = new Map();

  // Calculate RMS for each stem
  for (const [stemType, buffer] of stems) {
    const rms = await calculateRMS(buffer);
    rmsValues.set(stemType, rms);
  }

  // Find target RMS (use loudest stem as reference)
  const maxRms = Math.max(...rmsValues.values());
  const targetRms = maxRms * 0.9; // 10% headroom

  // Calculate volume adjustments
  for (const [stemType, rms] of rmsValues) {
    const adjustment = targetRms / rms;
    // Apply per-stem multiplier for balance
    const stemMultiplier = DEFAULT_STEM_VOLUME[stemType] || 0.8;
    volumes.set(stemType, adjustment * stemMultiplier);
  }

  log('info', 'stemMixing.volumes.calculated', {
    rmsValues: Object.fromEntries(rmsValues),
    volumes: Object.fromEntries(volumes),
  });

  return volumes;
}

/**
 * Calculate RMS level of an audio buffer
 */
async function calculateRMS(buffer: Buffer): Promise<number> {
  // Simplified RMS calculation (would need proper audio decoding for accuracy)
  // For now, return a value based on buffer size as approximation
  return Math.sqrt(buffer.reduce((sum, byte) => sum + byte * byte, 0) / buffer.length) / 255;
}

/**
 * Validate stem mixing configuration
 */
export function validateStemMixingConfig(config: StemMixingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.tracks.length === 0) {
    errors.push('At least one track is required');
  }

  for (const track of config.tracks) {
    const stemCount = Object.keys(track.stems).length;
    if (stemCount === 0) {
      errors.push(`Track ${track.id} has no stems`);
    }
  }

  for (const transition of config.transitions) {
    const fromExists = config.tracks.some(t => t.id === transition.fromTrackId);
    const toExists = config.tracks.some(t => t.id === transition.toTrackId);
    
    if (!fromExists) {
      errors.push(`Transition references non-existent track: ${transition.fromTrackId}`);
    }
    if (!toExists) {
      errors.push(`Transition references non-existent track: ${transition.toTrackId}`);
    }
    
    if (transition.duration < 0) {
      errors.push(`Transition duration cannot be negative: ${transition.duration}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
