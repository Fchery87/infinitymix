
# Deep Research: DJ Mashups & InfinityMix Recommendations

## How Professional DJ Mashups Work

### Core Technical Pillars

**1. BPM (Tempo) Synchronization**
- Every song has a tempo measured in Beats Per Minute (80-180 typically)
- Tracks must be time-stretched/compressed to match tempos without pitch artifacts
- Modern tools use elastic audio algorithms (like Elastique) to preserve quality
- Phase alignment is critical - beats must land exactly together

**2. Harmonic (Key) Mixing**
- Songs are in musical keys (C major, A minor, etc.)
- The **Camelot Wheel** simplifies key compatibility (numbers 1-12 with A/B modes)
- Compatible keys: same number, +/-1, or switch A↔B
- Incompatible keys create dissonance - pitch shifting may be needed

**3. Stem Separation (The Game Changer)**
- AI models (Demucs, Spleeter, MDX-Net) isolate: **Vocals, Drums, Bass, Other**
- Enables: Acapella over different instrumental, drum swaps, creative layering
- Quality varies - artifacts in complex passages are common

**4. Structure Analysis**
- Songs have: Intro → Verse → Chorus → Bridge → Outro
- Smart mashups align structural elements (chorus-to-chorus transitions)
- Drop detection for EDM is critical for impact

**5. Transition Techniques**
- Crossfade (basic), EQ mixing (cut lows of outgoing track), filter sweeps
- Phrase matching: 8/16/32 bar phrases for natural transitions

---

## Current Codebase Analysis

### What You Have (Solid Foundation)
- Clean Next.js 15 architecture with App Router
- Cloudflare R2 storage integration
- PostgreSQL + Drizzle ORM with proper schema
- Authentication with better-auth
- Beautiful UI with Framer Motion
- Telemetry/monitoring infrastructure
- Feedback collection system

### Critical Gaps Identified

| Component | Current State | Impact |
|-----------|---------------|--------|
| **Audio Analysis** | Mock (pseudo-random BPM/key) | Cannot create harmonic mixes |
| **Mixing Engine** | Returns first track unmodified | No actual mashups |
| **Stem Separation** | None | Missing key feature |
| **Waveform Display** | None | Poor UX for track selection |
| **Preview Playback** | None | Users can't preview before generating |

---

## High-Impact Recommendations

### Phase 1: Real Audio Analysis (Essential)

**1. Integrate Essentia.js or Music-tempo for BPM Detection**
```typescript
// Example: Real BPM detection approach
import { Essentia, EssentiaWASM } from 'essentia.js';

async function detectBPM(audioBuffer: AudioBuffer): Promise<number> {
  const essentia = new Essentia(await EssentiaWASM());
  const rhythm = essentia.RhythmExtractor(audioSignal);
  return rhythm.bpm;
}
```

**2. Key Detection with Tonal.js or Essentia**
- Return Camelot notation alongside standard keys
- Store compatibility scores in database

**3. Beat Grid Generation**
- Store beat positions for precise sync
- Enable "snap to beat" in UI

---

### Phase 2: Real Mixing Engine (Core Value)

**Option A: Server-Side FFmpeg (Recommended for MVP)**
```typescript
// FFmpeg-based mixing pipeline
async function mixTracks(tracks: TrackInfo[], duration: number) {
  const filterComplex = tracks.map((t, i) => 
    `[${i}:a]atempo=${targetBPM/t.bpm}[a${i}]`
  ).join(';');
  
  await ffmpeg()
    .input(track1).input(track2)
    .complexFilter([
      // Time-stretch to common BPM
      `[0:a]rubberband=tempo=${ratio1}[a1]`,
      `[1:a]rubberband=tempo=${ratio2}[a2]`,
      // Mix with crossfade
      `[a1][a2]amix=inputs=2:duration=first[out]`
    ])
    .output(outputPath);
}
```

**Option B: WebAssembly Audio Processing (Advanced)**
- Use Tone.js + custom WASM for browser-side preview
- Server confirms and renders final

---

### Phase 3: Stem Separation Integration (Differentiator)

**Recommended: Demucs via Python API**
```python
# Backend Python service (FastAPI)
from demucs import separate

@app.post("/api/stems/{track_id}")
async def separate_stems(track_id: str):
    stems = separate(audio_path, model="htdemucs")
    # Returns: vocals.wav, drums.wav, bass.wav, other.wav
```

**Alternative: Cloud APIs**
- LALAL.AI, Moises.ai, AudioStrip have APIs
- Trade cost for simplicity

---

### Phase 4: UX Enhancements (Engagement)

**1. Waveform Visualization**
```typescript
// Using wavesurfer.js
import WaveSurfer from 'wavesurfer.js';

const waveform = WaveSurfer.create({
  container: '#waveform',
  waveColor: '#ff6b00',
  progressColor: '#ff9500',
  cursorColor: '#fff',
});
```

**2. Compatibility Scoring UI**
- Show BPM difference (green <5%, yellow <10%, red >10%)
- Show key compatibility via Camelot wheel graphic
- Auto-suggest best combinations

**3. Preview Before Generate**
- 15-30 second browser-side preview using Web Audio API
- Uses actual mixing logic at lower quality

**4. "Surprise Me" One-Tap Mixing**
```typescript
// Auto-select compatible tracks
function autoSelectTracks(pool: Track[]): Track[] {
  const anchor = pool[0];
  return pool.filter(t => 
    Math.abs(t.bpm - anchor.bpm) < 8 &&
    isCompatibleKey(t.key, anchor.key)
  ).slice(0, 4);
}
```

---

### Phase 5: Social & Growth Features

1. **Public Sharing** - Unique URLs with embed players
2. **Remix/Fork** - "Make your version" from any public mashup
3. **Trending Feed** - Discover popular mashups
4. **Challenges** - Weekly prompts ("80s vs Modern", "Genre Clash")
5. **Collaboration** - Invite others to contribute tracks

---

## Suggested Technology Stack Additions

| Need | Recommendation | Why |
|------|----------------|-----|
| Audio Processing | **FFmpeg + fluent-ffmpeg** | Proven, handles all formats |
| BPM Detection | **Essentia.js** or **music-tempo** | Accurate, runs in Node |
| Key Detection | **Essentia.js** or **keyfinder-cli** | Standard in DJ software |
| Stem Separation | **Demucs API** (Python microservice) | Best quality open-source |
| Waveforms | **wavesurfer.js** | Industry standard |
| Real-time Preview | **Tone.js** | WebAudio abstraction |
| Queue Processing | **BullMQ + Redis** | Handle async jobs properly |

---

## Implementation Priority

### Immediate (Make it Real)
1. Replace mock analysis with real BPM/key detection
2. Implement basic FFmpeg mixing (crossfade two tracks at matched BPM)
3. Add waveform visualization to track selection

### Short-term (Core Experience)
4. Add stem separation (start with API, move to self-hosted)
5. Build preview system
6. Implement compatibility scoring UI

### Medium-term (Differentiation)
7. Advanced mixing modes (vocals-over-instrumental, drum swap)
8. Social sharing features
9. Recommendation engine for track combinations

---

## Quick Wins from Your IDEAS_TODO.md

Already in your backlog that I'd prioritize:
- **"One-tap smart mix"** - High impact, moderate effort
- **"CDN-ready streaming"** - Essential for scale
- **"Survey v2 after playback"** - Better feedback loop
- **"Tiering"** - Monetization foundation

---

**Bottom Line**: You have a polished UI and solid infrastructure. The critical path to "best online mashup system" is:
1. Real audio analysis (not mocked)
2. Actual mixing engine (FFmpeg or similar)  
3. Stem separation capability

These three unlock everything else. Want me to start implementing any of these phases?
