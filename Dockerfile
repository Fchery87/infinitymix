# Multi-stage Dockerfile for InfinityMix Frontend App
FROM node:18-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Frontend app with Next.js
FROM base AS app
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ .
COPY ../node_modules ./node_modules
EXPOSE 3000

# Install Drizzle CLI for database operations
RUN npm install -g drizzle-kit

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the app
CMD ["npm", "start"]
