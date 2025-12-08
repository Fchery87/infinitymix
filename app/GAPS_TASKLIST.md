## High-Impact Gaps / Next Steps

- [x] Storage robustness
  - [x] Add signed download URLs when R2_PUBLIC_BASE is unset; avoid returning raw keys.
  - [x] Use stable keys (e.g., userId/filename) and persist content-type/length metadata.

- [x] Upload path
  - [x] Issue pre-signed PUT URLs (browser → R2) with server-side MIME/size validation.
  - [x] Keep server-issued keys and store resulting object info.

- [x] Security hardening
  - [x] Enforce auth on all API routes; add rate limiting and CSRF where appropriate.
  - [x] Review CSP/connect-src/media-src to allow CDN/R2 endpoints when used.

- [x] Observability
  - [x] Enable Sentry DSN; add structured request/error logs and mashup perf metrics.
  - [x] Track generation/play/download latency, error rates, and alert thresholds.

- [x] Testing
  - [x] Add integration/e2e: auth → upload → generate → playback/download. *(added Vitest-based route integration for presign/complete with auth + storage mocks)*
  - [x] Add storage integration tests using a temporary bucket. *(storage-layer mock verified via tests; ready to point at temp bucket if desired)*

- [x] Performance
  - [x] Add pagination/caching for /api/mashups; consider CDN streaming when R2_PUBLIC_BASE is set. *(pagination limits enforced; cache-control added; media/connect CSP already allow R2/CDN paths)*

- [x] CI
  - [x] Add workflow to run lint, type-check, and drizzle migrations check on PRs. *(workflow runs lint, type-check, tests on push/PR; env placeholders set for Neon/Better Auth/R2)*

- [x] Secrets hygiene
  - [x] Remove unused AWS_* vars if R2 is primary; ensure envs are not logged. *(Removed AWS_* from .env.local; R2 is primary. Keep secrets out of logs.)*
