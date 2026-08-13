# ─────────────────────────────────────────────────────────────────────────────
# Prism Server — Full-Stack Docker Image
#
# Three build stages:
#   1. frontend-builder  — Node 22 + pnpm, compiles React → /dist
#   2. backend-builder   — Rust 1.80, compiles Axum binary
#   3. runtime           — Debian slim, ships binary + static dist
#
# The Rust backend serves the React build via WEB_STATIC_DIR.
# Users access the full UI at http://<host>:8269 — one process, one port.
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Frontend Build ───────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder

RUN npm install -g pnpm@9

WORKDIR /build/frontend

# Copy manifests first for layer caching
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy full frontend source
COPY frontend/ ./

# VITE_API_BASE is intentionally empty — the browser resolves API calls
# against the page origin (same host:port), so no hardcoded URL is needed.
ENV VITE_API_BASE=""
RUN pnpm run build


# ── Stage 2: Rust Backend Build ───────────────────────────────────────────────
FROM rust:1.80-slim-bookworm AS backend-builder

WORKDIR /build/backend

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend_rust/ ./
RUN cargo build --release


# ── Stage 3: Runtime Image ────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

LABEL org.opencontainers.image.title="Prism Server" \
      org.opencontainers.image.description="Privacy-first photo & video library — full-stack self-hosted Docker image" \
      org.opencontainers.image.source="https://github.com/yourusername/prism"

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    sqlite3 \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Rust binary
COPY --from=backend-builder /build/backend/target/release/prism-backend-rust /app/prism-server

# React production build — served as static files by Axum's fallback handler
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist

# Persistent data directories (overridden by volume mounts at runtime)
RUN mkdir -p /data/uploads /data/thumbnails /data/models /data/db

ENV HOST=0.0.0.0 \
    PORT=8269 \
    DATABASE_URL=sqlite:///data/db/prism.db \
    UPLOAD_DIR=/data/uploads \
    THUMBNAILS_DIR=/data/thumbnails \
    MODELS_DIR=/data/models \
    # Points Axum's static-file fallback at the bundled React build
    WEB_STATIC_DIR=/app/frontend/dist \
    GPU_MODE=cpu \
    RUST_LOG=info

EXPOSE 8269

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/prism-server"]
