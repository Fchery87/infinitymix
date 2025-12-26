# Analyzer Service (services/analyzer/)

## Package Identity

Audio analysis microservice for InfinityMix. Processes uploaded audio files to extract BPM, key signature, beat grids, song structure, and energy profiles. Framework: Node.js + TypeScript, BullMQ worker, FFmpeg, music-tempo, key detection libraries.

## Setup & Run

```bash
cd services/analyzer

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

**Docker**: Included in root `docker-compose.yml` as `audio-analyzer` service.

## Patterns & Conventions

### File Organization
- **Main worker**: `src/analyzer.ts` - BullMQ worker entry point
- **Core logic**: `src/AudioAnalyzer.ts` - Audio analysis implementation
- **Utilities**: `src/utils/` - Helper functions

### Worker Pattern
- ✅ DO: Use BullMQ `Worker` class for job processing
- ✅ Example: See `src/analyzer.ts` for worker setup
- ✅ Jobs: Define job types and handlers explicitly
- ❌ DON'T: Run analysis synchronously - always use queue

### Audio Analysis Pattern
- ✅ DO: Process audio files in stages: upload → analyze → save results
- ✅ Use FFmpeg for audio format conversion
- ✅ Use music-tempo for BPM detection
- ✅ Use key library for key signature detection
- ❌ DON'T: Store large audio files locally - stream/process directly

### Database Integration
- ✅ DO: Use Prisma client for database operations
- ✅ Example: See job handler in `src/analyzer.ts`
- ❌ DON'T: Write raw SQL queries

### Error Handling
- ✅ DO: Mark jobs as failed with descriptive error messages
- ✅ Log errors using Winston logger
- ❌ DON'T: Swallow exceptions - always fail job on unrecoverable errors

## Touch Points / Key Files

- **Worker entry**: `src/analyzer.ts` - BullMQ worker setup
- **Audio analyzer**: `src/AudioAnalyzer.ts` - Core analysis logic
- **Package config**: `package.json` - Dependencies and scripts
- **Dockerfile**: `Dockerfile` - Container configuration

## JIT Index Hints

```bash
# Find job handlers
rg -n "worker\.(add|process)" src/

# Find database operations
rg -n "prisma\.(uploadedTrack|track)" src/

# Find audio processing steps
rg -n "(analyze|extract|detect)" src/AudioAnalyzer.ts

# Find logger usage
rg -n "logger\.(info|error|warn)" src/
```

## Common Gotchas

- **Redis connection**: Requires `REDIS_URL` with password format: `redis://:password@host:6379`
- **S3/R2 access**: AWS credentials via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- **Audio formats**: Support MP3, WAV, FLAC - convert others to WAV for analysis
- **Job retries**: Configure BullMQ worker with appropriate retry limits
- **Timeout**: Long audio files may timeout - increase job timeout in worker config

## Pre-PR Checks

```bash
cd services/analyzer

# Run all checks
npm run lint && npm test && npm run build
```

## Special Considerations

### Queue Processing (BullMQ)
- Queue name: `audio-analysis` (must match app queue definition)
- Job data structure: `{ trackId, userId, storageUrl }`
- Result: Store analysis results in database (uploaded_tracks table)
- Failed jobs: Retry with exponential backoff, max 3 attempts

### External Dependencies
- **FFmpeg**: Used for audio decoding and format conversion
- **music-tempo**: BPM detection library
- **key**: Key signature detection library
- **Prisma**: Database ORM (configured for PostgreSQL)
- **Winston**: Structured logging

### Testing
- Unit tests: `*.test.ts` for audio analysis functions
- Integration tests: Test job processing with mock queue
- Mock external services: Use test fixtures instead of real audio files
