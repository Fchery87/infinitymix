FROM node:18-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
RUN npm ci
COPY . .
RUN mkdir -p logs
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS prod
COPY . .
RUN npm run build
RUN mkdir -p logs
ENV NODE_ENV=production
VOLUME ["/app/logs"]
CMD ["npm", "start"]
