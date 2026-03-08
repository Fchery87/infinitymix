# Analysis Contract and Annotation Semantics

Date: 2026-03-08

This document describes the canonical audio analysis contract output by the backend and saved to the `uploaded_tracks` table.

## Core Concepts

### Time Grids
- **beatGrid**: Array of precise timestamp floats representing each individual beat.
- **downbeatGrid**: A sparse subset of `beatGrid` representing the first beat of each musical bar (downbeat). If the track is 4/4, this will be every 4th beat.

### Sections & Phrases
- **phrases**: A sub-division of the track based on energy envelopes. Each phrase holds a start, end, and an average `energy` score.
- **structure**: Array of labeled sections (`intro`, `body`, `build`, `drop`, `outro`). Every boundary must have a `confidence` score (0-1) and a `provenance` value to track which subsystem generated the label.

### Cue Points
- **cuePoints**: List of optimal moments to mix in or mix out.
  - Types: `mix-in`, `mix-out`, `drop`, `breakdown`.
  - Driven by the semantic labels of the structure sections, augmented with explicit drops.

## Provenance Model

Every semantic annotation (`structure`, `cuePoints`) carries a provenance tag:
1. `browser-heuristic`: simple rule-based inference performed in the browser.
2. `browser-ml`: on-device ML inference (e.g., WebGPU).
3. `backend-heuristic`: strict rule-based labeling in the robust backend path.
4. `backend-model`: reserved for future heavy-weight ML processing on the backend.

The backend is authoritative. Browser hints can optionally advance analysis speed if confident enough.
