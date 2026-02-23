# Remaining Phases Implementation Design

## Context

The Detailed-Analysis-Implementation-Plan.md defines 7 workstreams across 6 phases. Phases 0-1 are complete. Phases 2-5 have partial or no implementation. This design covers all remaining work.

## 1. UI Integration (WS2/WS3 Completion)

### Stem Player - Preview Graph Integration

When `toneJsPreviewGraph` feature flag is enabled, the stem player component (`src/components/stem-player/index.tsx`) uses `createPreviewGraph()` from `preview-graph.ts` instead of raw Web Audio nodes.

- Existing playback controls (play/pause/seek, volume, crossfade) delegate to the Tone.js graph
- Transition style buttons call `applyTransitionAutomation()` for real-time preview
- Falls back to current behavior when flag is off
- Telemetry emitted for preview graph init, transitions applied, and failures

### Section Tags in Create Flow

The create page (`src/app/create/page.tsx`) displays section tags from browser analysis alongside track cards.

- Tags shown as small colored badges (e.g., "vocal-dominant", "drop-like") on each track's section timeline
- Informational only - helps users understand what the planner will work with
- Only shown when `mlSectionTagging` or browser analysis is enabled

## 2. FFmpeg Two-Pass Loudnorm (WS5)

New module in `services/renderer/src/` alongside existing render pipeline. Gated by `twoPassLoudnorm` feature flag.

### Pass 1 - Measurement

Run `ffmpeg -i input.wav -af loudnorm=print_format=json -f null /dev/null` to extract:
- Integrated loudness (input_i)
- True peak (input_tp)
- LRA (input_lra)
- Threshold (input_thresh)

### Pass 2 - Normalization

Apply measured values with target: -14 LUFS, true peak ceiling -1.5 dBTP, LRA 11.

### Post-Render QA

Extract `ebur128` and `astats` metrics from output. Thresholds:
- Integrated loudness within 1 LU of -14 LUFS target
- True peak <= -1.0 dBTP
- No clipping detected in astats

### Retry Policy

If QA fails, retry with adjusted gain/limiter (max 2 retries). All metrics logged via telemetry.

## 3. Expanded Rule Packs (WS4 Completion)

Three new rule pack files in `services/worker/src/planning/rules/`:

- `energy-arc-rules.json` - Energy progression rules (rising, falling, peak placement relative to mix duration)
- `phrase-safety-rules.json` - Ensure transitions happen at phrase boundaries, penalize mid-phrase cuts
- `genre-compatibility-rules.json` - Genre-aware section and transition style selection

These extend the existing default pack and are composable via the rules engine.

## 4. Resumable Uploads (WS7)

- Install `tus-js-client` dependency
- Add resumable upload path in `src/lib/audio/upload-service.ts` gated by `resumableUploads` flag
- New API route for tus protocol handling
- Falls back to current chunked upload when flag is off or tus initialization fails
- Telemetry for upload retries, resume events, and failures

## 5. Implementation-Status.md Update

Correct status doc to reflect actual implementation state:
- WS4 (Rules Engine): Substantially complete (was "Not started")
- WS6 (Style Registry): Complete (was "Not started")

## Decisions

- Loudness target: -14 LUFS (streaming standard)
- UI integration: Feature-flagged swap (Tone.js preview graph replaces raw Web Audio when flag is on)
- All new capabilities behind existing feature flags
