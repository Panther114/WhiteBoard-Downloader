# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Playwright to use system chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy .env.example as reference
COPY .env.example ./

# Create directories for downloads and logs
RUN mkdir -p /app/downloads /app/logs

# Set environment variables for container
ENV NODE_ENV=production
ENV DOWNLOAD_DIR=/app/downloads
ENV LOG_FILE=/app/logs/whiteboard.log
ENV DATABASE_PATH=/app/whiteboard.db

# Default command
CMD ["node", "dist/cli.js", "download"]
