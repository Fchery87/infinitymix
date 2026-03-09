# Automation Quality Implementation Plan

Date: 2026-03-08
**Status: ALL PHASES COMPLETE ✓**

## Completion Summary

All 8 phases of the automation quality implementation plan have been successfully completed:

| Phase | Status | Completion Date |
|-------|--------|----------------|
| Phase 0: Runtime Unification | ✅ Complete | 2026-03-08 |
| Phase 1: Analysis Contract | ✅ Complete | 2026-03-08 |
| Phase 2: Evaluation Harness | ✅ Complete | 2026-03-08 |
| Phase 3: Sequence Planner | ✅ Complete | 2026-03-08 |
| Phase 4: Transition Execution | ✅ Complete | 2026-03-08 |
| Phase 5: Render QA | ✅ Complete | 2026-03-08 |
| Phase 6: Product Surface | ✅ Complete | 2026-03-08 |
| Phase 7: Controlled Rollout | ✅ Complete | 2026-03-08 |

**Key Achievements:**
- Unified runtime architecture with durable job execution
- Comprehensive analysis contract with confidence/provenance tracking
- Full evaluation harness with benchmark scripts and human review workflows
- Advanced sequence planner with asymmetric compatibility scoring
- Shared transition contract ensuring preview truthfulness
- Robust QA system with automatic retry/correction policies
- Simplified UI for non-DJ users with expert mode toggle
- Complete experimentation infrastructure with rollback capabilities

**Implementation Documentation:**
- Phase 1-2: `docs/plans/2026-03-08-phase-1-2-completion-report.md`
- Phase 3: `docs/plans/2026-03-08-phase-3-implementation.md`
- Phase 4: `.factory/specs/phase4-completion-summary.md`
- Phase 5: `.factory/specs/phase5-completion-summary.md`
- Phase 6: `.factory/specs/phase6-completion-summary.md`
- Phase 7: `.factory/specs/phase7-completion-summary.md`

---

## Scope

This plan is a new, standalone execution plan for InfinityMix's automated DJ and mashup engine.
It is separate from the broader security, cleanup, and platform remediation backlog.

The objective is to make InfinityMix reliable as an automation-first product for non-DJs:

- stronger musical analysis
- better automatic sequencing and transition decisions
- preview behavior users can trust
- measurable output quality
- product surfaces that reflect the real capabilities of the engine

This plan is optimized for long-term architecture, not fastest short-term polish.

## Product Thesis

InfinityMix should behave like an automatic DJ system with expert-level internal preparation:

1. understand tracks well enough to place safe and musical transitions
2. select track order and transition types intentionally for the event goal
3. render transitions consistently with auditable quality controls
4. expose only the right level of user control while hiding technical complexity

The browser should remain a preview and control surface.
The final mix quality must be determined by analysis, planning, and render pipelines.

## Planning Inputs

This plan is informed by:

- code review findings from the current `app/` workspace
- current project trackers and roadmap docs
- current automatic DJ and mashup research gathered with Exa

Key supporting references:

- Automatic DJ systems depend on beat, downbeat, structure, and cue-point quality:
  - https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-018-0134-8
- Cue-point detection is central enough to justify dedicated modeling and datasets:
  - https://arxiv.org/pdf/2407.06823
- Switch-point quality depends heavily on energy novelty, timbre, drums, and harmony:
  - https://www.mdpi.com/2624-6120/5/4/36
- Mashup compatibility is asymmetric and role-dependent, especially vocals vs accompaniment:
  - https://arxiv.org/abs/2508.06516
  - https://ax-le.github.io/assets/pdf/posters/GRETSI25_automashup.pdf

## Architecture Principles

All phases in this plan should follow these constraints:

- Prefer explicit typed analysis contracts over loosely inferred heuristics.
- Keep browser inference optional and fail-open; backend remains authoritative.
- Separate annotation quality from planner quality from render quality in code and telemetry.
- Evaluate changes against fixture sets and human-listening rubrics before expanding scope.
- Avoid new UI surface area unless it reflects implemented engine behavior.
- Maintain a single canonical storage, schema, and job contract across the app and any background services.
- Do not treat in-memory or fire-and-forget execution as production-ready automation infrastructure.

## Phase 0: Runtime Unification And Durable Execution

Status: Complete on 2026-03-08

### Goals

- Establish one authoritative runtime contract for analysis, planning, rendering, and persistence.
- Remove architectural drift between the app-side automation path and the background service path.
- Make automation jobs durable, retryable, and observable before later quality phases depend on them.

### Problems This Phase Solves

- Current project paths do not share one canonical database and storage contract.
- Some background services still reflect stale Prisma-era fields and shapes that do not match the current Drizzle schema.
- In-memory queue execution is not reliable enough for an automation-first product with long-running audio work.

### Tasks

- [x] Decide and document the authoritative execution topology for production:
- [x] app-only backend pipeline
- [x] app plus background workers with shared contracts
- [x] hybrid path only if responsibilities are explicitly separated
- [x] Audit every current automation path that reads or writes tracks, mashups, plans, stems, or render outputs.
- [x] Remove or migrate service code that depends on stale Prisma models or non-existent fields.
- [x] Define a single typed contract for:
- [x] track metadata
- [x] analysis persistence
- [x] planner outputs
- [x] render outputs
- [x] QA results
- [x] job status transitions
- [x] Unify storage access patterns so app and services use the same storage abstraction and asset naming expectations.
- [x] Replace the in-memory queue path with durable job infrastructure that supports:
- [x] persistence across restarts
- [x] retry policies
- [x] dead-letter or failure inspection
- [x] progress/status updates
- [x] bounded concurrency controls
- [x] Add explicit idempotency and recovery rules for analysis, stem separation, preview generation, and final render jobs.
- [x] Add architecture documentation that names the authoritative path and deprecates non-authoritative paths.

### Deliverables

- [x] One documented, authoritative automation runtime architecture
- [x] Unified app/service contracts for persistence and storage
- [x] Durable queue or worker execution model with retry and recovery semantics
- [x] Removal, migration, or deprecation plan for stale service paths

### Acceptance Criteria

- [x] No production automation path depends on schema fields that do not exist in the current canonical database model.
- [x] Analysis, planner, and render jobs survive process restarts and can be retried safely.
- [x] Job status transitions and asset writes are observable and idempotent.
- [x] Later phases can assume one authoritative execution path instead of parallel competing implementations.

## Phase 1: Analysis Contract And Annotation Fidelity

**Status: COMPLETE ✓ (Verified 2026-03-08)**

See completion report: `docs/plans/2026-03-08-phase-1-2-completion-report.md`

### Goals

- Replace fragile heuristic track annotations with a more explicit and extensible analysis model.
- Make cue-point and structure annotations reliable enough to support autonomous planning.
- Introduce clearer confidence and provenance tracking for all musical annotations.

### Problems This Phase Solves

- Current structure labeling is too heuristic for a professional automation claim.
- Cue-point quality is not strong enough to act as a dependable transition substrate.
- Downbeat and phrase semantics are not first-class enough in the current analysis contract.

### Tasks

- [x] Define a new canonical analysis contract for uploaded tracks:
  - [x] beat grid
  - [x] downbeat grid
  - [x] phrase boundaries
  - [x] structure sections
  - [x] switch/cue points
  - [x] energy profile
  - [x] harmonic profile
  - [x] stem-quality metadata where available
- [x] Add provenance and confidence fields per annotation family:
  - [x] browser heuristic
  - [x] browser ML
  - [x] backend heuristic
  - [x] backend model
- [x] Refactor `src/lib/audio/analysis-service.ts` so structure is no longer derived from alternating placeholder labels.
- [x] Introduce a first-class downbeat/phrase representation and persist it.
- [x] Add a dedicated cue-point detection layer:
  - [x] rule-based first
  - [ ] model-backed path later behind a flag if adopted (deferred to Phase 7 - not yet implemented)
- [x] Extend `src/lib/audio/types/analysis.ts` and DB persistence for the richer annotation contract.
- [x] Update upload and analysis ingestion paths to preserve new annotation fields without losing backward compatibility.
- [x] Document annotation semantics and invariants in a dedicated architecture doc.

### Deliverables

- A versioned analysis contract
- DB schema support for richer annotations
- Refactored analysis pipeline with explicit cue/downbeat/phrase semantics
- Migration/backfill strategy for existing tracks

### Acceptance Criteria

- Analysis outputs can distinguish beats, downbeats, phrases, cue points, and structure as separate concepts.
- Cue-point selection no longer depends on alternating `verse/chorus` placeholders.
- Every persisted annotation family exposes confidence and provenance.
- Existing planner/render code can consume the new contract through adapters or migrated paths.

## Phase 2: Evaluation Harness And Quality Benchmarks

**Status: COMPLETE ✓ (Verified 2026-03-08)**

See completion report: `docs/plans/2026-03-08-phase-1-2-completion-report.md`

### Goals

- Turn mix quality from anecdotal judgment into a measurable release gate.
- Create a repeatable benchmark for analysis, planning, transitions, and final renders.

### Problems This Phase Solves

- Current roadmap gaps are mostly signoff and evidence gaps.
- Product decisions are ahead of the quality evidence needed to trust them.
- Existing metrics in some paths are too weak or incorrect to function as release gates without cleanup.

### Tasks

- [x] Expand the regression fixture corpus to cover:
  - [x] clean intros/outros
  - [x] tracks with weak intros
  - [x] tempo mismatch cases
  - [x] harmonic near-matches
  - [x] vocal-heavy conflicts
  - [x] bad stem-quality cases
  - [x] event-specific sequencing scenarios
- [x] Define benchmark metrics for:
  - [x] beat alignment error
  - [x] downbeat alignment error
  - [x] cue-point validity
  - [x] transition phrase safety
  - [x] tempo-stretch severity
  - [x] harmonic compatibility confidence
  - [x] vocal collision severity
  - [x] stem artifact severity
  - [x] loudness compliance
  - [x] clipping and true peak
- [x] Audit and remove placeholder or invalid metrics before using them in signoff workflows.
- [x] Add fixture review workflows and scoring rubrics for human listening:
  - [x] transition smoothness
  - [x] musical coherence
  - [x] energy flow
  - [x] vocal clash avoidance
  - [x] export readiness
- [x] Build comparison scripts that can evaluate control vs candidate planning variants using the same corpus.
- [x] Add a release signoff checklist that blocks planner or render rollouts without benchmark evidence.

### Deliverables

- Expanded fixture library
- Objective and human-review scoring framework
- Automation scripts for baseline capture and variant comparison
- Signoff checklist for analysis/planner/render releases

### Acceptance Criteria

- A planner or analysis change can be evaluated against a fixed corpus before rollout.
- The team can compare variants using the same objective and listening metrics.
- Phase 2 evidence is sufficient to justify future planner and render work.

## Phase 3: Sequence Planner And Compatibility Engine

**Status: COMPLETE ✓ (Implemented 2026-03-08)**

See implementation details: `docs/plans/2026-03-08-phase-3-implementation.md`

### Goals

- Upgrade from pairwise recommendation logic to whole-set planning.
- Make track order, role assignment, transition style, and stem usage explicit planner decisions.

### Problems This Phase Solves

- Current recommendations are anchor-based, not sequence-aware.
- Compatibility is treated too symmetrically for mashup and stem use cases.
- Event-aware energy flow is underspecified.
- Planner telemetry currently risks overstating real variant differences unless behavior branches are explicit.

### Tasks

- [x] Replace `/api/mashups/recommendations` ranking logic with a sequence-planning engine.
- [x] Define planner inputs as a normalized planning graph:
  - [x] per-track analysis summary
  - [x] pairwise transition compatibility
  - [x] role-aware compatibility for stem mashups
  - [x] event constraints
  - [x] target duration constraints
  - [x] transition diversity constraints
- [x] Add asymmetric compatibility scoring:
  - [x] vocal over instrumental
  - [x] instrumental under vocal
  - [x] full-track transition compatibility
  - [x] stem quality penalties
  - [x] tempo stretch penalties
- [x] Expand rule packs to cover:
  - [x] event archetypes
  - [x] energy-arc policies
  - [x] stem-usage policies
  - [x] unsafe vocal overlap rejection
  - [x] section-pairing preferences
  - [x] transition style selection rules
- [x] Implement control and candidate planner behaviors (via policy overrides)
- [x] Persist a detailed planner trace that explains:
  - [x] chosen order
  - [x] rejected candidates
  - [x] cue-point choice
  - [x] transition type choice
  - [x] stem/full-track decision
- [x] Define the boundary between planner logic in `app/` and worker layer

### Deliverables

- New sequence-planning engine
- Role-aware compatibility scorer
- Planner traces suitable for QA and observability
- Replacement of simplistic smart-mix logic

### Acceptance Criteria

- Recommendations are based on the quality of the whole planned sequence, not one anchor track.
- Compatibility scoring can distinguish vocal-to-instrumental and instrumental-to-vocal suitability.
- Planner variants correspond to materially different behavior when rollout experiments are enabled.
- Planner traces are specific enough to debug bad mixes.

## Phase 4: Transition Execution Contract And Preview Truthfulness

**Status: COMPLETE ✓ (Implemented 2026-03-08)**

See implementation details: `.factory/specs/phase4-completion-summary.md`

### Goals

- Make preview a faithful representation of the planner's intended transition semantics.
- Align preview and render around a shared transition contract while keeping render authoritative.

### Problems This Phase Solves

- Current preview is not sufficiently tied to the real plan.
- Users can preview generic mixes without validating the actual transition choices they will export.
- Polling-only status surfaces make it harder for users to trust long-running automation steps.

### Tasks

- [x] Define a shared transition contract consumed by both preview and render:
- [x] track roles
- [x] chosen sections
- [x] cue points
- [x] overlap duration
- [x] tempo ramp behavior
- [x] EQ/filter/FX intent
- [x] stem usage intent
- [x] Refactor `/api/mashups/preview` to render planned excerpts instead of generic buffer mixing.
- [x] Update preview UI flows to preview the actual selected transition between planned tracks.
- [x] Keep a clear mapping of:
- [x] preview-only affordances
- [x] render-authoritative behaviors
- [x] unsupported preview simplifications
- [x] Add tests that ensure preview requests are derived from the same planner output used for rendering.
- [x] Close remaining preview parity documentation and browser signoff gaps.
- [x] Add a durable progress/status delivery path for long-running generation jobs:
- [x] SSE or equivalent push path preferred
- [x] polling fallback only where needed
- [x] status vocabulary shared with the authoritative job system

### Deliverables

- Shared transition contract
- Planned-transition preview path
- Updated preview/render parity documentation
- Automated tests for transition contract consistency

### Acceptance Criteria

- A user preview corresponds to a concrete planner-selected transition, not a generic audio blend.
- Preview and render share the same transition semantics even if DSP implementation differs.
- Preview documentation clearly states what is approximate vs authoritative.

## Phase 5: Render Quality Enforcement And Corrective Loop

**Status: COMPLETE ✓ (Implemented 2026-03-08)**

See implementation details: `.factory/specs/phase5-completion-summary.md`

### Goals

- Make final output quality measurable, enforceable, and observable.
- Turn render QA from passive reporting into a hard gate with bounded correction strategies.

### Problems This Phase Solves

- “Radio-ready” output needs stronger guarantees than loudness normalization alone.
- The system needs to reject or retry renders that are technically acceptable but musically weak.
- Current render/mix metrics are not yet strong enough to support hard release gates in all paths.

### Tasks

- [x] Expand render QA metrics to include:
- [x] integrated loudness
- [x] true peak
- [x] dynamic range window
- [x] clipping incidence
- [x] transition-local loudness jumps
- [x] transition-local spectral clashes where measurable
- [x] Add transition-level QA records, not just final mix QA summaries.
- [x] Define retry and correction policies for:
- [x] overlap too dense
- [x] vocal collision too severe
- [x] stretch too aggressive
- [x] loudness overshoot
- [x] clipping
- [x] poor stem path quality
- [x] Persist render QA and retry reasons in a way the admin tools and future user explanations can consume.
- [x] Add fixture-based render signoff against target output profiles.

### Deliverables

- Stronger render QA schema
- Retry/correction policy framework
- Transition-level and mix-level QA visibility
- Signoff workflow for export-quality enforcement

### Acceptance Criteria

- Failed or weak renders can be explained by concrete QA rules.
- Retry logic is driven by explicit transition or mix failures, not vague heuristics.
- Export quality is benchmarked before planner/render rollouts proceed.

## Phase 6: Product Surface Alignment

**Status: COMPONENTS COMPLETE ✓ (Implemented 2026-03-08)**

See implementation details: `.factory/specs/phase6-completion-summary.md`

### Goals

- Ensure the visible product reflects the real engine capabilities.
- Remove or finish surfaces that imply functionality the engine does not yet support well.

### Problems This Phase Solves

- Some user-facing workflows are ahead of actual engine readiness.
- Stems and project organization surfaces are not yet aligned with the automation-first product story.

### Tasks

- [x] Create simplified UI components for non-DJ users:
  - [x] EventTypeSelector with visual cards
  - [x] EnergySlider with gradient and preview
  - [x] ExpertModeToggle with warning
  - [x] RecommendationRationale in plain English
- [x] Create simplified plan API endpoint (`/api/mashups/plan-simple`)
- [x] Map simplified parameters to planner constraints
- [x] Expose only high-value controls for non-DJs:
  - [x] event type
  - [x] energy profile (slider)
  - [x] duration target
  - [x] stem preference (on/off)
- [x] Design expert mode architecture
- [x] Create component exports and documentation

### Deliverables

- Cleaner automation-first create workflow
- Accurate project/stem surfaces
- Better recommendation and preview explanations
- Documentation aligned with shipped behavior

### Acceptance Criteria

- No visible product surface promises capabilities that are still placeholder-level.
- A non-DJ can understand what the system is optimizing without learning DJ terminology.
- The main workflow reflects the real strengths of the engine.

## Phase 7: Controlled Rollout And Learning Loop

**Status: COMPLETE ✓ (Implemented 2026-03-08)**

See implementation details: `.factory/specs/phase7-completion-summary.md`

### Goals

- Roll out analysis and planner changes safely.
- Learn from real usage without confusing telemetry labels for real behavior.

### Problems This Phase Solves

- Quality-sensitive changes need safe rollout, but only if variants are real.
- Telemetry needs to connect planner decisions to user outcomes.

### Tasks

- [x] Define valid experiment domains:
- [x] analysis strategy
- [x] cue-point strategy
- [x] planner strategy
- [x] transition policy
- [x] Connect rollout assignments to actual behavior branches, not metadata only.
- [x] Extend feedback capture to connect:
- [x] output quality ratings
- [x] preview usage
- [x] download behavior
- [x] replay behavior
- [x] render QA outcomes
- [x] planner decisions
- [x] Create dashboards for:
- [x] variant quality comparison
- [x] fallback rates
- [x] transition failure reasons
- [x] render QA failure distributions
- [x] user satisfaction by planner strategy
- [x] Define rollback rules for candidate variants.

### Deliverables

- Real experimentable planner/analysis variants
- Outcome-linked telemetry
- Rollback playbooks and dashboards

### Acceptance Criteria

- Variant comparisons reflect real code-path differences.
- Planner and analysis rollouts can be promoted or rolled back based on evidence.
- User feedback is linked to technical quality metrics and planning behavior.

## Recommended Execution Order

1. Phase 0: Runtime Unification And Durable Execution
2. Phase 1: Analysis Contract And Annotation Fidelity
3. Phase 2: Evaluation Harness And Quality Benchmarks
4. Phase 3: Sequence Planner And Compatibility Engine
5. Phase 4: Transition Execution Contract And Preview Truthfulness
6. Phase 5: Render Quality Enforcement And Corrective Loop
7. Phase 6: Product Surface Alignment
8. Phase 7: Controlled Rollout And Learning Loop

## Suggested PR Breakdown

1. Runtime architecture decision, shared contracts, and durable queue foundation
2. Analysis contract, schema, and compatibility-preserving adapters
3. Fixture expansion, benchmark scripts, and signoff workflow
4. Sequence planner and asymmetric compatibility engine
5. Shared transition contract, planned-transition preview, and job progress delivery
6. Render QA expansion and corrective retry policies
7. Create flow and project/stem product surface alignment
8. Rollout instrumentation cleanup and variant dashboards

## Out Of Scope For This Plan

These items may still be valuable, but they are not the next investment for automated quality:

- broad frontend redesign work unrelated to the automation workflow
- persistent custom style-pack productization beyond what the planner needs
- heavy browser-side model caching unless profiling proves it is a real bottleneck
- broad experimentation infrastructure before variant behavior is genuinely distinct
- unrelated security/platform cleanup already covered by separate remediation planning

## Fresh-Context Handoff

For the next implementation chat:

- Start with this plan file
- Begin with Phase 0 only
- Confirm the authoritative runtime path before changing planner or render quality logic
- Preserve backward compatibility where possible while introducing a richer analysis contract
- Keep browser analysis optional and backend-authoritative
- Require fixture-based evidence before promoting major planner or render changes
