# Phase Execution Tracker Design

## Purpose

Create a durable execution tracker for `Detailed-Analysis-Implementation-Plan.md` that separates:
- the original roadmap and intent
- current implementation state
- remaining work
- objective signoff criteria
- verification evidence

The tracker is intended to replace ad hoc status updates as the operational source of truth for completion.

## Why a Separate Tracker

Editing the original implementation plan in place would mix strategy with execution details and make it harder to audit progress. A separate tracker preserves the original roadmap while providing a practical artifact for engineering signoff.

## Proposed Artifact

Create `Detailed-Analysis-Execution-Tracker.md` at the repository root.

The tracker mirrors the phase and task structure from `Detailed-Analysis-Implementation-Plan.md`, but each phase and task includes:
- `Status`
- `Current state`
- `Remaining work`
- `Done when`
- `Verification`

## Status Model

Use the following status values:
- `[x]` Complete
- `[-]` In progress / partially complete
- `[ ]` Not started
- `[!]` Blocked

Tasks should only move to `[x]` when both implementation and verification are complete.

## Tracker Structure

The tracker should contain:

1. Overall summary table
- One row per phase
- Short status, confidence, and major blockers

2. Phase sections
- Goals
- Exit criteria
- Task checklist with explicit signoff criteria

3. Evidence references
- Concrete code paths, tests, scripts, dashboards, or docs that support the claimed status

4. Immediate next work
- A small ordered list of the next unfinished tasks in proper sequence

## Completion Rule

A task is complete only if:
- the implementation exists in the codebase
- the implementation is wired into the relevant user or service path
- the expected verification artifact exists

Examples:
- A preview graph is not complete if the abstraction exists but the production UI path is not wired.
- A QA improvement is not complete if the code exists but there is no fixture-driven verification evidence.

## Phase 2 Closure Criteria

Phase 2 should not be marked complete until all of the following are true:
- Section tagging is implemented, wired, and fails open correctly.
- WebGPU/WASM/backend fallback behavior is explicit and testable.
- Preview graph behavior is integrated into actual preview surfaces.
- Preview-vs-render DSP parity mappings are documented.
- Cue-point quality is verified against the regression fixture process.
- Preview stability is verified across the target browser set.

## Operational Use

The execution tracker becomes the live signoff document.

`Implementation-Status.md` should remain as a human-readable summary, but it should explicitly defer to `Detailed-Analysis-Execution-Tracker.md` for the authoritative current state.
