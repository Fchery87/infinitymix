import { describe, it, expect } from 'vitest';

// Unit test the section tag color mapping utility
const SECTION_TAG_COLORS: Record<string, string> = {
  'vocal-dominant': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'percussive': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'build': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'drop-like': 'bg-red-500/20 text-red-300 border-red-500/30',
  'ambient': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

function getSectionTagStyle(tag: string): string {
  return SECTION_TAG_COLORS[tag] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30';
}

function formatSectionLabel(section: { label: string; start: number; end: number }): string {
  const durationSec = Math.round(section.end - section.start);
  return `${section.label} (${durationSec}s)`;
}

describe('section tag display helpers', () => {
  it('returns correct color classes for known tags', () => {
    expect(getSectionTagStyle('vocal-dominant')).toContain('pink');
    expect(getSectionTagStyle('drop-like')).toContain('red');
  });

  it('returns fallback style for unknown tags', () => {
    expect(getSectionTagStyle('unknown')).toContain('gray');
  });

  it('formats section labels with duration', () => {
    expect(formatSectionLabel({ label: 'chorus', start: 30, end: 60 })).toBe('chorus (30s)');
  });
});
