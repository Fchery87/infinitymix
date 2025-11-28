# InfinityMix

3.1. Idea Header

Working Title: InfinityMix
Type: Web app (AI-powered mashup generator)
Status: Fleshing out

3.2. One-Liner

Upload songs and stems, choose a duration, hit Generate, and an AI “super-mashup DJ” creates a polished mashup you can play in the browser and download.

3.3. Problem & Audience

Target users: bedroom producers and DJs, online creators (YouTube / TikTok / Twitch), and music fans who want “What if this song was over that beat?” without DAWs or music theory.

Core problem: good mashups are slow and technical—finding compatible songs, lining up grids, warping, pitching, arranging, mixing. Existing tools are either live DJ software (manual) or DAWs (complex). There’s no simple “upload → generate → listen & download” tool that behaves like a world-class mashup DJ.

Why now: stem separation, beat tracking and key detection are mature; AI music tools are rising; demand for fast, unique audio for social content and DJ culture is huge.

3.4. Vision & Value

Primary outcome: user uploads a pool of songs/stems, sets a target length, clicks Generate, and gets mashups that are on-beat, in-key, structured, energetic, and instantly playable + downloadable.

Key value promise:
“No DAW, no music theory, no engineering. Just pick songs, choose duration, and get a DJ-level mashup you can play and download.”

Vibe: magical, playful, empowering. Simple UI, deep “DJ brain” underneath.

3.5. Core Features (V1 Must-Haves)

1) Smart Audio Analysis (“Ears”)
Per track the system detects BPM + beat grid, key + rough harmony, song sections (intro/verse/chorus/drop/outro), does stem separation (at least vocals vs instrumental) and computes an energy curve. This is the musical context for DJ-style decisions.

2) Duration-Aware Generation
User enters a target duration (e.g., 0:45–5:00+). The system turns time into bars/phrases at a master BPM and picks a structure:

Short: quick intro → hook → outro.

Medium: intro → verse → chorus → switch → outro.

Long: mini DJ-set arc with multiple songs.

It rounds to full phrases instead of chopping mid-bar.

3) Multi-Track Pool
User can upload many tracks (songs, acapellas, instrumentals, loops). Backend treats them as ingredients: chooses backbone instrumentals, vocal moments, and rotates songs in and out over time. Internally you can cap for performance, but UX says “add as many records as you want.”

4) Mashup Planner (“Brain”)
Given analysis + duration + compatibility (key/BPM/structure) + optional vibe (safe vs experimental, chill vs hype), the planner chooses master BPM/key, 1–2 backbone instrumentals and which vocal sections go where. It builds a timeline (intro, vocal sections from different tracks, big chorus/drop moments, outro): a structured arrangement, not random overlaps.

5) Rendering & Mixing
Engine time-stretches stems to master BPM, pitch-shifts to the chosen key, places clips per the plan, adds crossfades, then does basic mixing (vocal/instrument balance, simple EQ, light compression/limiting). Output: a rendered mashup audio file (WAV or high-bitrate MP3).

6) In-Browser Playback + Download
After Generate, the app shows an audio player (play/pause, seek, optional waveform) and a clear “Download Mashup” button so users can immediately listen, then save the file for DJ sets, videos, etc.

7) Simple Guided Flow

Upload: drag-and-drop multiple audio files; optionally show detected BPM/key.

Settings: set duration; optionally energy (Chill → Hype) and style (Safe → Experimental).

Generate: backend analyzes, plans, renders.

Playback & download: built-in player plus download; optionally 2–3 variants.

3.6. Nice-to-Haves (Later)

Song suggestions based on the user’s pool; prompt-based modes (“festival banger,” “chill flip,” “nostalgia blend”); style sliders (vocal density, weirdness, amount of switch-ups); live-performance exports (stems, cue points, loops); AI FX for transitions; a visual timeline editor where users tweak the AI’s arrangement.

3.7. Constraints, Risks & MVP

Platform: Web app; heavy DSP/AI on the backend.
Tech: React/Next.js frontend; Python (FastAPI) backend; Python audio/ML stack (e.g., Spleeter/Demucs for stems, Essentia-style tools for BPM/key/structure/energy); S3-style storage; PostgreSQL; Redis + workers; GPU for stems/ML.

Risks: compute cost (stems + analysis), audio quality, subjective “perfection,” copyright/legal for uploaded music, bold expectations vs early reality.

Tiny MVP: internally use 2–3 tracks, 1 backbone instrumental + 1 vocal track, and a couple of fixed duration templates (e.g., 1:00, 2:00). It still must generate a structured mash and provide in-browser playback + download. First steps: script the core pipeline (analyze two songs, stretch/pitch, align a chorus, export); add simple duration templates; then wrap a minimal UI (upload, choose duration preset, Generate, play/download).

## Tech Stack

- **Stack**: custom
- **Generated**: 2025-11-28

## Quick Start

```bash
# Clone or download the project
git clone <repository-url>
cd infinitymix-910c0b47

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Run database migrations (if applicable)
pnpm db:migrate

# Start development server
pnpm dev
```

## Project Structure

```
infinitymix-910c0b47/
├── HANDOFF.md          # Complete project handoff for LLM code generation
├── README.md           # This file
├── specs/              # All specification documents
│   ├── ANALYSIS/       # Analysis phase outputs
│   ├── SPEC/           # Specification phase outputs
│   ├── DEPENDENCIES/   # Dependency definitions
│   └── SOLUTIONING/    # Architecture and task breakdown
└── (generated code)    # Use HANDOFF.md with an LLM to generate
```

## Documentation

| Document | Description |
|----------|-------------|
| [HANDOFF.md](./HANDOFF.md) | Complete handoff document for LLM code generation |
| [constitution.md](./specs/ANALYSIS/constitution.md) | Project guiding principles |
| [project-brief.md](./specs/ANALYSIS/project-brief.md) | Project overview and requirements |
| [PRD.md](./specs/SPEC/PRD.md) | Product Requirements Document |
| [architecture.md](./specs/SOLUTIONING/architecture.md) | System architecture |
| [tasks.md](./specs/SOLUTIONING/tasks.md) | Implementation task breakdown |

## Code Generation

To generate the implementation code, use the HANDOFF.md with your preferred LLM:

1. Open HANDOFF.md in your editor
2. Copy the entire content
3. Paste into Claude, GPT-4, or Gemini
4. Request code generation following the specifications

## License

This project was generated using the Spec-Driven Platform.

---

*Generated by [Spec-Driven Platform](https://spec-driven.dev)*
