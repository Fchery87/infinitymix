# Worker Service (services/worker/)

## Package Identity

Background worker microservice for InfinityMix. Handles general queue processing tasks that don't fit in analyzer or renderer services, including cleanup jobs, scheduled tasks, and other asynchronous operations. Framework: Node.js + TypeScript, BullMQ worker, PostgreSQL (Prisma).

## Setup & Run

```bash
cd services/worker

# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Build
npm run build

# Production start
npm start

# Linting
npm run lint

# Tests
npm test
```

**Docker**: Included in root `docker-compose.yml` as `worker` service.

## Patterns & Conventions

### File Organization
- **Main worker**: `src/worker.ts` - BullMQ worker entry point
- **Planner**: `src/MashupPlanner.ts` - Auto DJ track planning logic
- **Utilities**: `src/utils/` - Helper functions

### Worker Pattern
- ✅ DO: Use BullMQ `Worker` class for job processing
- ✅ Example: See `src/worker.ts` for worker setup
- ✅ Jobs: Handle various background tasks (cleanup, planning, scheduling)
- ❌ DON'T: Run tasks synchronously - always use queue

### Job Types
- **Cleanup jobs**: Delete old temporary files, expired sessions
- **Planning jobs**: Auto DJ track sequence planning
- **Maintenance jobs**: Database cleanup, cache invalidation

### Database Integration
- ✅ DO: Use Prisma client for database operations
- ✅ Example: See job handlers in `src/worker.ts`
- ❌ DON'T: Write raw SQL queries

### Error Handling
- ✅ DO: Mark jobs as completed or failed with appropriate status
- ✅ Log all operations using Winston logger
- ❌ DON'T: Let jobs hang - always handle timeout cases

## Touch Points / Key Files

- **Worker entry**: `src/worker.ts` - BullMQ worker setup
- **Mashup planner**: `src/MashupPlanner.ts` - Auto DJ planning logic
- **Package config**: `package.json` - Dependencies and scripts
- **Dockerfile**: `Dockerfile` - Container configuration

## JIT Index Hints

```bash
# Find job handlers
rg -n "worker\.(add|process)" src/

# Find database operations
rg -n "prisma\.(track|mashup|user)" src/

# Find planner logic
rg -n "(plan|sequence|select)" src/MashupPlanner.ts

# Find cleanup jobs
rg -n "(cleanup|delete|expire)" src/worker.ts
```

## Common Gotchas

- **Redis connection**: Requires `REDIS_URL` with password format: `redis://:password@host:6379`
- **Database URL**: PostgreSQL connection string for Prisma
- **Job priorities**: Critical jobs should have higher priority than maintenance jobs
- **Timeout**: Set appropriate timeouts for different job types
- **Idempotency**: Ensure jobs can be safely retried without side effects

## Pre-PR Checks

```bash
cd services/worker

# Run all checks
npm run lint && npm test && npm run build
```

## Special Considerations

### Queue Processing (BullMQ)
- Queue names vary by job type:
  - `cleanup` - File and record cleanup
  - `planning` - Auto DJ track planning
  - `maintenance` - Scheduled maintenance tasks
- Job data structure depends on job type
- Results may update database records or delete files

### External Dependencies
- **Prisma**: Database ORM (configured for PostgreSQL)
- **Winston**: Structured logging
- **BullMQ**: Job queue management
- **Redis**: Queue backend

### Mashup Planner (src/MashupPlanner.ts)
- **Purpose**: Plan Auto DJ track sequences based on user criteria
- **Inputs**: Track pool, target duration, energy mode, event preset
- **Outputs**: Ordered list of tracks with transition points
- **Logic**: Harmonic key matching (Camelot wheel), energy profiling, phrase alignment

### Common Jobs

**File Cleanup**
- Delete temporary audio files older than X hours
- Remove orphaned database records
- Clean up expired sessions

**Auto DJ Planning**
- Plan track sequence for user's Auto DJ mix
- Calculate optimal transition points
- Select tracks based on BPM, key, and energy

**Maintenance**
- Update recommendation cache
- Compact database (VACUUM)
- Generate usage reports

### Testing
- Unit tests: `*.test.ts` for individual job handlers
- Integration tests: Test queue processing with mock jobs
- Mock external services for reliability
