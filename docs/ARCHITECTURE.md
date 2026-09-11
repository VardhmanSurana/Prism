# Architecture

Prism is a privacy-first, local-only desktop photo and video library application. This document describes the system architecture, design decisions, and data flow.

## Overview

<p align="center">
  <img src="diagrams/system-architecture.svg" alt="Prism System Architecture" width="100%" />
</p>

## Core Design Principles

### 1. Local-first
All data stays on the user's machine. No cloud dependencies, no external API calls for core features. The application works completely offline.

### 2. Desktop-native
Tauri v2 provides a lightweight, secure native shell. The frontend runs in a WebView, while the backend is a native Rust process.

### 3. High-performance Backend
Rust (Axum) runs as the core backend with in-process ONNX/ML inference. The backend handles all media processing, database operations, and AI tasks.

### 4. SQLite WAL + FTS5
Write-Ahead Logging for concurrent read/write performance, with full-text search for fast photo discovery.

### 5. REST API
Frontend communicates with backend via HTTP REST API. This enables web mode (browser) and desktop mode (Tauri) with the same backend.

### 6. Opt-in AI
All AI features are behind feature flags, disabled by default. AI models run in-process or via local llama-server instances.

## Frontend Architecture

### Component Hierarchy

<p align="center">
  <img src="diagrams/frontend-component-hierarchy.svg" alt="Frontend Component Hierarchy" width="100%" />
</p>

### State Management

| Store | File | Purpose |
|-------|------|---------|
| `uiStore` | `store/uiStore.ts` | UI state (sidebar, modals, theme) |
| `editStore` | `store/editStore.ts` | Image editor state |
| `nleStore` | `store/nleStore.ts` | Video editor (NLE) state |
| `settingsStore` | `store/settingsStore.ts` | App settings |
| `syncStore` | `store/syncStore.ts` | Sync status |
| `galleryLayoutStore` | `store/galleryLayoutStore.ts` | Gallery layout |

### View Modes

| ViewMode | Component | Description |
|----------|-----------|-------------|
| `gallery` | `PhotoGrid` | Default photo grid with virtualized rows |
| `explore` | `ExploreView` | AI-powered discovery |
| `agent` | `AgentView` | AI assistant chat |
| `albums` | `AlbumsView` | Album management |
| `people` | `PeopleView` | People management |
| `projects` | `ProjectsDashboard` | Video projects |
| `map` | `MapView` | Leaflet map view |
| `utilities` | `UtilitiesView` | System utilities |
| `locked` | `LockedViewAuth` | Locked Folder |
| `trash` | `TrashView` | Trash view |
| `favorites` | `PhotoGrid` (filtered) | Favorites |
| `toolbox` | `ImageToolbox` | Image editing tools |

## Backend Architecture

### Application Startup

<p align="center">
  <img src="diagrams/backend-startup-flow.svg" alt="Backend Startup Flow" width="100%" />
</p>

### Middleware Stack

1. **CORS Layer** — Allows `tauri://localhost`, `http://localhost:3005`, `http://127.0.0.1:3005`
2. **TraceLayer** — HTTP request tracing
3. **DefaultBodyLimit** — 1GB max body
4. **Rate Limit Layer** — 20 req/min per IP+path for expensive endpoints
5. **Telemetry Layer** — Samples API requests, logs errors always
6. **API Key Auth Layer** — Checks `X-API-Key` header if configured

### Service Architecture

<p align="center">
  <img src="diagrams/service-architecture.svg" alt="Service Architecture" width="100%" />
</p>

### Background Worker Pipeline

The background worker processes photos through a 4-stage pipeline:

<p align="center">
  <img src="diagrams/background-worker-flow.svg" alt="Background Worker Pipeline" width="100%" />
</p>

Each stage is pluggable via the `AnalyzerRegistry`.

## Database Schema

### Core Tables

- **photos** — Main photo/video metadata
- **albums** — Album definitions
- **photo_albums** — Many-to-many photo-album relationships
- **people** — Identified people
- **photo_people** — Many-to-many photo-person relationships
- **faces** — Detected face data
- **background_jobs** — Background processing jobs
- **events** — Event groupings (trips, etc.)
- **video_projects** — Video editor project state
- **agent_sessions** — AI agent chat sessions
- **agent_messages** — AI agent chat messages
- **settings** — Key-value settings store

### Entity Relationships

<p align="center">
  <img src="diagrams/database-schema.svg" alt="Entity Relationships" width="100%" />
</p>

## ML/AI Pipeline

### In-process Models

- **SigLIP2** — Semantic image embeddings (768-dim)
- **face-id** — Face detection (SCRFD) + embeddings (ArcFace)
- **BiSeNet** — Face parsing/portrait segmentation
- **SegFormer** — Semantic segmentation (ADE20K-150)
- **LaMa** — Inpainting/object removal
- **PP-OCRv4** — Neural text detection & recognition (in-process ONNX)

### External Services (Optional)

- **llama-server** — LLM for agent search (port 9090)
- **llama-server** — Vision/captioning (port 9091)

## Dual-Mode Media Sharing & Device Discovery

Prism supports zero-configuration local network media sharing through two complementary mechanisms:

```
┌─────────────────────────────────────────────────────────────┐
│                       Prism Share Modal                     │
├──────────────────────────────┬──────────────────────────────┤
│     EasyShare (AirDrop)      │      Web Link & QR Code      │
│  - UDP beacon (port 8272)    │  - Canvas QR code            │
│  - Zero-config peer discovery│  - Passcode & expiry         │
│  - Direct HTTP push upload   │  - EXIF/GPS stripping        │
└──────────────┬───────────────┴──────────────┬───────────────┘
               │                              │
               ▼                              ▼
      ┌─────────────────┐            ┌──────────────────┐
      │ Discovered Peer │            │  Mobile Browser  │
      │ (Prism Node)    │            │ (/share/:token)  │
      └─────────────────┘            └──────────────────┘
```

### 1. EasyShare (Direct Device-to-Device Push)
- **UDP Beacon Discovery (`LanBeaconService`)**: Background service running on UDP port `8272`. Broadcasts lightweight JSON presence beacons every 3 seconds to `255.255.255.255:8272`.
- **Peer Liveness & Auto-Expiry**: In-memory registry tracking discovered hostnames, device types, IPs, and ports. Peers not seen for 10 seconds are automatically evicted.
- **Direct Push (`POST /api/v1/lan/push-to-peer`)**: Streams selected photo files directly across the LAN to the peer's upload endpoint with real-time transfer progress feedback.

### 2. Web Link & QR Code
- **Tokenized Ephemeral Shares (`/api/v1/shares`)**: Generates cryptographically secure, time-limited tokens (1h, 24h, 7d, never) with optional password protection.
- **Privacy Controls**: Strips camera metadata (EXIF) and GPS location coordinates dynamically before serving.
- **Integrated Canvas QR Generator**: Renders scannable QR codes in-client using the server's detected LAN IP, allowing immediate phone camera scanning.
- **Recipient Portal (`SharePortalView`)**: Responsive standalone web viewer served directly at `/share/:token` with passcode verification, thumbnail preview, and full-resolution media downloads.

## Security Model

- **Local-first** — No data leaves the machine
- **Locked Folder** — Argon2id encryption for private media
- **API Key Auth** — Optional backend authentication
- **CSP** — Strict Content Security Policy in Tauri
- **No telemetry by default** — Opt-in only

## Performance Optimizations

- **Virtualized Grid** — TanStack Virtual for rendering 100k+ photos
- **WebP Thumbnails** — Fast, small thumbnails with quality preservation
- **SQLite WAL** — Concurrent read/write without locking
- **FTS5** — Full-text search with ranking
- **Background Processing** — Non-blocking AI pipeline
- **Proxy Videos** — Automatic proxy generation for smooth NLE editing

