/**
 * Filter Chain Builder
 * 
 * Builder pattern for constructing FFmpeg audio filter chains.
 * Provides fluent API for chaining audio processing steps.
 */

import { log } from '@/lib/logger';
import type { LoudnessConfig } from './audio-normalizer';
import type { MultibandConfig } from './mixing-service';

/**
 * Filter chain builder for constructing FFmpeg audio filters
 */
export class AudioFilterChain {
  private filters: string[] = [];
  private label: string = 'out';
  private readonly OUTPUT_SAMPLE_RATE = 44100;
  private readonly OUTPUT_CHANNELS = 2;

  constructor(label?: string) {
    if (label) {
      this.label = label;
    }
  }

  /**
   * Add loudness normalization filter (EBU R128)
   */
  public addLoudnessNormalization(config: LoudnessConfig): this {
    const filter = `loudnorm=` +
      `I=${config.targetIntegrated}:` +
      `LRA=${config.targetLRA}:` +
      `TP=${config.targetTP}:` +
      `dual_mono=${config.dualMono ? 'true' : 'false'}:` +
      `print_format=${config.printFormat}`;
    
    this.filters.push(filter);
    log('info', 'filterChain.addLoudnessNormalization', {
      targetI: config.targetIntegrated,
      targetLRA: config.targetLRA,
      targetTP: config.targetTP,
    });
    
    return this;
  }

  /**
   * Add multiband compression
   */
  public addMultibandCompression(config: MultibandConfig): this {
    const filter = this.buildMultibandFilter(config);
    this.filters.push(filter);
    log('info', 'filterChain.addMultibandCompression', {
      lowThreshold: config.lowBand.threshold,
      midThreshold: config.midBand.threshold,
      highThreshold: config.highBand.threshold,
    });
    
    return this;
  }

  /**
   * Add sidechain compression for ducking
   */
  public addSidechainDucking(thresholdDb: number = -20, ratio: number = 4, attackMs: number = 10, releaseMs: number = 100): this {
    const filter = `acompressor=` +
      `threshold=${thresholdDb}db:` +
      `ratio=${ratio}:` +
      `attack=${attackMs}ms:` +
      `release=${releaseMs}ms`;
    
    this.filters.push(filter);
    log('info', 'filterChain.addSidechainDucking', {
      thresholdDb,
      ratio,
      attackMs,
      releaseMs,
    });
    
    return this;
  }

  /**
   * Add vocal ducking (gradually reduce vocals over duration)
   */
  public addVocalDucking(duckDuration: number, duckAmount: number = 0.3): this {
    // Gradually reduce vocals over duckDuration
    const duckCurve = `1-${duckAmount}*t/${duckDuration}`;
    this.filters.push(`volume=${duckCurve}`);
    
    log('info', 'filterChain.addVocalDucking', {
      duckDuration,
      duckAmount,
    });
    
    return this;
  }

  /**
   * Add EQ curve (volume automation over time)
   */
  public addEQCurve(startVolume: number, endVolume: number, duration: number): this {
    const curve = `volume=${startVolume}+(${endVolume}-${startVolume})*t/${duration}`;
    this.filters.push(curve);
    
    log('info', 'filterChain.addEQCurve', {
      startVolume,
      endVolume,
      duration,
    });
    
    return this;
  }

  /**
   * Add parametric EQ (bell filter)
   */
  public addParametricEQ(freq: number, gain: number, q: number = 1): this {
    this.filters.push(`equalizer=f=${freq}:t=h:width=${q * 100}:g=${gain}`);
    
    log('info', 'filterChain.addParametricEQ', {
      freq,
      gain,
      q,
    });
    
    return this;
  }

  /**
   * Add highpass filter (cuts low frequencies)
   */
  public addHighpass(freq: number): this {
    this.filters.push(`highpass=f=${freq}`);
    log('info', 'filterChain.addHighpass', { freq });
    return this;
  }

  /**
   * Add lowpass filter (cuts high frequencies)
   */
  public addLowpass(freq: number): this {
    this.filters.push(`lowpass=f=${freq}`);
    log('info', 'filterChain.addLowpass', { freq });
    return this;
  }

  /**
   * Add bandpass filter (keeps frequency range)
   */
  public addBandpass(freq: number, widthType: 'h' | 'q' | 's' = 'h', width: number = 1000): this {
    this.filters.push(`bandpass=f=${freq}:width_type=${widthType}:width=${width}`);
    log('info', 'filterChain.addBandpass', { freq, widthType, width });
    return this;
  }

  /**
   * Add shelf EQ (high or low shelf)
   */
  public addShelfEQ(freq: number, gain: number, type: 'high' | 'low' = 'high'): this {
    const filter = type === 'high'
      ? `highshelf=f=${freq}:gain=${gain}`
      : `lowshelf=f=${freq}:gain=${gain}`;
    this.filters.push(filter);
    
    log('info', 'filterChain.addShelfEQ', { freq, gain, type });
    return this;
  }

  /**
   * Add compressor
   */
  public addCompressor(thresholdDb: number = -20, ratio: number = 4, attackMs: number = 20, releaseMs: number = 250): this {
    const filter = `acompressor=` +
      `threshold=${thresholdDb}db:` +
      `ratio=${ratio}:` +
      `attack=${attackMs}ms:` +
      `release=${releaseMs}ms`;
    
    this.filters.push(filter);
    log('info', 'filterChain.addCompressor', {
      thresholdDb,
      ratio,
      attackMs,
      releaseMs,
    });
    
    return this;
  }

  /**
   * Add limiter (prevents clipping)
   */
  public addLimiter(levelIn: number = 1, levelOut: number = 0.95, attackMs: number = 5, releaseMs: number = 50): this {
    const filter = `alimiter=` +
      `level_in=${levelIn}:` +
      `level_out=${levelOut}:` +
      `attack=${attackMs}ms:` +
      `release=${releaseMs}ms`;
    
    this.filters.push(filter);
    log('info', 'filterChain.addLimiter', {
      levelIn,
      levelOut,
      attackMs,
      releaseMs,
    });
    
    return this;
  }

  /**
   * Add volume adjustment
   */
  public addVolume(volume: number): this {
    this.filters.push(`volume=${volume.toFixed(3)}`);
    log('info', 'filterChain.addVolume', { volume });
    return this;
  }

  /**
   * Add filter sweep (dynamic highpass to lowpass)
   */
  public addFilterSweep(startFreq: number, endFreq: number, duration: number, curve: 'linear' | 'exp' | 'log' = 'linear'): this {
    let freqExpression: string;
    
    switch (curve) {
      case 'linear':
        freqExpression = `${startFreq}+(${endFreq}-${startFreq})*t/${duration}`;
        break;
      case 'exp':
        freqExpression = `${startFreq}*(${endFreq}/${startFreq})^(t/${duration})`;
        break;
      case 'log':
        freqExpression = `${startFreq}*Math.exp(Math.log(${endFreq}/${startFreq})*t/${duration})`;
        break;
      default:
        freqExpression = `${startFreq}+(${endFreq}-${startFreq})*t/${duration}`;
    }
    
    // Use highpass sweep (gradual filter opening)
    this.filters.push(`highpass=f=${freqExpression}`);
    
    log('info', 'filterChain.addFilterSweep', {
      startFreq,
      endFreq,
      duration,
      curve,
    });
    
    return this;
  }

  /**
   * Add custom filter string
   */
  public addCustomFilter(filter: string): this {
    this.filters.push(filter);
    log('info', 'filterChain.addCustomFilter', { filter });
    return this;
  }

  /**
   * Add multiple filters at once
   */
  public addFilters(filters: string[]): this {
    this.filters.push(...filters);
    return this;
  }

  /**
   * Remove last filter
   */
  public pop(): AudioFilterChain {
    this.filters.pop();
    return this;
  }

  /**
   * Clear all filters
   */
  public clear(): AudioFilterChain {
    this.filters = [];
    return this;
  }

  /**
   * Get current filter count
   */
  public getFilterCount(): number {
    return this.filters.length;
  }

  /**
   * Get all filters as array
   */
  public getFilters(): string[] {
    return [...this.filters];
  }

  /**
   * Build complete filter chain as comma-separated string
   */
  public build(): string {
    return this.filters.join(',');
  }

  /**
   * Build FFmpeg audio filter arguments
   */
  public buildFFmpegArgs(): string[] {
    const filter = this.build();
    return filter ? ['-af', filter] : [];
  }

  /**
   * Build complex filter graph with input/output labels
   */
  public buildComplexFilter(inputLabels: string[], outputLabel?: string): string {
    const outLabel = outputLabel || this.label;
    const filter = this.build();
    
    if (!filter) {
      return '';
    }
    
    // Map input labels through the filter chain
    const inputMapping = inputLabels.map((label, i) => `[${label}]`).join('');
    
    return `${inputMapping}${filter}[${outLabel}]`;
  }

  /**
   * Build FFmpeg output options (sample rate, channels, bitrate)
   */
  public buildOutputOptions(): string[] {
    return [
      `-ac ${this.OUTPUT_CHANNELS}`,
      `-ar ${this.OUTPUT_SAMPLE_RATE}`,
      '-b:a 192k',
    ];
  }

  /**
   * Create a clone of this filter chain
   */
  public clone(): AudioFilterChain {
    const clone = new AudioFilterChain(this.label);
    clone.filters = [...this.filters];
    return clone;
  }

  /**
   * Build multiband compression filter string
   */
  private buildMultibandFilter(config: MultibandConfig): string {
    return `
      [in]asplit=3[low][mid][high];
      [low]lowpass=f=250,acompressor=threshold=${config.lowBand.threshold}db:ratio=${config.lowBand.ratio}:attack=20ms:release=100ms[low_comp];
      [mid]lowpass=f=2500,highpass=f=250,acompressor=threshold=${config.midBand.threshold}db:ratio=${config.midBand.ratio}:attack=20ms:release=100ms[mid_comp];
      [high]highpass=f=4000,acompressor=threshold=${config.highBand.threshold}db:ratio=${config.highBand.ratio}:attack=20ms:release=100ms[high_comp];
      [low_comp][mid_comp][high_comp]amix=inputs=3:duration=longest:normalize=0[mixed]
    `.trim();
  }
}

/**
 * Preset factory for common filter chains
 */
export class FilterChainPresets {
  /**
   * Build standard mastering chain
   */
  public static mastering(): AudioFilterChain {
    return new AudioFilterChain('mastered')
      .addCompressor(-20, 2, 20, 250)
      .addLimiter(1, 0.95, 5, 50);
  }

  /**
   * Build broadcast-ready chain
   */
  public static broadcastReady(): AudioFilterChain {
    return new AudioFilterChain('broadcast')
      .addLoudnessNormalization({
        targetIntegrated: -23,
        targetLRA: 7,
        targetTP: -2,
        dualMono: true,
        printFormat: 'summary',
      })
      .addLimiter(1, 0.98, 5, 50);
  }

  /**
   * Build stem-specific processing chain
   */
  public static stemProcessing(stemType: 'vocals' | 'drums' | 'bass' | 'other'): AudioFilterChain {
    const chain = new AudioFilterChain(`${stemType}_processed`);

    switch (stemType) {
      case 'vocals':
        return chain
          .addHighpass(120)
          .addLowpass(12000)
          .addParametricEQ(500, -2, 2); // Cut low-mids

      case 'drums':
        return chain
          .addHighpass(150)
          .addLowpass(12000)
          .addCompressor(-15, 3, 10, 100);

      case 'bass':
        return chain
          .addLowpass(200)
          .addParametricEQ(80, 2, 1); // Boost sub

      case 'other':
        return chain
          .addBandpass(500, 'h', 15000)
          .addVolume(0.7);

      default:
        return chain;
    }
  }

  /**
   * Build transition-specific chain
   */
  public static transition(type: 'smooth' | 'drop' | 'cut' | 'filter_sweep'): AudioFilterChain {
    const chain = new AudioFilterChain('transition');

    switch (type) {
      case 'smooth':
        return chain
          .addEQCurve(1, 1, 4); // Linear crossfade

      case 'drop':
        return chain
          .addCompressor(-12, 4, 5, 50); // Add punch

      case 'cut':
        return chain; // No processing

      case 'filter_sweep':
        return chain
          .addFilterSweep(20, 20000, 4, 'exp');

      default:
        return chain;
    }
  }

  /**
   * Build genre-specific chain
   */
  public static genrePreset(genre: 'electronic' | 'hiphop' | 'rock' | 'pop' | 'jazz'): AudioFilterChain {
    const chain = new AudioFilterChain('genre_preset');

    switch (genre) {
      case 'electronic':
        return chain
          .addMultibandCompression({
            lowBand: { threshold: -24, ratio: 2 },
            midBand: { threshold: -20, ratio: 3 },
            highBand: { threshold: -18, ratio: 4 },
          })
          .addLimiter(1, 0.95, 5, 50);

      case 'hiphop':
        return chain
          .addHighpass(80)
          .addCompressor(-18, 3, 20, 250)
          .addLimiter(1, 0.98, 5, 50);

      case 'rock':
        return chain
          .addParametricEQ(350, -2, 2) // Cut mud
          .addCompressor(-20, 4, 15, 200)
          .addLimiter(1, 0.95, 3, 30);

      case 'pop':
        return chain
          .addCompressor(-18, 2.5, 20, 250)
          .addLimiter(1, 0.96, 5, 50);

      case 'jazz':
        return chain
          .addCompressor(-22, 1.5, 30, 300) // Gentle compression
          .addLimiter(1, 0.9, 10, 100);

      default:
        return chain;
    }
  }
}

log('info', 'filterChain.service.loaded', {
  availablePresets: ['mastering', 'broadcastReady', 'stemProcessing', 'transition', 'genrePreset'],
});
