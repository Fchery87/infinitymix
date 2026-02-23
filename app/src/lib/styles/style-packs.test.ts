import { describe, expect, it } from 'vitest';
import { BUILT_IN_STYLE_PACKS, applyStylePackToAutoDjRequest, listBuiltInStylePackSummaries } from '@/lib/styles/style-packs';
import { validateStylePack } from '@/lib/styles/style-pack-validator';

describe('style packs', () => {
  it('validates all built-in style packs against schema', () => {
    for (const pack of BUILT_IN_STYLE_PACKS) {
      const result = validateStylePack(pack);
      expect(result.valid).toBe(true);
    }
  });

  it('returns summaries for built-in packs', () => {
    const summaries = listBuiltInStylePackSummaries();
    expect(summaries.length).toBeGreaterThanOrEqual(3);
    expect(summaries.map((s) => s.id)).toEqual(
      expect.arrayContaining(['steady-default', 'build-default', 'wave-default'])
    );
  });

  it('applies style pack defaults without overriding explicit request values', () => {
    const stylePack = BUILT_IN_STYLE_PACKS.find((p) => p.id === 'build-default');
    expect(stylePack).toBeTruthy();
    const derived = applyStylePackToAutoDjRequest(
      {
        energyMode: undefined,
        transitionStyle: undefined,
        preferStems: undefined,
        keepOrder: undefined,
        fadeDurationSeconds: undefined,
      },
      stylePack!
    );
    expect(derived.energyMode).toBe('build');
    expect(derived.transitionStyle).toBe('energy');
    expect(derived.preferStems).toBe(true);

    const explicit = applyStylePackToAutoDjRequest(
      {
        energyMode: 'steady',
        transitionStyle: 'cut',
        preferStems: false,
        keepOrder: true,
        fadeDurationSeconds: 1,
      },
      stylePack!
    );
    expect(explicit.energyMode).toBe('steady');
    expect(explicit.transitionStyle).toBe('cut');
    expect(explicit.preferStems).toBe(false);
    expect(explicit.keepOrder).toBe(true);
    expect(explicit.fadeDurationSeconds).toBe(1);
  });

  it('returns clear validation errors for invalid packs', () => {
    const invalidPack = {
      schemaVersion: '1.0.0',
      id: 'x',
      name: 'Bad Pack',
      planner: {
        energyArc: { profile: 'steady' },
        transitions: { preferred: ['not-a-style'] },
        constraints: { phraseSafety: 'strict', genreCompatibility: 'balanced' },
      },
    };
    const result = validateStylePack(invalidPack);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toHaveProperty('path');
      expect(result.errors[0]).toHaveProperty('message');
    }
  });
});
