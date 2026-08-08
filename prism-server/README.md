<div align="center">

# Prism Server

**Docker-containerized backend for Prism — deploy your photo library server on any machine or NAS**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](../prism-desktop/LICENSE)
[![Rust](https://img.shields.io/badge/Rust-2021-orange.svg)](https://www.rust-lang.org/)
[![Docker](https://img.shields.io/badge/Docker-24-2496ED.svg)](https://www.docker.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL+FTS5-003B57.svg)](https://www.sqlite.org/)

*Run the Prism backend as a Docker container — perfect for headless servers, NAS devices, or home labs. Connect from Prism Desktop or Prism Mobile.*

[Quick Start](#-quick-start) • [Features](#-features) • [Configuration](#%EF%B8%8F-configuration) • [Contributing](#-contributing)

</div>

---

## What is Prism Server?

Prism Server is a Dockerized version of the [Prism Desktop](../prism-desktop/) backend, designed for headless deployment on:

- **Home servers** — Run on a dedicated machine always-on
- **NAS devices** — Deploy on Synology, QNAP, or custom NAS
- **Raspberry Pi** — Lightweight enough for ARM devices
- **Cloud VPS** — Deploy on any cloud provider
- **Docker hosts** — Integrate with existing Docker infrastructure

It provides the same AI-powered photo library backend as Prism Desktop, but packaged as a portable, self-contained Docker container.

## ✨ Features

### 🖥️ Headless Server
- **No GUI Required** — Runs without a display or desktop environment
- **Always-On** — Persistent service with automatic restart
- **Remote Access** — Connect from any device on your network
- **Multi-Client** — Support multiple simultaneous connections

### 🐳 Docker Deployment
- **Multi-Stage Build** — Optimized image size (~200MB final)
- **Health Checks** — Built-in HTTP health endpoint
- **Persistent Storage** — Volume mounts for database and media
- **Environment Config** — All settings via environment variables
- **One-Command Start** — `docker compose up -d`

### 🤖 AI-Powered Backend
- **Face Detection** — In-process face detection and recognition
- **Semantic Search** — SigLIP2 embeddings for similarity search
- **OCR Text Extraction** — PaddleOCR for text in images
- **Object Detection** — Automatic tagging and categorization
- **Auto-Enhancement** — AI-powered photo improvements

### 📡 LAN Sync
- **Peer Discovery** — Automatic discovery of other Prism instances
- **Device Pairing** — Secure pairing with PIN verification
- **Photo Sync** — Sync photos between devices over LAN
- **Manifest API** — Efficient batch metadata transfer

### 🔒 Privacy-First
- **Local Storage** — All data stored in Docker volumes
- **No Cloud** — Zero external dependencies
- **Encrypted Folder** — Argon2id-encrypted private storage
- **Optional Auth** — API key protection for endpoints

## 🚀 Quick Start

### Prerequisites

- **Docker** (v20.10+) — [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (v2.0+) — [Install Compose](https://docs.docker.com/compose/install/)
- **ffmpeg** — Required for video processing (included in container)

### One-Command Start

```bash
# Clone the repository
git clone https://github.com/yourusername/prism.git
cd prism/prism-server

# Start the server
./run-server-docker.sh up
```

Or using Docker Compose directly:

```bash
docker compose up -d --build
```

The server will be available at `http://localhost:8269`.

### Verify Health

```bash
# Check server status
curl http://localhost:8269/health

# Or use the convenience script
./run-server-docker.sh status
```

### Connect Clients

Once the server is running, connect from:

- **Prism Desktop** — Point to `http://<server-ip>:8269`
- **Prism Mobile** — Pair using the server IP and PIN (default: `8269`)
- **CLI** — Use `prism-cli` with `--server http://<server-ip>:8269`

## 📁 Data Persistence

The Docker container uses a named volume for persistent storage:

```
prism_data/
├── prism.db          # SQLite database
├── uploads/          # Original media files
├── thumbnails/       # Generated thumbnails
└── models/           # ML model files
```

### Backup

```bash
# Backup the data volume
docker run --rm -v prism_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/prism-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restore from backup
docker run --rm -v prism_data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/prism-backup-YYYYMMDD.tar.gz -C /data
```

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind host address |
| `PORT` | `8269` | Server port |
| `DATABASE_URL` | `sqlite:///data/prism.db` | SQLite database path |
| `UPLOAD_DIR` | `/data/uploads` | Media upload directory |
| `THUMBNAILS_DIR` | `/data/thumbnails` | Thumbnail storage directory |
| `MODELS_DIR` | `/data/models` | ML model files directory |
| `GPU_MODE` | `cpu` | GPU mode: `cpu`, `cuda`, `metal` |
| `RUST_LOG` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `API_KEY` | *(empty)* | Optional API key for authentication |

### GPU Acceleration

For NVIDIA GPU support:

```yaml
# docker-compose.yml
services:
  prism-server:
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - GPU_MODE=cuda
```

### Custom Ports

To run on a different port:

```yaml
# docker-compose.yml
services:
  prism-server:
    ports:
      - "9000:8269"  # Map host port 9000 to container port 8269
```

Then access at `http://localhost:9000`.

### NAS Deployment

**Synology NAS:**
1. Open Docker package
2. Go to "Image" → "Add" → "Build"
3. Set build context to the `prism` repository root
4. Set Dockerfile path to `prism-server/Dockerfile`
5. Create container with volume mappings

**QNAP NAS:**
1. Open Container Station
2. Import the Dockerfile or use docker-compose.yml
3. Map volumes to shared folders

## 🔗 Connection with Prism Ecosystem

Prism Server is part of the larger Prism ecosystem:

```
┌─────────────────────────────────────────────────┐
│              Prism Server (Docker)               │
│              Port: 8269                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Axum    │  │  SQLite  │  │  ML Models    │  │
│  │  Backend │  │  (WAL)   │  │  (ONNX)       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└────────────────────┬────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│  Prism   │  │  Prism   │  │  CLI     │
│  Desktop │  │  Mobile  │  │  Client  │
│  (Tauri) │  │  (PWA)   │  │  (Rust)  │
└──────────┘  └──────────┘  └──────────┘
```

### Supported Clients

| Client | Connection Method | Features |
|--------|-------------------|----------|
| **Prism Desktop** | Direct HTTP | Full access, editing, AI features |
| **Prism Mobile** | LAN pairing | Browse, upload, search, albums |
| **CLI** | HTTP + API key | Import, export, diagnostics |

### API Compatibility

Prism Server exposes the same REST API as Prism Desktop:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and status |
| `/api/v1/photos` | GET | List photos (paginated) |
| `/api/v1/photos/search?q=` | GET | Full-text search |
| `/api/v1/photos/upload` | POST | Upload photo/video |
| `/api/v1/albums` | GET | List all albums |
| `/api/v1/people` | GET | List detected people |
| `/api/v1/lan/discover` | GET | Discover LAN peers |
| `/api/v1/lan/peers/:id/pair` | POST | Pair with peer |
| `/api/v1/agent/chat` | POST | AI agent chat |

See [API Reference](../prism-desktop/docs/API.md) for complete documentation.

## 🛠️ Management Commands

The `run-server-docker.sh` script provides convenient commands:

```bash
# Start server (detached)
./run-server-docker.sh up

# Stop server
./run-server-docker.sh down

# Rebuild image
./run-server-docker.sh build

# View logs (follow mode)
./run-server-docker.sh logs

# Check status and health
./run-server-docker.sh status
```

### Docker Compose Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Remove everything (including volumes)
docker compose down -v
```

## 🔍 Troubleshooting

### Server Won't Start

```bash
# Check logs
docker compose logs prism-server

# Common issues:
# - Port 8269 already in use → change port mapping
# - Volume permissions → check Docker volume mounts
# - Database locked → ensure no other instance is running
```

### Can't Connect from Client

```bash
# 1. Verify server is running
curl http://localhost:8269/health

# 2. Check firewall rules
sudo ufw allow 8269/tcp  # Ubuntu
sudo firewall-cmd --add-port=8269/tcp  # CentOS

# 3. Verify LAN connectivity
ping <server-ip>
telnet <server-ip> 8269
```

### Performance Issues

```bash
# Check resource usage
docker stats prism-companion-server

# For large libraries, ensure:
# - Sufficient RAM (4GB+ recommended)
# - Fast storage (SSD for database)
# - GPU acceleration if using AI features
```

## 📊 Resource Requirements

| Library Size | RAM | Storage | CPU |
|--------------|-----|---------|-----|
| <10K photos | 1GB | 10GB | 2+ cores |
| 10K-50K photos | 2GB | 50GB | 4+ cores |
| 50K+ photos | 4GB+ | 100GB+ | 4+ cores |

## 🤝 Contributing

Contributions are welcome! Please follow the same guidelines as [Prism Desktop](../prism-desktop/CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch
3. Test with Docker Compose
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](../prism-desktop/LICENSE) file for details.

## 🙏 Acknowledgments

- [Prism Desktop](../prism-desktop/) — The main desktop application
- [Docker](https://www.docker.com/) — Container platform
- [Rust](https://www.rust-lang.org/) — Systems programming language
- [Axum](https://github.com/tokio-rs/axum) — Ergonomic web framework

---

<div align="center">

**Part of the [Prism](https://github.com/yourusername/prism) ecosystem**

[Prism Desktop](../prism-desktop/) • **Prism Server** • [Prism Mobile](../prism-mobile/)

</div>
