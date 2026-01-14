# Use the official Bun image
FROM oven/bun:1.2.22

# Install system dependencies for pdf2pic (ImageMagick, GraphicsMagick and Ghostscript)
RUN apt-get update && apt-get install -y \
    imagemagick \
    graphicsmagick \
    ghostscript \
    poppler-utils \
    curl \
    && apt-get install --only-upgrade -y gpgv "libpam*" \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code and additional files
COPY src/ ./src/
COPY index.ts server.ts package.json tsconfig.json ./
COPY instrument.js ./
COPY gcs-key.json* ./

# Create directories for persistent data storage
RUN mkdir -p data/uploads data/output

# Set environment variables (Railway will provide PORT dynamically)
ENV NODE_ENV=production
# Enable garbage collection expose flag for memory optimization
ENV NODE_OPTIONS="--expose-gc --max-old-space-size=4096"

# Health check for Railway (use PORT env var with fallback)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start the server
CMD ["bun", "run", "start"]
