import { describe, it, expect } from 'vitest';
import { evaluatePlannerRules } from '../src/planning/rules-engine';
import genreRules from '../src/planning/rules/genre-compatibility-rules.json';
import type { PlannerRulePack } from '../src/planning/types';

describe('genre compatibility rules', () => {
  const rulePack = genreRules as PlannerRulePack;

  it('prefers smooth transitions for same-genre tracks', async () => {
    const facts = {
      genreMatch: true,
      bpmDelta: 3,
      keyCompatible: true,
    };
    const initial = { genrePenalty: 0, preferredTransition: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.genrePenalty).toBe(0);
    expect(state.preferredTransition).toBe('smooth');
  });

  it('penalizes large BPM delta between tracks', async () => {
    const facts = {
      genreMatch: false,
      bpmDelta: 25,
      keyCompatible: true,
    };
    const initial = { genrePenalty: 0, preferredTransition: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.genrePenalty).toBeGreaterThan(0);
  });

  it('suggests energy transition for incompatible keys', async () => {
    const facts = {
      genreMatch: true,
      bpmDelta: 2,
      keyCompatible: false,
    };
    const initial = { genrePenalty: 0, preferredTransition: '' };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.preferredTransition).toBe('energy');
  });
});
