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
