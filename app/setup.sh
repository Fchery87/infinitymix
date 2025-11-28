#!/bin/bash
# InfinityMix Quick Setup Script

echo "🎵 Setting up InfinityMix..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 14+ first."
    exit 1
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Setup environment file
if [ ! -f .env.local ]; then
    echo "⚙️  Creating .env.local file..."
    cp .env.local.example .env.local
    echo "✅ Please edit .env.local with your database configuration"
fi

# Create database
echo "🗄️  Setting up database..."
createdb infinitymix 2>/dev/null || echo "Database 'infinitymix' already exists"

# Run schema
if [ -f schema.sql ]; then
    echo "🔧 Applying database schema..."
    psql infinitymix < schema.sql
fi

# Start development server
echo "🚀 Starting development server..."
echo "Open http://localhost:3000 in your browser"
npm run dev
