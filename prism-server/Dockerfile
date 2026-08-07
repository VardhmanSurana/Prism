# Multi-stage Dockerfile for Prism Companion Server
# Stage 1: Builder
FROM rust:1.80-slim-bookworm AS builder

WORKDIR /usr/src/app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend source code
COPY backend_rust ./backend_rust

# Build release binary
WORKDIR /usr/src/app/backend_rust
RUN cargo build --release

# Stage 2: Runtime
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    sqlite3 \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary from builder
COPY --from=builder /usr/src/app/backend_rust/target/release/prism-backend-rust /app/prism-server

# Set default environment variables
ENV HOST=0.0.0.0 \
    PORT=8269 \
    DATABASE_URL=sqlite:///data/prism.db \
    UPLOAD_DIR=/data/uploads \
    THUMBNAILS_DIR=/data/thumbnails \
    MODELS_DIR=/data/models

# Create persistent data directories
RUN mkdir -p /data/uploads /data/thumbnails /data/models

# Expose server port
EXPOSE 8269

# Persistent volume
VOLUME ["/data"]

# HTTP Healthcheck definition
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8269/health || exit 1

# Entrypoint
ENTRYPOINT ["/app/prism-server"]
