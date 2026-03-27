# InfinityMix Architectural Implementation Plan

## Document Info

- **Created**: 2026-03-22
- **Updated**: 2026-03-22
- **Status**: Ready for Implementation
- **Owner**: InfinityMix Engineering
- **Review Cycle**: Quarterly

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [What's Already Done](#whats-already-done)
4. [Implementation Phases](#implementation-phases)
5. [Phase 1: Production Infrastructure](#phase-1-production-infrastructure)
6. [Phase 2: Performance & UX](#phase-2-performance--ux)
7. [Phase 3: Observability & Security](#phase-3-observability--security)
8. [Phase 4: Scale & Optimization](#phase-4-scale--optimization)
9. [Dependency Graph](#dependency-graph)
10. [Risk Assessment](#risk-assessment)
11. [Success Criteria](#success-criteria)

---

## Executive Summary

This plan outlines remaining architectural work to take InfinityMix from its current state to a production-ready, scalable audio mashup platform. Items already implemented have been removed. All suggestions use **open-source, free libraries only** (MIT, Apache 2.0, or equivalent).

**Key Metrics to Improve:**
- Job processing reliability: No retry/backoff → Exponential backoff + dead letter queue
- Real-time progress: Polling-based SSE → Redis Pub/Sub backed SSE (multi-instance safe)
- Rate limiting: In-memory Map → Redis-backed (multi-instance safe)
- Auth state: Hardcoded `isAuthenticated: true` → Real session management
- Logging: Console-based JSON → Pino structured logging with transports
- Error handling: Single generic boundary → Per-feature error boundaries

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 16.2.1 (App Router)          │
│                    Turbopack | React 19                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   API Routes │  │  Components │  │  Server Actions │ │
│  │  (REST/JSON) │  │  (React 19) │  │   (Planned)     │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
├─────────┴────────────────┴───────────────────┴──────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Audio      │  │   Queue     │  │   Auth          │ │
│  │   Services   │  │   System    │  │   (Better Auth) │ │
│  │   (src/lib/) │  │   (DB-based)│  │                 │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
├─────────┴────────────────┴───────────────────┴──────────┤
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  PostgreSQL  │  │ Cloudflare  │  │   FFmpeg        │ │
│  │  (Neon)      │  │     R2      │  │   (Local)       │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## What's Already Done

These items are implemented and removed from the plan:

| Component | Location | Status |
|-----------|----------|--------|
| Database Schema | `src/lib/db/schema.ts` | ✅ 20+ tables, proper indexing |
| Auth (Server) | `src/lib/auth/` | ✅ Better Auth with Drizzle adapter |
| Storage | `src/lib/storage.ts` | ✅ R2 primary, mock fallback |
| Audio Analysis | `src/lib/audio/analysis-service.ts` | ✅ BPM, key, beat grid detection |
| Stem Separation | `src/lib/audio/stems-service.ts` | ✅ Multi-engine fallback |
| Mixing Engine | `src/lib/audio/mixing-service.ts` | ✅ FFmpeg-based crossfade |
| Auto DJ | `src/lib/audio/auto-dj-service.ts` | ✅ AI-powered sequencing |
| Queue (DB) | `src/lib/queue.ts` | ✅ Custom durable queue with SKIP LOCKED |
| SSE Streaming | `src/app/api/mashups/*/events/` | ✅ ReadableStream, heartbeats, auto-close |
| Health Checks | `src/app/api/health/route.ts` | ✅ DB, storage, memory checks |
| Rate Limiting | `src/lib/utils/rate-limiting.ts` | ✅ In-memory, single instance only |
| Browser Analysis | `src/lib/audio/browser-analysis/` | ✅ Web Worker + Comlink |
| File Validation | `src/lib/utils/validation.ts` | ✅ Zod schemas with size/type checks |
| DB Connection | `src/lib/db/index.ts` | ✅ Neon HTTP driver (serverless-native pooling) |
| Security Headers | `middleware.ts` | ✅ HSTS, X-Content-Type-Options, Referrer-Policy |
| Error Boundary | `src/components/ErrorBoundary.tsx` | ✅ Single generic boundary |

---

## Implementation Phases

```
Phase 1 (Weeks 1-2)          Phase 2 (Weeks 3-4)          Phase 3 (Weeks 5-6)          Phase 4 (Weeks 7-8)
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ PRODUCTION       │         │ PERFORMANCE      │         │ OBSERVABILITY    │         │ SCALE &          │
│ INFRASTRUCTURE   │────────▶│ & UX             │────────▶│ & SECURITY       │────────▶│ OPTIMIZATION     │
│                  │         │                  │         │                  │         │                  │
│ • BullMQ Queue   │         │ • Auth State     │         │ • Pino Logging   │         │ • Cursor         │
│ • Redis Rate     │         │   Management     │         │ • OpenTelemetry  │         │   Pagination     │
│   Limiting       │         │ • SSE Redis      │         │ • Feature Error  │         │ • CDN Cache      │
│                  │         │   Pub/Sub        │         │   Boundaries     │         │   Strategy       │
│                  │         │ • RSC Dashboard  │         │ • CSRF           │         │                  │
│                  │         │                  │         │ • Health Enhance  │         │                  │
└──────────────────┘         └──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## Phase 1: Production Infrastructure

**Timeline**: Weeks 1-2
**Goal**: Reliable job processing and multi-instance rate limiting

### 1.1 BullMQ Queue System

**Priority**: 🔴 High
**Effort**: 4 days
**Dependencies**: Redis (already in `docker-compose.yml`)
**License**: MIT (open source, free)

BullMQ standard package is MIT licensed. No subscription required. BullMQ Pro (paid) adds Groups/Batches/Observables — not needed for this implementation.

#### Implementation Steps

1. **Install BullMQ**
   ```bash
   npm install bullmq ioredis
   ```

2. **Create queue abstraction layer**
   ```
   src/lib/queue/
   ├── index.ts              # Public API exports
   ├── types.ts              # Queue job types and contracts
   ├── bullmq-driver.ts      # BullMQ implementation
   ├── durable-driver.ts     # Existing DB-based driver (fallback)
   └── factory.ts            # Driver selection based on REDIS_URL
   ```

3. **Define job types**
   ```typescript
   // src/lib/queue/types.ts
   export type AudioJobType =
     | 'stem-separation'
     | 'audio-analysis'
     | 'mashup-generation'
     | 'dj-mix'
     | 'preview-render';

   export interface AudioJob<T extends AudioJobType> {
     type: T;
     payload: JobPayloadMap[T];
     priority?: number;
     userId?: string;
     metadata?: Record<string, unknown>;
   }
   ```

4. **Implement BullMQ driver**
   - Queue per job type (`stem-separation`, `audio-analysis`, `mashup-generation`)
   - Priority support (1-10 scale)
   - Exponential backoff (5s, 15s, 45s)
   - Stalled job detection (30s timeout)
   - Dead letter queue for permanently failed jobs

5. **Create worker processes**
   ```
   src/workers/
   ├── index.ts              # Worker manager
   ├── stem-separation.ts    # Stem separation worker
   ├── audio-analysis.ts     # Analysis worker
   ├── mashup-generation.ts  # Mashup generation worker
   └── shared/
       ├── concurrency.ts    # Concurrency control
       └── metrics.ts        # Job metrics collection
   ```

6. **Migrate existing queue**
   - Implement `bullmq-driver.ts` that satisfies existing `QueueDriver` interface
   - Update `factory.ts` to select BullMQ when `REDIS_URL` is set
   - Keep `DurableAutomationQueueDriver` as fallback when Redis unavailable
   - Add Redis connection health checks

#### Success Criteria

- [ ] BullMQ driver implements existing `QueueDriver` interface
- [ ] 1000 concurrent jobs processed without errors
- [ ] Job retry with exponential backoff working
- [ ] Dead letter queue capturing permanently failed jobs
- [ ] Graceful fallback to DB-backed queue when `REDIS_URL` not set
- [ ] All existing queue consumers (`enqueueAnalysis`, `enqueueStems`, `enqueueMix`) work unchanged

#### Risk: Redis as single point of failure

**Mitigation**: Existing DB-backed queue remains as automatic fallback. Health check monitors Redis connectivity. Factory selects driver based on availability.

---

### 1.2 Redis-Backed Rate Limiting

**Priority**: 🟡 Medium
**Effort**: 2 days
**Dependencies**: Redis instance (shared with 1.1)
**License**: Uses ioredis (MIT, already installed with BullMQ)

#### Implementation Steps

1. **Create distributed rate limiter**
   ```
   src/lib/rate-limiting/
   ├── index.ts              # Public API
   ├── redis-limiter.ts      # Redis implementation (sliding window)
   ├── memory-limiter.ts     # Existing in-memory fallback
   └── middleware.ts         # API route middleware wrapper
   ```

2. **Implement sliding window with Redis sorted sets**
   ```typescript
   // Atomic rate limit check using Redis
   // ZREMRANGEBYSCORE + ZCARD + ZADD in a MULTI/EXEC transaction
   ```

3. **Reuse existing rate limit tiers**
   - Leverage existing `authRateLimit`, `generalApiRateLimit`, `uploadRateLimit`, `mashupGenerateRateLimit`, `heavyOperationRateLimit`
   - Replace in-memory Map with Redis sorted sets when `REDIS_URL` available
   - Fall back to existing in-memory limiter when Redis unavailable

4. **Add rate limit headers**
   - `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
   - `Retry-After` header on 429 responses

#### Success Criteria

- [ ] Rate limits enforced across multiple server instances
- [ ] Rate limit headers present in all API responses
- [ ] Graceful fallback to in-memory when Redis unavailable
- [ ] Existing rate limit configurations preserved

---

## Phase 2: Performance & UX

**Timeline**: Weeks 3-4
**Goal**: Fix auth state, improve real-time updates, add server rendering

### 2.1 Frontend Auth State Management

**Priority**: 🔴 High
**Effort**: 2 days
**Dependencies**: None

**Current Problem**: `src/app/create/page.tsx:114` has `const [isAuthenticated] = useState(true); // Auto-logged in for development`

#### Implementation Steps

1. **Create auth context provider**
   ```typescript
   // src/lib/auth/auth-context.tsx
   'use client';

   interface AuthState {
     user: User | null;
     isAuthenticated: boolean;
     isLoading: boolean;
   }

   export function AuthProvider({ children }: { children: React.ReactNode }) {
     // Fetch session from Better Auth's /api/auth/session
     // Expose via React Context
   }

   export function useAuth(): AuthState;
   ```

2. **Replace hardcoded auth state**
   - Remove `useState(true)` from `src/app/create/page.tsx`
   - Wire up real session check via Better Auth
   - Update navigation for login/logout state

3. **Add auth guard component**
   ```typescript
   // src/components/auth/auth-guard.tsx
   export function AuthGuard({ children }: { children: React.ReactNode }) {
     const { isAuthenticated, isLoading } = useAuth();
     if (isLoading) return <LoadingSpinner />;
     if (!isAuthenticated) redirect('/login');
     return <>{children}</>;
   }
   ```

4. **Wrap protected routes**
   - `/create` — requires auth
   - `/mashups` — requires auth
   - `/profile` — requires auth

#### Success Criteria

- [ ] No hardcoded `isAuthenticated: true` in codebase
- [ ] Login/logout flows working end-to-end
- [ ] Protected routes redirect to `/login` when unauthenticated
- [ ] Loading states shown during auth check

---

### 2.2 SSE with Redis Pub/Sub

**Priority**: 🟡 Medium
**Effort**: 3 days
**Dependencies**: Phase 1.1 (Redis available)

**Current Problem**: SSE endpoints poll the database every 2-2.5s. Works single-instance but won't scale. No cross-instance event propagation.

#### Implementation Steps

1. **Create Redis event bus**
   ```
   src/lib/realtime/
   ├── index.ts              # Public API
   ├── event-bus.ts          # Redis Pub/Sub event bus
   ├── sse-stream.ts         # SSE stream management (already exists, enhance)
   └── types.ts              # Event type definitions
   ```

2. **Implement Redis Pub/Sub publisher**
   - When job status changes, publish to Redis channel (`mashup:{id}:events`)
   - SSE endpoints subscribe to relevant channels
   - Events propagate across all server instances

3. **Keep existing polling as fallback**
   - When Redis unavailable, fall back to current DB polling approach
   - Factory pattern: Redis Pub/Sub when `REDIS_URL` set, polling otherwise

4. **Enhance SSE client hooks**
   - Auto-reconnect with exponential backoff
   - Connection state indicators
   - Event deduplication

#### Success Criteria

- [ ] SSE updates delivered within 100ms across all server instances
- [ ] No polling when Redis Pub/Sub is active
- [ ] Automatic fallback to polling when Redis unavailable
- [ ] Auto-reconnect after network interruption

---

### 2.3 React Server Components Dashboard

**Priority**: 🟡 Medium
**Effort**: 3 days
**Dependencies**: None

**Current State**: All pages are `'use client'` except one admin page. No user dashboard exists.

#### Implementation Steps

1. **Create dashboard page as RSC**
   ```
   src/app/dashboard/
   ├── page.tsx                  # Server Component (async)
   ├── mashup-list.tsx           # Server Component
   └── mashup-list-skeleton.tsx  # Loading skeleton
   ```

2. **Server-side data fetching**
   ```typescript
   // src/app/dashboard/page.tsx
   export default async function DashboardPage() {
     const user = await getSessionUser();
     if (!user) redirect('/login');

     return (
       <div>
         <h1>Welcome, {user.name}</h1>
         <Suspense fallback={<MashupListSkeleton />}>
           <MashupList userId={user.id} />
         </Suspense>
       </div>
     );
   }
   ```

3. **Create data layer**
   ```typescript
   // src/lib/data/mashups.ts
   export async function getMashupListForUser({ userId, page, limit }) {
     return db.select().from(mashups)
       .where(eq(mashups.userId, userId))
       .orderBy(desc(mashups.createdAt))
       .limit(limit)
       .offset((page - 1) * limit);
   }
   ```

4. **Keep interactive parts as Client Components**
   - Audio player controls
   - Mashup creation form
   - Real-time progress indicators (SSE)

#### Success Criteria

- [ ] Dashboard loads with server-rendered content (no loading spinner for initial data)
- [ ] SEO meta tags present on public pages
- [ ] No client-side data fetching for initial page load
- [ ] Audio playback and forms still work as Client Components

---

## Phase 3: Observability & Security

**Timeline**: Weeks 5-6
**Goal**: Production-grade logging, tracing, error handling, and security

### 3.1 Structured Logging with Pino

**Priority**: 🟡 Medium
**Effort**: 2 days
**Dependencies**: None
**License**: MIT

**Current Problem**: `src/lib/logger.ts` uses `console.info/warn/error` with JSON serialization. No log levels, no transports, no child loggers.

#### Implementation Steps

1. **Install Pino**
   ```bash
   npm install pino pino-pretty
   ```

2. **Replace logger implementation**
   ```typescript
   // src/lib/observability/logger.ts
   import pino from 'pino';

   export const logger = pino({
     level: process.env.LOG_LEVEL || 'info',
     transport: process.env.NODE_ENV === 'development'
       ? { target: 'pino-pretty', options: { colorize: true } }
       : undefined,
   });
   ```

3. **Create context-aware child loggers**
   ```typescript
   // src/lib/observability/context.ts
   export function createRequestLogger(requestId: string) {
     return logger.child({ requestId });
   }
   export function createJobLogger(jobId: string, jobType: string) {
     return logger.child({ jobId, jobType });
   }
   ```

4. **Replace all `console.log`/`logger.log` calls**
   - API routes: request/response logging
   - Audio services: processing stage logging
   - Queue system: job lifecycle logging
   - Auth: login/logout events

5. **Preserve existing header redaction**
   - Port `redactHeaders` logic to Pino serializers

#### Success Criteria

- [ ] Zero `console.log` calls in production code
- [ ] All logs in JSON format in production
- [ ] Log levels configurable via `LOG_LEVEL` env var
- [ ] Request tracing via request ID propagation

---

### 3.2 OpenTelemetry Tracing

**Priority**: 🟢 Low
**Effort**: 3 days
**Dependencies**: Phase 3.1 (Pino logging)
**License**: Apache 2.0

#### Implementation Steps

1. **Install OpenTelemetry SDK**
   ```bash
   npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
   npm install @opentelemetry/exporter-trace-otlp-http
   ```

2. **Setup instrumentation**
   ```
   src/lib/observability/
   ├── otel.ts               # OpenTelemetry initialization
   ├── traces/
   │   ├── audio.ts          # Audio processing spans
   │   ├── database.ts       # Database query spans
   │   └── queue.ts          # Queue job spans
   └── metrics/
       ├── audio.ts          # Audio processing metrics
       └── queue.ts          # Queue metrics
   ```

3. **Instrument audio pipeline**
   ```typescript
   const tracer = trace.getTracer('audio-service');

   export async function analyzeTrack(trackId: string) {
     return tracer.startActiveSpan('audio.analyze', async (span) => {
       span.setAttribute('track.id', trackId);
       try {
         const result = await performAnalysis(trackId);
         span.setStatus({ code: SpanStatusCode.OK });
         return result;
       } catch (error) {
         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
         throw error;
       } finally {
         span.end();
       }
     });
   }
   ```

4. **Add custom metrics**
   - Stem separation duration histogram
   - Mashup generation success/failure counter
   - Queue depth gauge

#### Success Criteria

- [ ] Traces visible for all audio processing operations
- [ ] Database queries traced with duration
- [ ] Queue job lifecycle traced end-to-end
- [ ] Export to OTLP-compatible backend (Jaeger, Grafana Tempo, etc.)

---

### 3.3 Feature-Specific Error Boundaries

**Priority**: 🟡 Medium
**Effort**: 2 days
**Dependencies**: None

**Current Problem**: Single generic `ErrorBoundary` in `src/components/ErrorBoundary.tsx`. No per-feature isolation.

#### Implementation Steps

1. **Create feature-specific error boundaries**
   ```
   src/components/error-boundaries/
   ├── audio-error-boundary.tsx    # Audio player errors
   ├── mashup-error-boundary.tsx   # Mashup creation errors
   ├── stem-error-boundary.tsx     # Stem player errors
   └── upload-error-boundary.tsx   # Upload form errors
   ```

2. **Each boundary provides**
   - Contextual error message
   - Retry/reset button
   - Fallback UI matching feature area
   - Error logging to Pino (Phase 3.1)

3. **Wrap feature sections in layouts/pages**
   ```typescript
   <AudioErrorBoundary>
     <AudioPlayer />
   </AudioErrorBoundary>
   ```

#### Success Criteria

- [ ] No unhandled errors crash the entire page
- [ ] Users see helpful, contextual error messages
- [ ] Errors logged with full context via Pino
- [ ] Retry flows work for transient errors

---

### 3.4 CSRF Protection

**Priority**: 🔴 High
**Effort**: 2 days
**Dependencies**: None

**Current Problem**: No CSRF protection exists. State-changing API endpoints are vulnerable.

#### Implementation Steps

1. **Create CSRF module**
   ```typescript
   // src/lib/security/csrf.ts
   import { randomBytes, createHmac } from 'crypto';

   export function generateCSRFToken(sessionId: string): string {
     const token = randomBytes(32).toString('hex');
     const signature = createHmac('sha256', process.env.CSRF_SECRET)
       .update(`${sessionId}:${token}`)
       .digest('hex');
     return `${token}.${signature}`;
   }

   export function validateCSRFToken(token: string, sessionId: string): boolean {
     const [tokenId, signature] = token.split('.');
     const expected = createHmac('sha256', process.env.CSRF_SECRET)
       .update(`${sessionId}:${tokenId}`)
       .digest('hex');
     return signature === expected;
   }
   ```

2. **Create CSRF middleware**
   - Generate token on session creation
   - Validate token on POST/PUT/DELETE/PATCH requests
   - Return 403 with clear message on validation failure

3. **Apply to state-changing routes**
   - `POST /api/mashups/*`
   - `POST /api/audio/*`
   - `PUT /api/users/*`
   - Skip GET/HEAD/OPTIONS

4. **Client integration**
   - Fetch CSRF token from session endpoint
   - Include in `X-CSRF-Token` header on mutations

#### Success Criteria

- [ ] CSRF tokens required for all state-changing requests
- [ ] Token validation working with Better Auth sessions
- [ ] Client automatically includes token in requests
- [ ] 403 returned on invalid/missing tokens

---

### 3.5 Enhanced Health Checks

**Priority**: 🟢 Low
**Effort**: 1 day
**Dependencies**: Phase 1.1 (Redis), Phase 3.1 (Logging)

**Current State**: `src/app/api/health/route.ts` already checks DB, storage, and memory.

#### Implementation Steps

1. **Add Redis health check**
   ```typescript
   async function checkRedis() {
     // PING via ioredis
     // Return { status: 'up', latency: ms } or { status: 'down', error }
   }
   ```

2. **Add FFmpeg health check**
   ```typescript
   async function checkAudioServices() {
     // Verify ffmpeg binary exists and responds to -version
   }
   ```

3. **Add queue depth metric**
   - Report pending/active/failed job counts
   - Include in health response

#### Success Criteria

- [ ] Health endpoint reports Redis status
- [ ] Health endpoint reports FFmpeg availability
- [ ] Queue depth visible in health response
- [ ] Degraded state when any dependency down

---

## Phase 4: Scale & Optimization

**Timeline**: Weeks 7-8
**Goal**: Optimize for scale, reduce costs, improve perceived performance

### 4.1 Cursor-Based Pagination

**Priority**: 🟢 Low
**Effort**: 2 days
**Dependencies**: None

**Current State**: Offset-based pagination in `src/lib/runtime/mashup-list.ts`. Works but degrades at deep pages.

#### Implementation Steps

1. **Create pagination utilities**
   ```typescript
   // src/lib/utils/pagination.ts
   export function createCursorQuery(table, { cursor, limit, orderBy }) {
     let query = db.select().from(table).orderBy(orderBy);
     if (cursor) {
       const cursorValue = decodeCursor(cursor);
       query = query.where(gt(orderBy, cursorValue));
     }
     return query.limit(limit + 1); // +1 to detect hasNextPage
   }
   ```

2. **Update API routes**
   - Add `?cursor=xxx&limit=10` alongside existing `?page=` support
   - Return `nextCursor` in response
   - Maintain backward compatibility

3. **Update client components**
   - Implement infinite scroll with cursor
   - Show loading indicator for next page

#### Success Criteria

- [ ] Consistent query performance regardless of page depth
- [ ] No duplicate or missing records during pagination
- [ ] Backward compatible with offset pagination

---

### 4.2 CDN Cache Strategy

**Priority**: 🟡 Medium
**Effort**: 2 days
**Dependencies**: None

**Current State**: Ad-hoc `Cache-Control` headers scattered across API routes. No centralized strategy.

#### Implementation Steps

1. **Define cache tiers**
   ```typescript
   const CACHE_TIERS = {
     static: 'public, max-age=31536000, immutable',           // JS, CSS, images
     semiStatic: 'public, max-age=3600, stale-while-revalidate=86400', // waveforms
     dynamic: 'no-store',                                       // API responses
     private: 'private, max-age=0',                             // user data
   };
   ```

2. **Configure in `next.config.js` headers**
   ```typescript
   // Centralized cache header configuration
   async headers() {
     return [
       { source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: CACHE_TIERS.static }] },
       { source: '/api/waveforms/:path*', headers: [{ key: 'Cache-Control', value: CACHE_TIERS.semiStatic }] },
     ];
   }
   ```

3. **Configure R2 public assets**
   - Set `Cache-Control` on R2 objects for public assets
   - Use content-addressable filenames for cache busting

#### Success Criteria

- [ ] CDN cache hit rate > 80% for static assets
- [ ] Waveform assets cached with long TTL
- [ ] Centralized cache configuration in `next.config.js`

---

## Dependency Graph

```
Phase 1.1 (BullMQ) ─────┬─────────────────────────────────┐
                         │                                 │
Phase 1.2 (Redis Rate) ──┤                                 │
                         │                                 │
                         ▼                                 │
Phase 2.1 (Auth State)   │                        Phase 4.1 (Pagination)
                         │                                 │
Phase 2.2 (SSE Redis) ───┤                                 │
                         │                                 │
Phase 2.3 (RSC Dashboard)┘                        Phase 4.2 (CDN)

Phase 3.1 (Pino) ────────┐
                         │
Phase 3.2 (OpenTelemetry)│
                         │
Phase 3.3 (Error Bounds)─┤
                         │
Phase 3.4 (CSRF) ────────┤
                         │
Phase 3.5 (Health) ──────┘
```

**Critical Path**: Phase 1.1 → Phase 2.2 (SSE Redis)
**Independent Tracks**: Phase 2.1 (Auth) can start immediately. Phase 3.x track is independent of Phase 1-2.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Redis single point of failure | Medium | High | DB-backed queue fallback, health monitoring, factory pattern |
| Breaking existing queue consumers | Medium | Medium | BullMQ driver implements same `QueueDriver` interface, factory fallback |
| RSC breaking client components | Low | Medium | Incremental migration, only new dashboard page uses RSC |
| SSE connection limits | Low | Medium | Heartbeat keepalive, connection pooling |
| PII in structured logs | Medium | High | Port existing header redaction to Pino, add sensitive field filtering |
| CSRF token sync issues | Low | Low | Token tied to session, auto-fetch on client |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] BullMQ processes 1000+ concurrent jobs with retry and dead letter queue
- [ ] Rate limiting enforced across 2+ server instances
- [ ] Graceful fallback to existing DB queue when Redis unavailable
- [ ] All existing queue consumers unchanged

### Phase 2 Complete When:
- [ ] No hardcoded auth state in codebase
- [ ] SSE updates within 100ms across all server instances
- [ ] Dashboard loads with server-rendered content
- [ ] Login/logout flows working end-to-end

### Phase 3 Complete When:
- [ ] Zero `console.log` in production code
- [ ] All audio operations traced with OpenTelemetry
- [ ] No unhandled errors crash pages
- [ ] CSRF tokens required on all state-changing requests
- [ ] Health checks report Redis, FFmpeg, and queue status

### Phase 4 Complete When:
- [ ] Pagination performance consistent at any depth
- [ ] CDN cache hit rate > 80% for static assets
- [ ] Centralized cache configuration in place

### Overall Project Complete When:
- [ ] All phases complete
- [ ] Load test: 10k concurrent users
- [ ] Audio pipeline: 50 mashups/hour capacity
- [ ] Uptime: 99.9% over 30 days

---

## Appendix A: New Dependencies (All Free & Open Source)

| Package | License | Purpose |
|---------|---------|---------|
| `bullmq` | MIT | Redis-based job queue |
| `ioredis` | MIT | Redis client (BullMQ dependency) |
| `pino` | MIT | Structured logging |
| `pino-pretty` | MIT | Dev log formatting |
| `@opentelemetry/sdk-node` | Apache 2.0 | Tracing SDK |
| `@opentelemetry/auto-instrumentations-node` | Apache 2.0 | Auto-instrumentation |
| `@opentelemetry/exporter-trace-otlp-http` | Apache 2.0 | Trace export |

---

## Appendix B: New Environment Variables

```env
# Redis (optional — app works without it using DB fallback)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info

# OpenTelemetry (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=infinitymix

# Security
CSRF_SECRET=<generate-with-openssl-rand-base64-32>
```

---

## Appendix C: File Structure (Target State)

```
src/
├── app/
│   ├── api/
│   │   ├── health/route.ts           # Enhanced health check
│   │   └── ...
│   ├── dashboard/
│   │   ├── page.tsx                  # Server Component
│   │   ├── mashup-list.tsx           # Server Component
│   │   └── mashup-list-skeleton.tsx
│   └── ...
├── components/
│   ├── auth/
│   │   └── auth-guard.tsx
│   ├── error-boundaries/
│   │   ├── audio-error-boundary.tsx
│   │   ├── mashup-error-boundary.tsx
│   │   └── upload-error-boundary.tsx
│   └── ...
├── hooks/
│   └── use-auth.ts                   # useAuth hook
├── lib/
│   ├── auth/
│   │   ├── auth-context.tsx          # AuthProvider + useAuth
│   │   └── ...
│   ├── data/
│   │   └── mashups.ts                # Server-side data fetching
│   ├── observability/
│   │   ├── logger.ts                 # Pino logger
│   │   ├── context.ts                # Context-aware child loggers
│   │   ├── otel.ts                   # OpenTelemetry setup
│   │   └── traces/
│   │       ├── audio.ts
│   │       ├── database.ts
│   │       └── queue.ts
│   ├── queue/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── bullmq-driver.ts
│   │   ├── durable-driver.ts         # Existing driver (fallback)
│   │   └── factory.ts
│   ├── rate-limiting/
│   │   ├── index.ts
│   │   ├── redis-limiter.ts
│   │   ├── memory-limiter.ts         # Existing (fallback)
│   │   └── middleware.ts
│   ├── realtime/
│   │   ├── event-bus.ts              # Redis Pub/Sub
│   │   └── ...
│   ├── security/
│   │   └── csrf.ts
│   └── utils/
│       └── pagination.ts
├── workers/
│   ├── index.ts
│   ├── stem-separation.ts
│   ├── audio-analysis.ts
│   ├── mashup-generation.ts
│   └── shared/
│       ├── concurrency.ts
│       └── metrics.ts
└── ...
```
