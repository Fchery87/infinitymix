# 🚀 InfinityMix Production Deployment Guide

## Architecture Overview
InfinityMix uses a **simplified frontend-first architecture** with:
- **Next.js 14** frontend with embedded API routes (`/api/*`)
- **Drizzle ORM** with PostgreSQL (Neon/Railway recommended)
- **Cloud Storage** (AWS S3 or Google Cloud) for audio files
- **Serverless-ready** design for Vercel/Railway deployment

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (Neon/Railway recommended)
- Cloud storage account (AWS S3 or Google Cloud Storage) - optional
- Domain name (optional)
- Vercel/Railway account for hosting

---

## 1. Database Setup (PostgreSQL with Drizzle ORM)

### Option A: Neon (Recommended)
1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string
4. Add to environment variables as `DATABASE_URL`

### Database Schema Setup
Run the Drizzle schema migrations:

```bash
cd app
npm run db:migrate
```

Or manually with SQL:
```bash
psql YOUR_DATABASE_URL -f schema.sql
```

---

## 2. Cloud Storage Setup (Optional - Mock storage works for testing)

### Option A: AWS S3 (Recommended)
1. Create AWS account if needed
2. Go to S3 service in AWS Console
3. Create new bucket
4. Create IAM user with programmatic access
5. Add AWS credentials to environment variables

---

## 3. Environment Variables

Create production environment variables in your hosting platform:

```bash
# Database (Required)
DATABASE_URL="postgresql://user:password@host:5432/infinitymix"

# Auth (Required - Generate secure secrets)
NEXTAUTH_SECRET="your-very-secure-nextauth-secret-32-chars"
BETTER_AUTH_SECRET="your-very-secure-better-auth-secret-32-chars"
NEXTAUTH_URL="https://your-domain.vercel.app"
BETTER_AUTH_URL="https://your-domain.vercel.app"

# Storage (Optional)
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="us-east-1"
AWS_BUCKET_NAME="infinitymix-uploads-prod"

# Services
AUDIO_PROCESSING_SERVICE_URL="https://your-api.com"
SENTRY_DSN="your-sentry-dsn-for-error-tracking"
```

---

## 4. Production Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Deploy from app directory**:
   ```bash
   cd app
   vercel --prod
   ```

3. **Add environment variables** in Vercel dashboard

4. **Set up database**:
   ```bash
   vercel env pull
   npm run db:migrate
   ```

### Railway (Alternative)

1. **Deploy**:
   ```bash
   cd app
   npm i -g @railway/cli
   railway deploy
   ```

2. **Configure PostgreSQL** in Railway dashboard

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

---

## 5. Monitoring & Health Checks

### Built-in Health Check
- **Endpoint**: `/api/health`
- **Returns**: Status, database connection, storage test, memory usage

### Error Monitoring (Optional)
1. Create Sentry project
2. Add `SENTRY_DSN` to environment variables
3. Install Sentry SDK: `npm install @sentry/nextjs`

---

## 6. Post-Deployment Checklist

- [ ] Database connection working (check `/api/health`)
- [ ] Drizzle migrations applied successfully
- [ ] Environment variables configured
- [ ] File uploads working (S3 or mock)
- [ ] Authentication flows working
- [ ] Audio upload and mashup generation working
- [ ] SSL certificate active
- [ ] Custom domain configured (if applicable)

---

## 7. Security Considerations

- **Authentication**: Better Auth with JWT tokens
- **Database**: Drizzle ORM with SQL injection protection
- **File Uploads**: Size limits, type validation, cloud storage
- **Environment Variables**: All secrets in platform env vars
- **HTTPS**: Automatic SSL on Vercel/Railway
- **Security Headers**: Configured in Next.js

---

## 8. Troubleshooting

### Common Issues
1. **Database Connection**: Check DATABASE_URL format
2. **Drizzle Migrations**: Run `npm run db:migrate`
3. **Build Errors**: Verify all environment variables
4. **Auth Issues**: Check NEXTAUTH_URL matches deployment domain

### Health Check URL
Always available at: `https://your-domain.vercel.app/api/health`

---

## Architecture Benefits

✅ **Single Deployment**: Just deploy the Next.js app  
✅ **Drizzle ORM**: Type-safe, modern database access  
✅ **Integrated API**: Routes in `/api/*` - no separate backend  
✅ **Serverless Ready**: Perfect for Vercel/Railway  
✅ **Simplified**: No microservice complexity for MVP  

---

🚀 **Your InfinityMix with Drizzle ORM is ready for production!**
