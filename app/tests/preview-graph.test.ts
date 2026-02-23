import { describe, expect, it } from 'vitest';
import { buildTransitionAutomationPlan } from '@/lib/audio/preview-graph';

describe('preview-graph', () => {
  it('returns a cut plan with very short duration', () => {
    const plan = buildTransitionAutomationPlan('cut', 2);
    expect(plan.crossfadeCurve).toBe('cut');
    expect(plan.durationSeconds).toBeLessThanOrEqual(0.15);
  });

  it('maps filter sweep transitions to filter automation', () => {
    const plan = buildTransitionAutomationPlan('filter_sweep', 4);
    expect(plan.filterSweep).toBeTruthy();
    expect(plan.crossfadeCurve).toBe('log');
  });

  it('maps echo/reverb transitions to fx sends', () => {
    const plan = buildTransitionAutomationPlan('echo_reverb', 4);
    expect(plan.delaySend).toBeGreaterThan(0);
    expect(plan.reverbSend).toBeGreaterThan(0);
  });

  it('maps tape stop to playback rate ramp', () => {
    const plan = buildTransitionAutomationPlan('tape_stop', 3);
    expect(plan.playbackRateRamp).toEqual({ from: 1, to: 0.6 });
  });
});

