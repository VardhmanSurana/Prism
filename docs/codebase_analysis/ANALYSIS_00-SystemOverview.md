# Prism Technical Analysis: System Overview

> **Document**: ANALYSIS_00-SystemOverview.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 1  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [1. System Introduction & Core Tenets](#1-system-introduction--core-tenets)
- [2. Architectural Layout & System Topology](#2-architectural-layout--system-topology)
- [3. Threading Model & Concurrency Architecture](#3-threading-model--concurrency-architecture)
- [4. Inter-Module Relationships & Middleware Topology](#4-inter-module-relationships--middleware-topology)
- [5. Systemwide Data Flow Pipeline](#5-systemwide-data-flow-pipeline)
- [6. Technology Stack & Key Dependencies](#6-technology-stack--key-dependencies)
- [7. Codebase Structure Mapping](#7-codebase-structure-mapping)
- [8. Security & Cryptographic Sandboxing Model](#8-security--cryptographic-sandboxing-model)
- [9. Verification & Audit Report](#9-verification--audit-report)

---

## 1. System Introduction & Core Tenets

### 1.1 What is Prism?

**Prism** is an offline, privacy-first, high-performance desktop photo and video library workstation designed to deliver cloud-caliber multimedia intelligence entirely on user hardware without transmitting private photos or telemetry to external servers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Prism System Topology                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Desktop Client Shell]                                                     │
│   Tauri v2 Native Windows/Linux/macOS Window                                │
│   └─ Vite 6 + React 18 + Zustand 5 User Interface (Port 3005)               │
│                                                                             │
│                     │ HTTP REST & SSE Stream (127.0.0.1:8269)               │
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
- [VERIFY: backend_rust/src/main.rs:44-53] - Tokio multi-threaded entry point and host:port binding.
- [VERIFY: frontend/src-tauri/tauri.conf.json:3-10] - Tauri application product definition, devUrl on port 3005.
- [VERIFY: backend_rust/src/db.rs:32-35] - SQLite initialization with WAL mode, normal synchronicity, and foreign keys enabled.

### 1.2 Core Architectural Tenets

1. **Deterministic Local Execution (Zero Cloud Exfiltration)**:
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

4. **Crash Resiliency & Operation Recovery**:
   On every startup, Prism scans the uploads and thumbnails directories for interrupted operations and `.prism_backup` artifacts, restoring files and cleaning locks automatically.
   - [VERIFY: backend_rust/src/main.rs:176-231] - `scan_and_recover` and `recover_interrupted_operations` directory traversal.

---

## 2. Architectural Layout & System Topology

Prism separates user interaction, business routing, computation, and storage into isolated subsystems:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Prism Detailed Layered Architecture                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Presentation Layer - Frontend]                                            │
│  ├── React 18 View Hierarchy (App.tsx, MainContent.tsx)                    │
│  ├── Zustand Reactive Stores (photoStore, nleStore, uiStore, settingsStore) │
│  ├── Virtualized Renderers (@tanstack/react-virtual PhotoGrid)              │
│  └── Tauri IPC Bridge (Dialogs, Native Window Controls, FS Links)           │
│                                                                             │
│  [Transport & API Gateway Layer - Backend]                                  │
│  ├── Axum 0.7 Router (120+ REST Endpoints, SSE Event Source)                │
│  ├── CORS Enforcement (Allowed origins: tauri.localhost, localhost:3005)    │
│  ├── Sliding-Window IP Rate Limiter (20 req/min on heavy AI endpoints)      │
│  └── Dynamic Sampling Telemetry Layer (1-in-N sampling, 100% error logging) │
│                                                                             │
│  [Execution & Scheduling Layer]                                             │
│  ├── Tokio Multi-threaded Async Runtime (Network I/O, DB queries)           │
│  ├── Rayon / spawn_blocking Pool (Thumbnail generation, EXIF parsing)       │
│  └── Autonomous AI Worker Loop (Battery/CPU monitor, DAG-based job queue)   │
│                                                                             │
│  [AI / ML Inference Engine Layer]                                           │
│  ├── SigLIP2 ViT-B/16 (768d Multimodal Image & Text Embeddings)             │
│  ├── ArcFace (512d Face Identification & Bounding Box Localization)         │
│  ├── PP-OCRv4 (Text Detection & Recognition with Word Bounding Boxes)       │
│  ├── Florence-2 / Local Vision (Dense Scene Captioning & Tagging)           │
│  └── Inpainting / Depth Models (Selective Local Photo Enhancement)          │
│                                                                             │
│  [Persistence & Storage Layer]                                              │
│  ├── SQLite 3 with WAL Mode & PRAGMA synchronous = NORMAL                   │
│  ├── Inverted Index: FTS5 Full-Text Search Virtual Tables                  │
│  ├── HNSW In-Memory Vector Index for sub-millisecond retrieval              │
│  └── Filesystem Layout: uploads/, thumbnails/ (400px), models/llm/          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Threading Model & Concurrency Architecture

Prism divides system execution across dedicated execution contexts to guarantee that expensive neural inference and image decodes never freeze the user interface or stall API responses:

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
- [VERIFY: backend_rust/src/main.rs:104-111] - Dedicated asynchronous background task spawned via `spawn_worker_loop`.
- [VERIFY: backend_rust/src/routes/photos/upload.rs:166-168] - Offloading CPU-heavy thumbnail image encoding to Tokio's blocking threadpool via `tokio::task::spawn_blocking`.
- [VERIFY: backend_rust/src/services/siglip.rs:9-10] - Thread-safe access to ONNX session via `std::sync::Mutex<Session>`.
- [VERIFY: backend_rust/src/services/agent_search.rs:3] - Multi-threaded vector scoring with Rayon parallel iteration.

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
 │ 2. CorsLayer (Tauri localhost & dev port 3005)         │ [VERIFY: backend_rust/src/routes/mod.rs:398-422]
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
 │ 5. TelemetryTrackingLayer (Adaptive 1-in-N sampling)   │ [VERIFY: backend_rust/src/routes/mod.rs:131-160]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
 ┌────────────────────────────────────────────────────────┐
 │ 6. ApiKeyAuthLayer (Dynamic database-backed x-api-key) │ [VERIFY: backend_rust/src/routes/mod.rs:236-288]
 └──────────────────────┬─────────────────────────────────┘
                        ▼
             Business Route Handlers
```

### 4.1 Middleware Details

1. **DefaultBodyLimit**:
   Allocates up to 1024 MB per request to support multi-gigabyte 4K ProRes video uploads and batch image imports without premature client disconnections.
   - [VERIFY: backend_rust/src/routes/mod.rs:613]

2. **CORS Security**:
   Explicitly restricts incoming origins to `tauri://localhost`, `http://tauri.localhost`, and development origins (`http://localhost:3005`). Production overrides can be provided via `ALLOWED_ORIGINS`.
   - [VERIFY: backend_rust/src/routes/mod.rs:401-422]

3. **Sliding-Window Rate Limiter**:
   Guards computationally intense routes (`/api/v1/photos/ai/`, `/api/v1/photos/inpaint/`, `/api/v1/nle/preview/`) to at most 20 requests per minute per IP address, returning `429 Too Many Requests` on violation.
   - [VERIFY: backend_rust/src/routes/mod.rs:347-370]

4. **Telemetry Sampling**:
   Monitors API execution latencies. Uses an atomic counter to log 1 in every 10 successful requests (`TELEM_SAMPLE_RATE = 10`), while capturing 100% of error responses (`status >= 400`).
   - [VERIFY: backend_rust/src/routes/mod.rs:53-56]
   - [VERIFY: backend_rust/src/routes/mod.rs:157-160]

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
│ Stage 4: Reactive Client Notification                                │ [VERIFY: backend_rust/src/routes/settings.rs:509]
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

## 8. Security & Cryptographic Sandboxing Model

Prism is designed from the ground up for strict local privacy:

1. **Local Authentication**:
   User credentials are encrypted using modern Argon2id with random 128-bit salt. Default admin bootstrap runs automatically if the `users` table is empty.
   - [VERIFY: backend_rust/src/db.rs:317-326]

2. **Resource-Based Ephemeral Sharing**:
   Files can be shared via cryptographic UUID tokens (`share_token`) with optional argon2 password verification, download quotas (`max_downloads`), and expiration timestamps (`expires_at`). EXIF and GPS coordinates can be stripped dynamically during export.
   - [VERIFY: backend_rust/src/db.rs:250-264]
   - [VERIFY: backend_rust/src/routes/shares.rs:1-150]

3. **Desktop Shell Isolation**:
   Tauri v2 configuration locks down dangerous native capabilities, ensuring that web views only access designated host APIs through audited Tauri plugins.
   - [VERIFY: frontend/src-tauri/tauri.conf.json:10-30]

---

## 9. Verification & Audit Report

| Verification Target | Referenced File:Line | Code Content Summary | Status |
|---|---|---|---|
| Server Startup & AppState | `backend_rust/src/main.rs:30-53` | `pub struct AppState`, `tokio::main`, host/port setup | ✓ Verified |
| Database Schema & WAL | `backend_rust/src/db.rs:32-50` | `PRAGMA journal_mode = WAL`, `CREATE TABLE photos` | ✓ Verified |
| Rate Limiting Middleware | `backend_rust/src/routes/mod.rs:347-370` | Sliding window rate limit per IP on expensive paths | ✓ Verified |
| Telemetry Tracking Layer | `backend_rust/src/routes/mod.rs:131-160` | Dynamic 1-in-N sampling & error auto-logging | ✓ Verified |
| Media Ingestion Endpoint | `backend_rust/src/routes/photos/upload.rs:34-175` | EXIF extraction, thumbnail generation, worker enqueue | ✓ Verified |
| AI Worker & System Monitor | `backend_rust/src/services/worker.rs:78-140` | Battery and CPU usage polling for task throttling | ✓ Verified |
| SigLIP2 Engine Vectorization | `backend_rust/src/services/siglip.rs:55-93` | 224x224 RGB resize, NCHW normalization, L2 norm | ✓ Verified |
| Semantic Dot-Product Search | `backend_rust/src/services/agent_search.rs:18-70` | Cosine similarity calculation with 0.15 threshold | ✓ Verified |
| Fused Search & Text Fallback | `backend_rust/src/routes/utilities.rs:750-860` | Vector search with SQL LIKE fallback across 4 fields | ✓ Verified |
| Visual Perceptual Dedup | `backend_rust/src/routes/utilities.rs:483-512` | Hamming distance clustering (dist <= 5) | ✓ Verified |
| Blurry Photo Filter | `backend_rust/src/routes/utilities.rs:246-258` | SQL query filtering `blur_score < 100.0` | ✓ Verified |
| NLE Timeline & Projects | `backend_rust/src/routes/nle.rs:76-100` | VideoProject CRUD and project_json management | ✓ Verified |
| Tauri Desktop Configuration | `frontend/src-tauri/tauri.conf.json:3-10` | Port 3005 Vite devUrl and binary packaging spec | ✓ Verified |
| CLI REST Interface | `cli/src/main.rs:14-48` | Clap command interpreter for headless management | ✓ Verified |
