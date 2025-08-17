# =============================================================================
# YouTube Automation Platform - Production Docker Image
# Multi-stage build optimized for Hetzner Cloud deployment
# =============================================================================

# Stage 1: Base image with system dependencies
FROM node:18-alpine AS base

# Install system dependencies for audio/video processing and security
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    sox \
    curl \
    wget \
    git \
    bash \
    dumb-init \
    tini \
    sqlite \
    && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Set working directory
WORKDIR /app

# Stage 2: Dependencies installation
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install production dependencies only
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Install client production dependencies
RUN cd client && \
    npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Stage 3: Build stage with dev dependencies
FROM base AS builder

# Copy package files and install all dependencies
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies (including dev)
RUN npm ci --no-audit --no-fund
RUN cd client && npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the React frontend
RUN cd client && npm run build

# Remove dev dependencies from server
RUN npm prune --production

# Stage 4: Production runtime
FROM base AS runner

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NODE_OPTIONS="--max-old-space-size=2048"

# Create application directories with proper permissions
RUN mkdir -p \
    /app/data \
    /app/logs \
    /app/uploads \
    /app/downloads \
    /app/processed \
    /app/temp \
    /app/credentials \
    /app/backups \
    /app/shorts \
    /app/thumbnails && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Set working directory
WORKDIR /app

# Copy production dependencies
COPY --from=deps --chown=appuser:appuser /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=appuser:appuser /app/server ./server
COPY --from=builder --chown=appuser:appuser /app/client/build ./client/build
COPY --from=builder --chown=appuser:appuser /app/package*.json ./
COPY --from=builder --chown=appuser:appuser /app/mock ./mock

# Copy additional configuration files if they exist
COPY --from=builder --chown=appuser:appuser /app/.env.example ./.env.example

# Ensure all files have correct permissions
USER root
RUN chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/data /app/logs /app/uploads /app/downloads /app/processed /app/temp
USER appuser

# Expose application port
EXPOSE 3000

# Add comprehensive health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "server/index.js"]
