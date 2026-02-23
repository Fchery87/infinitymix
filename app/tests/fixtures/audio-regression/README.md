# Audio Regression Fixture Set

This folder contains the curated fixture manifest and QA rubric for Phase 0 baseline/regression evaluation of the audio pipeline.

## Purpose

Use a fixed corpus of tracks to compare changes across phases (browser analysis, planner, section tagging, loudness/refinement).

## Contents

- `manifest.json`
  - Canonical fixture metadata, categories, and expected characteristics.
- `review-rubric.md`
  - Human QA scoring rubric for transitions, phrasing, section choice, and loudness quality.
- `baselines/`
  - Captured baseline snapshots from `scripts/capture-audio-baseline.mjs`.

## Audio Assets

Binary audio assets are intentionally not committed here. Place local fixture files in a private folder and keep `manifest.json` filenames in sync.

Recommended local layout (not committed):

```text
private-fixtures/
  regression-audio/
    pop_vocal_124bpm_cmaj.mp3
    hiphop_vocal_92bpm_amin.mp3
    edm_drop_128bpm_fmin.wav
    rock_band_140bpm_emaj.mp3
    afrobeat_groove_105bpm_gmaj.mp3
    rnb_slowjam_78bpm_dmin.mp3
```

## Baseline Workflow

1. Ensure admin access is configured.
2. Start the app and services.
3. Run the fixture uploads / analyses manually or via your own runner.
4. Capture a snapshot:

```bash
npm run baseline:audio:capture
```

5. Compare snapshots after changes:

```bash
npm run baseline:audio:compare -- --before tests/fixtures/audio-regression/baselines/<older>.json --after tests/fixtures/audio-regression/baselines/<newer>.json
```

