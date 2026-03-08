# Runtime Unification Design: App-Authoritative Automation Runtime

Date: 2026-03-08

## Decision

InfinityMix will treat `app/` as the authoritative automation runtime.

That means:

- the canonical database contract lives in `app/src/lib/db/schema.ts`
- the canonical storage contract lives in `app/src/lib/storage.ts`
- the canonical analysis, planning, render, and QA contracts are defined in `app/`
- any separate worker process must execute `app`-owned contracts rather than define its own product logic or persistence model

The existing root services under `services/analyzer`, `services/renderer`, and `services/worker` are legacy paths until they are explicitly migrated onto the app-owned contracts.

## Why This Path

The current codebase already has one functioning product path inside `app/`:

- upload and analysis ingestion
- Auto DJ planning
- render and output variant persistence
- preview and playback flows
- rollout and observability hooks

By contrast, the root services still depend on Prisma-era field names and persistence shapes that do not match the current Drizzle schema. Treating both paths as equally authoritative would force every future quality phase to solve the same contract problem twice.

The goal of Phase 0 is to reduce ambiguity before improving musical quality. Consolidating authority in `app/` is the smallest viable step that makes later phases coherent.

## Architecture Boundaries

### App-Owned Domain Authority

`app/` owns:

- track persistence shape
- analysis annotations and confidence/provenance semantics
- mashup persistence shape
- planner output schema
- render output schema
- output QA schema
- job lifecycle vocabulary
- storage key conventions and asset variants

### Executor Model

Background execution is allowed, but only as an execution detail.

Workers may:

- run CPU-heavy or long-running tasks
- report progress and completion
- retry idempotent work

Workers may not:

- invent alternate database field names
- own a separate planner contract
- own a separate renderer persistence contract
- write incompatible status values

## Immediate Migration Rule

Until durable queue infrastructure is in place, all new work must extend the app-owned contracts first.

This means:

- add shared types in `app/` before changing queue backends
- route in-process queueing through those shared contracts
- treat worker-thread helpers as implementation detail, not source of truth
- avoid adding new behavior to the root Prisma services except for migration or retirement work

## Canonical Job Model

Phase 0 introduces an app-owned job contract with:

- job kind
- job stage/status
- job owner
- resource references
- payload shape per job kind
- retryability and idempotency expectations

This contract is designed so the current in-memory queue can adopt it immediately, and a future durable queue can reuse it with minimal API churn.

## Status Model Direction

Resource-level statuses already exist on tracks, stems, and mashups. Phase 0 does not replace them yet.

Instead, it defines a parallel canonical job lifecycle vocabulary for execution:

- queued
- running
- succeeded
- failed
- cancelled

Resource-level status fields remain the persisted product-facing truth for now:

- track analysis: `pending | analyzing | completed | failed`
- mashup generation: `pending | generating | completed | failed`
- stems: `pending | processing | completed | failed`

Later phases can add explicit job tables or event logs without changing the public contract of the current app routes.

## Legacy Service Policy

The root services are now categorized as:

- `legacy-non-authoritative` by default
- eligible for migration only if they consume app-owned contracts
- otherwise candidates for removal

No new product capability should be implemented first in those services.

## Near-Term Implementation Steps

1. Add shared runtime contract types in `app/`.
2. Refactor the current in-memory queue to use those contracts.
3. Normalize worker-thread helpers onto the same contract vocabulary.
4. Add durable queue infrastructure behind the same contract boundary.
5. Only after that, decide whether any root service should be migrated or retired.

## Acceptance Signal For Phase 0

Phase 0 is considered structurally successful when:

- `app/` is the documented source of truth for runtime contracts
- queue helpers use shared app-owned job types
- no new code depends on the root Prisma service schema assumptions
- durable execution can be introduced without redefining job payloads again
