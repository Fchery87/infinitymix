# Renderer Service (services/renderer/)

## Package Identity

Audio rendering microservice for InfinityMix. Generates final mashup audio files from multiple track inputs, handling beat alignment, crossfades, BPM matching, and output rendering. Framework: Node.js + TypeScript, BullMQ worker, FFmpeg, fluent-ffmpeg.

## Setup & Run

```bash
cd services/renderer

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

**Docker**: Included in root `docker-compose.yml` as `audio-renderer` service.

## Patterns & Conventions

### File Organization
- **Main worker**: `src/renderer.ts` - BullMQ worker entry point
- **Core logic**: `src/AudioRenderer.ts` - Audio mixing and rendering implementation
- **Utilities**: `src/utils/` - Helper functions

### Worker Pattern
- ✅ DO: Use BullMQ `Worker` class for job processing
- ✅ Example: See `src/renderer.ts` for worker setup
- ✅ Jobs: Handle different render types (standard mashup, stem mashup, auto DJ)
- ❌ DON'T: Run rendering synchronously - always use queue

### Rendering Pattern
- ✅ DO: Process jobs in stages: fetch tracks → align beats → apply transitions → render
- ✅ Use FFmpeg for audio mixing, crossfades, and output encoding
- ✅ Support multiple output formats (MP3, WAV)
- ❌ DON'T: Store intermediate files permanently - clean up after rendering

### BPM/Key Matching
- ✅ DO: Time-stretch tracks to match target BPM (using FFmpeg)
- ✅ Pitch-shift tracks to match key if harmonic mixing enabled
- ❌ DON'T: Modify source files - create temporary copies

### Crossfade/Transitions
- ✅ DO: Support multiple transition types: smooth, drop, energy, cut
- ✅ Calculate crossfade duration based on BPM (e.g., 8 beats at 128 BPM)
- ❌ DON'T: Use fixed durations - calculate dynamically

## Touch Points / Key Files

- **Worker entry**: `src/renderer.ts` - BullMQ worker setup
- **Audio renderer**: `src/AudioRenderer.ts` - Core rendering logic
- **Package config**: `package.json` - Dependencies and scripts
- **Dockerfile**: `Dockerfile` - Container configuration

## JIT Index Hints

```bash
# Find job handlers
rg -n "worker\.(add|process)" src/

# Find FFmpeg commands
rg -n "ffmpeg\(\)|\.input\(\)|\.output\(\)" src/AudioRenderer.ts

# Find crossfade logic
rg -n "(crossfade|transition|mix)" src/AudioRenderer.ts

# Find BPM matching
rg -n "(timeStretch|pitchShift|tempo)" src/AudioRenderer.ts
```

## Common Gotchas

- **Redis connection**: Requires `REDIS_URL` with password format: `redis://:password@host:6379`
- **S3/R2 access**: AWS credentials via `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- **FFmpeg path**: Ensure FFmpeg is installed in container (included in Dockerfile)
- **Memory usage**: Large mashups with many tracks may exceed memory - limit track count
- **Output URLs**: Store rendered files in R2 and return public URLs
- **Cleanup**: Delete temporary files after rendering to free disk space

## Pre-PR Checks

```bash
cd services/renderer

# Run all checks
npm run lint && npm test && npm run build
```

## Special Considerations

### Queue Processing (BullMQ)
- Queue names:
  - `mashup-render` - Standard mashup generation
  - `stem-mashup-render` - Stem-based mashups
  - `djmix-render` - Auto DJ mix rendering
- Job data structure varies by type (see app for payload formats)
- Result: Upload rendered file to R2, update mashup record with URL
- Failed jobs: Retry with exponential backoff, max 3 attempts

### External Dependencies
- **FFmpeg**: Core audio processing engine
- **fluent-ffmpeg**: Node.js wrapper for FFmpeg
- **Prisma**: Database ORM (for updating mashup records)
- **Winston**: Structured logging
- **AWS SDK**: For uploading rendered files to R2

### Rendering Pipeline
1. Fetch input tracks from R2
2. Download to local temporary storage
3. Apply BPM/time-stretch matching
4. Apply key/pitch shifting (if needed)
5. Generate crossfade transitions
6. Mix tracks using FFmpeg
7. Encode output to target format (MP3/WAV)
8. Upload result to R2
9. Cleanup temporary files
10. Update database with output URL

### Testing
- Unit tests: `*.test.ts` for individual rendering functions
- Integration tests: Test job processing with mock queue and audio samples
- Use test fixtures instead of real audio files for reliability
