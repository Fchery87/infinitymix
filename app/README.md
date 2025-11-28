# InfinityMix

An AI-powered web application that democratizes mashup creation by allowing users to upload audio files and generate professional-quality DJ-level mashups with minimal technical input.

## 🎯 Features

- **Smart Audio Analysis**: Automatic detection of BPM, key, beat grid, song sections, energy curves, and stem separation
- **AI-Powered Generation**: Create structured, on-beat, in-key mashups with duration presets
- **Simple Workflow**: Upload → Select Duration → Generate → Play/Download
- **User Management**: Secure authentication, profile management, and mashup history
- **Real-time Processing**: Live status updates for analysis and generation
- **Modern UI**: Clean, responsive interface built with Next.js 14 and Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 14.2.0 App Router + Tailwind CSS 3.4.3
- **Backend**: Next.js 14.2.0 API Routes with Server Actions  
- **Database**: PostgreSQL + Drizzle ORM 0.30.0 with Neon hosting ready
- **Authentication**: Better Auth 1.0.0 with JWT tokens
- **State Management**: TanStack Query 5.32.0 for server state
- **Validation**: Zod 3.23.0 + React Hook Form 7.51.0
- **Package Manager**: npm
- **Deployment**: Vercel (ready) and Railway backend services ready

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
│   ├── app/                    # Next.js app directory
│   │   ├── api/               # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── audio/        # Audio upload & management
│   │   │   ├── mashups/      # Mashup generation & retrieval
│   │   │   └── users/        # User profile management
│   │   ├── mashups/          # Mashups history page
│   │   ├── page.tsx          # Main upload/generation page
│   │   └── layout.tsx        # Root layout
│   ├── components/
│   │   ├── ui/               # Reusable UI components
│   │   └── forms/            # Form components
│   └── lib/
│       ├── auth/             # Authentication configuration
│       ├── db/               # Database schema and connections
│       └── utils/            # Helper functions and validation
├── drizzle.config.ts         # Drizzle ORM configuration
├── package.json
└── README.md
```

## 🔧 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/infinitymix"

# Better Auth
BETTER_AUTH_SECRET="your-better-auth-secret-here"
BETTER_AUTH_URL="http://localhost:3000"

# Storage (AWS S3 or similar)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="infinitymix-uploads"
```

## 🗄️ Database Schema

The application uses the following main tables:

- **users**: User accounts and profiles
- **uploaded_tracks**: Audio files metadata and analysis results  
- **mashups**: Generated mashup information
- **mashup_input_tracks**: Many-to-many relationship for mashup inputs
- **feedback**: User ratings and comments on mashups

## 🔌 API Endpoints

### Authentication
- `POST /api/auth` - User registration and login

### Users
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update user profile  
- `DELETE /api/users/me` - Delete user account

### Audio Files
- `POST /api/audio/pool` - Upload audio files
- `GET /api/audio/pool` - Get user's uploaded tracks
- `DELETE /api/audio/pool/[fileId]` - Remove a track

### Mashups
- `POST /api/mashups/generate` - Generate new mashup
- `GET /api/mashups` - List user's mashups
- `GET /api/mashups/[mashupId]` - Get mashup details
- `DELETE /api/mashups/[mashupId]` - Delete mashup
- `GET /api/mashups/[mashupId]/download` - Download mashup file
- `POST /api/mashups/[mashupId]/feedback` - Submit feedback

## 🎨 UI Components

The application includes reusable UI components in `src/components/ui/`:
- Button, Input, Card components with proper styling
- Form validation with react-hook-form + zod
- Audio upload interface with drag-and-drop
- Real-time status indicators
- Mashup playback controls

## 🔄 Development Workflow

## 📦 Build & Deploy

### Build for Production
```bash
npm run build
npm start
```

### Database Commands
```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Run migrations
npm run db:studio    # Open Drizzle Studio
```

### Linting
```bash
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

**1. Font Error: `Unknown font 'Geist'`**
- ✅ **Fixed**: Updated to use Inter font which is built into Next.js

**2. Next.js Version Compatibility**  
- ✅ **Fixed**: Using stable Next.js 14.2.0 with React 18.3.0 for maximum compatibility

**3. Missing UI Utilities**
- ✅ **Fixed**: All required packages (clsx, tailwind-merge, class-variance-authority) installed

**4. PostCSS Configuration Error**
- ✅ **Fixed**: Updated postcss.config.mjs to use correct `tailwindcss` and `autoprefixer` plugins

**5. Tailwind CSS Configuration Missing**
- ✅ **Fixed**: Created proper tailwind.config.js with content configuration
- ✅ **Fixed**: Updated globals.css to use correct @tailwind directives

**6. Development Server Not Starting**
- ✅ **Now Working**: Server starts successfully on http://localhost:3000 (or 3001 if 3000 occupied)
- ✅ **Page Loads**: GET / 200 - Application is fully accessible

## 🧪 Testing

The project is structured to support testing. Test files should be placed alongside their source files with `.test.ts` or `.spec.ts` extensions.

## 🔒 Security

- JWT tokens with 1-hour expiry
- Password hashing with bcrypt (cost factor 10+)
- HTTPS-only communication in production
- Input validation on client and server
- Audit logging for authentication events

## 🚨 Important Notes

### Current Implementation Status (MVP)

The current implementation provides:
- ✅ Complete user authentication system
- ✅ Audio file upload and mock analysis
- ✅ Mashup generation workflow
- ✅ User interface for all major features
- ✅ API endpoints for all functionality
- ✅ Basic error handling and validation

### Areas for Future Enhancement

1. **Real Audio Processing**: Integration with actual audio analysis and generation services
2. **Cloud Storage**: Implement real file storage (vs. mock URLs)
3. **Advanced AI Integration**: Real mashup generation algorithms
4. **Enhanced UI**: More interactive features and better user feedback
5. **Performance Optimization**: Caching, CDN integration, database optimization
6. **Additional Features**: Multiple mashup variants, style controls, advanced editing

### Production Deployment Considerations

1. Set up a real PostgreSQL instance (recommend: Neon or Railway)
2. Configure proper cloud storage (AWS S3, Google Cloud Storage)
3. Implement real audio processing pipeline
4. Set up monitoring and logging
5. Configure proper environment variables and secrets management

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a proof-of-concept implementation. For contributions or questions, please follow the project's established development guidelines.

---

**InfinityMix** - Democratizing mashup creation with AI 🎵✨
