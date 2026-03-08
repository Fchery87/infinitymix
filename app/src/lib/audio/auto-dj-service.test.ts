import { describe, expect, it } from 'vitest';
import {
  classifyTempoStretch,
  clampTempoRatio,
  getTempoStretchPercent,
  resolveAutoDjPlanTargetBpm,
} from './auto-dj-service';

type TestTrackInfo = {
  id: string;
  bpm: number | null;
};

describe('resolveAutoDjPlanTargetBpm', () => {
  it('anchors to the first selected track when keepOrder is enabled', () => {
    const trackInfos = [
      { id: 'track-b', bpm: 128 },
      { id: 'track-a', bpm: 100 },
      { id: 'track-c', bpm: 124 },
    ] as TestTrackInfo[];

    const targetBpm = resolveAutoDjPlanTargetBpm(trackInfos as never[], {
      trackIds: ['track-a', 'track-b', 'track-c'],
      keepOrder: true,
    });

    expect(targetBpm).toBe(100);
  });

  it('falls back to the median BPM when keepOrder is disabled', () => {
    const trackInfos = [
      { id: 'track-a', bpm: 100 },
      { id: 'track-b', bpm: 124 },
      { id: 'track-c', bpm: 128 },
    ] as TestTrackInfo[];

    const targetBpm = resolveAutoDjPlanTargetBpm(trackInfos as never[], {
      trackIds: ['track-a', 'track-b', 'track-c'],
      keepOrder: false,
    });

    expect(targetBpm).toBe(124);
  });

  it('honors an explicit target BPM over automatic anchoring', () => {
    const trackInfos = [
      { id: 'track-a', bpm: 100 },
      { id: 'track-b', bpm: 128 },
    ] as TestTrackInfo[];

    const targetBpm = resolveAutoDjPlanTargetBpm(trackInfos as never[], {
      trackIds: ['track-a', 'track-b'],
      keepOrder: true,
      targetBpm: 110,
    });

    expect(targetBpm).toBe(110);
  });
});

describe('tempo stretch policy', () => {
  it('clamps tempo ratios to the tighter hard quality window', () => {
    expect(clampTempoRatio(0.82)).toBe(0.9);
    expect(clampTempoRatio(1.18)).toBe(1.1);
  });

  it('classifies ratios inside the preferred window as preferred', () => {
    expect(classifyTempoStretch(0.97)).toBe('preferred');
    expect(classifyTempoStretch(1.04)).toBe('preferred');
  });

  it('classifies edge ratios as tolerated and reports stretch percent', () => {
    expect(classifyTempoStretch(0.91)).toBe('tolerated');
    expect(classifyTempoStretch(1.09)).toBe('tolerated');
    expect(getTempoStretchPercent(1.09)).toBeCloseTo(9, 5);
  });
});
