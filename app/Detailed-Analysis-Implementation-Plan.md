# InfinityMix Detailed Analysis Implementation Plan

## Purpose

This plan translates the recommendations in `Detailed-Analysis.md` into a practical implementation roadmap for InfinityMix as an online-only web application. It prioritizes free and open-source technologies that fit the current architecture:

- Next.js 15 + React 19 (`app/`)
- TypeScript monorepo
- Audio microservices (`services/analyzer`, `services/renderer`, `services/worker`)
- FFmpeg-based rendering pipeline
- Cloudflare R2 storage
- BullMQ/Redis job orchestration

## Goals

1. Improve mashup quality (compatibility, phrasing, transitions, structure, refinement).
2. Keep UI responsive during analysis and previews.
3. Preserve deterministic backend rendering for production output.
4. Introduce explainable, testable planning/style logic instead of opaque generation.
5. Roll out incrementally with measurable quality and performance gains.

## Non-Goals (Phase 1-2)

- Full end-to-end generative music creation.
- Training custom ML models from scratch.
- Replacing the FFmpeg renderer with browser-only rendering.
- Offline-first app support (this is an online web app).

## Target Architecture (High-Level)

### Browser (Next.js Client Components)

- Upload + local decode for preview analysis
- Web Worker-based feature extraction and beat estimation
- Optional WebGPU/WASM inference for section/style tagging
- Tone.js preview graph for low-latency interactive effects

### Web API / Backend Services

- Existing Next.js API routes for uploads, metadata, and orchestration
- Analyzer service for authoritative/deeper analysis when needed
- Worker service for planning and rules execution
- Renderer service for final FFmpeg render + two-pass loudness refinement

### Shared Logic / Contracts

- Typed analysis result schema
- JSON Schema for style packs (Ajv validation)
- Rules format for structure and transition policies

## Guiding Principles

1. Browser for fast feedback, backend for final output.
2. Confidence-gated escalation: only run expensive server analysis when browser confidence is low.
3. Rules-first planning for explainability and testing.
4. Progressive enhancement: WebGPU acceleration when available, WASM fallback otherwise.
5. Feature flags and A/B comparisons for quality-sensitive changes.

## Workstreams and Deliverables

## 1. Audio Analysis Pipeline Upgrade (Track Compatibility, BPM/Key, Phrasing)

### Objective

Improve track compatibility scoring and beat/phrase confidence without degrading UX.

### Technologies

- `essentia.js` (AGPL-3.0, WASM)
- `meyda` (MIT)
- `web-audio-beat-detector` (MIT)
- Web Workers + `comlink`

### Deliverables

1. Browser audio analysis worker module
- `src/lib/audio/workers/analysis-worker.ts`
- Exposes typed Comlink API for:
  - lightweight timbral features (`meyda`)
  - beat/BPM estimate (`web-audio-beat-detector`)
  - advanced MIR features (`essentia.js`) behind feature flag

2. Shared analysis result contract
- `src/lib/audio/types/analysis.ts`
- Include confidence fields:
  - `tempoConfidence`
  - `keyConfidence`
  - `phraseConfidence`
  - `sectionConfidence`

3. Confidence-gated backend escalation
- If confidence < threshold, call analyzer service for authoritative analysis.

4. Compatibility scoring upgrade
- Extend existing heuristics with weighted feature similarity:
  - energy envelope similarity
  - timbre compatibility
  - rhythmic stability
  - key confidence penalty

### Acceptance Criteria

- UI remains responsive during analysis for typical uploads (<100MB).
- BPM estimate available in browser for preview path before backend job completes.
- Backend analyzer is triggered only for low-confidence or unsupported cases.
- Existing analysis route behavior remains backward compatible.

## 2. Section Detection and Semantic Tagging (Section Choice)

### Objective

Improve detection of usable mashup segments (chorus/build/drop/vocal-led sections) using modern browser inference.

### Technologies

- `@huggingface/transformers` (Apache-2.0)
- ONNX Runtime Web via Transformers.js backend
- WebGPU (when supported), WASM fallback
- Optional OPFS model cache later phase

### Deliverables

1. Section tagging inference service (client-side worker)
- Windowed audio clip classification for coarse tags:
  - `vocal-dominant`
  - `percussive`
  - `build`
  - `drop-like`
  - `ambient`

2. Fusion logic with existing `buildStructure()` output
- Existing energy-peak section labels remain primary.
- ML tags are used as confidence boosters / tie-breakers.

3. Inference capability detection
- Detect WebGPU support and choose:
  - WebGPU model path
  - WASM fallback path
  - backend-only fallback when browser resources are insufficient

### Acceptance Criteria

- Section labels degrade gracefully when inference is unavailable.
- No hard dependency on WebGPU support.
- Tagged sections improve cue-point quality in internal QA comparisons.

## 3. Browser Preview DSP Modernization (EQ, Volume, Effects, Transitions)

### Objective

Make previews more musical and maintainable without shifting final render responsibility away from the backend.

### Technologies

- Native Web Audio API (`BiquadFilterNode`, `DynamicsCompressorNode`)
- `tone` (Tone.js, MIT)

### Deliverables

1. Preview graph abstraction
- `src/lib/audio/preview-graph.ts`
- Encapsulates buses/chains for:
  - vocal bus
  - instrumental bus
  - transition FX sends

2. Tone.js integration for preview automation
- Transport-synced filter sweeps, delays, reverbs, pitch-shift preview.
- Preserve current transition style logic; only the preview execution layer changes.

3. DSP parity checks
- Define which effects are preview-only vs render-authoritative.
- Document parameter mappings from preview controls to backend FFmpeg/render settings.

### Acceptance Criteria

- Preview latency remains acceptable on mid-range devices.
- Existing transition style UX stays functionally intact.
- Final render output remains generated by existing renderer service.

## 4. Mix Planning and Structure Engine Upgrade (Song-Like Structure)

### Objective

Replace hardcoded planning-only behavior with a data-driven rules engine plus optional ML signals.

### Technologies

- `json-rules-engine`
- Existing `MashupPlanner.ts`
- Optional Transformers.js embeddings/classifiers as input signals

### Deliverables

1. Rule-based planning layer
- `services/worker/src/planning/rules-engine.ts`
- Rule packs for:
  - energy arc progression
  - phrase safety
  - genre compatibility constraints
  - section quotas

2. Planner refactor
- Keep current `MashupPlanner.ts` as orchestrator.
- Externalize decision rules from hardcoded branches into JSON rule definitions.

3. Explainability output
- Planner returns decision traces:
  - selected segment
  - rules fired
  - rejected alternatives (optional debug mode)

### Acceptance Criteria

- Planner behavior is reproducible given same inputs.
- Rule changes do not require code changes for common style adjustments.
- Existing presets (`steady`, `build`, `wave`) can be represented as rule packs.

## 5. Audio Refinement Loop (Loudness and Quality Assurance)

### Objective

Add a production-grade post-render analysis/refinement loop for loudness, clipping, and audio quality issues.

### Technologies

- `ffmpeg` / `ffmpeg-static` (already present)
- FFmpeg `loudnorm`, `ebur128`, `astats`
- Optional reference patterns from `ffmpeg-normalize` (MIT)

### Deliverables

1. Two-pass loudness normalization implementation
- Pass 1: `loudnorm` stats (`print_format=json`)
- Pass 2: apply measured values to normalize to target profile (e.g. LUFS + true peak)

2. Post-render QA analysis pass
- Extract metrics:
  - integrated loudness
  - true peak
  - loudness range
  - clipping indicators
  - phase/correlation checks (if implemented)

3. Corrective retry policy
- If metrics violate thresholds:
  - adjust gain/limiter settings
  - optionally retry render with safer parameters
- Cap retries to avoid runaway job cost

### Acceptance Criteria

- Final outputs meet documented loudness target profile.
- Clipping/true-peak violations are reduced versus baseline.
- Retry loop is bounded and observable in logs.

## 6. Style Adaptation and Customization (Style Registry)

### Objective

Create a secure, versioned, user-extensible style system using schemas and rules.

### Technologies

- `ajv` (MIT)
- `json-rules-engine`
- Existing planner pipeline
- Optional Transformers.js style-tag inference

### Deliverables

1. Style registry schema
- `src/lib/styles/style-pack.schema.json`
- Versioned JSON schema (draft 2020-12 compatible)

2. Style pack validator
- Shared validation utility using Ajv in app/worker contexts.

3. Rule-backed style execution
- Style packs define:
  - transition preferences
  - phrase lengths
  - section priorities
  - energy arc preferences
  - FX usage constraints

4. Style management endpoints/UI (phase 2+)
- Create/list/apply style packs
- Validate before persistence

### Acceptance Criteria

- Invalid style packs are rejected with clear validation errors.
- Style packs can be applied without code changes.
- Default styles map to current behavior to prevent regressions.

## 7. Web App Reliability and Performance Foundations (Cross-Cutting)

### Objective

Ensure large-file online workflows remain reliable and responsive while introducing heavier browser-side processing.

### Technologies

- `comlink`
- Web Workers
- `tus-js-client` (MIT) for resumable uploads
- Browser cache / optional OPFS for large model assets (future)

### Deliverables

1. Worker infrastructure standards
- Shared worker lifecycle management and error handling.
- Typed worker RPC wrappers via Comlink.

2. Resumable upload path (recommended)
- Integrate `tus-js-client` for large audio uploads.
- Preserve existing R2 flow; add resumable path where infrastructure supports it.

3. Caching strategy
- Cache WASM/model assets in browser cache.
- Optional OPFS custom cache for large models in later phase.

4. Observability hooks
- Track:
  - analysis duration
  - worker failures
  - upload retries
  - inference fallback rates (WebGPU -> WASM -> backend)

### Acceptance Criteria

- Uploads recover from transient network failures.
- Browser analysis failures fail open (backend path still works).
- Performance metrics are available for tuning and rollout decisions.

## Implementation Phases

## Phase 0: Baseline and Instrumentation (1-2 weeks)

### Goals

- Establish metrics before changing quality-sensitive logic.
- Add feature flags and telemetry scaffolding.

### Tasks

1. Add feature flags for:
- browser analysis worker
- ML section tagging
- Tone.js preview graph
- rule-based planner
- two-pass loudnorm

2. Add baseline metrics/logging
- analysis durations
- planner durations
- render retries
- loudness metrics

3. Curate regression test fixture set
- diverse tracks (genres, tempos, vocals, instrumentation)

### Exit Criteria

- Baseline quality and performance metrics captured.
- Safe rollout toggles available.

## Phase 1: Browser Analysis Worker + BPM/Phrasing Upgrade (2-4 weeks)

### Goals

- Improve compatibility, BPM verification, and phrasing while preserving UX.

### Tasks

1. Introduce Comlink worker framework.
2. Integrate `web-audio-beat-detector`.
3. Integrate `meyda` for lightweight features.
4. Add optional `essentia.js` path behind flag.
5. Add confidence-gated backend escalation.

### Exit Criteria

- Browser analysis path stable in staging.
- No UI thread stalls in normal upload flow.

## Phase 2: Section Tagging + Preview DSP Modernization (3-5 weeks)

### Goals

- Improve section choice and preview quality.

### Tasks

1. Add Transformers.js-based section tagging worker.
2. Implement WebGPU/WASM capability fallback logic.
3. Create Tone.js preview graph abstraction.
4. Map existing transition styles onto preview buses/effects.

### Exit Criteria

- Section tagging improves cue-point quality in QA set.
- Preview behavior is stable across target browsers.

## Phase 3: Rule-Based Planner + Style Registry (3-6 weeks)

### Goals

- Make planning and styles data-driven, explainable, and extensible.

### Tasks

1. Introduce `json-rules-engine` in worker service.
2. Refactor `MashupPlanner.ts` to consume rule packs.
3. Create Ajv-validated style schema and default style packs.
4. Add planner debug traces (internal/staging).

### Exit Criteria

- Current presets can be represented as rule packs.
- Style changes no longer require planner code edits for common adjustments.

## Phase 4: Refinement Loop and Quality Enforcement (2-4 weeks)

### Goals

- Ship production-grade loudness normalization and QA loop.

### Tasks

1. Implement FFmpeg two-pass `loudnorm`.
2. Add post-render QA analysis (`ebur128`, `astats`).
3. Add bounded corrective retry policy.
4. Surface metrics in job logs/history.

### Exit Criteria

- Loudness targets consistently met on QA fixture set.
- Clipping incidents reduced versus baseline.

## Phase 5: Reliability Hardening and Rollout (ongoing)

### Goals

- Improve upload resilience and tune performance in production.

### Tasks

1. Integrate resumable uploads (`tus-js-client`) where supported.
2. Tune worker memory use and model asset caching.
3. Tune confidence thresholds and fallback policies.
4. A/B test planner and section-tagging variants.

### Exit Criteria

- Stable production rollout with monitored regressions.

## File-by-File Suggested Change Map

### App (`app/`)

- `src/lib/audio/analysis-service.ts`
  - Add confidence fields and hooks for browser-derived analysis inputs.
- `src/lib/audio/auto-dj-service.ts`
  - Consume enriched compatibility metrics and phrase confidence.
- `src/lib/audio/dynamic-eq-service.ts`
  - Optional preview parameter parity mappings.
- `src/components/` (relevant upload/mashup flows)
  - Wire worker-driven analysis status and fallbacks.
- `src/lib/audio/`
  - Add worker wrappers, preview graph, shared types.
- `src/app/api/mashups/*`
  - Pass new planner/style/refinement options through request contracts.

### Worker Service (`services/worker/`)

- `src/MashupPlanner.ts`
  - Refactor orchestration around rule evaluation.
- `src/planning/rules/`
  - New JSON rule packs + defaults.
- `src/planning/rules-engine.ts`
  - `json-rules-engine` integration and trace output.

### Renderer Service (`services/renderer/`)

- Render pipeline modules
  - Add FFmpeg pass-1/2 `loudnorm`
  - Add QA analysis pass and bounded retries

### Analyzer Service (`services/analyzer/`)

- Analysis endpoints
  - Support authoritative re-analysis for low-confidence browser results
  - Return confidence/scoring details compatible with shared schema

## Testing Strategy

## Unit Tests

- Feature extraction adapters (Meyda/Essentia wrappers)
- Rules engine evaluation
- Style pack Ajv validation
- Fallback policy logic (WebGPU/WASM/backend)

## Integration Tests

- Upload -> browser analysis -> backend fallback
- Planner with rule packs and default presets
- Render -> loudnorm -> QA metrics extraction

## Regression Audio Test Set

- Maintain a fixed corpus with expected metadata and qualitative review notes.
- Compare:
  - BPM/key stability
  - phrase alignment success
  - transition quality score (human QA rubric)
  - loudness compliance

## Performance Testing

- Browser worker analysis on low/mid/high devices
- Memory usage during model/WASM load
- Render retry cost impact

## Rollout and Risk Management

## Feature Flags

- Enable per capability/workstream and per environment.
- Support emergency fallback to current behavior.

## Key Risks and Mitigations

1. Browser ML model size/performance is too heavy
- Mitigation: keep ML optional, use short windows, WebGPU when available, backend fallback.

2. AGPL concerns with `Essentia.js`
- Mitigation: legal review before production use; keep `Meyda` fallback and feature flag for easy disablement.

3. Planner regressions from rule migration
- Mitigation: dual-run planner in staging and compare outputs before cutover.

4. Longer render times from refinement loop
- Mitigation: bounded retries, only retry on threshold violations, instrument job duration.

5. Cross-browser inconsistencies in Web Audio / WebGPU
- Mitigation: capability detection, fallback hierarchy, browser support matrix testing.

## Success Metrics (Track Per Phase)

### Quality Metrics

- Phrase-aligned transition success rate
- Section selection precision (internal QA rubric)
- Loudness compliance rate
- Clipping/true-peak violation rate

### UX Metrics

- Time to first playable preview
- Main-thread blocking incidents during analysis
- Upload failure/retry completion rate

### Operational Metrics

- Analyzer service escalation rate
- Render retry rate
- Average job duration
- Worker error rate

## Recommended Execution Order (Pragmatic)

1. Baseline instrumentation + feature flags
2. Browser worker infrastructure + BPM/phrasing improvements
3. Tone.js preview graph modernization
4. Section tagging (Transformers.js) with fallbacks
5. Rule-based planner + style registry (Ajv + json-rules-engine)
6. FFmpeg two-pass loudness/refinement loop
7. Resumable uploads and caching optimizations

## Definition of Done for This Initiative

1. All new capabilities are behind feature flags and observable.
2. Default behavior remains backward compatible until explicit cutover.
3. Rule-based planner and style registry cover existing presets.
4. Refinement loop meets documented loudness and clipping targets.
5. Browser analysis and preview remain responsive on target devices.
6. Tests cover critical paths and fallback behavior.

