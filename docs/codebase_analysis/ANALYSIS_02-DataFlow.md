# Prism Technical Analysis: Data Flow

> **Document**: ANALYSIS_02-DataFlow.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 3  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [1. Data Flow Architecture Overview](#1-data-flow-architecture-overview)
- [2. Media Ingestion & Persistence Pipeline](#2-media-ingestion--persistence-pipeline)
- [3. Autonomous AI Worker Processing Cascade](#3-autonomous-ai-worker-processing-cascade)
- [4. Fused Multimodal Search Execution Flow](#4-fused-multimodal-search-execution-flow)
- [5. Real-Time Telemetry & Event Streaming](#5-real-time-telemetry--event-streaming)
- [6. Non-Linear Video Editor (NLE) Pipeline](#6-non-linear-video-editor-nle-pipeline)
- [7. Local Cryptographic Sharing & Export Flow](#7-local-cryptographic-sharing--export-flow)
- [8. Verification Report](#8-verification-report)

---

## 1. Data Flow Architecture Overview

Data flow in Prism connects disk media, Axum API endpoints, SQLite tables, in-process ONNX neural models, and reactive frontend Zustand stores:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          End-to-End Prism Data Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Client Action]        [Axum Ingestion]         [Database & Task Queue]    │
│  File Drag & Drop ────▶ POST /upload     ──────▶ INSERT INTO photos         │
│                         - Writes to uploads/     - INSERT background_jobs   │
│                         - Parses EXIF tags       - Notifies AI Worker       │
│                                                          │                  │
│                                                          ▼                  │
│  [Client UI Sync]       [Worker Scheduler]       [In-Process AI Pipeline]   │
│  Zustand Store    ◀──── SSE /settings/events ◀── SigLIP2 Embed (768d)       │
│  Virtual Grid           - State: "completed"     Face Engine (ArcFace)      │
│  Search Index           - Stage progress JSON    Florence-2 / Vision        │
│                                                  PP-OCRv4 (Text & BBoxes)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Media Ingestion & Persistence Pipeline

The ingestion pipeline handles both raw binary streaming and JSON path-referencing:

```
Client Request (Binary Body / JSON Path / Multipart)
        │
        ▼
[1] Body Dispatch & File Writing
    - Checks Content-Type header [VERIFY: backend_rust/src/routes/photos/upload.rs:39-42]
    - Saves target file into `uploads/` [VERIFY: backend_rust/src/routes/photos/upload.rs:60-64]
    - Deduplicates against existing file paths [VERIFY: backend_rust/src/routes/photos/upload.rs:74-78]
        │
        ▼
[2] Metadata Extraction & EXIF Parsing
    - Probes image dimensions & aspect ratio [VERIFY: backend_rust/src/routes/photos/upload.rs:100-104]
    - Extracts EXIF camera make, model, ISO, focal length [VERIFY: backend_rust/src/routes/photos/upload.rs:105]
    - Generates RFC4122 v4 UUID string [VERIFY: backend_rust/src/routes/photos/upload.rs:107]
        │
        ▼
[3] Database Transaction & Webhook Notification
    - Executes parameterized SQL INSERT into `photos` [VERIFY: backend_rust/src/routes/photos/upload.rs:109-132]
    - Dispatches async webhook event `photo.imported` [VERIFY: backend_rust/src/routes/photos/upload.rs:150-160]
        │
        ▼
[4] Thumbnail Generation & Queue Awakening
    - Dispatches blocking task to render 400px thumbnail [VERIFY: backend_rust/src/routes/photos/upload.rs:166-168]
    - Inserts job row into `background_jobs` table [VERIFY: backend_rust/src/routes/photos/upload.rs:171]
    - Calls `state.worker.notify.notify_one()` to wake scheduler [VERIFY: backend_rust/src/routes/photos/upload.rs:172]
```

---

## 3. Autonomous AI Worker Processing Cascade

The background AI processor is orchestrated by an asynchronous event loop that executes registered analyzers in order of priority:

```
Worker Event Loop (`spawn_worker_loop`)
        │
        ▼
[1] System Telemetry Guard (`check_system`)
    - Checks CPU load; if > 85%, sleeps 10 seconds [VERIFY: backend_rust/src/services/worker.rs:301-303]
    - Checks battery; if discharging & < 20%, sleeps 30 seconds [VERIFY: backend_rust/src/services/worker.rs:304-306]
        │
        ▼
[2] Pending Job Selection (`fetch_pending_job`)
    - Queries `background_jobs` for oldest row with status='pending' [VERIFY: backend_rust/src/services/worker.rs:498-504]
    - Converts row into lean `PhotoRecord` [VERIFY: backend_rust/src/services/worker.rs:316-324]
        │
        ▼
[3] Execution Planning (`AnalyzerRegistry::plan`)
    - Computes resume priority: skips already completed stages [VERIFY: backend_rust/src/services/worker.rs:258-264]
    - Filters remaining analyzers by hardware availability [VERIFY: backend_rust/src/services/worker.rs:268-270]
        │
        ▼
[4] Priority Execution Cascade:
    ├─ Priority 300: SiglipAnalyzer [VERIFY: backend_rust/src/services/analyzers/siglip.rs:24-60]
    │  - Normalizes pixels and generates 768d float embedding
    │  - Writes embedding JSON & binary blob to SQLite
    │  - Inserts vector into memory HNSW index
    ├─ Priority 200: FaceAnalyzer [VERIFY: backend_rust/src/services/analyzers/face.rs:23-52]
    │  - Scans ArcFace 512d face embeddings
    │  - Inserts detected faces into `faces` table
    ├─ Priority 100: VisionAnalyzer [VERIFY: backend_rust/src/services/analyzers/vision.rs:23-40]
    │  - Calls Florence-2 / Vision model
    │  - Updates `ai_summary`, `caption`, and `auto_tags` in SQLite
    └─ Priority 0: OcrBboxAnalyzer [VERIFY: backend_rust/src/services/analyzers/ocr_bbox.rs:28-40]
       - Runs PP-OCRv4 detection and recognition
       - Stores extracted text and bounding boxes in SQLite
        │
        ▼
[5] Status Transition & Client Notification
    - Marks background job 'completed' in SQLite [VERIFY: backend_rust/src/services/worker.rs:522-528]
    - Increments global worker completed counter [VERIFY: backend_rust/src/services/worker.rs:525-527]
```

---

## 4. Fused Multimodal Search Execution Flow

The fused search pipeline combines semantic vector dot-product scoring with SQLite keyword matching:

```
User Query Input ("sunset on water")
        │
        ▼
[1] Embedding Generation
    - SigLIP2 tokenizes query and computes 768d unit vector [VERIFY: backend_rust/src/services/siglip.rs:96-121]
    - Normalizes vector to unit Euclidean norm [VERIFY: backend_rust/src/services/siglip.rs:118-120]
        │
        ▼
[2] Track A: Parallel Vector Dot-Product Scan
    - Reads candidate vectors from `embedding_blob` [VERIFY: backend_rust/src/services/agent_search.rs:36-42]
    - Computes inner dot product via auto-vectorized SIMD [VERIFY: backend_rust/src/services/agent_search.rs:51-54]
    - Filters results using minimum threshold score >= 0.15 [VERIFY: backend_rust/src/services/agent_search.rs:55-57]
    - Sorts descending by score and truncates to limit [VERIFY: backend_rust/src/services/agent_search.rs:62]
        │
        ▼
[3] Track B: Fallback Text Matching (if count < limit)
    - Checks if vector results are fewer than requested limit [VERIFY: backend_rust/src/routes/utilities.rs:808]
    - Performs SQL LIKE matching across: [VERIFY: backend_rust/src/routes/utilities.rs:821-830]
      ai_summary, caption, auto_tags, and ocr_text
    - Excludes existing vector match IDs: `id NOT IN (...)` [VERIFY: backend_rust/src/routes/utilities.rs:833-844]
        │
        ▼
[4] Response Aggregation & Serialization
    - Joins photo metadata rows from SQLite [VERIFY: backend_rust/src/routes/utilities.rs:851-858]
    - Returns JSON response with score and match_type indicators
```

---

## 5. Real-Time Telemetry & Event Streaming

Prism monitors system health and notifies connected clients via Server-Sent Events (SSE):

```
HTTP Request Execution
        │
        ▼
[1] Telemetry Interceptor Layer
    - Measures wall-clock request duration [VERIFY: backend_rust/src/routes/mod.rs:134-137]
    - Skips internal polling paths to prevent feedback loops [VERIFY: backend_rust/src/routes/mod.rs:143-146]
    - Passes request to downstream business handler [VERIFY: backend_rust/src/routes/mod.rs:150]
        │
        ▼
[2] Dynamic Sampling Decision
    - Always records responses with status >= 400 (errors) [VERIFY: backend_rust/src/routes/mod.rs:154-155]
    - Evaluates 1-in-N atomic counter for successful requests [VERIFY: backend_rust/src/routes/mod.rs:159-160]
        │
        ▼
[3] Asynchronous Persistence & Client SSE Broadcast
    - Inserts event row into `telemetry_events` table [VERIFY: backend_rust/src/db.rs:192-203]
    - Broadcasts event to connected clients on SSE channel `/api/v1/settings/events`
```

---

## 6. Non-Linear Video Editor (NLE) Pipeline

```
NLE Media Editing & Export
        │
        ▼
[1] Waveform Peak Extraction (`/api/v1/nle/audio-peaks`)
    - Spawns FFmpeg to extract mono 44.1kHz f32le audio samples [VERIFY: backend_rust/src/routes/nle.rs:471-477]
    - Downsamples samples into 200 normalized peaks [VERIFY: backend_rust/src/routes/nle.rs:484-499]
        │
        ▼
[2] Frame Preview Extraction (`/api/v1/nle/preview/render`)
    - Performs seek to playhead position t: `ffmpeg -ss {t} -i {src}` [VERIFY: backend_rust/src/routes/nle.rs:515-520]
    - Renders preview JPEG to temporary directory [VERIFY: backend_rust/src/routes/nle.rs:521]
        │
        ▼
[3] Production Render Export (`/api/v1/nle/export`)
    - Builds multi-track `-filter_complex` specification [VERIFY: backend_rust/src/routes/nle.rs:537-550]
    - Applies transforms, trims, transitions, and audio EQ
    - Encodes final MP4 deliverable on host filesystem
```

---

## 7. Local Cryptographic Sharing & Export Flow

```
Local Asset Sharing
        │
        ▼
[1] Share Token Generation (`POST /api/v1/shares`)
    - Generates 128-bit UUID share_token [VERIFY: backend_rust/src/db.rs:252]
    - Optionally hashes access password with Argon2id [VERIFY: backend_rust/src/db.rs:255]
    - Sets expiration timestamp and download quotas [VERIFY: backend_rust/src/db.rs:256-258]
        │
        ▼
[2] Shared Asset Download (`GET /share/:token`)
    - Validates token existence, expiration, and quota limits
    - If `hide_exif` is enabled, dynamically strips EXIF headers from image stream [VERIFY: backend_rust/src/db.rs:259]
    - If `hide_gps` is enabled, sanitizes GPS metadata tags [VERIFY: backend_rust/src/db.rs:260]
    - Streams sanitized binary to client
```

---

## 8. Verification Report

| Pipeline Step | Source Code Location | Description | Status |
|---|---|---|---|
| Upload Dispatch & File Write | `backend_rust/src/routes/photos/upload.rs:39-64` | Binary/JSON branching and disk write | ✓ Verified |
| Deduplication Guard | `backend_rust/src/routes/photos/upload.rs:74-78` | Deduplication by existing file path | ✓ Verified |
| EXIF & Dimension Extraction | `backend_rust/src/routes/photos/upload.rs:100-105`| Image dimensions, camera make/model | ✓ Verified |
| Database Insert & Webhook | `backend_rust/src/routes/photos/upload.rs:109-160`| SQL insert and photo.imported event | ✓ Verified |
| Thumbnail & Worker Awakening | `backend_rust/src/routes/photos/upload.rs:166-172`| spawn_blocking thumbnail, notify_one() | ✓ Verified |
| System Monitor Throttling | `backend_rust/src/services/worker.rs:301-306` | CPU > 85%, Battery < 20% guards | ✓ Verified |
| Pending Job Fetch & Plan | `backend_rust/src/services/worker.rs:498-507` | Oldest pending job fetch, DAG planning | ✓ Verified |
| SigLIP Vectorization | `backend_rust/src/services/analyzers/siglip.rs:24-60`| 768d vector creation and DB save | ✓ Verified |
| Face Engine Scan | `backend_rust/src/services/analyzers/face.rs:23-52` | ArcFace detection and DB save | ✓ Verified |
| Vision Scene Description | `backend_rust/src/services/analyzers/vision.rs:23-40`| Captioning, summary, and auto_tags | ✓ Verified |
| PP-OCRv4 Text Extraction | `backend_rust/src/services/analyzers/ocr_bbox.rs:28-40`| Text recognition and bounding boxes | ✓ Verified |
| Fused Vector + Text Search | `backend_rust/src/routes/utilities.rs:750-860` | Dot-product vector + SQL LIKE fallback | ✓ Verified |
| Telemetry Tracking Layer | `backend_rust/src/routes/mod.rs:134-160` | Wall-clock latency, dynamic 1-in-N | ✓ Verified |
| NLE Audio Peaks & Export | `backend_rust/src/routes/nle.rs:471-550` | 200 audio peaks, fast preview, export | ✓ Verified |
