# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install system dependencies for audio processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    sox \
    curl \
    git \
    bash \
    && rm -rf /var/cache/apk/*

# Create app directory and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

WORKDIR /app

# Stage 1: Dependencies
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force
RUN cd client && npm ci --only=production && npm cache clean --force

# Stage 2: Builder
FROM base AS builder

# Copy package files and install all deps (including dev)
COPY package*.json ./
COPY client/package*.json ./client/

RUN npm ci
RUN cd client && npm ci

# Copy source code
COPY . .

# Build the React client
RUN cd client && npm run build

# Stage 3: Production runtime
FROM base AS runner

# Set to production environment
ENV NODE_ENV=production
ENV PORT=3000

# Don't run as root
USER nodejs

WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/client/node_modules ./client/node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/server ./server
COPY --from=builder --chown=nodejs:nodejs /app/client/build ./client/build
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p data logs uploads downloads processed temp credentials && \
    chown -R nodejs:nodejs /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["node", "server/index.js"]
