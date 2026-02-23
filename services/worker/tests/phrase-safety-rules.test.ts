import { describe, it, expect } from 'vitest';
import { evaluatePlannerRules } from '../src/planning/rules-engine';
import phraseSafetyRules from '../src/planning/rules/phrase-safety-rules.json';
import type { PlannerRulePack } from '../src/planning/types';

describe('phrase safety rules', () => {
  const rulePack = phraseSafetyRules as PlannerRulePack;

  it('flags mid-phrase transitions as unsafe', async () => {
    const facts = {
      transitionAtPhraseEdge: false,
      phraseConfidence: 0.8,
      transitionDuration: 2,
    };
    const initial = { phraseSafe: true, transitionPenalty: 0 };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.phraseSafe).toBe(false);
    expect(state.transitionPenalty).toBeGreaterThan(0);
  });

  it('allows phrase-edge transitions', async () => {
    const facts = {
      transitionAtPhraseEdge: true,
      phraseConfidence: 0.9,
      transitionDuration: 4,
    };
    const initial = { phraseSafe: true, transitionPenalty: 0 };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.phraseSafe).toBe(true);
  });

  it('penalizes very short transitions', async () => {
    const facts = {
      transitionAtPhraseEdge: true,
      phraseConfidence: 0.7,
      transitionDuration: 0.3,
    };
    const initial = { phraseSafe: true, transitionPenalty: 0 };
    const { state } = await evaluatePlannerRules(rulePack, facts, initial);
    expect(state.transitionPenalty).toBeGreaterThan(0);
  });
});
