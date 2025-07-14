# Multi-stage build for the AI Music Uploader project
FROM node:18-alpine AS base

# Install system dependencies for audio processing
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    sox \
    curl \
    git \
    bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/
COPY admin-panel/package*.json ./admin-panel/

# Install dependencies
RUN npm install
RUN cd client && npm install
RUN cd admin-panel && npm install

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# Copy source code
COPY . .

# Build the React client
RUN cd client && npm run build

# Create necessary directories
RUN mkdir -p data logs uploads downloads processed temp overlays credentials

# Set proper permissions
RUN chmod +x /app

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start command
CMD ["npm", "start"]
