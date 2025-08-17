FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    sox \
    curl \
    wget \
    git \
    bash \
    sqlite \
    tini \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NPM_CONFIG_LOGLEVEL=warn

# Install server dependencies
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Install and build client
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install --no-audit --no-fund && \
    npm cache clean --force

COPY client/ ./
RUN npm run build

# Copy server code
WORKDIR /app
COPY server/ ./server/
COPY mock/ ./mock/

# Create directories
RUN mkdir -p data logs uploads downloads processed temp credentials backups shorts thumbnails && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/data /app/logs /app/uploads /app/downloads /app/processed /app/temp /app/credentials /app/backups /app/shorts /app/thumbnails

USER appuser
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]
