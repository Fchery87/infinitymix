# Code Review Remediation Plan

## Scope

This plan captures the findings from the March 2026 review of the `app/` workspace and turns them into an execution checklist. It is intentionally ordered by risk: security and correctness first, modernization last.

Sensitive data handling requirements for all phases:

- Do not print, copy, or commit secrets from `.env.local`, deployment settings, auth cookies, API keys, DSNs, or storage credentials.
- When validating configuration, confirm presence and behavior without exposing raw secret values.
- If logs or screenshots are needed, redact tokens, emails, signed URLs, and internal identifiers unless strictly required for debugging.

## Phase 1: Auth And Access Hardening

### Goals

- Remove implicit developer authentication from runtime request paths.
- Remove default-on admin bypass behavior.
- Fix authorization ordering issues in mutation routes.

### Tasks

- [ ] Remove fabricated dev-user fallback from `src/lib/auth/session.ts`.
- [ ] Make `getSessionUser()` return only a real authenticated user or `null`.
- [ ] Remove default-on admin bypass behavior from `src/lib/auth/admin.ts`.
- [ ] Keep admin authorization based on real session data plus explicit allowlists only.
- [ ] Fix `src/app/api/collab/invite/route.ts` so invite ownership is verified before mutation.
- [ ] Audit lightweight JSON routes for missing schema validation and weak authorization:
- [ ] `src/app/api/challenges/route.ts`
- [ ] `src/app/api/survey/route.ts`
- [ ] `src/app/api/collab/invite/route.ts`
- [ ] Verify admin pages still deny access correctly:
- [ ] `src/app/admin/audio-preview-qa/page.tsx`
- [ ] `src/app/admin/audio-observability/page.tsx`
- [ ] Verify `src/app/api/admin/session/route.ts` still reports auth/admin state correctly after bypass removal.

### Acceptance Criteria

- Unauthenticated requests receive `401` where applicable.
- Non-admin users cannot access admin UI or admin-only API behavior.
- No request path silently fabricates a user.

## Phase 2: Broken Feature Path Cleanup

### Goals

- Ensure accepted work can complete successfully.
- Remove or fully integrate half-implemented mashup paths.

### Tasks

- [ ] Decide whether `/api/mashups/stem` remains supported now.
- [ ] If supported, replace the stubbed `renderStemMashup()` path with a real implementation.
- [ ] If not supported, disable the route and corresponding UI entry points until implemented.
- [ ] Audit `src/app/api/mashups/stem-per-track/route.ts` and choose one:
- [ ] Finish integration with auth, ownership, persistence, and telemetry.
- [ ] Or remove/disable the route until it is production-ready.
- [ ] Remove placeholder comments that imply unfinished production behavior.

### Acceptance Criteria

- No route returns success while calling code that only throws.
- No production route remains as scaffold-only code.

## Phase 3: Quality Gate Restoration

### Goals

- Restore lint and typecheck to green.
- Eliminate obvious dead-code residue and warning noise.

### Tasks

- [ ] Fix `tests/audio-worker-pool.test.ts` lint errors caused by `module` variable naming.
- [ ] Fix `src/lib/audio/preview-graph.test.ts` type errors around mocked `window` and `AudioContext`.
- [ ] Remove current unused-symbol warnings from linted files, including:
- [ ] `src/app/api/mashups/preview/route.ts`
- [ ] `src/app/projects/[id]/page.tsx`
- [ ] `src/components/admin/audio-observability-dashboard.tsx`
- [ ] `src/components/projects/project-grid.tsx`
- [ ] `src/lib/audio/auto-dj-service.ts`
- [ ] `src/lib/audio/browser-analysis/browser-analysis.worker.ts`
- [ ] `src/lib/audio/dynamic-eq-service.ts`
- [ ] `src/lib/audio/filter-chain-builder.ts`
- [ ] `src/lib/audio/mixing-service.ts`
- [ ] `src/lib/audio/presets/genre-presets.ts`
- [ ] `src/lib/audio/stem-mixing-service.ts`
- [ ] Run:
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`

### Acceptance Criteria

- Lint passes with no errors.
- Typecheck passes with no errors.
- Warning count is materially reduced, ideally to zero for obvious dead code.

## Phase 4: Durable Queue Migration

### Goals

- Replace the in-memory queue with a durable backend.
- Make background failures observable and recoverable.

### Tasks

- [ ] Replace `src/lib/queue.ts` in-memory execution with the intended durable queue backend.
- [ ] Ensure analysis, stem generation, and mashup jobs persist across restarts.
- [ ] Stop swallowing worker failures with empty `.catch()` handlers.
- [ ] Persist job state updates back into the database.
- [ ] Audit all enqueue callers:
- [ ] `src/lib/audio/upload-service.ts`
- [ ] `src/app/api/audio/upload/complete/route.ts`
- [ ] `src/app/api/audio/stems/[trackId]/route.ts`
- [ ] `src/app/api/mashups/generate/route.ts`
- [ ] Add failure-path tests or integration checks for queue-driven work.

### Acceptance Criteria

- Background jobs survive process restarts.
- Failures are visible in logs and reflected in DB state.
- Work is safe under multi-instance deployment.

## Phase 5: Security Header And Health Endpoint Tightening

### Goals

- Bring HTTP hardening closer to current best practice.
- Prevent public health endpoints from leaking internals.

### Tasks

- [ ] Tighten CSP in `next.config.js`, reducing or removing `unsafe-eval` and narrowing `unsafe-inline`.
- [ ] Remove deprecated `X-XSS-Protection` header.
- [ ] Review whether the `next/document` alias workaround is still required and safe.
- [ ] Fix `src/app/api/health/route.ts` to use `getStorage()` rather than lazy `MockStorage` export behavior.
- [ ] Reduce health response detail:
- [ ] avoid raw infra error text
- [ ] avoid exposing memory internals publicly
- [ ] avoid exposing environment details unless required
- [ ] Confirm no secret values are logged while validating health behavior.

### Acceptance Criteria

- Security headers are current and intentional.
- Health checks work reliably without leaking operational detail.

## Phase 6: Streaming And Resource Management

### Goals

- Avoid loading entire media files into memory for delivery.
- Support proper browser seeking and large-file playback.

### Tasks

- [ ] Refactor `src/app/api/mashups/[mashupId]/download/route.ts` to stream rather than fully buffer files.
- [ ] Refactor `src/app/api/audio/stream/track/[trackId]/route.ts` to stream rather than fully buffer files.
- [ ] Add `Range` request support where needed.
- [ ] Validate large-file playback and seek behavior in browser clients.
- [ ] Review any adjacent stream routes for the same buffering pattern.

### Acceptance Criteria

- Audio delivery is stream-based.
- Range requests work.
- Memory usage no longer scales linearly with file size per request.

## Phase 7: Dead Code And AI-Slop Cleanup

### Goals

- Remove duplicated, unused, or clearly scaffolded code.
- Reduce generated-looking noise that obscures real behavior.

### Tasks

- [ ] Remove or justify legacy Pages Router files:
- [ ] `src/pages/_app.tsx`
- [ ] `src/pages/404.tsx`
- [ ] Remove unused duplicate storage files if truly dead:
- [ ] `src/lib/storage-service.ts`
- [ ] `src/lib/mock-storage-service.ts`
- [ ] Remove obsolete helpers or unused exports such as `updateTrack()` if no longer needed.
- [ ] Remove placeholder comments and numbered banner comments from scaffolded routes.
- [ ] Replace render-time `Math.random()` usage with deterministic values or client-only initialized state:
- [ ] `src/components/audio-player/index.tsx`
- [ ] `src/app/player/page.tsx`
- [ ] Trim redundant comments that restate obvious code flow without adding intent.

### Acceptance Criteria

- No clearly dead duplicate modules remain.
- Comments explain intent, not trivial mechanics.
- SSR/client render output is deterministic.

## Phase 8: Framework And Language Modernization

### Goals

- Move from the current runtime/tooling baseline to current supported versions with a controlled upgrade.

### Current Baseline

- `next@15.5.12`
- `react@18.3.1`
- `react-dom@18.3.1`
- `typescript@5.4.5`

### Tasks

- [ ] Plan upgrade path for Next, React, React DOM, and TypeScript.
- [ ] Align package metadata and actual installed versions.
- [ ] Revisit React hook issues that may become more visible after upgrade.
- [ ] Re-test auth, queue, upload, and streaming paths after upgrade.
- [ ] Re-run full project checks after dependency updates.

### Acceptance Criteria

- Framework versions match current project targets.
- Upgrade lands only after Phases 1 through 7 are stable.

## Recommended Execution Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5
6. Phase 6
7. Phase 7
8. Phase 8

## Suggested PR Breakdown

1. Auth and access hardening
2. Stem route correctness and endpoint cleanup
3. Lint and typecheck restoration
4. Durable queue migration
5. Security headers and health endpoint cleanup
6. Streaming and resource management
7. Dead code cleanup
8. Framework modernization

## Fresh-Context Handoff

For the next chat, start from:

- This plan file
- Implement phases in this exact order:
- Phase 1
- Phase 2
- Phase 3
- Phase 4
- Phase 5
- Phase 6
- Phase 7
- Phase 8
- Begin with Phase 1 only in the new chat
- Requirement: do not expose secrets while validating config or behavior

Recommended first implementation target in the new chat:

- `src/lib/auth/session.ts`
- `src/lib/auth/admin.ts`
- `src/app/api/collab/invite/route.ts`
