# 🚀 InfinityMix Production Deployment Guide

## Overview
This guide covers deploying the InfinityMix MVP to production with real database, cloud storage, and monitoring.

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (recommended: Neon or Railway)
- Cloud storage account (AWS S3 or Google Cloud Storage)
- Domain name (optional)
- Vercel/Railway account for hosting

---

## 1. Database Setup (PostgreSQL)

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to environment variables as `DATABASE_URL`

### Option B: Railway
1. Go to [railway.app](https://railway.app)
2. Create new PostgreSQL service
3. Get connection string from service variables
4. Add to environment variables

### Database Schema Setup
Once you have the database, run the schema:

```bash
# Connect to your database and run:
psql YOUR_DATABASE_URL -f schema.sql
```

---

## 2. Cloud Storage Setup

### Option A: AWS S3 (Recommended)
1. Create AWS account if needed
2. Go to S3 service in AWS Console
3. Create new bucket:
   - Bucket name: `infinitymix-uploads-prod` (unique)
   - Region: us-east-1 (or closest to your users)
   - Block public access: ✓ (checked)
4. Create IAM user with programmatic access:
   - Policy: `AmazonS3FullAccess` (for now)
   - Save Access Key ID and Secret Access Key
5. Add to environment variables:
   ```
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   AWS_BUCKET_NAME=your-bucket-name
   ```

### Option B: Google Cloud Storage
1. Create GCP project
2. Enable Cloud Storage API
3. Create storage bucket
4. Create service account key
5. Add environment variables accordingly

---

## 3. Environment Variables

Create production environment variables in your hosting platform:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/infinitymix"

# Auth (Generate secure secrets)
NEXTAUTH_SECRET="your-secure-nextauth-secret-32-chars"
NEXTAUTH_URL="https://your-domain.vercel.app"
BETTER_AUTH_SECRET="your-secure-better-auth-secret-32-chars"
BETTER_AUTH_URL="https://your-domain.vercel.app"

# Storage
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="infinitymix-uploads-prod"

# Services (when ready)
AUDIO_PROCESSING_SERVICE_URL="https://your-api.com"

# Monitoring
SENTRY_DSN="your-sentry-dsn-for-error-tracking"
```

---

## 4. Production Deployment

### Option A: Vercel (Recommended for Next.js)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from app directory**:
   ```bash
   cd infinitymix/app
   vercel --prod
   ```

4. **Add environment variables**:
   - Go to Vercel dashboard
   - Project Settings → Environment Variables
   - Add all variables from step 3

5. **Retry deployment**:
   ```bash
   vercel --prod
   ```

### Option B: Railway (Full-stack)

1. **Install Railway CLI**:
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. **Deploy app and database**:
   ```bash
   cd infinitymix/app
   railway deploy
   ```

3. **Add environment variables** in Railway dashboard

---

## 5. Database Migrations (Drizzle)

For production, ensure migrations are properly handled:

```bash
# Generate migration (if schema changes)
npm run db:generate

# Run migration on production
npm run db:migrate
```

---

## 6. Monitoring & Error Tracking

### Sentry Setup
1. Create account at [sentry.io](https://sentry.io)
2. Create new Next.js project
3. Install Sentry SDK:
   ```bash
   npm install @sentry/nextjs
   ```
4. Add `SENTRY_DSN` to environment variables
5. Follow Sentry integration guide for Next.js

### Basic Monitoring
Add these to your Vercel dashboard for health checks:
- `/api/health` endpoint
- SSL certificate monitoring
- Response time alerts

---

## 7. Post-Deployment Checklist

- [ ] Database connection working
- [ ] File uploads to cloud storage successful
- [ ] Authentication flows working
- [ ] All API endpoints responding
- [ ] Error tracking reporting issues
- [ ] SSL certificate active
- [ ] Custom domain configured (if applicable)
- [ ] Performance tests pass
- [ ] Security headers configured

---

## 8. Performance Optimization

### Production Build
```bash
cd infinitymix/app
npm run build
```

### CDN Configuration
- Static assets served via Vercel's Edge Network
- Consider Cloudflare for additional caching

### Database Optimization
- Monitor query performance
- Add indexes as needed
- Consider connection pooling

---

## 9. Security Considerations

- [ ] Review and restrict AWS S3 bucket policies
- [ ] Enable database SSL
- [ ] Rotate secrets periodically
- [ ] Set up rate limiting
- [ ] Enable security headers (CSP, HSTS)
- [ ] Regular security audits

---

## 10. Backup & Recovery

### Database Backups
- Neon: Automatic backups enabled
- Railway: Configure regular backups
- Custom: Set up pg_dump scripts

### File Storage Backups
- AWS S3: Enable versioning
- Consider cross-region replication

---

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure URL format is correct
2. **File Uploads**: Check S3 bucket permissions
3. **Build Errors**: Verify all environment variables are set
4. **Auth Issues**: Check NEXTAUTH_URL matches deployment domain

### Logs & Debugging
```bash
# Vercel logs
vercel logs

# Railway logs
railway logs
```

---

## Support

- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Railway: [docs.railway.app](https://docs.railway.app)
- Neon: [neon.tech/docs](https://neon.tech/docs)
- AWS S3: [docs.aws.amazon.com/s3](https://docs.aws.amazon.com/s3)

---

🚀 **Your InfinityMix will be live and production-ready!**
