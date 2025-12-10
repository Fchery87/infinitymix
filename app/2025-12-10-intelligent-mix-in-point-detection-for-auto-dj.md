
# Intelligent Mix-In Point Detection for Auto DJ

## The Problem

Currently, the Auto DJ system always starts the incoming track from **0:00** (the beginning). Professional DJs rarely do this - they find an optimal **mix-in point** based on:

- Track structure (skip long intros, start at verse/buildup)
- Energy matching (enter at appropriate energy level)
- Transition type (drop mixing vs smooth blending)
- Phrase alignment (enter on a downbeat)

---

## Key Concepts

### Cue Point Types (Professional DJ Practice)

| Cue # | Name | Purpose | Typical Position |
|-------|------|---------|------------------|
| 1 | **Mix-In** | Where to start track during blend | First phrase after intro, or buildup |
| 2 | **Drop** | Main energy peak / chorus | First drop or chorus |
| 3 | **Breakdown** | Low energy section | Middle breakdown |
| 4 | **Mix-Out** | Where to start fading out | Outro start or last phrase |

### Mix-In Point Selection Rules

From professional DJ interviews and academic research:

1. **Skip long intros** - Intros are designed for mixing, but often skipped for tighter blends
2. **Match energy context** - If outgoing track is high energy, enter incoming at buildup/drop
3. **Phrase alignment** - Always enter on beat 1 of an 8/16/32 bar phrase
4. **Structure awareness** - Don't enter mid-chorus or mid-drop

---

## Implementation Plan

### Phase 1: Auto Cue Point Detection

Add automatic cue point detection during track analysis:

```typescript
type AutoCuePoints = {
  mixIn: number;       // Recommended mix-in point (seconds)
  drop: number | null; // First drop/chorus
  breakdown: number | null;
  mixOut: number;      // Recommended mix-out point
  confidence: number;  // 0-1 detection confidence
};

async function detectCuePoints(trackInfo: TrackInfo): Promise<AutoCuePoints> {
  const structure = trackInfo.structure || [];
  const beatGrid = trackInfo.beatGrid || [];
  const bpm = Number(trackInfo.bpm) || 120;
  const barDuration = (60 / bpm) * 4;
  const duration = Number(trackInfo.durationSeconds) || 180;
  
  // Find key structure sections
  const intro = structure.find(s => s.label === 'intro');
  const verse = structure.find(s => s.label === 'verse');
  const buildup = structure.find(s => s.label === 'buildup');
  const drop = structure.find(s => s.label === 'drop');
  const chorus = structure.find(s => s.label === 'chorus');
  const breakdown = structure.find(s => s.label === 'breakdown');
  const outro = structure.find(s => s.label === 'outro');
  
  // MIX-IN POINT: First phrase after intro, or buildup start
  let mixIn = 0;
  if (intro?.end) {
    // Skip intro, start at first phrase boundary after
    mixIn = snapToPhrase(intro.end, barDuration, 8);
  } else if (verse?.start) {
    mixIn = snapToPhrase(verse.start, barDuration, 8);
  } else if (buildup?.start) {
    mixIn = snapToPhrase(buildup.start, barDuration, 8);
  } else {
    // Fallback: skip first 8-16 bars (typical intro length)
    mixIn = Math.min(16 * barDuration, duration * 0.1);
  }
  
  // DROP: First high-energy peak
  const dropPoint = drop?.start ?? chorus?.start ?? null;
  
  // BREAKDOWN: Mid-track low point
  const breakdownPoint = breakdown?.start ?? null;
  
  // MIX-OUT: Outro start or last 32 bars
  let mixOut = duration;
  if (outro?.start) {
    mixOut = snapToPhrase(outro.start, barDuration, 8);
  } else {
    mixOut = Math.max(0, duration - 32 * barDuration);
  }
  
  return {
    mixIn: Math.max(0, mixIn),
    drop: dropPoint,
    breakdown: breakdownPoint,
    mixOut: Math.min(duration, mixOut),
    confidence: structure.length > 0 ? 0.8 : 0.5,
  };
}
```

### Phase 2: Context-Aware Mix-In Selection

Choose mix-in point based on transition context:

```typescript
type MixInStrategy = 
  | 'intro'        // Start from beginning (for long transitions)
  | 'post_intro'   // Skip intro, start at first verse/phrase
  | 'buildup'      // Start at buildup (for energy matching)
  | 'drop'         // Drop mixing - start right at the drop
  | 'verse'        // Start at verse (balanced energy)
  | 'custom';      // User-specified cue point

function selectMixInPoint(
  incomingTrack: TrackInfo,
  outgoingTrack: TrackInfo,
  context: {
    transitionStyle: TransitionStyle;
    energyPhase: 'warmup' | 'build' | 'peak' | 'cooldown';
    overlapDuration: number;
  }
): { point: number; strategy: MixInStrategy; reason: string } {
  const cuePoints = detectCuePoints(incomingTrack);
  const barDuration = (60 / (Number(incomingTrack.bpm) || 120)) * 4;
  
  // RULE 1: Drop mixing - if transition style is 'drop', enter at the drop
  if (context.transitionStyle === 'drop' && cuePoints.drop) {
    return {
      point: cuePoints.drop,
      strategy: 'drop',
      reason: 'Drop mixing: entering at first drop for maximum impact',
    };
  }
  
  // RULE 2: Peak energy phase - enter at buildup or drop
  if (context.energyPhase === 'peak') {
    const buildup = incomingTrack.structure?.find(s => s.label === 'buildup');
    if (buildup) {
      return {
        point: buildup.start,
        strategy: 'buildup',
        reason: 'Peak phase: entering at buildup to maintain energy',
      };
    }
  }
  
  // RULE 3: Short overlap - skip intro entirely
  if (context.overlapDuration < 8 * barDuration) {
    return {
      point: cuePoints.mixIn,
      strategy: 'post_intro',
      reason: 'Short transition: skipping intro for tighter blend',
    };
  }
  
  // RULE 4: Long overlap - can use intro for gradual blend
  if (context.overlapDuration >= 16 * barDuration) {
    return {
      point: 0,
      strategy: 'intro',
      reason: 'Long transition: using full intro for gradual blend',
    };
  }
  
  // DEFAULT: Start after intro
  return {
    point: cuePoints.mixIn,
    strategy: 'post_intro',
    reason: 'Standard transition: starting after intro',
  };
}
```

### Phase 3: Database Schema Update

Store detected cue points for each track:

```sql
-- Add cue points column to uploaded_tracks
ALTER TABLE uploaded_tracks ADD COLUMN cue_points JSONB DEFAULT NULL;

-- Example data:
-- {
--   "mixIn": 16.5,
--   "drop": 64.0,
--   "breakdown": 128.0,
--   "mixOut": 192.0,
--   "confidence": 0.85,
--   "detectedAt": "2024-12-10T..."
-- }
```

### Phase 4: Integrate with Auto DJ Planning

Update `planAutoDjMix` to use intelligent mix-in points:

```typescript
// In auto-dj-service.ts

type PlannedTransition = {
  fromId: string;
  toId: string;
  // ... existing fields ...
  
  // NEW: Mix-in point for incoming track
  mixInPoint: {
    position: number;      // Seconds into incoming track
    strategy: MixInStrategy;
    reason: string;
  };
};

// Update the planning loop
for (let i = 0; i < ordered.length - 1; i++) {
  const from = trackInfos.find(t => t.id === ordered[i])!;
  const to = trackInfos.find(t => t.id === ordered[i + 1])!;
  
  // Determine mix-in point for incoming track
  const mixInSelection = selectMixInPoint(to, from, {
    transitionStyle: config.transitionStyle ?? 'smooth',
    energyPhase: getEnergyPhase(i, ordered.length, config.eventType),
    overlapDuration: fadeDuration,
  });
  
  transitions.push({
    // ... existing fields ...
    mixInPoint: mixInSelection,
  });
}
```

### Phase 5: Update Rendering

Use mix-in point as `startOffset` in FFmpeg:

```typescript
// In renderAutoDjMix playback planning

const playbackPlans: TrackPlaybackPlan[] = orderedBuffers.map((track, idx) => {
  // Get mix-in point from transition (if not first track)
  const transition = idx > 0 ? plan.transitions[idx - 1] : null;
  const mixInPoint = transition?.mixInPoint?.position ?? 0;
  
  return {
    id: track.id,
    // ... other fields ...
    startOffset: mixInPoint,  // START FROM MIX-IN POINT, NOT 0
    trimEnd: maxSegment,
  };
});
```

**FFmpeg filter change:**
```
# Before (always starts at 0):
atrim=start=0:end=62

# After (starts at mix-in point):
atrim=start=16.5:end=78.5  # Skip first 16.5s (intro)
```

---

## Mix-In Point Rules Summary

| Transition Style | Energy Phase | Mix-In Strategy | Why |
|-----------------|--------------|-----------------|-----|
| `smooth` | warmup | `intro` (0:00) | Long gradual blend |
| `smooth` | build | `post_intro` | Skip intro, cleaner blend |
| `smooth` | peak | `buildup` | Match high energy |
| `drop` | any | `drop` | Maximum impact |
| `cut` | any | `post_intro` | Quick clean cut |
| `energy` | peak | `drop` or `buildup` | Maintain momentum |

---

## UI Enhancements

### Track Library View

Show detected cue points on waveform:
```
[========|====VERSE====|==BUILD==|===DROP===|==BREAK==|==OUTRO==]
         ^mixIn                  ^drop      ^breakdown ^mixOut
```

### Auto DJ Settings

```
Mix-In Behavior:
(•) Auto-detect optimal entry point
( ) Always start from beginning
( ) Always start at drop
( ) Custom: skip first [__] seconds
```

### Transition Preview

Show which part of incoming track will be used:
```
Track 2 Entry: Post-Intro (16.5s)
"Skipping 16-bar intro for cleaner blend"
[░░░░|████████████████████████████]
     ^Start here
```

---

## Implementation Priority

| Task | Effort | Impact |
|------|--------|--------|
| `detectCuePoints()` function | 1 day | High |
| `selectMixInPoint()` context logic | 1 day | High |
| Integrate with `planAutoDjMix` | 0.5 day | High |
| Update rendering with `startOffset` | 0.5 day | High |
| DB schema for cue points | 0.5 day | Medium |
| UI cue point display | 1 day | Medium |
| UI mix-in settings | 0.5 day | Low |

**Total: ~5-6 days**

---

## Expected Results

**Before (current):**
```
Track 1: [INTRO----VERSE----DROP----OUTRO] (plays intro→outro)
Track 2: [INTRO----VERSE----DROP----OUTRO] (starts at 0:00)

Result: Long intro of Track 2 plays during transition = boring
```

**After (with mix-in points):**
```
Track 1: [INTRO----VERSE----DROP----OUTRO] (fades during outro)
Track 2: [skip]---[VERSE----DROP----OUTRO] (starts at verse)

Result: Track 2 enters with energy, cleaner blend
```

---

Ready to implement intelligent mix-in point detection?
