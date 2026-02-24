# InfinityMix

An AI-powered web application that democratizes mashup creation by allowing users to upload audio files and generate professional-quality DJ-level mashups with minimal technical input. Features intelligent Auto DJ mixing with stem-based transitions, harmonic mixing, and energy flow management.

## 🎯 Features

### Audio Analysis
- **BPM & Key Detection**: Automatic tempo and musical key analysis with Camelot wheel notation
- **Beat Grid Analysis**: Precise beat mapping for accurate mixing
- **Structure Detection**: Automatic identification of intro, verse, chorus, breakdown, drop, and outro sections with ML-based section tagging
- **Section Tags**: Visual labels for vocal-dominant, percussive, build, drop-like, and ambient sections
- **Cue Point Detection**: Intelligent mix-in/mix-out point suggestions
- **Energy Profiling**: Track energy curve analysis for smart sequencing

### Stem Separation
- **Multi-Engine Support**: Demucs (local), HuggingFace Spaces (free cloud), FFmpeg (fallback)
- **4-Stem Separation**: Vocals, drums, bass, and other/instrumental
- **Stem Player**: Individual stem playback and download

### Auto DJ System
- **Professional Mixing**: Phrase-aligned transitions on 8/16/32 bar boundaries
- **Energy Modes**: Steady, build (low→high), wave (alternating)
- **Event Presets**: Wedding, birthday, sweet16, club, default
- **Transition Styles**: Smooth, drop, energy, cut
- **Harmonic Mixing**: Camelot wheel-based key matching with automatic pitch shifting
- **Intelligent Mix-In Points**: Skip intros, enter at buildups/drops based on context
- **Stem-Based Transitions**: Vocal overlay, bass swap, instrumental bridge techniques
- **Vocal Collision Detection**: Automatic detection and avoidance of clashing vocals
- **Rule-Based Planner**: Extensible rule packs for style registry with decision traces

### Stem Mashups
- **Vocal + Instrumental Blending**: Mix vocals from one track with instrumental from another
- **Key Matching**: Automatic pitch adjustment for harmonic compatibility
- **BPM Sync**: Time-stretch tracks to match target tempo
- **Beat Alignment**: Sync downbeats between tracks
- **Two-Pass Loudnorm**: FFmpeg loudness normalization with QA verification and retry policy

### User Experience
- **Drag & Drop Upload**: Easy audio file upload
- **Resumable Uploads**: Large file uploads resume on network interruption
- **Real-time Progress**: Live status updates during analysis and generation
- **Mashup History**: Browse, play, and manage created mashups
- **Download Support**: Export mashups in MP3 format

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 App Router + React 19 + Tailwind CSS
- **Backend**: Next.js API Routes with Server Actions
- **Database**: PostgreSQL + Drizzle ORM (Neon-ready)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Authentication**: Better Auth with session-based auth
- **Audio Processing**: FFmpeg + fluent-ffmpeg
- **Stem Separation**: HuggingFace Gradio Client + Demucs
- **Rule Engine**: json-rules-engine for extensible planning logic
- **Resumable Uploads**: tus-js-client for large file uploads
- **State Management**: TanStack Query for server state
- **Validation**: Zod + React Hook Form
- **Deployment**: Vercel + Cloudflare R2

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm (comes with Node.js)

### Installation

1. **Clone and setup the project**
   ```bash
   cd infinitymix/app
   npm install
   ```

2. **Database Setup**
   ```bash
   # Create PostgreSQL database
   createdb infinitymix
   
   # Set up environment variables
   cp .env.local.example .env.local
   # Edit .env.local with your database URL and other secrets
   ```

3. **Run Database Migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
app/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API Routes
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   ├── audio/           # Audio management
│   │   │   │   ├── pool/        # Upload & track management
│   │   │   │   ├── stems/       # Stem separation
│   │   │   │   └── stream/      # Audio streaming proxy
│   │   │   ├── mashups/         # Mashup endpoints
│   │   │   │   ├── generate/    # Standard mashup generation
│   │   │   │   ├── stem/        # Stem-based mashups
│   │   │   │   ├── djmix/       # Auto DJ mix generation
│   │   │   │   └── recommendations/  # Track recommendations
│   │   │   └── users/           # User management
│   │   ├── create/              # Mashup creation page
│   │   ├── mashups/             # Mashup history page
│   │   └── layout.tsx           # Root layout
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   ├── track-list/          # Track list with section tags
│   │   ├── stem-player/         # Stem playback component
│   │   └── forms/               # Form components
│   └── lib/
│       ├── audio/               # Audio processing services
│       │   ├── analysis-service.ts    # BPM, key, structure detection
│       │   ├── stems-service.ts       # Stem separation
│       │   ├── mixing-service.ts      # Mashup mixing
│       │   ├── auto-dj-service.ts     # Auto DJ system
│       │   ├── resumable-upload.ts    # tus-js-client wrapper
│       │   ├── preview-graph.ts       # Tone.js preview
│       │   └── huggingface-stems.ts   # HuggingFace integration
│       ├── auth/                # Authentication
│       ├── db/                  # Database (Drizzle ORM)
│       │   └── schema.ts        # Database schema
│       ├── storage.ts           # Cloudflare R2 storage
│       └── utils/
│           └── audio-compat.ts  # Camelot wheel, BPM matching
├── services/
│   ├── renderer/                # FFmpeg rendering service
│   │   └── src/loudnorm.ts      # Two-pass loudness normalization
│   └── worker/                  # Planning/queue worker
│       └── src/planning/rules/  # Rule packs (energy, phrase, genre)
├── .drizzle/                    # Database migrations
├── drizzle.config.ts
└── package.json
```

## 🔧 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database (PostgreSQL - Neon recommended)
DATABASE_URL="postgresql://user:password@host:5432/infinitymix"

# Authentication
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-stable-32-char-secret-here"
BETTER_AUTH_URL="http://localhost:3000"

# Cloudflare R2 Storage
R2_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET="infinitymix"
R2_PUBLIC_BASE="https://your-public-bucket-url.com"  # Optional: for public URLs

# Stem Separation (Optional - falls back to FFmpeg)
DEMUCS_SERVICE_URL="http://localhost:8001"  # Local Demucs service

# Development
DEV_USER_ID="00000000-0000-0000-0000-000000000001"
DEV_USER_EMAIL="dev@example.com"
```

### Environment Variable Notes

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Session signing secret (must be stable) |
| `BETTER_AUTH_URL` | Yes | Base URL for auth callbacks |
| `R2_*` | Yes | Cloudflare R2 credentials for file storage |
| `DEMUCS_SERVICE_URL` | No | Optional local Demucs for high-quality stems |

## 🗄️ Database Schema

The application uses the following main tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts and profiles |
| `uploaded_tracks` | Audio files with analysis data (BPM, key, beat grid, structure, cue points) |
| `track_stems` | Separated stems (vocals, drums, bass, other) |
| `mashups` | Generated mashups with mix configuration |
| `mashup_input_tracks` | Many-to-many: tracks used in mashups |
| `playback_surveys` | User feedback/ratings |
| `recommendations` | Track recommendations |

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/*` - Better Auth endpoints (signup, signin, signout)

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile  
- `DELETE /api/users/me` - Delete account (cleans up all R2 files)

### Audio Files
- `POST /api/audio/pool` - Upload audio file (triggers analysis)
- `GET /api/audio/pool` - Get user's uploaded tracks
- `DELETE /api/audio/pool/[fileId]` - Delete track (cleans up R2 + stems)
- `POST /api/audio/pool/[fileId]/analyze` - Re-analyze track

### Stems
- `POST /api/audio/stems/[trackId]` - Trigger stem separation
- `GET /api/audio/stems/[trackId]` - Get track's stems
- `GET /api/audio/stream/[stemId]` - Stream stem audio

### Mashups
- `POST /api/mashups/generate` - Generate standard mashup
- `POST /api/mashups/stem` - Generate stem-based mashup (vocals + instrumental)
- `POST /api/mashups/djmix` - Generate Auto DJ mix
- `POST /api/mashups/djmix/preview-transition` - Preview single transition
- `GET /api/mashups` - List user's mashups
- `GET /api/mashups/[mashupId]` - Get mashup details
- `DELETE /api/mashups/[mashupId]` - Delete mashup (cleans up R2)
- `GET /api/mashups/[mashupId]/download` - Download/stream mashup
- `POST /api/mashups/[mashupId]/play` - Record playback

### Recommendations
- `GET /api/mashups/recommendations` - Get track recommendations

## 🎨 UI Components

The application includes reusable UI components in `src/components/ui/`:
- Button, Input, Card, Dialog components
- Form validation with react-hook-form + zod
- Audio upload interface with drag-and-drop
- Stem player with individual track controls
- Real-time progress indicators
- Mashup playback and download controls

## 📦 Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:generate      # Generate migration files
npm run db:migrate       # Apply migrations
npm run db:push          # Push schema changes directly
npm run db:studio        # Open Drizzle Studio

# Quality
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript check
npm test                 # Run tests
```

## 🐛 Troubleshooting

### Session Lost on Server Restart
- Ensure `BETTER_AUTH_SECRET` is set and consistent in `.env.local`
- Generate a stable secret: `openssl rand -base64 32`

### Stems Not Separating
- Check if HuggingFace Spaces are available (free tier has rate limits)
- Falls back to FFmpeg filter-based separation automatically

### Audio Not Playing
- Stems are stored as WAV files (browser-compatible)
- Check R2 bucket permissions and CORS settings

### Auto DJ Only Plays One Song
- Fixed: Segment duration calculation now properly distributes time across all tracks
- Each track gets proportional time based on target duration

## 🔒 Security

- Session-based authentication with secure cookies
- Password hashing with bcrypt
- HTTPS-only cookies in production
- Input validation on all endpoints
- Proper file cleanup on deletion (R2 + Database)
- Cascade deletes for related records

## ✅ Implementation Status

### Completed Features
- ✅ User authentication (signup, signin, signout, account deletion)
- ✅ Audio file upload with automatic analysis
- ✅ BPM, key, beat grid, structure detection
- ✅ ML-based section tagging (vocal-dominant, percussive, build, drop-like, ambient)
- ✅ Visual section tags in track list UI
- ✅ Stem separation (HuggingFace + Demucs + FFmpeg fallback)
- ✅ Standard mashup generation
- ✅ Stem-based mashups (vocals + instrumental)
- ✅ Auto DJ system with professional mixing features
- ✅ Intelligent mix-in point detection
- ✅ Harmonic mixing with Camelot wheel
- ✅ Two-pass loudnorm with QA verification and retry policy
- ✅ Rule-based planner with extensible rule packs
- ✅ Energy arc rules (rising, steady, wave profiles)
- ✅ Phrase safety rules for transition boundaries
- ✅ Genre compatibility rules for transition styles
- ✅ Resumable uploads with tus-js-client
- ✅ Cloudflare R2 storage integration
- ✅ Proper file cleanup on deletion

### Auto DJ Features
- ✅ Phrase-aligned transitions (8/16/32 bars)
- ✅ Energy modes (steady, build, wave)
- ✅ Event presets (wedding, birthday, club, etc.)
- ✅ Transition styles (smooth, drop, energy, cut)
- ✅ Cue point detection (mix-in, drop, breakdown, mix-out)
- ✅ Vocal collision detection
- ✅ Gain staging (loudness normalization)
- ✅ Filter sweeps (optional)
- ✅ Mix quality scoring
- ✅ Fallback mixing chain

### Future Enhancements
- Real-time waveform visualization
- Manual cue point editing
- Transition preview before full render
- User preference learning
- Collaborative mashup creation

## 📄 License

This project is private and proprietary.

---

**InfinityMix** - Professional DJ-quality mashups powered by AI 🎵
