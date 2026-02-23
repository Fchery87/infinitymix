import { describe, it, expect } from 'vitest';
import { evaluatePlannerRules } from '../src/planning/rules-engine';
import energyArcRules from '../src/planning/rules/energy-arc-rules.json';
import type { PlannerRulePack } from '../src/planning/types';

describe('energy arc rules', () => {
  const rulePack = energyArcRules as PlannerRulePack;

  it('boosts gain early in a rising arc', async () => {
    const facts = {
      energyProfile: 'rising',
      segmentPosition: 0.2,
      segmentEnergy: 0.4,
    };
    const initial = { gainAdjust: 0, energyLabel: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.energyLabel).toBe('low');
  });

  it('labels peak segment in a rising arc', async () => {
    const facts = {
      energyProfile: 'rising',
      segmentPosition: 0.85,
      segmentEnergy: 0.9,
    };
    const initial = { gainAdjust: 0, energyLabel: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.energyLabel).toBe('peak');
  });

  it('labels wave trough', async () => {
    const facts = {
      energyProfile: 'wave',
      segmentPosition: 0.5,
      segmentEnergy: 0.3,
    };
    const initial = { gainAdjust: 0, energyLabel: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.energyLabel).toBe('trough');
  });
});
