# InfinityMix Web Application (app/)

## Package Identity

Main Next.js 15 web application for AI-powered audio mashup generation. Handles user authentication, audio upload/analysis, mashup generation, playback, and file storage. Framework: Next.js 15 (App Router), React 19, TypeScript, Drizzle ORM.

## Setup & Run

```bash
cd app

# Install dependencies
npm install

# Database setup
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Generate and run migrations
npm run db:generate
npm run db:migrate

# Development server
npm run dev  # http://localhost:3000

# Build for production
npm run build

# Quality checks
npm run lint           # ESLint
npm test               # Vitest tests

# Database tools
npm run db:studio      # Drizzle Studio (visual DB editor)
```

## Patterns & Conventions

### File Organization
- **App Routes**: `src/app/` - Next.js App Router with file-based routing
- **API Routes**: `src/app/api/` - REST endpoints organized by domain
- **Components**: `src/components/` - Reusable UI components
- **Libraries**: `src/lib/` - Core business logic and utilities
- **Hooks**: `src/hooks/` - React hooks (TanStack Query, custom hooks)

### Naming Conventions
- Files: kebab-case (e.g., `audio-player.tsx`, `mixing-service.ts`)
- Components: PascalCase (e.g., `AudioPlayer`, `MashupCard`)
- API routes: lowercase (e.g., `api/audio/pool/route.ts`)
- Database tables: snake_case (defined in `src/lib/db/schema.ts`)

### Code Patterns

**API Routes (App Router)**
- ✅ DO: Use `export async function GET/POST(req: Request)` pattern
- ✅ Example: See `src/app/api/audio/pool/route.ts` for full pattern
- ❌ DON'T: Use Next.js Pages Router (`pages/api/`) - use App Router only

**Database Queries**
- ✅ DO: Use Drizzle ORM with `db.select()`, `db.insert()`, `db.update()`
- ✅ Example: See `src/app/api/audio/pool/route.ts` for query patterns
- ❌ DON'T: Write raw SQL - use Drizzle query builder

**Audio Processing**
- ✅ DO: Use services from `src/lib/audio/`
- ✅ Example: Audio analysis → `src/lib/audio/analysis-service.ts`
- ✅ Example: Stem separation → `src/lib/audio/stems-service.ts`
- ✅ Example: Auto DJ → `src/lib/audio/auto-dj-service.ts`
- ❌ DON'T: Call FFmpeg directly - use service abstractions

**Storage (Cloudflare R2)**
- ✅ DO: Use `src/lib/storage.ts` for all file operations
- ✅ Example: Upload pattern → `src/app/api/audio/pool/route.ts`
- ❌ DON'T: Use AWS SDK directly - wrap through storage service

**Authentication**
- ✅ DO: Use Better Auth from `src/lib/auth/`
- ✅ Example: Protected route → `src/app/api/users/me/route.ts`
- ❌ DON'T: Implement custom auth - use Better Auth providers

**Form Validation**
- ✅ DO: Use Zod schemas with react-hook-form
- ✅ Example: See `src/components/forms/` for patterns
- ❌ DON'T: Skip validation - all inputs must be validated

**React Components**
- ✅ DO: Use functional components with hooks
- ✅ Example: `src/components/ui/button.tsx`, `src/components/audio-player/`
- ❌ DON'T: Use class components - no legacy React patterns

**Error Handling**
- ✅ DO: Throw descriptive errors with HTTP status codes
- ✅ Example: `return NextResponse.json({ error: '...' }, { status: 400 })`
- ❌ DON'T: Return 200 OK with error objects - use proper HTTP status codes

## Touch Points / Key Files

### Core Audio Services
- Audio analysis: `src/lib/audio/analysis-service.ts` - BPM, key, beat grid detection
- Stem separation: `src/lib/audio/stems-service.ts` - Demucs, HuggingFace integration
- Mixing engine: `src/lib/audio/mixing-service.ts` - Crossfade, beat alignment
- Auto DJ system: `src/lib/audio/auto-dj-service.ts` - Intelligent track sequencing

### Database
- Schema definition: `src/lib/db/schema.ts` - All tables, types, enums
- DB connection: `src/lib/db/index.ts` - Drizzle instance
- Drizzle config: `drizzle.config.ts` - Migration configuration

### Authentication
- Better Auth config: `src/lib/auth/` - Session management, providers
- Middleware: `middleware.ts` - Route protection

### Storage
- Cloudflare R2: `src/lib/storage.ts` - Upload, download, delete operations
- Mock storage: `src/lib/mock-storage-service.ts` - Testing/development

### API Routes by Domain
- Audio pool: `src/app/api/audio/pool/route.ts` - Track upload/list/delete
- Stems: `src/app/api/audio/stems/[trackId]/route.ts` - Stem separation
- Mashups: `src/app/api/mashups/` - Generation, history, playback
- Users: `src/app/api/users/me/route.ts` - Profile management

### UI Components
- Design system: `src/components/ui/` - Button, Input, Card (Shadcn-style)
- Feature components: `src/components/audio-player/`, `src/components/stem-player/`
- Forms: `src/components/forms/` - Upload forms, mashup creation

## JIT Index Hints

### Search Commands for App
```bash
# Find an API route
rg -n "export (async )?function (GET|POST|PUT|DELETE)" src/app/api

# Find a React component
rg -n "export (default )?function.*Component" src/components

# Find database table definitions
rg -n "export const [a-z]+ = pgTable" src/lib/db/schema.ts

# Find audio service functions
rg -n "export (async )?function" src/lib/audio

# Find database queries
rg -n "db\.(select|insert|update|delete)" src

# Find file storage operations
rg -n "uploadFile|downloadFile|deleteFile" src/lib/storage.ts

# Find authentication usage
rg -n "auth\.api\.getSession" src/app/api

# Find form validation schemas
rg -n "z\.object|z\.string|z\.number" src

# Find tests
find . -name "*.test.ts" -o -name "*.test.tsx"
```

### Common File Locations
- Upload flow: `src/app/api/audio/pool/route.ts` + `src/lib/audio/upload-service.ts`
- Auto DJ: `src/app/api/mashups/djmix/route.ts` + `src/lib/audio/auto-dj-service.ts`
- Stem mashups: `src/app/api/mashups/stem/route.ts` + `src/lib/audio/mixing-service.ts`

## Common Gotchas

- **Database URL**: Must include `postgresql://` protocol in `DATABASE_URL`
- **Auth sessions**: `BETTER_AUTH_SECRET` must be stable across restarts (use `openssl rand -base64 32`)
- **File cleanup**: Always delete from R2 before deleting database records
- **Stem URLs**: Use `src/app/api/audio/stream/[stemId]/route.ts` to proxy audio files (avoid CORS)
- **Path aliases**: Always use `@/` for imports - configured in `tsconfig.json`
- **Environment**: Client-side env vars need `NEXT_PUBLIC_` prefix (most env vars are server-side only)
- **Type imports**: Import database types from `src/lib/db/schema.ts` (not from drizzle-orm directly)

## Pre-PR Checks

```bash
cd app

# Run all checks before committing
npm run lint && npm test && npm run build

# Verify database schema is in sync
npm run db:generate

# Check for missing types
npx tsc --noEmit
```

## Special Considerations

### Database (Drizzle ORM + PostgreSQL)
- Schema: `src/lib/db/schema.ts` - Single source of truth
- Migrations: `.drizzle/` directory
- **NEVER** run migrations in tests - use test database
- Connection: Singleton pattern in `src/lib/db/index.ts`
- Types: Auto-generated via `$inferSelect` and `$inferInsert`

### API Patterns (Next.js App Router)
- REST routes: `src/app/api/**/route.ts`
- Dynamic routes: `src/app/api/[param]/route.ts`
- Auth middleware: Apply via `middleware.ts` or check session per-route
- Validation: Use Zod schemas at route boundaries
- Error handling: Return proper HTTP status codes with JSON responses
- Example endpoint: `src/app/api/audio/pool/route.ts` shows full pattern

### Audio Processing
- Never use FFmpeg directly - use service abstractions in `src/lib/audio/`
- Services handle format conversion, analysis, mixing
- Stems support multiple engines: HuggingFace (free), Demucs (local), FFmpeg (fallback)
- Audio files stored in Cloudflare R2, proxied through API for CORS
- See `src/lib/audio/` for all audio-related services

### Testing
- Unit tests: `*.test.ts` colocated with source (currently in `tests/` directory)
- Test framework: Vitest (configured in `vitest.config.ts`)
- Mock external services: Use `src/lib/mock-storage-service.ts`
- Run single test: `npm test -- path/to/file.test.ts`
- Coverage: Aim for critical path coverage (API routes, audio services)
