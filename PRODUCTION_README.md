# Production Deployment

InfinityMix is production-ready with comprehensive setup for cloud deployment.

## Quick Deploy Options

### 1. Vercel (Recommended)
```bash
cd app
npm install -g vercel
vercel login
vercel --prod
```

### 2. Railway
```bash
cd app
npm install -g @railway/cli
railway login
railway deploy
```

## Environment Variables

Copy `.env.production.example` to `.env.production.local` and configure:

```bash
# Required
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-32-char-secret"
BETTER_AUTH_SECRET="your-32-char-secret"
NEXTAUTH_URL="https://your-domain.vercel.app"
BETTER_AUTH_URL="https://your-domain.vercel.app"

# Optional (cloud storage)
AWS_ACCESS_KEY_ID="your-key"
AWS_SECRET_ACCESS_KEY="your-secret"
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="your-bucket"
```

## Database Setup

1. **Neon (Recommended)**
   - Go to [neon.tech](https://neon.tech)
   - Create new project
   - Copy connection string to `DATABASE_URL`

2. **Run Schema:**
   ```bash
   psql YOUR_DATABASE_URL -f schema.sql
   ```

## Storage Setup

1. **AWS S3**
   - Create S3 bucket
   - Create IAM user with programmatic access
   - Add AWS credentials to environment variables

2. **Alternative:** Google Cloud Storage

## Post-Deployment Checklist

- [ ] Database connection working
- [ ] File uploads successful
- [ ] Authentication flows working
- [ ] Health check passing: `/api/health`

## Monitoring

- Enable Sentry for error tracking (add SENTRY_DSN)
- Monitor `/api/health` endpoint
- Check Vercel/Railway logs regularly

## Build Commands

```bash
npm run build      # Production build
npm start          # Start production server
```

Full guide: See `DEPLOYMENT.md`
