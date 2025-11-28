# Multi-stage Dockerfile for InfinityMix Frontend App
FROM node:18-alpine AS base

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S infinitymix -u 1001

# Security: Install security updates and remove unnecessary packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Frontend app with Next.js
FROM base AS app
WORKDIR /app

# Copy app files and install dependencies
COPY app/package*.json ./
RUN npm ci --ignore-scripts
COPY app/ .

# Set ownership to non-root user
RUN chown -R infinitymix:nodejs /app
USER infinitymix

# Install drizzle CLI for database operations
RUN npm install -g drizzle-kit

# Environment variables for security
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
