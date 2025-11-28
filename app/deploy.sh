#!/bin/bash

# InfinityMix Production Deployment Script
# This script helps prepare and deploy the application to production

set -e

echo "🚀 InfinityMix Production Deployment Setup"
echo "=========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the app directory"
    echo "   Usage: cd app && ./deploy.sh"
    exit 1
fi

# Dependencies installed?
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
else
    echo "   ✅ Dependencies already installed"
fi

# Build check
echo "🏗️  Testing production build..."
npm run build
if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
else
    echo "   ❌ Build failed - fix errors before deploying"
    exit 1
fi

# Environment check
echo "🔧 Checking environment setup..."
if [ -z "$DATABASE_URL" ] && [ ! -f ".env.production.local" ]; then
    echo "   ⚠️  No production environment found"
    echo ""
    echo "   Before deploying, you must:"
    echo "   1. Set up a PostgreSQL database (Neon/Railway recommended)"
    echo "   2. Copy .env.production.example to .env.production.local"
    echo "   3. Fill in your production environment variables"
    echo "   4. Run: export NODE_ENV=production"
    echo ""
    echo "   See DEPLOYMENT.md for detailed instructions"
    echo ""
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "   Deployment cancelled"
        exit 1
    fi
else
    echo "   ✅ Environment configuration found"
fi

# Git check
echo "📋 Git status:"
git status --porcelain
echo ""

if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes"
    read -p "   Commit them before deploying? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Production deployment - $(date)"
        echo "   ✅ Changes committed"
    fi
fi

# Deployment options
echo ""
echo "🚀 Choose deployment method:"
echo "   1) Vercel (recommended for Next.js)"
echo "   2) Railway (full-stack)"
echo "   3) Manual (view deployment guide)"
echo ""
read -p "   Select option (1-3): " -n 1 -r
echo ""

case $REPLY in
    1)
        echo "🌐 Deploying to Vercel..."
        if ! command -v vercel &> /dev/null; then
            echo "   Installing Vercel CLI..."
            npm install -g vercel
        fi
        
        echo "   📝 You'll need to:"
        echo "   a) Login to Vercel: vercel login"
        echo "   b) Deploy with: vercel --prod"
        echo "   c) Configure environment variables in Vercel dashboard"
        echo ""
        echo "   Deploying now..."
        vercel --prod
        ;;
    2)
        echo "🚂 Deploying to Railway..."
        if ! command -v railway &> /dev/null; then
            echo "   Installing Railway CLI..."
            npm install -g @railway/cli
        fi
        
        echo "   📝 You'll need to:"
        echo "   a) Login to Railway: railway login"
        echo "   b) Deploy with: railway deploy"
        echo "   c) Configure environment variables in Railway dashboard"
        echo ""
        echo "   Deploying now..."
        railway deploy
        ;;
    3)
        echo "📖 Opening deployment guide..."
        if command -v xdg-open &> /dev/null; then
            xdg-open DEPLOYMENT.md
        elif command -v open &> /dev/null; then
            open DEPLOYMENT.md
        else
            echo "   See DEPLOYMENT.md for manual deployment instructions"
        fi
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Post-deployment checklist:"
echo "   □ Verify database connection"
echo "   □ Test file uploads to cloud storage"
echo "   □ Check authentication flows"
echo "   □ Test audio upload and mashup generation"
echo "   □ Set up monitoring and error tracking"
echo "   □ Configure custom domain (optional)"
echo ""
echo "🔍 Health check: https://your-domain.vercel.app/api/health"
echo ""
echo "🎉 InfinityMix is ready for production!"
