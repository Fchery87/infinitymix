FROM node:18-alpine AS base

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S worker -u 1001

# Install security updates and remove unnecessary packages
RUN apk update && \
    apk upgrade && \
    apk add --no-cache dumb-init && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# Install dependencies securely
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Set ownership
RUN chown -R worker:nodejs /app

# Development stage
FROM base AS dev
USER worker
RUN npm ci --ignore-scripts
COPY . .
RUN mkdir -p logs
ENV NODE_ENV=development
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS prod
USER worker
COPY . .
RUN npm run build
RUN mkdir -p logs
ENV NODE_ENV=production
VOLUME ["/app/logs"]
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
