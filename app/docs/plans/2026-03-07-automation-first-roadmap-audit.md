# Automation-First Roadmap Audit

Date: 2026-03-07

## Purpose

Reassess `Detailed-Analysis-Implementation-Plan.md` against the actual codebase and the product requirement:

- InfinityMix is an automated DJ mashup system.
- Primary user is a non-DJ.
- Primary workflow is: select songs -> generate a professional-quality mashup.
- Manual controls are valuable, but secondary.

This document classifies roadmap items into:

- `Core`: directly improves automatic mashup quality or reliability.
- `Secondary`: useful, but not required for the product to work well.
- `Defer`: not wrong, but lower ROI than remaining core work.

## Bottom Line

The project is not overkill in concept.

The current plan is somewhat over-scoped in execution. The strongest path is not to remove the automated-DJ ambition. It is to narrow the remaining work around the automatic mashup engine:

1. better analysis
2. better planner decisions
3. better transition execution
4. better render QA
5. better reliability

The browser should remain a fast preview and control surface, not the source of truth for final mix quality.

## Codebase Audit Summary

### Effectively Implemented

- Phase 0 baseline instrumentation and feature flags
- Phase 1 browser analysis worker and confidence-gated backend fallback
- Most of Phase 2 architecture:
  - section tagging worker
  - capability fallback logic
  - preview graph abstraction
  - preview/render parity contract docs
- Most of Phase 3 architecture:
  - rule-based planner path
  - planner traces
  - built-in style packs
  - style schema validation
- Part of Phase 4:
  - two-pass loudnorm
  - bounded retry loop
- Part of Phase 5:
  - observability
  - client resumable upload helper

### Still Missing or Incomplete

- Phase 2:
  - formal signoff evidence
  - target-browser QA evidence
  - a real preview-path defect is still present: newly created Tone.js players can start before their buffers finish loading
- Phase 4:
  - explicit post-render QA pass using `ebur128`/`astats`
  - structured surfacing of render QA metrics
- Phase 5:
  - end-to-end resumable upload server path
  - rollout/tuning process formalization

### Actual Product Risk

The largest product risk is not missing browser preview sophistication.

The largest product risk is any weakness in:

- cue-point selection
- section pairing
- transition choice
- stem-vs-full-track decision quality
- final render QA

Those are the parts a non-DJ user will experience as “this sounds like a professional mashup” or “this sounds amateur.”

## Roadmap Classification

## Phase 0: Baseline and Instrumentation

Classification: `Core`

Recommendation: Keep as implemented.

Reason:
- Safe rollout and diagnostics are necessary for quality-sensitive automation work.

Action:
- No major expansion needed beyond what already exists.

## Phase 1: Browser Analysis Worker + BPM/Phrasing Upgrade

Classification: `Core`

Recommendation: Keep and treat as foundational.

Reason:
- Automated mashup quality depends on reliable tempo, key, phrasing, and compatibility signals.

Action:
- Keep current architecture.
- Future tuning should focus on confidence thresholds and false-positive/false-negative analysis quality, not feature proliferation.

## Phase 2: Section Tagging + Preview DSP Modernization

Classification:
- Section tagging: `Core`
- Browser preview modernization: `Secondary`

Recommendation:
- Keep section tagging as core.
- Narrow preview work to “good enough for auditioning.”
- Do not keep investing in browser preview parity beyond what helps users trust transitions.

Reason:
- Section choice is central to automation quality.
- Browser preview is helpful, but it is not the product.
- Final render remains authoritative.

Action:
- Implement/fix:
  - real cue-point QA evidence
  - browser preview defect in shared preview graph loader
  - browser stability signoff
- Deprioritize:
  - deeper preview DSP fidelity work unless it materially changes user decision-making

## Phase 3: Rule-Based Planner + Style Registry

Classification:
- rule-based planner: `Core`
- built-in style packs: `Secondary`
- persistent user-extensible style CRUD: `Defer`

Recommendation:
- Keep and finish the planner.
- Keep built-in style packs only as a thin way to steer planner behavior.
- Defer persistent custom style-pack management unless product demand is clear.

Reason:
- The planner is the product brain.
- Non-DJ automation quality depends on explainable, deterministic transition decisions.
- Full style-pack productization is less important than better default planning.

Action:
- Implement/focus:
  - better default transition policies
  - stronger event-aware sequencing behavior
  - better stem-usage rules
- Defer:
  - custom style-pack persistence and management workflows

## Phase 4: Refinement Loop and Quality Enforcement

Classification: `Core`

Recommendation: Raise priority.

Reason:
- For an automated system, final render quality is non-negotiable.
- Loudness, clipping, and output consistency matter more than advanced browser preview polish.

Action:
- Implement next after Phase 2 closure:
  - explicit `ebur128`/`astats` QA pass
  - structured metrics persistence/exposure
  - retry decision visibility

## Phase 5: Reliability Hardening and Rollout

Classification:
- upload resilience: `Core`
- threshold tuning: `Core`
- A/B experimentation framework: `Secondary`
- model asset caching/OPFS: `Defer`

Recommendation:
- Finish upload resilience and threshold tuning.
- Keep experimentation lightweight.
- Defer sophisticated browser model asset caching unless it becomes a measured bottleneck.

Reason:
- If upload or generation is unreliable, the automated system fails before quality matters.
- Threshold tuning directly affects automatic decision quality.
- OPFS/model caching is only worth it if browser inference becomes a significant production path and measured pain point.

Action:
- Implement:
  - end-to-end resumable upload path
  - threshold/fallback tuning workflow
- Defer:
  - larger caching strategy work
  - complex experimentation platform

## What To Remove vs Implement

## Remove From Near-Term Scope

- Treating browser preview/render parity as a major product workstream
- Persistent custom style-pack CRUD
- Heavy investment in browser model asset caching without measured need
- Broad A/B experimentation infrastructure before render QA and upload resilience are complete

These are not forbidden permanently. They are the wrong next investments.

## Implement / Finish

### Highest Priority

1. Close Phase 2 with real QA evidence and fix preview loader defect
2. Complete Phase 4 render QA and loudness enforcement visibility
3. Complete Phase 5 resumable uploads end-to-end

### Product-Brain Improvements

1. Improve event-aware sequencing behavior
2. Improve section-pairing and transition-type rules
3. Improve selective stem usage rules based on stem quality and section role

## Corrected Execution Order

1. Finish Phase 2
- fix preview loader defect
- collect signoff evidence
- close tracker honestly

2. Complete Phase 4
- add explicit render QA pass
- persist or expose QA metrics
- validate against fixture set

3. Complete Phase 5 core pieces
- resumable upload server path
- threshold/fallback tuning workflow

4. Tighten Phase 3 around automation quality
- improve planner defaults
- improve event-aware transition rules
- improve stem-usage policy

5. Revisit deferred items only after mashup quality is consistently strong

## Strong Product Recommendation

InfinityMix should be positioned and built as:

`an automatic DJ mashup engine for non-DJs that aims at professional, top-tier mashup quality, with expert overrides`

That implies:

- automation-first UX
- planner-first architecture
- render-first quality enforcement
- preview as assistance, not authority

## Supporting Evidence

### Codebase Evidence

- `src/lib/audio/browser-analysis/browser-analysis.worker.ts`
- `src/lib/audio/preview-graph.ts`
- `src/app/create/page.tsx`
- `src/components/stem-player/index.tsx`
- `../services/worker/src/MashupPlanner.ts`
- `../services/worker/src/planning/rules-engine.ts`
- `../services/renderer/src/loudnorm.ts`
- `../services/renderer/src/AudioRenderer.ts`
- `src/lib/audio/resumable-upload.ts`

### External Research

- Fully automatic DJ systems rely on beat/downbeat/structure/cue-point/transition planning as the core stack:
  - https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-018-0134-8
- Stem-aware mashup quality improves when stem compatibility and constraints are part of the decision pipeline:
  - https://cdn.aaai.org/ojs/16092/16092-13-19586-1-2-20210518.pdf
  - https://repositum.tuwien.at/handle/20.500.12708/212628
- Commercial workflow evidence favors timeline/preparation/export quality over making real-time browser/live logic the primary system:
  - https://dj.studio/blog/dj-software-stem-separation-compatibility
  - https://dj.studio/blog/live-stem-separation-latency-artifacts-failsafes
