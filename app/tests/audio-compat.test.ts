import { describe, it, expect } from 'vitest';
import {
  bpmCompatibility,
  camelotCompatible,
  overallCompatibility,
  calculatePitchShiftSemitones,
  semitonesToPitchRatio,
  calculateTempoRatio,
  calculateBeatAlignment,
} from '@/lib/utils/audio-compat';

describe('audio-compat', () => {
  describe('bpmCompatibility', () => {
    it('returns zero score for null/undefined inputs', () => {
      expect(bpmCompatibility(null, 120)).toEqual({ diff: null, score: 0 });
      expect(bpmCompatibility(120, null)).toEqual({ diff: null, score: 0 });
      expect(bpmCompatibility(undefined, undefined)).toEqual({ diff: null, score: 0 });
    });

    it('returns zero score for zero/negative inputs', () => {
      expect(bpmCompatibility(0, 120)).toEqual({ diff: null, score: 0 });
      expect(bpmCompatibility(120, -10)).toEqual({ diff: null, score: 0 });
    });

    it('returns perfect score for identical BPM', () => {
      const result = bpmCompatibility(120, 120);
      expect(result.diff).toBe(0);
      expect(result.score).toBe(1);
    });

    it('calculates correct diff and score for similar BPM', () => {
      const result = bpmCompatibility(120, 122);
      expect(result.diff).toBe(2);
      expect(result.score).toBeCloseTo(0.983, 2);
    });

    it('returns low score for very different BPM', () => {
      const result = bpmCompatibility(120, 180);
      expect(result.diff).toBe(60);
      expect(result.score).toBeLessThanOrEqual(0.5);
    });
  });

  describe('camelotCompatible', () => {
    it('returns false for null/undefined inputs', () => {
      expect(camelotCompatible(null, '8B')).toBe(false);
      expect(camelotCompatible('8B', null)).toBe(false);
      expect(camelotCompatible(null, null)).toBe(false);
    });

    it('returns true for identical keys', () => {
      expect(camelotCompatible('8B', '8B')).toBe(true);
      expect(camelotCompatible('5A', '5A')).toBe(true);
    });

    it('returns true for same number different mode (major/minor)', () => {
      expect(camelotCompatible('8A', '8B')).toBe(true);
      expect(camelotCompatible('5B', '5A')).toBe(true);
    });

    it('returns true for adjacent keys on Camelot wheel', () => {
      expect(camelotCompatible('8B', '7B')).toBe(true);
      expect(camelotCompatible('8B', '9B')).toBe(true);
      expect(camelotCompatible('5A', '4A')).toBe(true);
      expect(camelotCompatible('5A', '6A')).toBe(true);
    });

    it('handles wrap-around (12 ↔ 1)', () => {
      expect(camelotCompatible('12B', '1B')).toBe(true);
      expect(camelotCompatible('1A', '12A')).toBe(true);
    });

    it('returns false for non-compatible keys', () => {
      expect(camelotCompatible('8B', '10B')).toBe(false);
      expect(camelotCompatible('5A', '8A')).toBe(false);
    });

    it('handles lowercase input', () => {
      expect(camelotCompatible('8b', '8B')).toBe(true);
      expect(camelotCompatible('5a', '6a')).toBe(true);
    });

    it('handles invalid format gracefully', () => {
      expect(camelotCompatible('invalid', '8B')).toBe(false);
      expect(camelotCompatible('8X', '8B')).toBe(false);
      expect(camelotCompatible('', '8B')).toBe(false);
    });
  });

  describe('overallCompatibility', () => {
    it('weights BPM at 60% and key at 40%', () => {
      const result = overallCompatibility(120, '8B', { bpm: 120, camelotKey: '8B' });
      expect(result.score).toBe(1);
      expect(result.bpmDiff).toBe(0);
      expect(result.keyOk).toBe(true);
    });

    it('penalizes for BPM mismatch', () => {
      const result = overallCompatibility(120, '8B', { bpm: 126, camelotKey: '8B' });
      expect(result.score).toBeLessThan(1);
      expect(result.bpmDiff).toBe(6);
      expect(result.keyOk).toBe(true);
    });

    it('penalizes for key mismatch', () => {
      const result = overallCompatibility(120, '8B', { bpm: 120, camelotKey: '10B' });
      expect(result.score).toBe(0.6);
      expect(result.bpmDiff).toBe(0);
      expect(result.keyOk).toBe(false);
    });

    it('handles missing camelotKey', () => {
      const result = overallCompatibility(120, '8B', { bpm: 120 });
      expect(result.keyOk).toBe(false);
      expect(result.score).toBe(0.6);
    });

    it('preserves legacy scoring when advanced features are not provided', () => {
      const legacy = overallCompatibility(120, '8B', { bpm: 126, camelotKey: '8B' });
      expect(legacy.score).toBeCloseTo(0.97, 2);
      expect(legacy.components.energy).toBeNull();
      expect(legacy.components.rhythm).toBeNull();
      expect(legacy.components.confidence).toBeNull();
    });

    it('uses weighted feature similarity when beatgrid/waveform/confidence are provided', () => {
      const anchor = {
        beatGrid: [0, 0.5, 1, 1.5, 2, 2.5],
        waveformLite: [0.1, 0.3, 0.6, 0.2, 0.4, 0.8],
        bpmConfidence: 0.95,
        keyConfidence: 0.9,
      };
      const closeCandidate = overallCompatibility(
        120,
        '8B',
        {
          bpm: 121,
          camelotKey: '8B',
          beatGrid: [0, 0.49, 0.99, 1.49, 1.99, 2.49],
          waveformLite: [0.12, 0.31, 0.58, 0.19, 0.42, 0.79],
          bpmConfidence: 0.91,
          keyConfidence: 0.86,
        },
        anchor
      );

      const weakCandidate = overallCompatibility(
        120,
        '8B',
        {
          bpm: 121,
          camelotKey: '8B',
          beatGrid: [0, 0.6, 1.4, 2.0, 3.1],
          waveformLite: [0.9, 0.1, 0.9, 0.1, 0.9, 0.1],
          bpmConfidence: 0.4,
          keyConfidence: 0.3,
        },
        anchor
      );

      expect(closeCandidate.components.energy).not.toBeNull();
      expect(closeCandidate.components.timbre).not.toBeNull();
      expect(closeCandidate.components.rhythm).not.toBeNull();
      expect(closeCandidate.components.confidence).not.toBeNull();
      expect(closeCandidate.score).toBeGreaterThan(weakCandidate.score);
    });

    it('prefers MIR descriptor similarity when analysisFeatures are provided', () => {
      const anchor = {
        analysisFeatures: {
          version: 'mir-v1' as const,
          source: 'hybrid' as const,
          descriptors: {
            rms: 0.23,
            energy: 0.24,
            zcr: 0.08,
            spectralCentroid: 2150,
            spectralRolloff: 5400,
            flatnessDb: -7.5,
            crest: 6.2,
          },
        },
      };

      const similarMir = overallCompatibility(
        124,
        '8A',
        {
          bpm: 124,
          camelotKey: '8A',
          analysisFeatures: {
            version: 'mir-v1',
            source: 'essentia',
            descriptors: {
              rms: 0.22,
              energy: 0.25,
              zcr: 0.09,
              spectralCentroid: 2200,
              spectralRolloff: 5600,
              flatnessDb: -7.0,
              crest: 6.8,
            },
          },
        },
        anchor
      );

      const dissimilarMir = overallCompatibility(
        124,
        '8A',
        {
          bpm: 124,
          camelotKey: '8A',
          analysisFeatures: {
            version: 'mir-v1',
            source: 'essentia',
            descriptors: {
              rms: 0.9,
              energy: 0.95,
              zcr: 0.3,
              spectralCentroid: 9000,
              spectralRolloff: 15000,
              flatnessDb: -0.5,
              crest: 20,
            },
          },
        },
        anchor
      );

      expect(similarMir.components.timbre).not.toBeNull();
      expect(dissimilarMir.components.timbre).not.toBeNull();
      expect(similarMir.score).toBeGreaterThan(dissimilarMir.score);
    });
  });

  describe('calculatePitchShiftSemitones', () => {
    it('returns 0 for null/undefined inputs', () => {
      expect(calculatePitchShiftSemitones(null, '8B')).toBe(0);
      expect(calculatePitchShiftSemitones('8B', null)).toBe(0);
      expect(calculatePitchShiftSemitones(null, null)).toBe(0);
    });

    it('returns 0 for compatible keys', () => {
      expect(calculatePitchShiftSemitones('8B', '8B')).toBe(0);
      expect(calculatePitchShiftSemitones('8B', '7B')).toBe(0);
      expect(calculatePitchShiftSemitones('8A', '8B')).toBe(0);
    });

    it('calculates shift for non-adjacent keys', () => {
      const result = calculatePitchShiftSemitones('8B', '10B');
      expect(typeof result).toBe('number');
      expect(Math.abs(result)).toBeLessThanOrEqual(6);
    });
  });

  describe('semitonesToPitchRatio', () => {
    it('returns 1 for 0 semitones', () => {
      expect(semitonesToPitchRatio(0)).toBe(1);
    });

    it('returns 2 for +12 semitones (one octave up)', () => {
      expect(semitonesToPitchRatio(12)).toBe(2);
    });

    it('returns 0.5 for -12 semitones (one octave down)', () => {
      expect(semitonesToPitchRatio(-12)).toBe(0.5);
    });

    it('returns sqrt(2) for +6 semitones (tritone)', () => {
      expect(semitonesToPitchRatio(6)).toBeCloseTo(Math.SQRT2, 5);
    });
  });

  describe('calculateTempoRatio', () => {
    it('returns 1 for null/undefined inputs', () => {
      expect(calculateTempoRatio(null, 120)).toBe(1);
      expect(calculateTempoRatio(120, null)).toBe(1);
      expect(calculateTempoRatio(null, null)).toBe(1);
    });

    it('returns 1 for zero/negative inputs', () => {
      expect(calculateTempoRatio(0, 120)).toBe(1);
      expect(calculateTempoRatio(120, -10)).toBe(1);
    });

    it('calculates correct ratio', () => {
      expect(calculateTempoRatio(120, 120)).toBe(1);
      expect(calculateTempoRatio(120, 240)).toBe(2);
      expect(calculateTempoRatio(240, 120)).toBe(0.5);
      expect(calculateTempoRatio(100, 120)).toBe(1.2);
    });
  });

  describe('calculateBeatAlignment', () => {
    it('returns 0 for empty beat grids', () => {
      expect(calculateBeatAlignment([], [0, 1, 2], 120)).toBe(0);
      expect(calculateBeatAlignment([0, 1, 2], [], 120)).toBe(0);
      expect(calculateBeatAlignment([], [], 120)).toBe(0);
    });

    it('returns 0 for invalid BPM', () => {
      expect(calculateBeatAlignment([0, 0.5], [0, 0.5], 0)).toBe(0);
      expect(calculateBeatAlignment([0, 0.5], [0, 0.5], -10)).toBe(0);
    });

    it('calculates alignment for matching downbeats', () => {
      const vocalGrid = [0, 0.5, 1, 1.5, 2];
      const instGrid = [0, 0.5, 1, 1.5, 2];
      const result = calculateBeatAlignment(vocalGrid, instGrid, 120, 'downbeat');
      expect(result).toBe(0);
    });

    it('calculates alignment for offset downbeats', () => {
      const vocalGrid = [0, 0.5, 1, 1.5, 2];
      const instGrid = [0.5, 1, 1.5, 2, 2.5];
      const result = calculateBeatAlignment(vocalGrid, instGrid, 120, 'downbeat');
      expect(Math.abs(result)).toBeLessThanOrEqual(2);
    });

    it('aligns to nearest beat in any mode', () => {
      const vocalGrid = [0, 0.5, 1, 1.5, 2];
      const instGrid = [0.25, 0.75, 1.25, 1.75];
      const result = calculateBeatAlignment(vocalGrid, instGrid, 120, 'any');
      expect(typeof result).toBe('number');
    });
  });
});
