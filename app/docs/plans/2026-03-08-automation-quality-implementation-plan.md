# Automation Quality Implementation Plan

Date: 2026-03-08

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

## Phase 1: Analysis Contract And Annotation Fidelity

### Goals

- Replace fragile heuristic track annotations with a more explicit and extensible analysis model.
- Make cue-point and structure annotations reliable enough to support autonomous planning.
- Introduce clearer confidence and provenance tracking for all musical annotations.

### Problems This Phase Solves

- Current structure labeling is too heuristic for a professional automation claim.
- Cue-point quality is not strong enough to act as a dependable transition substrate.
- Downbeat and phrase semantics are not first-class enough in the current analysis contract.

### Tasks

- [ ] Define a new canonical analysis contract for uploaded tracks:
- [ ] beat grid
- [ ] downbeat grid
- [ ] phrase boundaries
- [ ] structure sections
- [ ] switch/cue points
- [ ] energy profile
- [ ] harmonic profile
- [ ] stem-quality metadata where available
- [ ] Add provenance and confidence fields per annotation family:
- [ ] browser heuristic
- [ ] browser ML
- [ ] backend heuristic
- [ ] backend model
- [ ] Refactor `src/lib/audio/analysis-service.ts` so structure is no longer derived from alternating placeholder labels.
- [ ] Introduce a first-class downbeat/phrase representation and persist it.
- [ ] Add a dedicated cue-point detection layer:
- [ ] rule-based first
- [ ] model-backed path later behind a flag if adopted
- [ ] Extend `src/lib/audio/types/analysis.ts` and DB persistence for the richer annotation contract.
- [ ] Update upload and analysis ingestion paths to preserve new annotation fields without losing backward compatibility.
- [ ] Document annotation semantics and invariants in a dedicated architecture doc.

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

### Goals

- Turn mix quality from anecdotal judgment into a measurable release gate.
- Create a repeatable benchmark for analysis, planning, transitions, and final renders.

### Problems This Phase Solves

- Current roadmap gaps are mostly signoff and evidence gaps.
- Product decisions are ahead of the quality evidence needed to trust them.

### Tasks

- [ ] Expand the regression fixture corpus to cover:
- [ ] clean intros/outros
- [ ] tracks with weak intros
- [ ] tempo mismatch cases
- [ ] harmonic near-matches
- [ ] vocal-heavy conflicts
- [ ] bad stem-quality cases
- [ ] event-specific sequencing scenarios
- [ ] Define benchmark metrics for:
- [ ] beat alignment error
- [ ] downbeat alignment error
- [ ] cue-point validity
- [ ] transition phrase safety
- [ ] tempo-stretch severity
- [ ] harmonic compatibility confidence
- [ ] vocal collision severity
- [ ] stem artifact severity
- [ ] loudness compliance
- [ ] clipping and true peak
- [ ] Add fixture review workflows and scoring rubrics for human listening:
- [ ] transition smoothness
- [ ] musical coherence
- [ ] energy flow
- [ ] vocal clash avoidance
- [ ] export readiness
- [ ] Build comparison scripts that can evaluate control vs candidate planning variants using the same corpus.
- [ ] Add a release signoff checklist that blocks planner or render rollouts without benchmark evidence.

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

### Goals

- Upgrade from pairwise recommendation logic to whole-set planning.
- Make track order, role assignment, transition style, and stem usage explicit planner decisions.

### Problems This Phase Solves

- Current recommendations are anchor-based, not sequence-aware.
- Compatibility is treated too symmetrically for mashup and stem use cases.
- Event-aware energy flow is underspecified.

### Tasks

- [ ] Replace `/api/mashups/recommendations` ranking logic with a sequence-planning engine.
- [ ] Define planner inputs as a normalized planning graph:
- [ ] per-track analysis summary
- [ ] pairwise transition compatibility
- [ ] role-aware compatibility for stem mashups
- [ ] event constraints
- [ ] target duration constraints
- [ ] transition diversity constraints
- [ ] Add asymmetric compatibility scoring:
- [ ] vocal over instrumental
- [ ] instrumental under vocal
- [ ] full-track transition compatibility
- [ ] stem quality penalties
- [ ] tempo stretch penalties
- [ ] Expand rule packs to cover:
- [ ] event archetypes
- [ ] energy-arc policies
- [ ] stem-usage policies
- [ ] unsafe vocal overlap rejection
- [ ] section-pairing preferences
- [ ] transition style selection rules
- [ ] Decide whether `plannerVariant` represents real planning strategies or just telemetry buckets.
- [ ] If real strategies are intended, implement distinct control and candidate planner behaviors.
- [ ] Persist a detailed planner trace that explains:
- [ ] chosen order
- [ ] rejected candidates
- [ ] cue-point choice
- [ ] transition type choice
- [ ] stem/full-track decision

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

### Goals

- Make preview a faithful representation of the planner's intended transition semantics.
- Align preview and render around a shared transition contract while keeping render authoritative.

### Problems This Phase Solves

- Current preview is not sufficiently tied to the real plan.
- Users can preview generic mixes without validating the actual transition choices they will export.

### Tasks

- [ ] Define a shared transition contract consumed by both preview and render:
- [ ] track roles
- [ ] chosen sections
- [ ] cue points
- [ ] overlap duration
- [ ] tempo ramp behavior
- [ ] EQ/filter/FX intent
- [ ] stem usage intent
- [ ] Refactor `/api/mashups/preview` to render planned excerpts instead of generic buffer mixing.
- [ ] Update preview UI flows to preview the actual selected transition between planned tracks.
- [ ] Keep a clear mapping of:
- [ ] preview-only affordances
- [ ] render-authoritative behaviors
- [ ] unsupported preview simplifications
- [ ] Add tests that ensure preview requests are derived from the same planner output used for rendering.
- [ ] Close remaining preview parity documentation and browser signoff gaps.

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

### Goals

- Make final output quality measurable, enforceable, and observable.
- Turn render QA from passive reporting into a hard gate with bounded correction strategies.

### Problems This Phase Solves

- “Radio-ready” output needs stronger guarantees than loudness normalization alone.
- The system needs to reject or retry renders that are technically acceptable but musically weak.

### Tasks

- [ ] Expand render QA metrics to include:
- [ ] integrated loudness
- [ ] true peak
- [ ] dynamic range window
- [ ] clipping incidence
- [ ] transition-local loudness jumps
- [ ] transition-local spectral clashes where measurable
- [ ] Add transition-level QA records, not just final mix QA summaries.
- [ ] Define retry and correction policies for:
- [ ] overlap too dense
- [ ] vocal collision too severe
- [ ] stretch too aggressive
- [ ] loudness overshoot
- [ ] clipping
- [ ] poor stem path quality
- [ ] Persist render QA and retry reasons in a way the admin tools and future user explanations can consume.
- [ ] Add fixture-based render signoff against target output profiles.

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

### Goals

- Ensure the visible product reflects the real engine capabilities.
- Remove or finish surfaces that imply functionality the engine does not yet support well.

### Problems This Phase Solves

- Some user-facing workflows are ahead of actual engine readiness.
- Stems and project organization surfaces are not yet aligned with the automation-first product story.

### Tasks

- [ ] Finish or hide incomplete stems views in the project workspace.
- [ ] Rework create flow UX around the actual automation engine:
- [ ] upload
- [ ] analysis readiness
- [ ] smart sequence recommendation
- [ ] transition preview
- [ ] final generation
- [ ] Expose only high-value controls for non-DJs:
- [ ] event type
- [ ] energy profile
- [ ] duration target
- [ ] stem preference
- [ ] safe/creative mix mode
- [ ] Keep advanced controls behind an expert or admin path.
- [ ] Update recommendation rationale UI so the system explains selections in user language, not raw metrics only.
- [ ] Align README and status docs with actual implementation state after each phase.

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

### Goals

- Roll out analysis and planner changes safely.
- Learn from real usage without confusing telemetry labels for real behavior.

### Problems This Phase Solves

- Quality-sensitive changes need safe rollout, but only if variants are real.
- Telemetry needs to connect planner decisions to user outcomes.

### Tasks

- [ ] Define valid experiment domains:
- [ ] analysis strategy
- [ ] cue-point strategy
- [ ] planner strategy
- [ ] transition policy
- [ ] Connect rollout assignments to actual behavior branches, not metadata only.
- [ ] Extend feedback capture to connect:
- [ ] output quality ratings
- [ ] preview usage
- [ ] download behavior
- [ ] replay behavior
- [ ] render QA outcomes
- [ ] planner decisions
- [ ] Create dashboards for:
- [ ] variant quality comparison
- [ ] fallback rates
- [ ] transition failure reasons
- [ ] render QA failure distributions
- [ ] user satisfaction by planner strategy
- [ ] Define rollback rules for candidate variants.

### Deliverables

- Real experimentable planner/analysis variants
- Outcome-linked telemetry
- Rollback playbooks and dashboards

### Acceptance Criteria

- Variant comparisons reflect real code-path differences.
- Planner and analysis rollouts can be promoted or rolled back based on evidence.
- User feedback is linked to technical quality metrics and planning behavior.

## Recommended Execution Order

1. Phase 1: Analysis Contract And Annotation Fidelity
2. Phase 2: Evaluation Harness And Quality Benchmarks
3. Phase 3: Sequence Planner And Compatibility Engine
4. Phase 4: Transition Execution Contract And Preview Truthfulness
5. Phase 5: Render Quality Enforcement And Corrective Loop
6. Phase 6: Product Surface Alignment
7. Phase 7: Controlled Rollout And Learning Loop

## Suggested PR Breakdown

1. Analysis contract, schema, and compatibility-preserving adapters
2. Fixture expansion, benchmark scripts, and signoff workflow
3. Sequence planner and asymmetric compatibility engine
4. Shared transition contract and planned-transition preview
5. Render QA expansion and corrective retry policies
6. Create flow and project/stem product surface alignment
7. Rollout instrumentation cleanup and variant dashboards

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
- Begin with Phase 1 only
- Preserve backward compatibility where possible while introducing a richer analysis contract
- Keep browser analysis optional and backend-authoritative
- Require fixture-based evidence before promoting major planner or render changes
