# Phase 0 Runtime Audit

Date: 2026-03-08

## Authoritative Runtime

InfinityMix Phase 0 is complete when the `app/` workspace is the only default automation runtime for production-facing behavior.

Authoritative paths:

- Upload ingestion in [upload-service.ts](/C:/Coding-Projects/infinitymix/app/src/lib/audio/upload-service.ts)
- Analysis queueing in [queue.ts](/C:/Coding-Projects/infinitymix/app/src/lib/queue.ts)
- Durable job execution in [durable-queue-driver.ts](/C:/Coding-Projects/infinitymix/app/src/lib/runtime/durable-queue-driver.ts)
- Stem separation in [stems-service.ts](/C:/Coding-Projects/infinitymix/app/src/lib/audio/stems-service.ts)
- Standard mix generation in [generate route](/C:/Coding-Projects/infinitymix/app/src/app/api/mashups/generate/route.ts)
- Auto DJ planning in [djmix route](/C:/Coding-Projects/infinitymix/app/src/app/api/mashups/djmix/route.ts)
- Auto DJ rendering in [auto-dj-service.ts](/C:/Coding-Projects/infinitymix/app/src/lib/audio/auto-dj-service.ts)
- Storage access in [storage.ts](/C:/Coding-Projects/infinitymix/app/src/lib/storage.ts)
- Asset naming in [assets.ts](/C:/Coding-Projects/infinitymix/app/src/lib/runtime/assets.ts)
- Recovery and idempotency policy in [recovery.ts](/C:/Coding-Projects/infinitymix/app/src/lib/runtime/recovery.ts)

## Deprecated Paths

Deprecated non-authoritative paths:

- [analyzer.ts](/C:/Coding-Projects/infinitymix/services/analyzer/src/analyzer.ts)
- [renderer.ts](/C:/Coding-Projects/infinitymix/services/renderer/src/renderer.ts)
- [worker.ts](/C:/Coding-Projects/infinitymix/services/worker/src/worker.ts)

These services are guarded by `INFINITYMIX_ENABLE_LEGACY_SERVICES=true` and removed from the default Docker Compose runtime via the `legacy-services` profile.

Deprecated product path:

- [stem route](/C:/Coding-Projects/infinitymix/app/src/app/api/mashups/stem/route.ts)

The stem mashup render path is not implemented in the authoritative runtime and is therefore explicitly disabled until a future phase restores it under the shared contracts.

## Operation Policies

- `analysis`: durable job, idempotent per track, recovery via storage-backed replay
- `stems`: durable job, idempotent per track and quality, recovery via overwrite-safe stem upserts
- `mix`: durable job, idempotent per mashup and render profile, recovery via lease-owned retries
- `preview`: synchronous request, deterministic request key, no persistent side effects

## Storage Conventions

- Uploaded tracks: `users/<user-id>/tracks/<timestamp>-<sanitized-name>.<ext>`
- Stems: `tracks/<track-id>/stems/<stem-type>.<ext>`
- Mashup outputs: `mashups/<mashup-id>/<variant>.<ext>`
- Preview artifacts: `previews/<preview-idempotency-key>.mp3`

## Phase 0 Completion Notes

- Default runtime no longer depends on Prisma-era services.
- Default compose startup no longer launches the deprecated services.
- Long-running authoritative jobs have durable status, retries, and observable receipts.
- Queue completion and failure are lease-owned to prevent stale workers from finalizing reclaimed jobs.
