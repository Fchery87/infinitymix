## Research Summary

### What InfinityMix Already Has
- **Beat Grid**: Array of timestamps (seconds) for each beat, stored in `beatGrid` column
- **BPM Detection**: Accurate BPM with confidence score
- **Drop Detection**: `dropMoments` array with timestamp of energy peaks
- **Structure Detection**: `structure` array with labels like `intro`, `verse`, `chorus`, `drop`, `outro`
- **Time-stretching**: `buildAtempoChain()` for BPM sync

### What's Needed
1. **Beat Grid Alignment** - Sync downbeats between vocal and instrumental tracks
2. **Crossfade Transitions** - Smooth blend at transition points using FFmpeg `acrossfade`

---

## Implementation Plan

### Phase 1: Beat Grid Alignment

**Goal:** Align the downbeat (first beat of a bar) of vocals with the instrumental

#### Algorithm
```typescript
/**
 * Calculate beat offset to align two tracks' downbeats
 * @param vocalBeatGrid - Array of beat timestamps (seconds) from vocal track
 * @param instBeatGrid - Array of beat timestamps (seconds) from instrumental track
 * @param vocalBpm - BPM of vocal track (after time-stretch)
 * @returns offset in seconds to delay vocals (negative = advance)
 */
function calculateBeatAlignment(
  vocalBeatGrid: number[],
  instBeatGrid: number[],
  vocalBpm: number
): number {
  if (!vocalBeatGrid.length || !instBeatGrid.length) return 0;
  
  // Find first downbeat (every 4 beats = 1 bar in 4/4 time)
  const vocalDownbeat = vocalBeatGrid[0]; // First beat position
  const instDownbeat = instBeatGrid[0];
  
  // Beat interval (seconds per beat)
  const beatInterval = 60 / vocalBpm;
  const barInterval = beatInterval * 4; // 4 beats per bar
  
  // Calculate raw offset
  let offset = instDownbeat - vocalDownbeat;
  
  // Snap to nearest beat for tighter sync
  offset = Math.round(offset / beatInterval) * beatInterval;
  
  // Keep offset within one bar (avoid large delays)
  while (offset > barInterval / 2) offset -= barInterval;
  while (offset < -barInterval / 2) offset += barInterval;
  
  return offset;
}
```

#### FFmpeg Implementation
```typescript
// Apply offset using adelay filter (milliseconds)
const offsetMs = Math.round(beatOffset * 1000);
if (offsetMs > 0) {
  // Delay vocals to align with instrumental
  vocalChain = `adelay=${offsetMs}|${offsetMs},${vocalChain}`;
} else if (offsetMs < 0) {
  // Delay instrumental to align with vocals  
  instChain = `adelay=${Math.abs(offsetMs)}|${Math.abs(offsetMs)},${instChain}`;
}
```

---

### Phase 2: Crossfade Transitions

**Goal:** Smooth transitions instead of hard cuts, especially at drop points

#### FFmpeg `acrossfade` Filter
```bash
# Basic crossfade between two audio streams
ffmpeg -i track1.wav -i track2.wav -filter_complex \
  "[0:a][1:a]acrossfade=d=4:c1=tri:c2=tri[out]" \
  -map "[out]" output.mp3

# Parameters:
# d=4        - 4 second crossfade duration
# c1=tri     - Fade curve for first track (triangular)
# c2=tri     - Fade curve for second track
# Curves: tri, qsin, hsin, esin, log, ipar, qua, cub, squ, cbr, par, exp, iqsin, ihsin, dese, desi, losi, sinc, isinc, nofade
```

#### Transition Styles
```typescript
type TransitionStyle = 'smooth' | 'drop' | 'cut' | 'energy';

const CROSSFADE_PRESETS = {
  smooth: { duration: 4, curve1: 'tri', curve2: 'tri' },
  drop: { duration: 0.5, curve1: 'exp', curve2: 'log' },  // Quick punch
  cut: { duration: 0, curve1: 'nofade', curve2: 'nofade' },
  energy: { duration: 2, curve1: 'qsin', curve2: 'qsin' }, // Quarter-sine (DJ style)
};
```

#### Structure-Aware Transitions
```typescript
/**
 * Find optimal transition point based on track structure
 */
function findTransitionPoint(
  structure: Array<{ label: string; start: number; end: number }>,
  drops: number[],
  preference: 'drop' | 'chorus' | 'verse'
): { startFade: number; endFade: number; style: TransitionStyle } {
  // Find sections by preference
  if (preference === 'drop' && drops.length > 0) {
    const dropTime = drops[0];
    return {
      startFade: dropTime - 4, // Start fade 4s before drop
      endFade: dropTime,
      style: 'drop',
    };
  }
  
  const section = structure.find(s => s.label === preference);
  if (section) {
    return {
      startFade: section.start - 2,
      endFade: section.start + 2,
      style: 'smooth',
    };
  }
  
  // Default: fade at 80% of track
  return { startFade: -1, endFade: -1, style: 'smooth' };
}
```

---

### Phase 3: Enhanced Stem Mashup Config

```typescript
export type StemMashupConfig = {
  vocalTrackId: string;
  instrumentalTrackId: string;
  targetBpm?: number;
  autoKeyMatch?: boolean;
  pitchShiftSemitones?: number;
  vocalVolume?: number;
  instrumentalVolume?: number;
  durationSeconds?: number;
  
  // NEW: Beat alignment options
  beatAlign?: boolean;              // Enable beat grid alignment (default: true)
  beatAlignMode?: 'downbeat' | 'any'; // Align to downbeat or nearest beat
  
  // NEW: Crossfade options  
  crossfade?: {
    enabled: boolean;
    duration: number;         // seconds
    style: TransitionStyle;   // 'smooth' | 'drop' | 'cut' | 'energy'
    transitionAt?: 'start' | 'drop' | 'chorus' | 'auto';
  };
};
```

---

### Phase 4: FFmpeg Filter Chain Update

```typescript
function buildStemMashupFilters(config: StemMashupConfig, trackInfo: TrackInfo): string[] {
  const filters: string[] = [];
  
  // 1. Time-stretch vocals
  const vocalAtempo = buildAtempoChain(vocalTempoRatio);
  let vocalChain = vocalAtempo || 'anull';
  
  // 2. Beat alignment (NEW)
  if (config.beatAlign !== false) {
    const beatOffset = calculateBeatAlignment(
      trackInfo.vocalBeatGrid,
      trackInfo.instBeatGrid,
      config.targetBpm
    );
    if (beatOffset !== 0) {
      const delayMs = Math.abs(Math.round(beatOffset * 1000));
      if (beatOffset > 0) {
        vocalChain = `adelay=${delayMs}|${delayMs},${vocalChain}`;
      } else {
        // Apply to instrumental instead
        instChain = `adelay=${delayMs}|${delayMs},${instChain}`;
      }
    }
  }
  
  // 3. Pitch shift (existing)
  if (pitchShiftSemitones !== 0) {
    vocalChain += `,asetrate=${newRate},aresample=${OUTPUT_SAMPLE_RATE}`;
  }
  
  // 4. EQ and volume (existing)
  vocalChain += `,highpass=f=120,lowpass=f=12000,volume=${vocalVolume}`;
  
  filters.push(`[0:a]${vocalChain}[vocals]`);
  filters.push(`[1:a]${instChain}[inst]`);
  
  // 5. Crossfade OR direct mix (NEW)
  if (config.crossfade?.enabled) {
    const { duration, style } = config.crossfade;
    const preset = CROSSFADE_PRESETS[style];
    // For crossfade at specific point, we need to split and reassemble
    filters.push(`[vocals][inst]acrossfade=d=${duration}:c1=${preset.curve1}:c2=${preset.curve2}[mixed]`);
  } else {
    // Standard mix (existing)
    filters.push(`[vocals][inst]amix=inputs=2:duration=shortest:normalize=0[mixed]`);
  }
  
  // 6. Final limiter
  filters.push(`[mixed]alimiter=level_in=1:level_out=0.95[out]`);
  
  return filters;
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/utils/audio-compat.ts` | Add `calculateBeatAlignment()` function |
| `src/lib/audio/mixing-service.ts` | Update `StemMashupConfig`, add crossfade support, beat alignment |
| `src/lib/audio/stems-service.ts` | Include `beatGrid` in `getTrackInfoForMixing()` |
| `src/app/api/mashups/stem/route.ts` | Accept new config options |
| `src/app/create/page.tsx` | Add UI for beat align toggle, crossfade style selector |

---

## UI Additions

```tsx
{/* Beat Alignment Toggle */}
<label className="flex items-center gap-3">
  <input type="checkbox" checked={beatAlign} onChange={...} />
  <div>
    <p className="text-sm">Beat-sync alignment</p>
    <p className="text-xs text-gray-500">Align downbeats for tighter sync</p>
  </div>
</label>

{/* Crossfade Style */}
<div>
  <label className="text-xs text-gray-400">Transition Style</label>
  <select value={crossfadeStyle} onChange={...}>
    <option value="smooth">Smooth (4s fade)</option>
    <option value="drop">Drop punch (0.5s)</option>
    <option value="energy">DJ style (2s)</option>
    <option value="cut">Hard cut (no fade)</option>
  </select>
</div>
```

---

## Implementation Priority

1. **Beat Alignment** (High) - `calculateBeatAlignment()` + `adelay` filter
2. **Basic Crossfade** (High) - Add `acrossfade` option to mixer
3. **Crossfade Presets** (Medium) - Smooth, drop, energy styles
4. **Structure-Aware Transitions** (Medium) - Use `drops` and `structure` data
5. **UI Controls** (Medium) - Toggles and dropdowns

---

## Technical Notes

- **adelay filter**: `adelay=1000|1000` delays both channels by 1000ms
- **acrossfade**: Only works with exactly 2 inputs; for more complex arrangements need `afade` + `amix`
- **Beat grid already exists** in database as `beat_grid` JSONB column
- **Crossfade at specific time** requires splitting audio with `atrim` before applying crossfade

Ready to implement?