# Prism Technical Analysis: System Overview

> **Document**: ANALYSIS_00-SystemOverview.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 1  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [1. System Introduction](#1-system-introduction)
- [2. Architectural Layout & Threading Model](#2-architectural-layout--threading-model)
- [3. Core Subsystems & Module Breakdown](#3-core-subsystems--module-breakdown)
- [4. Inter-Module Relationships & Middleware Topology](#4-inter-module-relationships--middleware-topology)
- [5. Systemwide Data Flow Pipeline](#5-systemwide-data-flow-pipeline)
- [6. Technology Stack & Key Dependencies](#6-technology-stack--key-dependencies)
- [7. Codebase Structure Mapping](#7-codebase-structure-mapping)
- [8. Verification Report](#8-verification-report)

---

## 1. System Introduction

### 1.1 What is Prism?

**Prism** is an offline, privacy-first desktop photo and video workstation designed to deliver cloud-caliber intelligence entirely on user hardware without transmitting private photos or telemetry to external clouds.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Prism System Topology                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Desktop Client Shell]                                                     │
│   Tauri v2 Native Windows/Linux/macOS Window                                │
│   └─ Vite 6 + React 18 + Zustand 5 User Interface (Port 3005)               │
│                                                                             │
│                     │ HTTP Rest & SSE Stream (127.0.0.1:8269)               │
│                     ▼                                                       │
│                                                                             │
│  [Asynchronous Core Server]                                                 │
│   Axum 0.7 Engine + Tokio Multithreaded Runtime                             │
│   ├─ Middleware: API Auth, Sliding Rate-Limiter, Telemetry Tracker          │
│   ├─ Storage Engine: SQLite (WAL Mode, PRAGMA synchronous=NORMAL, FTS5)     │
│   ├─ In-Process ONNX AI Engine: SigLIP2, ArcFace, PP-OCRv4, Florence-2      │
│   └─ Background Scheduling Engine: Battery- & CPU-aware Worker Loop         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evidence**:
- [VERIFY: backend_rust/src/main.rs:41-53] - Tokio entry point and host:port binding.
- [VERIFY: frontend/src-tauri/tauri.conf.json:3-10] - Tauri application product definition, devUrl on port 3005.
- [VERIFY: backend_rust/src/db.rs:32-35] - SQLite initialization with WAL mode, normal synchronicity, and foreign keys enabled.

### 1.2 Core Architectural Advantages

1. **Deterministic Local Execution (Zero Cloud Data Exfiltration)**:
   All semantic vectorization, facial identification, optical character recognition, depth estimation, and natural language planning occur strictly inside local processes.
   - [VERIFY: backend_rust/src/services/siglip.rs:22-50] - In-process ONNX Runtime session creation.
   - [VERIFY: backend_rust/src/services/worker.rs:465-538] - Local background worker consuming SQLite jobs.

2. **Adaptive Hardware Throttling (Hardware-Aware Scheduling)**:
   The backend continuously probes OS battery state (`/sys/class/power_supply`) and CPU utilization via `sysinfo`. When a laptop is discharging and under 20% charge, or when CPU load surpasses 85%, intensive AI workloads pause automatically.
   - [VERIFY: backend_rust/src/services/worker.rs:32-35] - Threshold constants (`CPU_THRESHOLD_HIGH = 85.0`, `BATTERY_LOW = 20`).
   - [VERIFY: backend_rust/src/services/worker.rs:125-140] - Linux power supply sysfs parser.
   - [VERIFY: backend_rust/src/services/worker.rs:298-307] - Throttling scheduler evaluation.

3. **Hybrid Multimodal Search (Dual-Track Fused Search)**:
   Search queries execute simultaneously against 768-dimensional SigLIP2 dense embeddings using vector dot-product scoring, falling back to SQL wildcard matching against auto-generated captions, summaries, OCR text, and user tags.
   - [VERIFY: backend_rust/src/services/agent_search.rs:18-70] - Dot-product semantic search algorithm.
   - [VERIFY: backend_rust/src/routes/utilities.rs:750-860] - `fused_search` handler combining vector results with fallback keyword matching.

---

## 2. Architectural Layout & Threading Model

Prism divides system execution into dedicated threads and asynchronous task pools to prevent UI stuttering:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Prism Threading Model                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Thread Group 1: Desktop Shell & Web Runtime                                │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Tauri OS Event Loop ──▶ WebKit/WebView2 UI Thread ──▶ React 18 Canvas   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Thread Group 2: Axum Tokio Worker Pool (Tokio Multi-Threaded)               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Non-blocking Socket Acceptor ──▶ HTTP Middleware ──▶ Route Handlers    │ │
│  │ (I/O, database queries, metadata serving, thumbnail static delivery)   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Thread Group 3: Rayon / Blocking Thread Pool (`spawn_blocking`)            │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Thumbnail Generation ──▶ Image EXIF Decoding ──▶ Perceptual Hashing    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Thread Group 4: Autonomous Background AI Worker Loop                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Sysinfo Monitor ──▶ DB Job Fetcher ──▶ ONNX Runtime Model Slot         │ │
│  │ (SigLIP2 -> ArcFace -> Vision -> Florence-2 -> PP-OCRv4)               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evidence**:
- [VERIFY: backend_rust/src/main.rs:9-10] - `mimalloc::MiMalloc` installed as global memory allocator for high-concurrency low-fragmentation heap access.
- [VERIFY: backend_rust/src/main.rs:97-103] - Dedicated asynchronous background task spawned via `spawn_worker_loop`.
- [VERIFY: backend_rust/src/routes/photos/upload.rs:166-168] - Offloading CPU-heavy thumbnail image encoding to Tokio's blocking threadpool via `tokio::task::spawn_blocking`.
- [VERIFY: backend_rust/src/services/siglip.rs:9-10] - Thread-safe access to ONNX session via `std::sync::Mutex<Session>`.

---

## 3. Core Subsystems & Module Breakdown

| Module Name | Purpose | Primary Implementation File | Verification Anchor |
|---|---|---|---|
| **App Entry & State** | Config parsing, SQLite connection pool initialization, server startup | `backend_rust/src/main.rs` | [VERIFY: backend_rust/src/main.rs:28] |
| **Routing & Middleware** | Route aggregation, rate limiting, API key security, telemetry layer | `backend_rust/src/routes/mod.rs` | [VERIFY: backend_rust/src/routes/mod.rs:374] |
| **Database Engine** | SQLite WAL schema, table setup, foreign key enforcement, migrations | `backend_rust/src/db.rs` | [VERIFY: backend_rust/src/db.rs:10] |
| **Media Ingestion** | Photo/video upload, blob decoding, EXIF extraction, thumbnail pipeline | `backend_rust/src/routes/photos/upload.rs` | [VERIFY: backend_rust/src/routes/photos/upload.rs:34] |
| **AI Worker Engine** | Hardware-aware scheduling, retry backoff, multi-stage priority execution | `backend_rust/src/services/worker.rs` | [VERIFY: backend_rust/src/services/worker.rs:465] |
| **Multimodal Vectorizer**| In-process SigLIP2 image/text embedding generation and normalization | `backend_rust/src/services/siglip.rs` | [VERIFY: backend_rust/src/services/siglip.rs:17] |
| **Non-Linear Editor (NLE)**| Video timeline data management, proxy generation, transcode & export | `backend_rust/src/routes/nle.rs` | [VERIFY: backend_rust/src/routes/nle.rs:76] |
| **Agent Chat & Search** | Autonomous assistant session management, photo search & metadata retrieval| `backend_rust/src/routes/agent.rs` | [VERIFY: backend_rust/src/routes/agent.rs:34] |
| **Library Utilities** | Duplicate clustering, blur detection, fused search, backup/restore | `backend_rust/src/routes/utilities.rs` | [VERIFY: backend_rust/src/routes/utilities.rs:246] |
| **Frontend UI Shell** | Virtualized grid rendering, multi-view router, global Zustand stores | `frontend/App.tsx` | [VERIFY: frontend/App.tsx:62] |

---

## 4. Inter-Module Relationships & Middleware Topology

The backend Axum router stacks several layers of middleware to guarantee security, stability, and observability:

```
 Incoming Request (HTTP / SSE / WebSocket)
        │
        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 1. DefaultBodyLimit (1024 MB maximum payload)          │ [VERIFY: backend_rust/src/routes/mod.rs:613]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 2. CorsLayer (Tauri localhost & dev port 3005)         │ [VERIFY: backend_rust/src/routes/mod.rs:377-398]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 3. TraceLayer (Structured HTTP request logging)        │ [VERIFY: backend_rust/src/routes/mod.rs:615]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 4. RateLimiter (Sliding window 20 req/min for AI/video)│ [VERIFY: backend_rust/src/routes/mod.rs:319-346]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 5. TelemetryTrackingLayer (Adaptive 1-in-N sampling)   │ [VERIFY: backend_rust/src/routes/mod.rs:129-160]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 6. ApiKeyAuthLayer (Dynamic database-backed x-api-key) │ [VERIFY: backend_rust/src/routes/mod.rs:236-288]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
             Business Route Handlers
```

---

## 5. Systemwide Data Flow Pipeline

```
[Camera / Disk Media]
        │
        ▼ POST /api/v1/photos/upload (Multipart or JSON)
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 1: Ingestion & EXIF Parsing                                    │ [VERIFY: backend_rust/src/routes/photos/upload.rs:34]
│ - File written to uploads/                                           │
│ - Dimensions, camera make, model, ISO, focal length parsed           │
│ - New UUID created and inserted into SQLite `photos` table           │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 2: Thumbnail Rasterization & Enqueue                           │ [VERIFY: backend_rust/src/routes/photos/upload.rs:162-173]
│ - Asynchronous spawn_blocking renders 400px thumbnail               │
│ - Photo ID inserted into `background_jobs` with status='pending'    │
│ - Worker state `notify.notify_one()` awakens AI scheduler loop       │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 3: Autonomous AI Analysis Cascade                              │ [VERIFY: backend_rust/src/services/worker.rs:472-536]
│ - Priority 300: SiglipAnalyzer generates 768d vector                 │
│ - Priority 200: FaceAnalyzer extracts ArcFace bounding boxes        │
│ - Priority 100: VisionAnalyzer / Florence-2 describes scene          │
│ - Priority 0:   PP-OCRv4 recognizes text and coordinates             │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Stage 4: Reactive Client Notification                                │ [VERIFY: backend_rust/src/routes/settings.rs:511]
│ - SSE stream `/api/v1/settings/events` emits update message          │
│ - Frontend Zustand store updates photo item in-memory                │
│ - UI updates thumbnails, search vectors, and people clusters         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6. Technology Stack & Key Dependencies

### Backend Dependencies (`backend_rust/Cargo.toml`)
- **Web Framework**: `axum 0.7` with macros and multipart support [VERIFY: backend_rust/Cargo.toml:11]
- **Asynchronous Engine**: `tokio 1.38` with full features [VERIFY: backend_rust/Cargo.toml:12]
- **Database Access**: `sqlx 0.8` (SQLite, runtime-tokio, chrono, uuid) [VERIFY: backend_rust/Cargo.toml:17]
- **Machine Learning**: `ort 2.0.0-rc.13` (ONNX Runtime with CUDA and ndarray) [VERIFY: backend_rust/Cargo.toml:8]
- **Tokenization**: `tokenizers 0.20.0` for HuggingFace model token processing [VERIFY: backend_rust/Cargo.toml:10]
- **Image Manipulation**: `image 0.25` and `kamadak-exif 0.5` [VERIFY: backend_rust/Cargo.toml:21-25]
- **Security & Hashes**: `argon2 0.5`, `sha2 0.10`, `uuid 1.10` [VERIFY: backend_rust/Cargo.toml:19-40]
- **Memory Allocator**: `mimalloc 0.1` [VERIFY: backend_rust/Cargo.toml:43]

### Frontend Dependencies (`frontend/package.json`)
- **Framework & UI Core**: React 18.3, React-DOM 18.3, React Router 7.1 [VERIFY: frontend/package.json:34-38]
- **State Management**: Zustand 5.0 [VERIFY: frontend/package.json:39]
- **List Virtualization**: `@tanstack/react-virtual 3.5.0` [VERIFY: frontend/package.json:17]
- **Motion & Physics**: Framer Motion 12.4, GSAP 3.15, Anime.js 4.5 [VERIFY: frontend/package.json:22-26]
- **Geospatial & Mapping**: Leaflet 1.9, React-Leaflet 4.2, Leaflet MarkerCluster 1.5 [VERIFY: frontend/package.json:29-37]
- **Video & Codecs**: `hls.js 1.6`, `mp4-muxer 5.2` [VERIFY: frontend/package.json:27-32]
- **Desktop Bridge**: `@tauri-apps/api 2.11`, `@tauri-apps/plugin-dialog 2.7` [VERIFY: frontend/package.json:18-19]

---

## 7. Codebase Structure Mapping

```
Prism/
├── backend_rust/
│   ├── Cargo.toml                  # Backend package manifest & dependencies [VERIFY: backend_rust/Cargo.toml:1]
│   └── src/
│       ├── main.rs                 # Server entry point & AppState [VERIFY: backend_rust/src/main.rs:28]
│       ├── config.rs               # Environment configuration loader
│       ├── db.rs                   # SQLite database migrations & pool [VERIFY: backend_rust/src/db.rs:10]
│       ├── models.rs               # Core domain structures [VERIFY: backend_rust/src/models.rs:55]
│       ├── routes/
│       │   ├── mod.rs              # Route registry & middleware [VERIFY: backend_rust/src/routes/mod.rs:374]
│       │   ├── photos/             # Upload, listing, metadata, purge handlers
│       │   ├── photos_ai.rs        # AI endpoint operations (depth, SAM, upscale, OCR)
│       │   ├── nle.rs              # Video editor projects & export [VERIFY: backend_rust/src/routes/nle.rs:76]
│       │   ├── agent.rs            # Natural language conversational agent [VERIFY: backend_rust/src/routes/agent.rs:34]
│       │   └── utilities.rs        # Fused search, dedup, blur checks [VERIFY: backend_rust/src/routes/utilities.rs:246]
│       └── services/
│           ├── worker.rs           # AI job scheduler & worker state [VERIFY: backend_rust/src/services/worker.rs:465]
│           ├── siglip.rs           # SigLIP2 ONNX inference engine [VERIFY: backend_rust/src/services/siglip.rs:8]
│           ├── face_engine.rs      # ArcFace detection & embedding
│           ├── sam.rs              # Segment Anything Model
│           ├── agent_search.rs     # Vector dot-product search [VERIFY: backend_rust/src/services/agent_search.rs:18]
│           └── thumbnail.rs        # Fast image resize & downsampling
├── frontend/
│   ├── package.json                # Frontend dependencies & scripts [VERIFY: frontend/package.json:1]
│   ├── App.tsx                     # Top-level React orchestration [VERIFY: frontend/App.tsx:62]
│   ├── types.ts                    # Core UI interfaces & models [VERIFY: frontend/types.ts:1]
│   ├── src-tauri/
│   │   └── tauri.conf.json         # Tauri v2 desktop container config [VERIFY: frontend/src-tauri/tauri.conf.json:3]
│   ├── components/
│   │   ├── layout/MainContent.tsx  # Dynamic view switcher [VERIFY: frontend/components/layout/MainContent.tsx:86]
│   │   ├── PhotoGrid/              # Virtualized photo grid
│   │   └── AgentView/              # Assistant chat interface
│   └── store/                      # Zustand state slices (nle, ui, edit, sync)
└── cli/
    ├── Cargo.toml                  # CLI manifest
    └── src/main.rs                 # CLI command interpreter [VERIFY: cli/src/main.rs:14]
```

---

## 8. Verification Report

| Verification Target | Referenced File:Line | Code Content Summary | Status |
|---|---|---|---|
| Server Startup & AppState | `backend_rust/src/main.rs:28-53` | `pub struct AppState`, `tokio::main`, host/port setup | ✓ Verified |
| Database Schema & WAL | `backend_rust/src/db.rs:32-50` | `PRAGMA journal_mode = WAL`, `CREATE TABLE photos` | ✓ Verified |
| Rate Limiting Middleware | `backend_rust/src/routes/mod.rs:319-346` | Sliding window rate limit per IP on expensive paths | ✓ Verified |
| Telemetry Tracking Layer | `backend_rust/src/routes/mod.rs:129-160` | Dynamic 1-in-N sampling & error auto-logging | ✓ Verified |
| Media Ingestion Endpoint | `backend_rust/src/routes/photos/upload.rs:34-175` | EXIF extraction, thumbnail generation, worker enqueue | ✓ Verified |
| AI Worker & System Monitor | `backend_rust/src/services/worker.rs:78-140` | Battery and CPU usage polling for task throttling | ✓ Verified |
| SigLIP2 Engine Vectorization | `backend_rust/src/services/siglip.rs:54-93` | 224x224 RGB resize, NCHW normalization, L2 norm | ✓ Verified |
| Semantic Dot-Product Search | `backend_rust/src/services/agent_search.rs:18-70` | Cosine similarity calculation with 0.15 threshold | ✓ Verified |
| Fused Search & Text Fallback | `backend_rust/src/routes/utilities.rs:750-860` | Vector search with SQL LIKE fallback across 4 fields | ✓ Verified |
| Visual Perceptual Dedup | `backend_rust/src/routes/utilities.rs:483-512` | Hamming distance clustering (dist <= 5) | ✓ Verified |
| Blurry Photo Filter | `backend_rust/src/routes/utilities.rs:246-258` | SQL query filtering `blur_score < 100.0` | ✓ Verified |
| NLE Timeline & Projects | `backend_rust/src/routes/nle.rs:76-100` | VideoProject CRUD and project_json management | ✓ Verified |
| Tauri Desktop Configuration | `frontend/src-tauri/tauri.conf.json:3-10` | Port 3005 Vite devUrl and binary packaging spec | ✓ Verified |
| CLI REST Interface | `cli/src/main.rs:14-48` | Clap command interpreter for headless management | ✓ Verified |
