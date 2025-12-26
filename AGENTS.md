# InfinityMix AGENTS.md

## Project Snapshot

InfinityMix is a monorepo containing a Next.js web application and three microservices for AI-powered audio mashup generation. Tech stack: Next.js 15, React 19, TypeScript, Drizzle ORM (PostgreSQL), Cloudflare R2, FFmpeg, BullMQ/Redis. Each package has its own AGENTS.md for detailed guidance.

## Root Setup Commands

```bash
# Clone and setup
cd /home/nochaserz/Documents/Coding\ Projects/infinitymix

# Install all dependencies
cd app && npm install
cd ../services/analyzer && npm install
cd ../services/renderer && npm install
cd ../services/worker && npm install

# Start everything with Docker Compose
cd /home/nochaserz/Documents/Coding\ Projects/infinitymix
docker-compose up -d

# Or start app only (dev mode)
cd /home/nochaserz/Documents/Coding\ Projects/infinitymix/app
npm run dev  # Runs Next.js on port 3000
```

## Universal Conventions

- **TypeScript Strict Mode**: Enabled across all services. No implicit any.
- **Code Style**: ESLint with Next.js config. Run `npm run lint` before committing.
- **Commit Format**: Conventional Commits (feat:, fix:, docs:, etc.)
- **Branch Strategy**: master is default. feature/ branches for new work.
- **Imports**: Use `@/*` path aliases in app (e.g., `@/lib/db/schema.ts`)
- **Environment**: Never commit `.env.local` files. Use `.env.example` as template.

## Security & Secrets

- Never commit API keys, tokens, or credentials.
- Secrets go in `.env.local` (gitignored) - see `app/.env.local.example`
- For production: use environment variables in Docker Compose or deployment platform.
- Database migrations: Never run in tests - use test database.
- PII handling: User data hashed/stored per Better Auth patterns.

## JIT Index (what to open, not what to paste)

### Package Structure
- **Web UI & API**: `app/` → [see app/AGENTS.md](app/AGENTS.md)
- **Analyzer Service**: `services/analyzer/` → [see services/analyzer/AGENTS.md](services/analyzer/AGENTS.md)
- **Renderer Service**: `services/renderer/` → [see services/renderer/AGENTS.md](services/renderer/AGENTS.md)
- **Worker Service**: `services/worker/` → [see services/worker/AGENTS.md](services/worker/AGENTS.md)

### Quick Find Commands
```bash
# Find a function across app
rg -n "functionName" app/src

# Find a component
rg -n "export function .*" app/src/components

# Find API routes
rg -n "export (async )?function (GET|POST)" app/src/app/api

# Find database table definitions
rg -n "pgTable" app/src/lib/db/schema.ts

# Find audio processing services
rg -n "class.*Service" app/src/lib/audio

# Find service workers
rg -n "Queue.*Worker" services/*/src
```

## Definition of Done

Before a PR is ready:
- [ ] `npm run lint` passes with no errors
- [ ] TypeScript compiles with no errors
- [ ] Database migrations generated/applied if schema changed
- [ ] Tests pass (if applicable)
- [ ] New features have tests (critical paths)
- [ ] No secrets committed
