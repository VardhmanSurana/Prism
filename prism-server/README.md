<div align="center">

# Prism Server

**Full-stack self-hosted photo & video library — React UI + Rust API in a single Docker container**

[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-24-2496ED.svg)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL+FTS5-003B57.svg)](https://www.sqlite.org/)

*Deploy once. Access the full Prism UI from any browser on your network — phone, tablet, laptop, desktop. No app install required.*

</div>

---

## How it works

The Dockerfile uses three build stages so the final image only contains what's needed at runtime:

```
Stage 1: node:22-slim
  └── pnpm build → /build/frontend/dist  (React production bundle)

Stage 2: rust:1.80-slim-bookworm
  └── cargo build --release → prism-backend-rust binary

Stage 3: debian:bookworm-slim
  ├── /app/prism-server        ← Axum binary
  ├── /app/frontend/dist/      ← React build (served as static files)
  └── /data/                   ← Volume: DB · uploads · thumbnails · models
```

The Rust backend serves the React build from `WEB_STATIC_DIR`. All routes not matched by the API fall through to `index.html`, so React Router works normally.

```
Browser (any device on the network)
  └── http://<server-ip>:8269
        └── Docker container
              ├── /api/v1/*      → Axum REST handlers
              ├── /thumbnails/*  → static file serve
              └── /*             → /app/frontend/dist/index.html
```

---

## Quick Start

### 1. Configure

```bash
cd prism-server
cp .env.example .env
```

Set a strong `JWT_SECRET` in `.env`:

```bash
# Paste the output into .env as JWT_SECRET=<value>
openssl rand -hex 32
```

### 2. Build and start

```bash
docker compose up -d --build
```

### 3. Open

**http://localhost:8269** — or `http://<server-ip>:8269` from any device on the network.

Default credentials: **admin / admin123** — change this immediately in Settings.

---

## Common Commands

```bash
# Start (detached, rebuild image if source changed)
docker compose up -d --build

# Start without rebuilding
docker compose up -d

# Stop (data volumes preserved)
docker compose down

# Force full image rebuild from scratch
docker compose build --no-cache

# Follow logs
docker compose logs -f

# Last 100 lines of logs
docker compose logs --tail=100

# Container status
docker compose ps

# Live resource usage
docker stats prism-server

# Health check
curl http://localhost:8269/health

# Open a shell inside the running container
docker exec -it prism-server bash

# Restart the container
docker compose restart
```

---

## GPU Acceleration (NVIDIA)

For GPU-accelerated AI inference (face detection, semantic search, OCR):

```bash
# 1. Install nvidia-container-toolkit on the host
#    https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# 2. Verify it works
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# 3. Start with the GPU override file
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

---

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|---|---|---|
| `PRISM_PORT` | `8269` | Host port to expose |
| `JWT_SECRET` | *(must change)* | Secret for auth tokens |
| `API_KEY` | *(empty)* | Optional `X-API-Key` header enforcement |
| `GPU_MODE` | `cpu` | `cpu` or `cuda` |
| `RUST_LOG` | `info` | Log verbosity |

### Mounting your own media folder

To index an existing photos folder on the host instead of using a Docker volume, edit `docker-compose.yml`:

```yaml
volumes:
  # Replace:
  - prism_uploads:/data/uploads
  # With:
  - /path/to/your/photos:/data/uploads
```

---

## Backup & Restore

### Backup

Reads directly from Docker volumes — container can keep running:

```bash
docker run --rm \
  --volumes-from prism-server \
  -v $(pwd):/backup \
  debian:bookworm-slim \
  tar czf /backup/prism-backup-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

### Restore

```bash
# Stop the container first
docker compose down

# Restore into the volumes
docker run --rm \
  -v prism-server_prism_db:/data/db \
  -v prism-server_prism_uploads:/data/uploads \
  -v prism-server_prism_thumbnails:/data/thumbnails \
  -v prism-server_prism_models:/data/models \
  -v $(pwd)/prism-backup.tar.gz:/backup/archive.tar.gz \
  debian:bookworm-slim \
  tar xzf /backup/archive.tar.gz -C /data

# Restart
docker compose up -d
```

---

## Accessing from the Network

### Find your server IP

```bash
# Linux
ip addr show | grep 'inet ' | grep -v 127.0.0.1

# macOS
ipconfig getifaddr en0
```

### Open firewall (if needed)

```bash
# Ubuntu/Debian
sudo ufw allow 8269/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=8269/tcp --permanent && sudo firewall-cmd --reload
```

| Device | URL |
|---|---|
| Same machine | http://localhost:8269 |
| Any LAN device | http://192.168.x.x:8269 |
| Custom domain | https://photos.yourdomain.com |

---

## Reverse Proxy

**Caddy** (automatic HTTPS):
```
photos.yourdomain.com {
    reverse_proxy localhost:8269
}
```

**Nginx:**
```nginx
server {
    listen 443 ssl;
    server_name photos.yourdomain.com;

    location / {
        proxy_pass http://localhost:8269;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 0;       # no upload size limit
        proxy_buffering off;          # required for SSE event stream
        proxy_read_timeout 3600s;
    }
}
```

---

## Troubleshooting

**Port already in use:**
```bash
# Change PRISM_PORT in .env, then restart
docker compose down && docker compose up -d
```

**Can't connect from another device:**
```bash
# 1. Check the server is running
curl http://localhost:8269/health
# 2. Check firewall (see above)
# 3. Use the server's LAN IP — not localhost — from the other device
```

**Blank page after opening:**
```bash
# Verify the React build was copied into the image
docker exec prism-server ls /app/frontend/dist
# Should show: index.html  assets/  ...
```

**Database errors on startup:**
```bash
docker compose logs --tail=50
# Common cause: stale lock file from a previous crash
docker compose down && docker compose up -d
```

**Clean slate (removes all data):**
```bash
docker compose down -v   # -v removes named volumes too
docker compose up -d --build
```

---

## Resource Requirements

| Library size | RAM | Storage |
|---|---|---|
| < 10K photos | 1 GB | 20 GB |
| 10K–50K | 2 GB | 100 GB |
| 50K+ | 4 GB | 500 GB+ |
