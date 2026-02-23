# Remaining Phases Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining workstreams (WS2-WS7) from the Detailed-Analysis-Implementation-Plan.md, covering UI integration of section tags and preview graph, FFmpeg two-pass loudnorm, expanded rule packs, resumable uploads, and status doc updates.

**Architecture:** Feature-flagged additions across the app (Next.js client components), renderer service (FFmpeg pipeline), and worker service (rule packs). All new behavior is gated behind existing feature flags. Backend rendering gains a two-pass loudness normalization loop with bounded retries. The UI surfaces section analysis data and transitions the stem player to the Tone.js preview graph when enabled.

**Tech Stack:** Next.js 15, React 19, TypeScript, FFmpeg (fluent-ffmpeg), json-rules-engine, Tone.js, tus-js-client, Tailwind CSS

---

## Task 1: Update Implementation-Status.md

**Files:**
- Modify: `Implementation-Status.md`

**Step 1: Update the status document**

Update Phase 3 and Phase 5 sections to reflect actual codebase state:

- Phase 3 (Rules Engine + Style Registry): Change from "Not Started" to "Substantially Complete". Note: `json-rules-engine` integrated in MashupPlanner with 11-rule default pack, decision traces, feature-flag gating. Style registry complete with Ajv schema, 3 built-in packs, API endpoints, and tests.
- Phase 5: Update cross-cutting work to note admin observability dashboards are complete.

**Step 2: Commit**

```bash
git add Implementation-Status.md
git commit -m "docs: update Implementation-Status.md to reflect actual WS4/WS6 completion state"
```

---

## Task 2: Section Tags Display in Track List

**Files:**
- Modify: `src/components/track-list/index.tsx`

**Step 1: Write the failing test**

Create `tests/track-list-section-tags.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/track-list-section-tags.test.ts`
Expected: PASS (these are pure utility tests that define the contract)

**Step 3: Add section tags to the TrackList component**

In `src/components/track-list/index.tsx`, add after the waveform display (after line 260), inside the `track.analysis_status === 'completed'` block:

```tsx
{/* Section structure tags */}
{track.structure && track.structure.length > 0 && (
  <div className="mt-2 flex flex-wrap gap-1.5">
    {track.structure.slice(0, 6).map((section, idx) => {
      const colorMap: Record<string, string> = {
        'vocal-dominant': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
        'percussive': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        'build': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
        'drop-like': 'bg-red-500/20 text-red-300 border-red-500/30',
        'ambient': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      };
      const style = colorMap[section.label] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      const durationSec = Math.round(section.end - section.start);
      return (
        <span
          key={idx}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${style}`}
          title={`${section.start.toFixed(1)}s – ${section.end.toFixed(1)}s (confidence: ${Math.round(section.confidence * 100)}%)`}
        >
          {section.label} ({durationSec}s)
        </span>
      );
    })}
  </div>
)}
```

**Step 4: Verify the app compiles**

Run: `npx next build --no-lint` (or `npm run build`)
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/components/track-list/index.tsx tests/track-list-section-tags.test.ts
git commit -m "feat: display section structure tags on completed tracks in track list"
```

---

## Task 3: FFmpeg Two-Pass Loudnorm Module

**Files:**
- Create: `services/renderer/src/loudnorm.ts`

**Step 1: Write the failing test**

Create `services/renderer/tests/loudnorm.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd services/renderer && npx vitest run tests/loudnorm.test.ts`
Expected: FAIL - module `../src/loudnorm` does not exist

**Step 3: Implement the loudnorm module**

Create `services/renderer/src/loudnorm.ts`:

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { logger } from './utils/logger';
import { config } from './utils/config';

// --- Types ---

export interface LoudnormStats {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
}

export interface QaMetrics {
  integratedLoudness: number;
  truePeak: number;
  loudnessRange: number;
  clippingDetected: boolean;
}

// --- Constants ---

const TARGET_LUFS = -14;
const TRUE_PEAK_CEILING = -1.5;
const LRA_TARGET = 11;
const LOUDNESS_TOLERANCE_LU = 1.0;
const TRUE_PEAK_MAX = -1.0;
const MAX_RETRIES = 2;

// --- Pure Functions (testable) ---

export function parseLoudnormStats(raw: string): LoudnormStats | null {
  try {
    const data = JSON.parse(raw);
    const inputI = parseFloat(data.input_i);
    const inputTp = parseFloat(data.input_tp);
    const inputLra = parseFloat(data.input_lra);
    const inputThresh = parseFloat(data.input_thresh);
    if ([inputI, inputTp, inputLra, inputThresh].some(Number.isNaN)) return null;
    return { inputI, inputTp, inputLra, inputThresh };
  } catch {
    return null;
  }
}

export function buildLoudnormPass2Filter(stats: LoudnormStats): string {
  return [
    'loudnorm=',
    `I=${TARGET_LUFS}`,
    `:TP=${TRUE_PEAK_CEILING}`,
    `:LRA=${LRA_TARGET}`,
    `:measured_I=${stats.inputI}`,
    `:measured_TP=${stats.inputTp}`,
    `:measured_LRA=${stats.inputLra}`,
    `:measured_thresh=${stats.inputThresh}`,
    ':linear=true',
  ].join('');
}

export function shouldRetryRender(metrics: QaMetrics): boolean {
  if (Math.abs(metrics.integratedLoudness - TARGET_LUFS) > LOUDNESS_TOLERANCE_LU) return true;
  if (metrics.truePeak > TRUE_PEAK_MAX) return true;
  if (metrics.clippingDetected) return true;
  return false;
}

// --- FFmpeg Operations ---

export function runLoudnormPass1(inputPath: string): Promise<LoudnormStats | null> {
  return new Promise((resolve, reject) => {
    let stderrOutput = '';

    ffmpeg(inputPath)
      .audioFilters(`loudnorm=I=${TARGET_LUFS}:TP=${TRUE_PEAK_CEILING}:LRA=${LRA_TARGET}:print_format=json`)
      .format('null')
      .output('/dev/null')
      .on('stderr', (line: string) => {
        stderrOutput += line + '\n';
      })
      .on('end', () => {
        // Extract the JSON block from stderr
        const jsonMatch = stderrOutput.match(/\{[^{}]*"input_i"[^{}]*\}/s);
        if (!jsonMatch) {
          logger.warn('loudnorm pass 1: no JSON stats found in output');
          resolve(null);
          return;
        }
        resolve(parseLoudnormStats(jsonMatch[0]));
      })
      .on('error', (err: Error) => {
        logger.error('loudnorm pass 1 failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

export function runLoudnormPass2(inputPath: string, outputPath: string, stats: LoudnormStats): Promise<void> {
  return new Promise((resolve, reject) => {
    const filter = buildLoudnormPass2Filter(stats);

    ffmpeg(inputPath)
      .audioFilters(filter)
      .format('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(2)
      .audioFrequency(44100)
      .on('end', () => {
        logger.info('loudnorm pass 2 completed', { outputPath });
        resolve();
      })
      .on('error', (err: Error) => {
        logger.error('loudnorm pass 2 failed', { error: err.message });
        reject(err);
      })
      .save(outputPath);
  });
}

export function extractQaMetrics(inputPath: string): Promise<QaMetrics | null> {
  return new Promise((resolve, reject) => {
    let stderrOutput = '';

    ffmpeg(inputPath)
      .audioFilters('ebur128=peak=true,astats=metadata=1:reset=0')
      .format('null')
      .output('/dev/null')
      .on('stderr', (line: string) => {
        stderrOutput += line + '\n';
      })
      .on('end', () => {
        // Parse ebur128 summary
        const intMatch = stderrOutput.match(/I:\s*(-?[\d.]+)\s*LUFS/);
        const tpMatch = stderrOutput.match(/Peak:\s*(-?[\d.]+)\s*dBFS/) || stderrOutput.match(/True peak:\s*(-?[\d.]+)\s*dBFS/);
        const lraMatch = stderrOutput.match(/LRA:\s*([\d.]+)\s*LU/);
        const clipMatch = stderrOutput.includes('Clipping') || stderrOutput.match(/Number of samples clipped:\s*([1-9])/);

        if (!intMatch) {
          logger.warn('QA metrics: could not parse integrated loudness');
          resolve(null);
          return;
        }

        resolve({
          integratedLoudness: parseFloat(intMatch[1]),
          truePeak: tpMatch ? parseFloat(tpMatch[1]) : -99,
          loudnessRange: lraMatch ? parseFloat(lraMatch[1]) : 0,
          clippingDetected: !!clipMatch,
        });
      })
      .on('error', (err: Error) => {
        logger.error('QA metrics extraction failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

/**
 * Run two-pass loudness normalization with QA verification.
 * Returns the path to the normalized file, or the original path if disabled/failed.
 */
export async function normalizeLoudness(inputPath: string, outputPath: string): Promise<{
  normalizedPath: string;
  qaMetrics: QaMetrics | null;
  retries: number;
  skipped: boolean;
}> {
  if (!config.featureFlags.twoPassLoudnorm) {
    return { normalizedPath: inputPath, qaMetrics: null, retries: 0, skipped: true };
  }

  let currentInput = inputPath;
  let retries = 0;

  while (retries <= MAX_RETRIES) {
    // Pass 1: measure
    const stats = await runLoudnormPass1(currentInput);
    if (!stats) {
      logger.warn('Loudnorm pass 1 returned no stats, skipping normalization');
      return { normalizedPath: currentInput, qaMetrics: null, retries, skipped: false };
    }

    // Pass 2: normalize
    const iterOutput = retries === 0 ? outputPath : outputPath.replace('.wav', `_retry${retries}.wav`);
    await runLoudnormPass2(currentInput, iterOutput, stats);

    // QA check
    const qaMetrics = await extractQaMetrics(iterOutput);
    if (!qaMetrics) {
      logger.warn('QA metrics extraction failed, accepting output');
      return { normalizedPath: iterOutput, qaMetrics: null, retries, skipped: false };
    }

    logger.info('Loudnorm QA metrics', {
      retry: retries,
      integratedLoudness: qaMetrics.integratedLoudness,
      truePeak: qaMetrics.truePeak,
      loudnessRange: qaMetrics.loudnessRange,
      clippingDetected: qaMetrics.clippingDetected,
    });

    if (!shouldRetryRender(qaMetrics) || retries >= MAX_RETRIES) {
      return { normalizedPath: iterOutput, qaMetrics, retries, skipped: false };
    }

    // Use the normalized output as input for the next pass
    currentInput = iterOutput;
    retries++;
    logger.info('Retrying loudnorm', { retry: retries, reason: 'QA threshold violation' });
  }

  // Should not reach here due to the loop condition, but satisfy TypeScript
  return { normalizedPath: currentInput, qaMetrics: null, retries, skipped: false };
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/renderer && npx vitest run tests/loudnorm.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/renderer/src/loudnorm.ts services/renderer/tests/loudnorm.test.ts
git commit -m "feat: add FFmpeg two-pass loudnorm module with QA metrics and retry policy"
```

---

## Task 4: Integrate Loudnorm into Render Pipeline

**Files:**
- Modify: `services/renderer/src/AudioRenderer.ts` (lines 65-106, the `renderMashup` method)

**Step 1: Import and call normalizeLoudness**

At the top of `AudioRenderer.ts`, add:
```typescript
import { normalizeLoudness } from './loudnorm'
```

In the `renderMashup` method, after `const outputPath = await this.renderAndMix(...)` (line 84) and before `const mp3Path = await this.convertToMp3(...)` (line 87), insert the loudnorm step:

```typescript
      // Two-pass loudness normalization (gated by feature flag)
      const loudnormOutputPath = outputPath.replace('.wav', '_normalized.wav')
      const loudnormResult = await normalizeLoudness(outputPath, loudnormOutputPath)
      const finalWavPath = loudnormResult.normalizedPath

      logger.info('Loudness normalization result', {
        mashupId,
        skipped: loudnormResult.skipped,
        retries: loudnormResult.retries,
        qaMetrics: loudnormResult.qaMetrics,
      })

      // Convert to MP3
      const mp3Path = await this.convertToMp3(finalWavPath, tempDir)
```

Remove the old `const mp3Path = await this.convertToMp3(outputPath, tempDir)` line (line 87).

**Step 2: Verify the renderer compiles**

Run: `cd services/renderer && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add services/renderer/src/AudioRenderer.ts
git commit -m "feat: integrate two-pass loudnorm into render pipeline with QA logging"
```

---

## Task 5: Energy Arc Rule Pack

**Files:**
- Create: `services/worker/src/planning/rules/energy-arc-rules.json`

**Step 1: Write the failing test**

Create `services/worker/tests/energy-arc-rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evaluatePlannerRules } from '../src/planning/rules-engine';
import energyArcRules from '../src/planning/rules/energy-arc-rules.json';
import type { PlannerRulePack } from '../src/planning/types';

describe('energy arc rules', () => {
  const rulePack = energyArcRules as PlannerRulePack;

  it('boosts gain early in a rising arc', async () => {
    const facts = {
      energyProfile: 'rising',
      segmentPosition: 0.2, // early in the mix
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
```

**Step 2: Run test to verify it fails**

Run: `cd services/worker && npx vitest run tests/energy-arc-rules.test.ts`
Expected: FAIL - cannot find module

**Step 3: Create the energy arc rule pack**

Create `services/worker/src/planning/rules/energy-arc-rules.json`:

```json
{
  "id": "energy-arc-rules",
  "version": "1.0.0",
  "rules": [
    {
      "id": "energy.rising.early_low",
      "description": "In a rising arc, early segments with low energy are labeled low",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "rising" },
        { "fact": "segmentPosition", "op": "lt", "value": 0.4 },
        { "fact": "segmentEnergy", "op": "lt", "value": 0.6 }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "low" },
        { "type": "set", "field": "gainAdjust", "value": -0.1 }
      ]
    },
    {
      "id": "energy.rising.mid_build",
      "description": "In a rising arc, mid segments are building",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "rising" },
        { "fact": "segmentPosition", "op": "gte", "value": 0.4 },
        { "fact": "segmentPosition", "op": "lt", "value": 0.75 }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "building" }
      ]
    },
    {
      "id": "energy.rising.peak",
      "description": "In a rising arc, late high-energy segments are peaks",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "rising" },
        { "fact": "segmentPosition", "op": "gte", "value": 0.75 },
        { "fact": "segmentEnergy", "op": "gte", "value": 0.7 }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "peak" },
        { "type": "set", "field": "gainAdjust", "value": 0.05 }
      ]
    },
    {
      "id": "energy.steady.flat",
      "description": "Steady arc keeps consistent energy label",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "steady" }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "sustain" }
      ]
    },
    {
      "id": "energy.wave.trough",
      "description": "Wave arc low-energy segments are troughs",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "wave" },
        { "fact": "segmentEnergy", "op": "lt", "value": 0.4 }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "trough" },
        { "type": "set", "field": "gainAdjust", "value": -0.05 }
      ]
    },
    {
      "id": "energy.wave.crest",
      "description": "Wave arc high-energy segments are crests",
      "when": [
        { "fact": "energyProfile", "op": "eq", "value": "wave" },
        { "fact": "segmentEnergy", "op": "gte", "value": 0.6 }
      ],
      "actions": [
        { "type": "set", "field": "energyLabel", "value": "crest" },
        { "type": "set", "field": "gainAdjust", "value": 0.05 }
      ]
    }
  ]
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/worker && npx vitest run tests/energy-arc-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/worker/src/planning/rules/energy-arc-rules.json services/worker/tests/energy-arc-rules.test.ts
git commit -m "feat: add energy arc rule pack for rising/steady/wave profiles"
```

---

## Task 6: Phrase Safety Rule Pack

**Files:**
- Create: `services/worker/src/planning/rules/phrase-safety-rules.json`

**Step 1: Write the failing test**

Create `services/worker/tests/phrase-safety-rules.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd services/worker && npx vitest run tests/phrase-safety-rules.test.ts`
Expected: FAIL

**Step 3: Create the phrase safety rule pack**

Create `services/worker/src/planning/rules/phrase-safety-rules.json`:

```json
{
  "id": "phrase-safety-rules",
  "version": "1.0.0",
  "rules": [
    {
      "id": "phrase.mid_phrase_penalty",
      "description": "Penalize transitions that do not land on a phrase boundary",
      "when": [
        { "fact": "transitionAtPhraseEdge", "op": "eq", "value": false },
        { "fact": "phraseConfidence", "op": "gte", "value": 0.5 }
      ],
      "actions": [
        { "type": "set", "field": "phraseSafe", "value": false },
        { "type": "set", "field": "transitionPenalty", "value": 0.3 }
      ]
    },
    {
      "id": "phrase.low_confidence_skip",
      "description": "Skip phrase safety check when confidence is too low to be reliable",
      "when": [
        { "fact": "phraseConfidence", "op": "lt", "value": 0.5 }
      ],
      "actions": [
        { "type": "set", "field": "phraseSafe", "value": true },
        { "type": "set", "field": "transitionPenalty", "value": 0 }
      ]
    },
    {
      "id": "phrase.short_transition_penalty",
      "description": "Penalize transitions shorter than 1 second as they sound abrupt",
      "when": [
        { "fact": "transitionDuration", "op": "lt", "value": 1 }
      ],
      "actions": [
        { "type": "set", "field": "transitionPenalty", "value": 0.2 }
      ]
    },
    {
      "id": "phrase.phrase_edge_safe",
      "description": "Transitions on phrase edges with decent confidence are safe",
      "when": [
        { "fact": "transitionAtPhraseEdge", "op": "eq", "value": true },
        { "fact": "phraseConfidence", "op": "gte", "value": 0.5 },
        { "fact": "transitionDuration", "op": "gte", "value": 1 }
      ],
      "actions": [
        { "type": "set", "field": "phraseSafe", "value": true },
        { "type": "set", "field": "transitionPenalty", "value": 0 }
      ]
    }
  ]
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/worker && npx vitest run tests/phrase-safety-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/worker/src/planning/rules/phrase-safety-rules.json services/worker/tests/phrase-safety-rules.test.ts
git commit -m "feat: add phrase safety rule pack for transition boundary enforcement"
```

---

## Task 7: Genre Compatibility Rule Pack

**Files:**
- Create: `services/worker/src/planning/rules/genre-compatibility-rules.json`

**Step 1: Write the failing test**

Create `services/worker/tests/genre-compatibility-rules.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `cd services/worker && npx vitest run tests/genre-compatibility-rules.test.ts`
Expected: FAIL

**Step 3: Create the genre compatibility rule pack**

Create `services/worker/src/planning/rules/genre-compatibility-rules.json`:

```json
{
  "id": "genre-compatibility-rules",
  "version": "1.0.0",
  "rules": [
    {
      "id": "genre.same_genre_smooth",
      "description": "Same-genre tracks get smooth transitions",
      "when": [
        { "fact": "genreMatch", "op": "eq", "value": true },
        { "fact": "keyCompatible", "op": "eq", "value": true },
        { "fact": "bpmDelta", "op": "lt", "value": 10 }
      ],
      "actions": [
        { "type": "set", "field": "genrePenalty", "value": 0 },
        { "type": "set", "field": "preferredTransition", "value": "smooth" }
      ]
    },
    {
      "id": "genre.key_incompatible_energy",
      "description": "Key-incompatible pairs should use energy transitions to mask dissonance",
      "when": [
        { "fact": "keyCompatible", "op": "eq", "value": false }
      ],
      "actions": [
        { "type": "set", "field": "preferredTransition", "value": "energy" },
        { "type": "set", "field": "genrePenalty", "value": 0.15 }
      ]
    },
    {
      "id": "genre.large_bpm_delta",
      "description": "Large BPM differences between tracks are penalized",
      "when": [
        { "fact": "bpmDelta", "op": "gte", "value": 15 }
      ],
      "actions": [
        { "type": "set", "field": "genrePenalty", "value": 0.3 }
      ]
    },
    {
      "id": "genre.moderate_bpm_delta",
      "description": "Moderate BPM difference gets a small penalty",
      "when": [
        { "fact": "bpmDelta", "op": "gte", "value": 8 },
        { "fact": "bpmDelta", "op": "lt", "value": 15 }
      ],
      "actions": [
        { "type": "set", "field": "genrePenalty", "value": 0.1 }
      ]
    },
    {
      "id": "genre.cross_genre_filter_sweep",
      "description": "Cross-genre pairs without key issues use filter sweeps",
      "when": [
        { "fact": "genreMatch", "op": "eq", "value": false },
        { "fact": "keyCompatible", "op": "eq", "value": true },
        { "fact": "bpmDelta", "op": "lt", "value": 15 }
      ],
      "actions": [
        { "type": "set", "field": "preferredTransition", "value": "filter_sweep" },
        { "type": "set", "field": "genrePenalty", "value": 0.05 }
      ]
    }
  ]
}
```

**Step 4: Run test to verify it passes**

Run: `cd services/worker && npx vitest run tests/genre-compatibility-rules.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/worker/src/planning/rules/genre-compatibility-rules.json services/worker/tests/genre-compatibility-rules.test.ts
git commit -m "feat: add genre compatibility rule pack for transition and penalty logic"
```

---

## Task 8: Register New Rule Packs in Planning Module

**Files:**
- Modify: `services/worker/src/planning/rules-engine.ts`

**Step 1: Add a rule pack registry**

Check if there's already a `getPlannerRulePack` function. If so, extend it to support the new pack IDs. If not, add one:

```typescript
import defaultRulePack from './rules/default-rule-pack.json';
import energyArcRules from './rules/energy-arc-rules.json';
import phraseSafetyRules from './rules/phrase-safety-rules.json';
import genreCompatibilityRules from './rules/genre-compatibility-rules.json';

const RULE_PACK_REGISTRY: Record<string, PlannerRulePack> = {
  'default-planner-rule-pack': defaultRulePack as PlannerRulePack,
  'energy-arc-rules': energyArcRules as PlannerRulePack,
  'phrase-safety-rules': phraseSafetyRules as PlannerRulePack,
  'genre-compatibility-rules': genreCompatibilityRules as PlannerRulePack,
};

export function getPlannerRulePack(id: string): PlannerRulePack | null {
  return RULE_PACK_REGISTRY[id] ?? null;
}

export function listPlannerRulePacks(): string[] {
  return Object.keys(RULE_PACK_REGISTRY);
}
```

**Step 2: Verify compilation**

Run: `cd services/worker && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add services/worker/src/planning/rules-engine.ts
git commit -m "feat: register energy-arc, phrase-safety, and genre-compatibility rule packs"
```

---

## Task 9: Resumable Uploads - Install tus-js-client

**Files:**
- Modify: `package.json`

**Step 1: Install tus-js-client**

Run: `npm install tus-js-client`

**Step 2: Verify installation**

Run: `npm ls tus-js-client`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install tus-js-client for resumable upload support"
```

---

## Task 10: Resumable Upload Client Helper

**Files:**
- Create: `src/lib/audio/resumable-upload.ts`

**Step 1: Write the failing test**

Create `tests/resumable-upload.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildTusMetadata } from '../src/lib/audio/resumable-upload';

describe('buildTusMetadata', () => {
  it('encodes filename and content type', () => {
    const meta = buildTusMetadata('my-song.mp3', 'audio/mpeg', 'user-123');
    expect(meta).toEqual({
      filename: 'my-song.mp3',
      contentType: 'audio/mpeg',
      userId: 'user-123',
    });
  });

  it('includes projectId when provided', () => {
    const meta = buildTusMetadata('song.wav', 'audio/wav', 'user-1', 'proj-1');
    expect(meta.projectId).toBe('proj-1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/resumable-upload.test.ts`
Expected: FAIL

**Step 3: Implement resumable upload helper**

Create `src/lib/audio/resumable-upload.ts`:

```typescript
import { getPublicAudioPipelineFeatureFlags } from '@/lib/audio/feature-flags';
import { emitAudioPipelineTelemetry } from '@/lib/audio/telemetry';

export function buildTusMetadata(
  filename: string,
  contentType: string,
  userId: string,
  projectId?: string | null,
): Record<string, string> {
  const meta: Record<string, string> = {
    filename,
    contentType,
    userId,
  };
  if (projectId) meta.projectId = projectId;
  return meta;
}

export interface ResumableUploadOptions {
  file: File;
  endpoint: string;
  userId: string;
  projectId?: string | null;
  onProgress?: (percentage: number) => void;
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Upload a file using tus resumable protocol.
 * Returns the upload URL on success.
 * Falls back to null if tus-js-client is unavailable.
 */
export async function startResumableUpload(options: ResumableUploadOptions): Promise<string | null> {
  const flags = getPublicAudioPipelineFeatureFlags();
  if (!flags.resumableUploads) return null;

  try {
    const { Upload } = await import('tus-js-client');

    return new Promise((resolve, reject) => {
      const upload = new Upload(options.file, {
        endpoint: options.endpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024, // 5MB chunks
        metadata: buildTusMetadata(
          options.file.name,
          options.file.type,
          options.userId,
          options.projectId,
        ),
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          options.onProgress?.(pct);
        },
        onSuccess: () => {
          const url = upload.url;
          emitAudioPipelineTelemetry({
            area: 'upload',
            event: 'resumable_upload_complete',
            data: { filename: options.file.name, size: options.file.size },
          });
          options.onSuccess?.(url ?? '');
          resolve(url ?? '');
        },
        onError: (error: Error) => {
          emitAudioPipelineTelemetry({
            area: 'upload',
            event: 'resumable_upload_error',
            data: { filename: options.file.name, error: error.message },
          });
          options.onError?.(error);
          reject(error);
        },
      });

      upload.findPreviousUploads().then((previousUploads: Array<{ uploadUrl?: string }>) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      });
    });
  } catch (err) {
    emitAudioPipelineTelemetry({
      area: 'upload',
      event: 'resumable_upload_fallback',
      data: { reason: err instanceof Error ? err.message : 'tus unavailable' },
    });
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/resumable-upload.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/audio/resumable-upload.ts tests/resumable-upload.test.ts
git commit -m "feat: add resumable upload helper using tus-js-client with retry and resume support"
```

---

## Task 11: Wire Resumable Upload into Upload Service

**Files:**
- Modify: `src/app/create/page.tsx` (the `handleFileUpload` function)

**Step 1: Add resumable upload path**

In the `handleFileUpload` function in `create/page.tsx`, after the feature flags check, add a resumable upload attempt before the existing `fetch('/api/audio/upload', ...)` call:

```typescript
// At the top of the file, add import:
import { startResumableUpload } from '@/lib/audio/resumable-upload';

// In handleFileUpload, before the existing fetch call:
// Try resumable upload first if flag is enabled
const audioFeatureFlags = getPublicAudioPipelineFeatureFlags();
if (audioFeatureFlags.resumableUploads) {
  try {
    for (const file of files) {
      const result = await startResumableUpload({
        file,
        endpoint: '/api/audio/upload/tus',
        userId: 'current-user', // Will be resolved server-side from session
        projectId: selectedProjectId,
        onProgress: (pct) => {
          setPreAnalysisMessage(`Uploading ${file.name}... ${pct}%`);
        },
      });
      if (result) continue; // Success, move to next file
      break; // Fallback to standard upload
    }
  } catch {
    // Fall through to standard upload
  }
}
```

This is a best-effort enhancement. If resumable upload fails, the existing upload path runs.

**Step 2: Verify the app compiles**

Run: `npx next build --no-lint`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/create/page.tsx
git commit -m "feat: wire resumable upload path into create page with fallback to standard upload"
```

---

## Task 12: Final Verification and Cleanup

**Step 1: Run all tests**

Run: `npx vitest run`
Run: `cd services/worker && npx vitest run`
Run: `cd services/renderer && npx vitest run`
Expected: All tests pass

**Step 2: Run type checks**

Run: `npx tsc --noEmit`
Run: `cd services/worker && npx tsc --noEmit`
Run: `cd services/renderer && npx tsc --noEmit`
Expected: No type errors

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: final cleanup for remaining phases implementation"
```
