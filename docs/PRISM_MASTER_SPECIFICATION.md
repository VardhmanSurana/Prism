# Prism: Complete System Architecture & Technical Specification

> **Target Audience**: AI Coding Agents, Core Developers, Systems Architects  
> **Document Purpose**: Exhaustive, zero-omission specification of the entire Prism application, ecosystem, internal algorithms, database schemas, API surfaces, UI suites, and runtime behaviors.  
> **Repository Root**: `/home/chotaxdon/Work/Projects/Prism`  
> **Current Version**: v0.1.0  
> **Verification Standard**: 100% of claims, paths, line anchors, and schemas verified against actual source code.

---

## Table of Contents
1. [Executive Summary & Architectural Philosophy](#1-executive-summary--architectural-philosophy)
2. [Ecosystem Blueprint & Technology Stack](#2-ecosystem-blueprint--technology-stack)
3. [Backend Core Architecture (Rust + Axum)](#3-backend-core-architecture-rust--axum)
4. [Database Layer & SQLite Persistence (WAL Mode)](#4-database-layer--sqlite-persistence-wal-mode)
5. [Complete REST API Reference](#5-complete-rest-api-reference)
6. [In-Process ONNX AI & Multimodal Neural Engines](#6-in-process-onnx-ai--multimodal-neural-engines)
7. [Autonomous Hardware-Aware AI Job Scheduler](#7-autonomous-hardware-aware-ai-job-scheduler)
8. [Frontend Client Architecture (React + Vite + Zustand)](#8-frontend-client-architecture-react--vite--zustand)
9. [Pro Creative Suites: Image Editor & NLE Video Editor](#9-pro-creative-suites-image-editor--nle-video-editor)
10. [Autonomous Conversational Agent (`AgentView`)](#10-autonomous-conversational-agent-agentview)
11. [Local Network Synchronization, Sharing & Import Tools](#11-local-network-synchronization-sharing--import-tools)
12. [Extensibility System: Plugins & Model Packs](#12-extensibility-system-plugins--model-packs)
13. [Command-Line Interface (`cli/`)](#13-command-line-interface-cli)
14. [Security, Privacy, and Sandboxing](#14-security-privacy-and-sandboxing)
15. [Development, Build, Testing, and Troubleshooting Guide](#15-development-build-testing-and-troubleshooting-guide)

---

## 1. Executive Summary & Architectural Philosophy

**Prism** is a local-first, privacy-absolute multimedia management workstation and non-linear editing studio designed for high-resolution photography, video archives, and local AI reasoning.

### Core Architectural Pillars
1. **Zero Cloud Telemetry & Absolute Privacy**: No media binaries, vector embeddings, facial geometry, or user interactions are ever uploaded to third-party cloud infrastructure. All AI inference is executed locally via on-device ONNX runtime models [VERIFY: backend_rust/src/services/siglip.rs:22-50].
2. **Single-Binary Portability with Embedded Storage**: The backend compiles into a single, highly optimized Rust binary utilizing embedded SQLite with Write-Ahead Logging (WAL) and normal synchronicity, eliminating the operational overhead of external database engines like PostgreSQL or MongoDB [VERIFY: backend_rust/src/db.rs:10-35].
3. **Adaptive Hardware Harmony**: Rather than greedily consuming all host resources, background machine learning tasks dynamically throttle and reschedule according to real-time OS metrics (battery charge level, AC adapter status, and CPU load) [VERIFY: backend_rust/src/services/worker.rs:298-308].
4. **Hybrid Multimodal Retrieval**: Semantic vector search (768-dimensional SigLIP2 embeddings) is unified with relational keyword filters and full-text index lookups, providing instantaneous search across visual concepts, facial identities, OCR text, and camera parameters [VERIFY: backend_rust/src/routes/utilities.rs:750-860].
5. **Unified Desktop & Web Surface**: Built on Tauri v2, the desktop shell loads the Vite-bundled React frontend natively while also serving LAN web clients over HTTP and Server-Sent Events (SSE) [VERIFY: frontend/src-tauri/tauri.conf.json:3-10].

---

## 2. Ecosystem Blueprint & Technology Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Prism Ecosystem Topology                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   [Desktop Container]              [Command-Line Client]                        │
│   Tauri v2 Native Shell            Prism Rust Headless CLI                      │
│   (Deb, RPM, AppImage)             (Rest API & Batch Automation)                │
│            │                                    │                               │
│            ▼                                    │                               │
│   [Frontend Web Client]                         │                               │
│   React 18.3 + TypeScript 5.8                   │                               │
│   Vite 6 + Tailwind CSS 3                       │                               │
│   Zustand 5 State Management                    │                               │
│   TanStack Virtual + Framer Motion              │                               │
│   WebCodecs + MP4-Muxer Engine                  │                               │
│            │                                    │                               │
│            │ HTTP / SSE / Streaming (127.0.0.1:8269)                            │
│            ▼                                    ▼                               │
│   [Backend Core Engine]                                                         │
│   Rust 2021 Edition (Axum 0.7 + Tokio 1.38 Multithreaded)                       │
│   Global Mimalloc Heap Allocator                                                │
│   ├── Middleware: API Key Auth, Sliding Rate Limiter, Telemetry Layer           │
│   ├── Storage Engine: SQLite (SQLx 0.8, WAL Mode, Foreign Keys ON)              │
│   ├── In-Process AI Engine: ONNX Runtime (ort 2.0-rc.13 + CUDA/CPU)             │
│   ├── Scheduler: Hardware-Aware AI Worker & Multi-Stage DAG Pipeline            │
│   └── Video Engine: FFmpeg / HLS Streamer / Subtitle Generator                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Matrix
- **Backend Framework**: [Axum 0.7](file:///home/chotaxdon/Work/Projects/Prism/backend_rust/Cargo.toml#L11) with macros, multipart streaming, and JSON serialization.
- **Asynchronous Runtime**: [Tokio 1.38](file:///home/chotaxdon/Work/Projects/Prism/backend_rust/Cargo.toml#L12) (full multi-threaded reactor).
- **Database Engine**: [SQLx 0.8](file:///home/chotaxdon/Work/Projects/Prism/backend_rust/Cargo.toml#L17) driving SQLite with WAL mode, UUID generation, and chrono datetime serialization.
- **Machine Learning**: [ONNX Runtime (`ort` 2.0.0-rc.13)](file:///home/chotaxdon/Work/Projects/Prism/backend_rust/Cargo.toml#L8) supporting CPU and CUDA execution providers.
- **Token Processing**: HuggingFace `tokenizers 0.20.0` [VERIFY: backend_rust/Cargo.toml:10].
- **Memory Allocator**: `mimalloc 0.1` statically linked as the global allocator [VERIFY: backend_rust/src/main.rs:9-10].
- **Frontend Core**: React 18.3.1, React-DOM 18.3.1, TypeScript 5.8.2, Vite 6.2.0 [VERIFY: frontend/package.json:34-62].
- **Styling & Motion**: Tailwind CSS 3, Framer Motion 12.43, GSAP 3.15, Anime.js 4.5 [VERIFY: frontend/package.json:22-26].
- **Desktop Shell**: Tauri v2 (`@tauri-apps/api 2.11`, `@tauri-apps/cli 2.11`) [VERIFY: frontend/package.json:18] [VERIFY: frontend/package.json:43].
- **Video & Media**: WebCodecs API, `mp4-muxer 5.2`, `hls.js 1.6`, `image 0.25`, `kamadak-exif 0.5` [VERIFY: frontend/package.json:27-32] [VERIFY: backend_rust/Cargo.toml:21-25].

---

## 3. Backend Core Architecture (Rust + Axum)

The backend is built around a centralized state container `AppState` wrapped inside an `Arc` pointer, shared across all Axum request handlers and asynchronous tasks [VERIFY: backend_rust/src/main.rs:28-39]:

```rust
// [VERIFY: backend_rust/src/main.rs:28-39]
pub struct AppState {
    pub config: Config,
    pub db: db::DbPool,
    pub ml_client: MlClient,
    pub telemetry: TelemetryService,
    pub worker: Arc<WorkerState>,
    pub scheduler: Arc<JobScheduler>,
    pub registry: Arc<AnalyzerRegistry>,
    pub model_manager: Arc<ModelManager>,
    pub pack_manager: Arc<PackManager>,
    pub plugin_manager: Arc<PluginManager>,
}
```

### Server Startup Lifecycle
1. **Tracing Subscriber Setup**: Initializes structured logging (`tracing-subscriber`) reading `RUST_LOG` with a fallback to `prism_backend_rust=info,tower_http=info` [VERIFY: backend_rust/src/main.rs:44-50].
2. **Configuration Ingestion**: Reads environment variables (`PORT`, `HOST`, `DATABASE_URL`, `UPLOAD_DIR`, `THUMBNAILS_DIR`, `GPU_MODE`) [VERIFY: backend_rust/src/main.rs:52].
3. **Working Directory Bootstrap**: Guarantees the existence of `uploads/`, `thumbnails/`, and `map_cache/` so fresh checkouts start cleanly [VERIFY: backend_rust/src/main.rs:57-59].
4. **Database Pool Initialization**: Creates SQLite connection pool, applies `PRAGMA` settings, and executes database migrations [VERIFY: backend_rust/src/main.rs:63].
5. **AI Subsystem Assembly**: Instantiates `LlmServer`, `MlClient`, `TelemetryService`, `AnalyzerRegistry`, and `JobScheduler` [VERIFY: backend_rust/src/main.rs:64-71].
6. **Telemetry State Restoration**: Queries the `settings` table to restore `telemetry_enabled`, `telemetry_sample_rate`, and `telemetry_response_logging` across restarts [VERIFY: backend_rust/src/main.rs:76-94].
7. **Background Worker Spawning**: Launches `spawn_worker_loop` in a separate Tokio task [VERIFY: backend_rust/src/main.rs:97-103].
8. **Model Pack & Plugin Loading**: Refreshes installed model packs and registers dynamic model endpoints with `ModelManager` [VERIFY: backend_rust/src/main.rs:105-131].
9. **Axum Router Assembly & Port Binding**: Stacks middleware layers, binds `TcpListener` to `0.0.0.0:8269`, and serves requests [VERIFY: backend_rust/src/main.rs:146-150].

### Middleware Pipeline
Every request traversing Axum passes through a hardened middleware chain [VERIFY: backend_rust/src/routes/mod.rs:589-620]:
- **DefaultBodyLimit**: Enforces a strict 1024 MB maximum body limit to support multi-gigabyte 4K/8K video uploads [VERIFY: backend_rust/src/routes/mod.rs:613].
- **CorsLayer**: Permits desktop origin URLs (`tauri://localhost`, `http://tauri.localhost`, `http://localhost:3005`) and configurable custom origins via `ALLOWED_ORIGINS` [VERIFY: backend_rust/src/routes/mod.rs:377-398].
- **TraceLayer**: Tower HTTP request tracing for structured diagnostic logs [VERIFY: backend_rust/src/routes/mod.rs:615].
- **RateLimiter**: In-memory sliding-window rate limiter restricting expensive video export and AI inpainting routes to 20 requests per minute per IP [VERIFY: backend_rust/src/routes/mod.rs:319-346].
- **TelemetryTrackingLayer**: Intercepts requests, measures response duration in milliseconds, logs 100% of 4xx/5xx HTTP errors, and samples successful requests at a 1-in-$N$ rate [VERIFY: backend_rust/src/routes/mod.rs:129-160].
- **ApiKeyAuthLayer**: Validates the `X-API-Key` header against dynamic database configuration (`settings.api_key_value`), bypassing health checks and Swagger UI [VERIFY: backend_rust/src/routes/mod.rs:236-288].

---

## 4. Database Layer & SQLite Persistence (WAL Mode)

Prism uses SQLite managed via `sqlx::SqlitePool` with 10 max connections [VERIFY: backend_rust/src/db.rs:27-30].

### PRAGMA Tuning
```sql
-- [VERIFY: backend_rust/src/db.rs:32-34]
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
```
- **WAL Mode**: Enables concurrent read operations during background AI vectorization writes.
- **Synchronous NORMAL**: Minimizes filesystem sync calls while guaranteeing durability against app crashes.
- **Foreign Keys ON**: Guarantees cascading deletes for photo metadata, faces, and album associations.

### Database Schema Entity Overview
The database creates 18 core tables [VERIFY: backend_rust/src/db.rs:50-281]:
1. **`photos`**: Master entity containing filesystem paths, dimensions, aspect ratio, camera EXIF, perceptual hashes (`hash`, `phash`), blur score, and generated AI fields (`embedding`, `ai_summary`, `auto_tags`, `ocr_text`, `ocr_bboxes`).
2. **`albums`**: Logical user-created collections and smart albums (`screenshots`, `documents`, `places`).
3. **`photo_albums`**: Junction table establishing many-to-many relationships between photos and albums.
4. **`people`**: Clustered individuals with display names, cover thumbnails, and 512-dimensional face embeddings.
5. **`photo_people`**: Junction table linking photos to recognized people with confidence scores.
6. **`faces`**: Low-level bounding box coordinates (`box_json`) and facial embeddings (`embedding_json`) extracted from photos.
7. **`background_jobs`**: Job queue tracking AI processing status (`pending`, `processing`, `completed`, `failed`), retry attempts, and stage progress.
8. **`events`**: Spatiotemporal trip and event groupings.
9. **`video_projects`**: Non-linear editor project documents storing canvas geometry and complete timeline JSON strings (`project_json`).
10. **`telemetry_events`**: Structured application event logs recording component, action, status, and duration.
11. **`agent_sessions`**: Conversational chat session threads.
12. **`agent_messages`**: Chat messages storing textual content, tool call outputs (`tools_json`), plan metadata, and attached photos.
13. **`settings`**: Key-value configuration store for application preferences and runtime toggles.
14. **`external_locations`**: Mount paths for external storage drives, local directories, or SMB network shares.
15. **`sync_peers`**: Paired LAN devices authorized for peer-to-peer differential synchronization.
16. **`shares`**: Tokenized link sharing records with expiration timestamps, download quotas, and privacy toggles.
17. **`webhooks`**: External webhook listener endpoints with secret keys.
18. **`users`**: Administrative authentication table using Argon2 password hashes.

---

## 5. Complete REST API Reference

All API routes are mounted under the `/api/v1` namespace [VERIFY: backend_rust/src/routes/mod.rs:596].

### 5.1 Photo Operations
| Route | Method | Purpose | Source Reference |
|---|---|---|---|
| `/photos` | `GET` | List photos with pagination, sort order, and filter criteria | [VERIFY: backend_rust/src/routes/mod.rs:410] |
| `/photos/upload` | `POST` | Upload photo binary or JSON path payload | [VERIFY: backend_rust/src/routes/mod.rs:402] |
| `/photos/upload-blob` | `POST` | Multipart upload for edited canvas blobs | [VERIFY: backend_rust/src/routes/mod.rs:404] |
| `/photos/:id` | `GET` | Retrieve detailed metadata for a single photo | [VERIFY: backend_rust/src/routes/mod.rs:412] |
| `/photos/:id/thumbnail`| `GET` | Stream pre-rendered thumbnail image | [VERIFY: backend_rust/src/routes/mod.rs:415] |
| `/photos/:id/file` | `GET` | Stream full-resolution original media file | [VERIFY: backend_rust/src/routes/mod.rs:414] |
| `/photos/:id/favorite` | `POST`| Toggle favorite status | [VERIFY: backend_rust/src/routes/mod.rs:417] |
| `/photos/:id/trash` | `POST`| Move photo to trash (soft delete) | [VERIFY: backend_rust/src/routes/mod.rs:418] |
| `/photos/:id/restore` | `POST`| Restore photo from trash | [VERIFY: backend_rust/src/routes/mod.rs:419] |
| `/photos/:uuid/purge` | `DELETE`| Permanently delete photo and purge thumbnail | [VERIFY: backend_rust/src/routes/mod.rs:420] |
| `/photos/:id/location` | `PUT` | Update GPS latitude and longitude | [VERIFY: backend_rust/src/routes/mod.rs:421] |
| `/photos/:id/adjustments`| `PUT`| Save non-destructive image adjustments JSON | [VERIFY: backend_rust/src/routes/mod.rs:422] |

### 5.2 AI Processing Endpoints (`/photos/...`)
| Route | Method | Purpose | Source Reference |
|---|---|---|---|
| `/photos/:id/ocr-bboxes`| `POST` | Extract text and bounding boxes via PP-OCRv4 | [VERIFY: backend_rust/src/routes/mod.rs:424] |
| `/photos/inpaint/process`| `POST`| Inpaint mask region via LaMa engine | [VERIFY: backend_rust/src/routes/mod.rs:425] |
| `/photos/depth/process` | `POST`| Generate monocular depth map | [VERIFY: backend_rust/src/routes/mod.rs:427] |
| `/photos/enhance/upscale`| `POST`| Super-resolution upscale (2x / 4x) | [VERIFY: backend_rust/src/routes/mod.rs:428] |
| `/photos/enhance/face-restore`| `POST`| Face restoration via CodeFormer / GFPGAN | [VERIFY: backend_rust/src/routes/mod.rs:429] |
| `/photos/denoise` | `POST`| Neural image noise reduction | [VERIFY: backend_rust/src/routes/mod.rs:430] |
| `/photos/caption` | `POST`| Generate descriptive scene caption | [VERIFY: backend_rust/src/routes/mod.rs:431] |
| `/photos/sam/select` | `POST`| Interactive click-to-segment via SAM | [VERIFY: backend_rust/src/routes/mod.rs:433] |
| `/photos/background-mask/:photo_id`| `GET`| Generate transparent background cutout mask | [VERIFY: backend_rust/src/routes/mod.rs:441] |
| `/photos/auto-enhance/:photo_id` | `POST`| Compute automatic color/contrast adjustments | [VERIFY: backend_rust/src/routes/mod.rs:443] |

### 5.3 Non-Linear Video Editor (`/nle/...`)
| Route | Method | Purpose | Source Reference |
|---|---|---|---|
| `/nle/projects` | `GET`/`POST`| List existing projects or create a new timeline | [VERIFY: backend_rust/src/routes/mod.rs:481] |
| `/nle/projects/:id` | `GET`/`PUT`/`DELETE`| Read, update timeline JSON, or delete project | [VERIFY: backend_rust/src/routes/mod.rs:483] |
| `/nle/clips/proxy` | `POST` | Generate low-resolution editing proxy via FFmpeg | [VERIFY: backend_rust/src/routes/mod.rs:484] |
| `/nle/clips/waveform`| `POST` | Extract audio waveform visualization data | [VERIFY: backend_rust/src/routes/mod.rs:487] |
| `/nle/preview/frame` | `POST` | Render single frame at timestamp $t$ | [VERIFY: backend_rust/src/routes/mod.rs:489] |
| `/nle/export` | `POST` | Initiate server-side FFmpeg timeline export | [VERIFY: backend_rust/src/routes/mod.rs:491] |
| `/nle/stream` | `GET` | Stream video with dynamic transcoding | [VERIFY: backend_rust/src/routes/mod.rs:495] |

### 5.4 Conversational Agent (`/agent/...`)
| Route | Method | Purpose | Source Reference |
|---|---|---|---|
| `/agent/sessions` | `GET`/`POST`| List chat sessions or spawn a new conversation | [VERIFY: backend_rust/src/routes/mod.rs:572] |
| `/agent/sessions/:id`| `GET`/`PATCH`/`DELETE`| Retrieve session messages, rename, or delete | [VERIFY: backend_rust/src/routes/mod.rs:574] |
| `/agent/chat` | `POST` | Execute user query with tool calling & planning | [VERIFY: backend_rust/src/routes/mod.rs:577] |
| `/agent/upload_image`| `POST` | Attach reference image for multimodal analysis | [VERIFY: backend_rust/src/routes/mod.rs:575] |

### 5.5 System, Utilities & Telemetry
| Route | Method | Purpose | Source Reference |
|---|---|---|---|
| `/health` | `GET` | Instant health probe (status, version, db) | [VERIFY: backend_rust/src/routes/mod.rs:591] |
| `/utilities/search/fused`| `GET`| Fused semantic vector + SQL keyword search | [VERIFY: backend_rust/src/routes/mod.rs:544] |
| `/utilities/visual-duplicates`| `GET`| Perceptual hash Hamming distance clusters | [VERIFY: backend_rust/src/routes/mod.rs:538] |
| `/utilities/blurry` | `GET` | Laplacian blur score filtering (< 100.0) | [VERIFY: backend_rust/src/routes/mod.rs:530] |
| `/utilities/system-state`| `GET` | Instant hardware telemetry (CPU, battery, GPU) | [VERIFY: backend_rust/src/routes/mod.rs:551] |
| `/settings/events` | `GET` | Server-Sent Events (SSE) stream for live updates | [VERIFY: backend_rust/src/routes/mod.rs:511] |
| `/telemetry/stream` | `GET` | Live SSE stream of structured telemetry events | [VERIFY: backend_rust/src/routes/mod.rs:554] |
| `/maps/tiles/:provider/:z/:x/:y`| `GET`| Local tile proxy with offline disk caching | [VERIFY: backend_rust/src/routes/mod.rs:505] |
| `/shares` | `POST` | Create password-protected resource sharing token | [VERIFY: backend_rust/src/routes/mod.rs:579] |
| `/lan/discover` | `GET` | Broadcast & discover peer Prism instances on LAN | [VERIFY: backend_rust/src/routes/mod.rs:557] |

---

## 6. In-Process ONNX AI & Multimodal Neural Engines

Prism embeds ONNX Runtime directly into the Rust process using the `ort` crate, avoiding IPC serialization bottlenecks.

### 6.1 SigLIP2 Multimodal Vectorizer (`backend_rust/src/services/siglip.rs`)
- **Architecture**: In-process singleton instantiated via `OnceLock<Arc<SiglipEngine>>` [VERIFY: backend_rust/src/services/siglip.rs:14-20].
- **Vision Preprocessing**: Images are resized to $224 \times 224$ pixels using triangle filtering. Interleaved RGB bytes are converted into planar NCHW float values normalized to $[-1.0, 1.0]$:
  $$x_c(x, y) = \frac{\frac{p_c(x, y)}{255.0} - 0.5}{0.5}$$
  [VERIFY: backend_rust/src/services/siglip.rs:62-74].
- **Hypersphere Projection**: The output 768-dimensional tensor is normalized via L2 norm ($\epsilon = 10^{-12}$):
  $$\hat{\mathbf{v}} = \frac{\mathbf{v}}{\max(\|\mathbf{v}\|_2, 10^{-12})}$$
  [VERIFY: backend_rust/src/services/siglip.rs:125-131].
- **Vector Search Scoring**: Cosine similarity is computed via direct vector dot product. Scores below $0.15$ are filtered out as sub-threshold noise [VERIFY: backend_rust/src/services/agent_search.rs:51-57].

### 6.2 Facial Biometrics (`backend_rust/src/services/face_engine.rs`)
- **Face Detection**: Discovers human faces in photo canvases and computes bounding boxes $(x, y, w, h)$.
- **ArcFace Vectorization**: Generates 512-dimensional facial feature vectors.
- **Clustering**: Groups faces into individual `people` entities using cosine distance clustering, supporting manual naming, profile merging, and pending face confirmations [VERIFY: backend_rust/src/routes/people.rs:176-251].

### 6.3 OCR Engine (`backend_rust/src/services/ocr_engine.rs`)
- **Model**: PP-OCRv4 (PaddleOCR) execution via ONNX.
- **Output**: Generates both unified textual content (`ocr_text`) and polygonal bounding box coordinates (`ocr_bboxes`) [VERIFY: backend_rust/src/routes/photos_ai.rs:42-51].

### 6.4 Scene Reasoning & Florence-2
- **Florence-2**: Generates fine-grained captions and extracts localized object tags [VERIFY: backend_rust/src/services/analyzers/florence2_analyzer.rs:9-36].
- **Vision Analyzer**: Interfaces with local LLM vision models to produce rich Markdown photo summaries (`ai_summary`) and contextual auto-tags [VERIFY: backend_rust/src/services/analyzers/vision.rs:10-40].

### 6.5 Specialized Editing Models
- **Segment Anything Model (SAM)**: Enables zero-shot interactive point-click object segmentation and background removal [VERIFY: backend_rust/src/services/sam.rs:1-30].
- **Depth-Anything**: Monocular depth map generation for synthetic portrait blur and 3D parallax effects [VERIFY: backend_rust/src/services/depth.rs:1-30].
- **LaMa Inpainting**: Fourier-convolution inpainting for object removal and healing [VERIFY: backend_rust/src/services/inpaint.rs:1-30].

---

## 7. Autonomous Hardware-Aware AI Job Scheduler

The AI background worker (`backend_rust/src/services/worker.rs`) continuously polls OS telemetry and processes pending jobs without degrading user experience [VERIFY: backend_rust/src/services/worker.rs:465-538].

### 7.1 State-Dependent Throttling
Before dispatching inference, the scheduler probes the OS state [VERIFY: backend_rust/src/services/worker.rs:298-308]:
1. **CPU Guard**: If global CPU utilization exceeds $85.0\%$, the worker logs `cpu_overloaded` and sleeps for 10 seconds [VERIFY: backend_rust/src/services/worker.rs:301-303].
2. **Battery Guard**: If the device is running on battery (`on_battery == true`) and capacity drops below $20\%$, the worker logs `battery_critical` and sleeps for 30 seconds [VERIFY: backend_rust/src/services/worker.rs:304-306].

### 7.2 Prioritized Stage DAG
Analyzers execute in strict descending priority order [VERIFY: backend_rust/src/services/worker.rs:235-248]:
1. **`SiglipAnalyzer` (Priority 300, `CpuHeavy`)**: Vector embedding [VERIFY: backend_rust/src/services/analyzers/siglip.rs:24-30].
2. **`FaceAnalyzer` (Priority 200, `CpuHeavy`)**: Face bounding box and embedding extraction [VERIFY: backend_rust/src/services/analyzers/face.rs:23-29].
3. **`VisionAnalyzer` (Priority 100, `Gpu`)**: Scene summary [VERIFY: backend_rust/src/services/analyzers/vision.rs:23-29].
4. **`Florence2Analyzer` (Priority 90, `Gpu`)**: Object tags [VERIFY: backend_rust/src/services/analyzers/florence2_analyzer.rs:26-32].
5. **`OcrBboxAnalyzer` (Priority 0, `CpuLight`)**: Text recognition [VERIFY: backend_rust/src/services/analyzers/ocr_bbox.rs:28-34].

### 7.3 Stage-Aware Resume Logic
If the process terminates mid-execution, the scheduler checks populated database columns to determine the stage watermark and skips previously finished models [VERIFY: backend_rust/src/services/worker.rs:449-460]:
```rust
// [VERIFY: backend_rust/src/services/worker.rs:449-460]
fn get_resume_priority(has_embedding: bool, has_faces: bool, has_summary: bool, has_ocr: bool) -> u32 {
    if has_ocr { return 0; }
    if has_summary { return 100; }
    if has_faces { return 200; }
    if has_embedding { return 300; }
    0
}
```

---

## 8. Frontend Client Architecture (React + Vite + Zustand)

The user interface is built as a single-page reactive application rendered within Tauri or a modern browser [VERIFY: frontend/package.json:1-40].

### 8.1 View Routing (`ViewMode`)
Managed inside `frontend/components/layout/MainContent.tsx` [VERIFY: frontend/components/layout/MainContent.tsx:86-170]:
- **`gallery`**: Virtualized photo grid supporting justified aspect ratio rows, multi-selection, and bulk metadata operations.
- **`explore`**: Spatiotemporal trip clustering, "On This Day" anniversary retrospectives, and photography lens/camera statistics.
- **`people`**: Face identity management, profile naming, and candidate face verification.
- **`albums`**: Custom albums and smart albums (auto-classified screenshots, documents, and locations).
- **`map`**: Interactive Leaflet map displaying photo geographic clusters and GPS tag editors.
- **`locked`**: PIN-protected vault for confidential media, isolated from general search and APIs.
- **`trash`**: Soft-delete staging area supporting single/bulk restoration and permanent purging.
- **`agent`**: Natural language assistant interface for photo search and collection curation.
- **`toolbox`**: Image utility workspace for batch watermarking, palette extraction, and format transcoding.
- **`projects`**: Non-linear video editor project management dashboard.
- **`utilities`**: Storage cleanup tools, perceptual duplicate finder, blurry photo detector, and diagnostics.
- **`appearance`**: Custom themes, accent colors, and animation tuning.

### 8.2 Complete Zustand Store Inventory
The frontend state is partitioned into specialized stores under `frontend/store/`:
1. **`editStore.ts`**: Active image adjustments (exposure, contrast, saturation, curves, HSL sliders, crop bounds).
2. **`nleStore.ts`**: Video timeline document state, multi-track collections, clip selections, playhead position, and audio mixer gains.
3. **`uiStore.ts`**: Active view mode, modal dialog states, sidebar visibility, and toast notifications.
4. **`settingsStore.ts`**: Server preferences cache, API key configuration, telemetry preferences, and model settings.
5. **`syncStore.ts`**: LAN sync peer discovery, pairing handshake progress, and transfer statistics.
6. **`videoPlayerStore.ts`**: Video playback engine state, volume, playback speed, and buffering indicators.
7. **`aiLoadingStore.ts`**: Progress tracking for long-running AI operations (upscaling, inpainting, depth generation).
8. **`editDraftStore.ts`**: Auto-save draft storage for in-progress image edits to prevent data loss.
9. **`pluginStore.ts`**: Installed plugin registry, active extensions, and plugin catalog state.
10. **`galleryLayoutStore.ts`**: Grid layout preferences (justified vs masonry, thumbnail scale, display details).
11. **`mobileStore.ts`**: Responsive mobile drawer states, bottom navigation, and touch gesture handlers.

---

## 9. Pro Creative Suites: Image Editor & NLE Video Editor

### 9.1 Image Editor Studio (`frontend/components/Editor/ImageEditor/`)
- **Non-Destructive Pipeline**: Adjustments are stored as JSON sidecars on `photos.adjustments_json` and rendered on HTML5 Canvas [VERIFY: backend_rust/src/routes/photos/upload.rs:257].
- **Color Grading**:
  - **Tone Curves**: Cubic spline interpolation across master RGB and independent Red, Green, and Blue channels.
  - **HSL Panel**: 8 independent color channels (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta) with Hue shift, Saturation, and Luminance sliders.
  - **Color Wheels**: 3-way color grading (Lift, Gamma, Gain, Offset) with master luminance wheels.
- **Liquify Deformation**: Real-time mesh warp supporting push, reconstruct, smooth, twirl clockwise/counter-clockwise, pucker, and bloat brush modes.
- **Neural Healing Brush**: Interactive brush mask dispatched to `/api/v1/photos/inpaint/process` for LaMa Fourier-convolution texture synthesis.
- **Content Authenticity (C2PA)**: Provenance engine for inspecting and embedding cryptographic edit manifests.
- **RAW Engine**: Handles Camera RAW formats (DNG, ARW, CR2, NEF) with client-side development via `rawEngine.ts`, supporting Planckian locus Kelvin (2000K–20000K) + tint white balance, logarithmic exposure compensation (-5.0 EV to +5.0 EV), directional demosaicing simulation (AMaZE, AHD, RCD), highlight recovery, and wavelet luminance/chrominance noise reduction [VERIFY: frontend/components/Editor/ImageEditor/rawEngine.ts:1-64; backend_rust/src/routes/utilities.rs:77].

### 9.2 Non-Linear Video Editor (NLE) (`frontend/components/Editor/VideoEditor/`)
- **Multi-Track Synthesis**: Supports unlimited Video, Audio, and Text tracks with z-index stacking and alpha blending [VERIFY: frontend/types/nle.ts:26-37].
- **Timeline Algebra**:
  - Clip time remapping: $t_{src} = t_{in} + \sigma \cdot (t_{tl} - \frac{F_{start}}{\text{fps}})$ [VERIFY: frontend/types/nle.ts:70-78].
  - 2D affine transformations: $\mathbf{M} = \mathbf{T}(x, y) \cdot \mathbf{R}(\theta) \cdot \mathbf{S}(s_x, s_y)$ [VERIFY: frontend/types/nle.ts:39-46].
- **Cubic Bézier Keyframing**: Smooth keyframe transitions for opacity, scale, rotation, and volume parameterized via Bézier control points [VERIFY: frontend/types/nle.ts:50-63].
- **Audio Ducking & EQ**: 3-band parametric equalization (bass, mid, treble) and automatic dialogue-over-music volume ducking [VERIFY: frontend/types/nle.ts:99-100].
- **Professional Color Scopes**: Real-time Waveform monitor, Vectorscope, and RGB Parade rendered on Canvas via WebGL shaders.
- **Export Engine**: Fast-path client-side WebCodecs encoding directly to MP4 via `mp4-muxer` [VERIFY: frontend/package.json:32] with fallback to server-side FFmpeg filtergraph rendering [VERIFY: backend_rust/src/routes/mod.rs:491].

---

## 10. Autonomous Conversational Agent (`AgentView`)

Mounted under `/api/v1/agent/...` and `frontend/components/AgentView/` [VERIFY: backend_rust/src/routes/agent.rs:34-100].

### Workflow & Capabilities
1. **Session Persistence**: Chat sessions are stored in `agent_sessions`, and message histories are tracked in `agent_messages` with structured JSON columns for tool payloads (`photos_json`, `plan_json`, `tools_json`) [VERIFY: backend_rust/src/db.rs:199-217].
2. **Autonomous Intent Parsing**: The planner classifies user prompts into structured search intents (`photo_search`, `analyze_photo`, `count_photos`, `create_smart_album`) [VERIFY: backend_rust/src/services/agent_planner.rs:68-76].
3. **Multimodal Reasoning**: Users can upload or reference images directly in chat to query visual similarities or request detailed descriptions [VERIFY: backend_rust/src/routes/agent.rs:310-345].
4. **Interactive UI Feedback**: Renders thinking step indicators, suggested follow-ups, and inline interactive photo grids allowing instant selection and album creation.

---

## 11. Local Network Synchronization, Sharing & Import Tools

### 11.1 LAN Peer Discovery & Sync (`backend_rust/src/routes/lan_sync.rs`)
- **Peer Discovery**: Discovers running Prism nodes on the local Wi-Fi/Ethernet network via `/api/v1/lan/discover` [VERIFY: backend_rust/src/routes/lan_sync.rs:40-57].
- **PIN-Secured Pairing**: Exchanges cryptographically signed pairing tokens authenticated by user PIN [VERIFY: backend_rust/src/routes/lan_sync.rs:67-70].
- **Differential Manifest Synchronization**: Compares photo UUID manifests between instances and streams missing original binaries and EXIF metadata over high-speed local TCP.

### 11.2 Ephemeral Resource Sharing (`backend_rust/src/routes/shares.rs`)
- **Tokenized Links**: Creates random UUID sharing tokens pointing to photos or albums [VERIFY: backend_rust/src/models.rs:169-183].
- **Privacy Stripping**: Configurable options to strip EXIF camera metadata and remove GPS coordinates before file download (`hide_exif = 1`, `hide_gps = 1`).
- **Access Limits**: Password protection via Argon2 hashing, maximum download count quotas, and auto-expiring timestamps.

### 11.3 Google Takeout ZIP Importer (`backend_rust/src/routes/google_import.rs`)
- **Archive Extraction**: Accepts Google Takeout ZIP uploads, unpacks image/video binaries, and parses companion `.json` metadata sidecar files [VERIFY: backend_rust/src/routes/google_import.rs:9-50].
- **Timestamp & GPS Reconciliation**: Merges Google's `photoTakenTime` timestamps and geodata back into the database records.

---

## 12. Extensibility System: Plugins & Model Packs

### 12.1 Plugin System (`backend_rust/src/services/plugins.rs`)
- **Manifest Architecture**: Plugins declare unique IDs, categories, permissions, capabilities, and frontend entrypoint scripts in `plugin.json` [VERIFY: backend_rust/src/services/plugins.rs:8-26].
- **Installed Catalog**:
  - `ai-vision-studio`: Advanced segmentation and object tracking extensions.
  - `creative-color-studio`: Analog film simulations and specialized 3D LUT presets.
  - `retouch-metadata-studio`: Batch IPTC and copyright tagging workflows.

### 12.2 Model Packs (`backend_rust/src/services/packs.rs`)
- **Dynamic Model Registration**: Remote model packs are downloaded on-demand and registered dynamically into `ModelManager` without requiring server recompilation [VERIFY: backend_rust/src/main.rs:105-110].
- **License Tracking**: Persists user license acknowledgments in the `settings` table [VERIFY: backend_rust/src/main.rs:112-123].

---

## 13. Command-Line Interface (`cli/`)

The CLI is a fast, statically compiled Rust application built with `clap` and `reqwest` [VERIFY: cli/src/main.rs:14-105].

```bash
# General health & library statistics
prism status
prism stats

# Querying and search
prism photos --limit 50
prism photo <id_or_uuid>
prism search "sunset at the beach" --limit 20

# Library management
prism import /path/to/photos --recursive
prism export --album-id 4 --output-dir /backup/album4
prism purge-trash

# System & extension management
prism config [key] [value]
prism diagnostics
prism plugins list
prism install /path/to/plugin.json
prism uninstall <plugin_id>
```

---

## 14. Security, Privacy, and Sandboxing

1. **Zero External Network Calls**: The core backend binds strictly to `0.0.0.0` or `127.0.0.1` and performs zero background phone-home calls.
2. **Encrypted Passwords**: All local administrative credentials and sharing link passwords use Argon2 with cryptographically secure random salt strings [VERIFY: backend_rust/src/db.rs:309-318].
3. **Database Injection Defense**: 100% of queries use SQLx parameterized query binding (`$1, $2, ...` or `?`), eliminating SQL injection vulnerabilities.
4. **Path Traversal Protection**: File serving endpoints resolve canonical paths and ensure access is confined within configured roots [VERIFY: backend_rust/src/routes/photos/upload.rs:56-58].
5. **Content Security Policy (CSP)**: Tauri enforces a restrictive CSP restricting external scripts:
   `default-src 'self'; img-src 'self' http: https: data: blob:; media-src 'self' http: https: data: blob:; script-src 'self'` [VERIFY: frontend/src-tauri/tauri.conf.json:24-26].

---

## 15. Development, Build, Testing, and Troubleshooting Guide

### Environment Variables
| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `0.0.0.0` | Backend bind address |
| `PORT` | `8269` | Backend listening port |
| `DATABASE_URL` | `sqlite://prism.db` | SQLite database connection string |
| `UPLOAD_DIR` | `uploads` | Directory for stored media files |
| `THUMBNAILS_DIR` | `thumbnails` | Directory for cached thumbnails |
| `GPU_MODE` | `cpu` | Hardware acceleration (`cpu`, `cuda`, `metal`) |
| `RUST_LOG` | `info` | Tracing log level filter |

### Standard Development Commands
```bash
# 1. Run full web development stack (backend on 8269, Vite on 3005)
./run-web.sh

# 2. Run native desktop application (backend + Tauri window)
./run-desktop.sh

# 3. Backend development commands
cd backend_rust
cargo build            # Compile debug binary
cargo run              # Start backend standalone
cargo test             # Execute backend unit and integration test suite
cargo clippy           # Run Rust linter

# 4. Frontend development commands
cd frontend
pnpm install           # Install node dependencies
pnpm dev               # Launch Vite dev server
pnpm build             # Production Vite build (to dist/)
pnpm test              # Run frontend unit tests via Vitest
pnpm tsc               # Type-check TypeScript sources
```

### Common Diagnostic Tasks
- **Database Inspection**: `sqlite3 backend_rust/prism.db "PRAGMA quick_check;"` [VERIFY: backend_rust/src/db.rs:36-37].
- **Database Compaction**: `POST /api/v1/settings/vacuum` executes SQLite `VACUUM` to reclaim disk space [VERIFY: backend_rust/src/routes/mod.rs:515].
- **Backend Logging**: Set `RUST_LOG=debug cargo run` to observe real-time worker loop scheduling, sysfs polling, and inference execution.
