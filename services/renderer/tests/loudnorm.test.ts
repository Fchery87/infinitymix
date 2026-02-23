import { describe, it, expect } from 'vitest';
import { parseLoudnormStats, buildLoudnormPass2Filter, shouldRetryRender, type LoudnormStats, type QaMetrics } from '../src/loudnorm';

describe('parseLoudnormStats', () => {
  it('parses valid loudnorm JSON output', () => {
    const raw = JSON.stringify({
      input_i: '-24.5',
      input_tp: '-3.2',
      input_lra: '8.1',
      input_thresh: '-35.2',
      output_i: '-14.0',
      output_tp: '-1.5',
      output_lra: '7.5',
      output_thresh: '-24.8',
      normalization_type: 'dynamic',
      target_offset: '0.0',
    });
    const stats = parseLoudnormStats(raw);
    expect(stats).not.toBeNull();
    expect(stats!.inputI).toBeCloseTo(-24.5);
    expect(stats!.inputTp).toBeCloseTo(-3.2);
    expect(stats!.inputLra).toBeCloseTo(8.1);
    expect(stats!.inputThresh).toBeCloseTo(-35.2);
  });

  it('returns null for invalid JSON', () => {
    expect(parseLoudnormStats('not json')).toBeNull();
  });
});

describe('buildLoudnormPass2Filter', () => {
  it('builds correct filter string with measured values', () => {
    const stats: LoudnormStats = {
      inputI: -24.5,
      inputTp: -3.2,
      inputLra: 8.1,
      inputThresh: -35.2,
    };
    const filter = buildLoudnormPass2Filter(stats);
    expect(filter).toContain('loudnorm=');
    expect(filter).toContain('measured_I=-24.5');
    expect(filter).toContain('measured_TP=-3.2');
    expect(filter).toContain('measured_LRA=8.1');
    expect(filter).toContain('measured_thresh=-35.2');
    expect(filter).toContain('I=-14');
    expect(filter).toContain('TP=-1.5');
    expect(filter).toContain('linear=true');
  });
});

describe('shouldRetryRender', () => {
  it('returns false when metrics are within tolerance', () => {
    const metrics: QaMetrics = {
      integratedLoudness: -14.3,
      truePeak: -1.8,
      loudnessRange: 8.0,
      clippingDetected: false,
    };
    expect(shouldRetryRender(metrics)).toBe(false);
  });

  it('returns true when loudness is out of tolerance', () => {
    const metrics: QaMetrics = {
      integratedLoudness: -18.0,
      truePeak: -2.0,
      loudnessRange: 8.0,
      clippingDetected: false,
    };
    expect(shouldRetryRender(metrics)).toBe(true);
  });

  it('returns true when true peak exceeds ceiling', () => {
    const metrics: QaMetrics = {
      integratedLoudness: -14.2,
      truePeak: -0.5,
      loudnessRange: 8.0,
      clippingDetected: false,
    };
    expect(shouldRetryRender(metrics)).toBe(true);
  });

  it('returns true when clipping is detected', () => {
    const metrics: QaMetrics = {
      integratedLoudness: -14.0,
      truePeak: -1.5,
      loudnessRange: 8.0,
      clippingDetected: true,
    };
    expect(shouldRetryRender(metrics)).toBe(true);
  });
});
