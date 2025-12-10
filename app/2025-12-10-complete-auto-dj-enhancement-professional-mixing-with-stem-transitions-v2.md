
# Complete Auto DJ Enhancement Plan (v2)
## Professional Mixing Intelligence + Stem-Based Transitions

---

## Core Architecture (Phases 1-5 from previous spec)

*[Previous phases remain: Track Analysis, Energy Management, Stem Transitions, Auto DJ Flow, User Learning]*

---

## Additional Enhancements

### Enhancement A: Phrase-Aligned Mix Points

DJs always mix on phrase boundaries (8, 16, or 32 bars), never mid-phrase:

```typescript
type PhraseLength = 8 | 16 | 32; // bars

function findPhraseAlignedMixPoint(
  trackA: TrackInfo,
  trackB: TrackInfo,
  targetBpm: number
): MixPoint {
  const barDuration = (60 / targetBpm) * 4; // seconds per bar
  
  // Find Track A's outro phrase start (last 32 bars or structure.outro)
  const outroStart = trackA.structure?.find(s => s.label === 'outro')?.start 
    ?? (Number(trackA.durationSeconds) - 32 * barDuration);
  
  // Snap to nearest 8-bar phrase boundary
  const snappedOutro = Math.round(outroStart / (8 * barDuration)) * (8 * barDuration);
  
  // Find Track B's intro phrase end
  const introEnd = trackB.structure?.find(s => s.label === 'intro')?.end
    ?? (16 * barDuration);
  
  return {
    outStart: snappedOutro,
    inStart: 0,
    overlapBars: Math.min(16, Math.round(introEnd / barDuration)),
  };
}
```

**Why it matters:** Mixing mid-phrase sounds amateur. Phrase alignment creates that "how did they do that?" seamless feel.

---

### Enhancement B: Structure-Aware Transition Rules

Never interrupt key song moments:

```typescript
const STRUCTURE_RULES = {
  // Good places to mix OUT of a track
  mixOutAllowed: ['outro', 'breakdown', 'verse'],
  mixOutForbidden: ['drop', 'chorus', 'buildup'],
  
  // Good places to mix INTO a track
  mixInAllowed: ['intro', 'buildup', 'verse'],
  mixInForbidden: ['drop', 'chorus'], // Don't start mid-chorus
};

function validateMixPoint(
  trackA: TrackInfo,
  trackB: TrackInfo,
  proposedMixPoint: MixPoint
): { valid: boolean; warning?: string; alternative?: MixPoint } {
  const aStructureAtMix = getStructureAt(trackA, proposedMixPoint.outStart);
  const bStructureAtMix = getStructureAt(trackB, proposedMixPoint.inStart);
  
  if (STRUCTURE_RULES.mixOutForbidden.includes(aStructureAtMix)) {
    return {
      valid: false,
      warning: `Cannot mix out during ${aStructureAtMix}`,
      alternative: findNextAllowedMixOut(trackA, proposedMixPoint.outStart),
    };
  }
  
  return { valid: true };
}
```

---

### Enhancement C: Vocal Collision Detection

Prevent two vocal tracks from overlapping (sounds cluttered):

```typescript
function detectVocalCollision(
  trackA: TrackInfo,
  trackB: TrackInfo,
  overlapStart: number,
  overlapDuration: number
): { collision: boolean; severity: 'none' | 'minor' | 'major' } {
  // Check if both tracks have vocals during the overlap period
  const aHasVocalsInOverlap = hasVocalsAt(trackA, overlapStart, overlapDuration);
  const bHasVocalsInOverlap = hasVocalsAt(trackB, 0, overlapDuration);
  
  if (aHasVocalsInOverlap && bHasVocalsInOverlap) {
    // Both have vocals - check intensity
    const aVocalEnergy = getVocalEnergyAt(trackA, overlapStart);
    const bVocalEnergy = getVocalEnergyAt(trackB, 0);
    
    if (aVocalEnergy > 0.7 && bVocalEnergy > 0.7) {
      return { collision: true, severity: 'major' };
    }
    return { collision: true, severity: 'minor' };
  }
  
  return { collision: false, severity: 'none' };
}

// If collision detected, suggest instrumental_bridge transition
function handleVocalCollision(suggestion: TransitionSuggestion): TransitionSuggestion {
  if (suggestion.vocalCollision?.severity === 'major') {
    return {
      ...suggestion,
      type: 'instrumental_bridge',
      reason: suggestion.reason + ' (vocals dropped to avoid clash)',
    };
  }
  return suggestion;
}
```

---

### Enhancement D: Gain Staging / Loudness Normalization

Prevent volume jumps between tracks:

```typescript
type LoudnessInfo = {
  integratedLUFS: number;  // Overall loudness (-14 LUFS is streaming standard)
  truePeak: number;        // Maximum peak level
  loudnessRange: number;   // Dynamic range
};

// Add to track analysis
async function analyzeLoudness(buffer: Buffer): Promise<LoudnessInfo> {
  // Use FFmpeg loudnorm filter for analysis
  // ffmpeg -i input.mp3 -af loudnorm=print_format=json -f null -
}

// Apply gain compensation during mixing
function calculateGainCompensation(
  trackA: LoudnessInfo,
  trackB: LoudnessInfo,
  targetLUFS: number = -14
): { gainA: number; gainB: number } {
  return {
    gainA: targetLUFS - trackA.integratedLUFS,
    gainB: targetLUFS - trackB.integratedLUFS,
  };
}

// FFmpeg filter for loudness normalization
const loudnormFilter = `loudnorm=I=-14:TP=-1:LRA=11`;
```

**Why it matters:** Nothing ruins a mix like sudden volume changes. Professional DJs constantly adjust gain.

---

### Enhancement E: Filter Sweeps (Not Just Volume Fades)

Professional transitions use frequency sweeps:

```typescript
type FilterSweep = {
  type: 'highpass_up' | 'lowpass_down' | 'bandpass';
  startFreq: number;
  endFreq: number;
  resonance: number;
};

const FILTER_SWEEP_PRESETS: Record<string, FilterSweep> = {
  // Sweep out: gradually remove bass, leaving only highs
  sweep_out: { type: 'highpass_up', startFreq: 20, endFreq: 2000, resonance: 1.5 },
  
  // Sweep in: start with only highs, bring in full spectrum
  sweep_in: { type: 'highpass_up', startFreq: 2000, endFreq: 20, resonance: 1.5 },
  
  // Telephone effect: bandpass for dramatic transition
  telephone: { type: 'bandpass', startFreq: 800, endFreq: 800, resonance: 3 },
};

// FFmpeg animated filter (frequency changes over time)
function buildFilterSweepFilter(sweep: FilterSweep, duration: number): string {
  // Animated highpass: frequency ramps from start to end
  return `highpass=f='${sweep.startFreq}+${sweep.endFreq - sweep.startFreq}*t/${duration}':` +
         `p=${sweep.resonance}`;
}
```

---

### Enhancement F: Tempo Ramping (Smooth BPM Transitions)

Instead of instant tempo snap, gradually adjust:

```typescript
function buildTempoRampFilter(
  sourceBpm: number,
  targetBpm: number,
  rampDuration: number // seconds to ramp
): string {
  const startRatio = 1;
  const endRatio = targetBpm / sourceBpm;
  
  // Linear tempo ramp over duration
  // FFmpeg: atempo with expression
  return `atempo='${startRatio}+(${endRatio}-${startRatio})*t/${rampDuration}'`;
}
```

**Use case:** Track A is 124 BPM, Track B is 128 BPM. Instead of snapping Track A to 128, gradually speed up over 16 bars during the transition.

---

### Enhancement G: Transition Preview API

Preview individual transitions before full render:

```typescript
// POST /api/mashups/djmix/preview-transition
type PreviewRequest = {
  trackAId: string;
  trackBId: string;
  transitionType: StemTransitionType;
  mixPoint: MixPoint;
};

// Returns ~60 second audio clip: last 30s of A + first 30s of B with transition
type PreviewResponse = {
  audioUrl: string;        // Temporary URL (expires in 10 min)
  durationSeconds: number;
  transitionStartAt: number;
};
```

**Why it matters:** Users can audition each transition before committing to full render (saves time and compute).

---

### Enhancement H: Genre Compatibility Check

Even if BPM/key match, some genre jumps are jarring:

```typescript
const GENRE_COMPATIBILITY: Record<string, string[]> = {
  house: ['tech_house', 'deep_house', 'disco', 'nu_disco', 'uk_garage'],
  techno: ['tech_house', 'minimal', 'industrial', 'acid'],
  hip_hop: ['trap', 'rnb', 'dancehall', 'afrobeats'],
  pop: ['dance_pop', 'synth_pop', 'disco', 'rnb'],
  dnb: ['jungle', 'liquid', 'neurofunk'],
};

function checkGenreCompatibility(genreA: string, genreB: string): {
  compatible: boolean;
  distance: number; // 0 = same, 1 = adjacent, 2+ = far
} {
  if (genreA === genreB) return { compatible: true, distance: 0 };
  if (GENRE_COMPATIBILITY[genreA]?.includes(genreB)) {
    return { compatible: true, distance: 1 };
  }
  return { compatible: false, distance: 3 };
}
```

**UI Warning:** "Transitioning from Techno to Hip Hop may sound jarring. Consider reordering."

---

### Enhancement I: Fallback Chain for Robustness

If stem-based transition fails, gracefully degrade:

```typescript
async function executeTransition(
  trackA: TrackData,
  trackB: TrackData,
  suggestion: TransitionSuggestion
): Promise<Buffer> {
  const fallbackChain = [
    // 1. Try full stem-based transition
    () => buildStemTransition(trackA.stems, trackB.stems, suggestion),
    
    // 2. Fall back to EQ approximation
    () => buildEQTransition(trackA.audio, trackB.audio, suggestion.type),
    
    // 3. Fall back to simple crossfade
    () => buildSimpleCrossfade(trackA.audio, trackB.audio, suggestion.mixPoint.duration),
  ];
  
  for (const attempt of fallbackChain) {
    try {
      const result = await attempt();
      if (result && result.length > 0) return result;
    } catch (error) {
      log('warn', 'transition.fallback', { error: error.message });
      continue;
    }
  }
  
  throw new Error('All transition methods failed');
}
```

---

### Enhancement J: Mix Quality Scoring

After generation, score the mix quality:

```typescript
type MixQualityReport = {
  overallScore: number;           // 0-100
  transitionScores: {
    index: number;
    score: number;
    issues: string[];
  }[];
  suggestions: string[];
};

function scoreMixQuality(plan: AutoDjPlan, audioBuffer: Buffer): MixQualityReport {
  const scores = plan.transitions.map((t, i) => {
    let score = 100;
    const issues: string[] = [];
    
    // Deduct for key incompatibility
    if (!t.keyCompatible) {
      score -= 20;
      issues.push('Keys not harmonically compatible');
    }
    
    // Deduct for large BPM difference
    if (t.bpmDiff > 8) {
      score -= 15;
      issues.push(`Large BPM difference (${t.bpmDiff} BPM)`);
    }
    
    // Deduct for vocal collision
    if (t.vocalCollision?.severity === 'major') {
      score -= 25;
      issues.push('Vocal collision detected');
    }
    
    // Bonus for phrase alignment
    if (t.phraseAligned) score += 5;
    
    return { index: i, score: Math.max(0, score), issues };
  });
  
  return {
    overallScore: scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
    transitionScores: scores,
    suggestions: generateImprovementSuggestions(scores),
  };
}
```

---

## Updated Implementation Priority

| Phase | Feature | Effort | Impact | New? |
|-------|---------|--------|--------|------|
| 3.1 | Stem transition types | 2 days | High | |
| 3.2 | Transition suggestion engine | 2 days | High | |
| **A** | **Phrase-aligned mix points** | 1 day | **High** | ✓ |
| **B** | **Structure-aware rules** | 1 day | **High** | ✓ |
| 3.3 | FFmpeg stem filters | 2 days | High | |
| **C** | **Vocal collision detection** | 1 day | **Medium** | ✓ |
| **D** | **Gain staging** | 1 day | **High** | ✓ |
| **E** | **Filter sweeps** | 1 day | **Medium** | ✓ |
| 3.4 | EQ fallback | 1 day | Medium | |
| **G** | **Transition preview API** | 1 day | **Medium** | ✓ |
| 2.1 | Event energy profiles | 1 day | Medium | |
| **I** | **Fallback chain** | 0.5 day | **High** | ✓ |
| **J** | **Mix quality scoring** | 1 day | **Medium** | ✓ |
| **F** | Tempo ramping | 1 day | Low | ✓ |
| **H** | Genre compatibility | 0.5 day | Low | ✓ |

**Updated Total: ~18-20 days**

**Recommended Implementation Order:**
1. **Core Transitions:** 3.1 → 3.2 → A → B → 3.3
2. **Quality & Safety:** D → C → I
3. **Polish:** E → G → J
4. **Nice-to-have:** F → H

---

## Summary of New Additions

| Enhancement | What It Does | Why It Matters |
|-------------|--------------|----------------|
| **Phrase Alignment** | Mix on 8/16/32 bar boundaries | Professional sound |
| **Structure Rules** | Don't cut during drops/choruses | Preserve song moments |
| **Vocal Collision** | Detect overlapping vocals | Avoid cluttered sound |
| **Gain Staging** | Normalize loudness | No volume jumps |
| **Filter Sweeps** | Frequency-based transitions | More dynamic than volume fades |
| **Tempo Ramping** | Gradual BPM changes | Smoother feel |
| **Preview API** | Audition single transitions | Save time/compute |
| **Genre Check** | Warn on jarring genre jumps | Better flow |
| **Fallback Chain** | Stems → EQ → Crossfade | Robust error handling |
| **Quality Scoring** | Rate mix after generation | Feedback for improvement |

Ready to implement?
