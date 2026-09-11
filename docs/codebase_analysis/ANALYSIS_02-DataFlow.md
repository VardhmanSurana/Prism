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
- [7. Verification Report](#7-verification-report)

---

## 1. Data Flow Architecture Overview

Data flow in Prism connects disk media, Axum API endpoints, SQLite tables, ONNX tensor execution, and client Zustand stores:

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

The ingestion pipeline handles both raw binary streaming and multipart file upload:

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
[4] Sequential Analyzer Execution
    - Stage 1: SiglipAnalyzer (Priority 300) -> Writes 768-dim float array [VERIFY: backend_rust/src/services/analyzers/siglip.rs:24-60]
    - Stage 2: FaceAnalyzer (Priority 200) -> Writes detected face boxes & embeddings [VERIFY: backend_rust/src/services/analyzers/face.rs:23-52]
    - Stage 3: Vision / Florence2 (Priority 100/90) -> Writes scene description [VERIFY: backend_rust/src/services/analyzers/vision.rs:23-40]
    - Stage 4: OcrBboxAnalyzer (Priority 0) -> Writes recognized text & bboxes [VERIFY: backend_rust/src/services/analyzers/ocr_bbox.rs:28-40]
        │
        ▼
[5] Job Completion & Progress Recording
    - Updates `background_jobs` status to 'completed' or 'failed' [VERIFY: backend_rust/src/services/worker.rs:522-528]
    - Increments atomic completed/failed counters on `WorkerState` [VERIFY: backend_rust/src/services/worker.rs:525-527]
```

---

## 4. Fused Multimodal Search Execution Flow

The `fused_search` pipeline joins neural vector search with relational keyword filtering:

```
User Query: "golden retriever on the beach"
        │
        ▼
GET /api/v1/utilities/search/fused?q=...&limit=20
        │
        ▼
[1] Vector Generation
    - Passes query text to `SiglipEngine::embed_text` [VERIFY: backend_rust/src/services/siglip.rs:96-121]
    - Produces 768-dimensional L2-normalized float vector [VERIFY: backend_rust/src/services/siglip.rs:118-120]
        │
        ▼
[2] In-Memory Dot-Product Scoring
    - Fetches non-null embeddings from SQLite `photos` table [VERIFY: backend_rust/src/services/agent_search.rs:36-42]
    - Computes dot product: Sim(q, d) = Σ (q_i * d_i) [VERIFY: backend_rust/src/services/agent_search.rs:51-54]
    - Retains candidates with similarity >= 0.15 [VERIFY: backend_rust/src/services/agent_search.rs:55-57]
    - Sorts descending by similarity score [VERIFY: backend_rust/src/services/agent_search.rs:62]
        │
        ▼
[3] Relational Keyword Fallback
    - If vector search yielded fewer results than `limit`: [VERIFY: backend_rust/src/routes/utilities.rs:804]
    - Builds SQL query with `LIKE %term% ESCAPE '\'` across:
      `ai_summary`, `caption`, `auto_tags`, `ocr_text` [VERIFY: backend_rust/src/routes/utilities.rs:821-830]
    - Excludes IDs already returned by semantic search [VERIFY: backend_rust/src/routes/utilities.rs:833-844]
        │
        ▼
[4] Unified JSON Response
    - Merges semantic hits and keyword fallback rows into unified array [VERIFY: backend_rust/src/routes/utilities.rs:851-858]
```

---

## 5. Real-Time Telemetry & Event Streaming

Prism monitors system health and API performance using an adaptive telemetry sampling pipeline:

```
Incoming Request
        │
        ▼
[1] Request Interception (`telemetry_tracking_layer`)
    - Captures start timestamp and request URI [VERIFY: backend_rust/src/routes/mod.rs:134-137]
    - Skips polling routes (`/telemetry/*`, `/background-jobs/status`) [VERIFY: backend_rust/src/routes/mod.rs:141-146]
        │
        ▼
[2] Response Execution & Timing
    - Awaits inner handler: `next.run(req).await` [VERIFY: backend_rust/src/routes/mod.rs:148]
    - Computes elapsed duration in milliseconds [VERIFY: backend_rust/src/routes/mod.rs:150]
        │
        ▼
[3] Adaptive Sampling Decision
    - Always records errors (HTTP status >= 400) [VERIFY: backend_rust/src/routes/mod.rs:156]
    - If status < 400, samples 1 in every N requests using atomic counter [VERIFY: backend_rust/src/routes/mod.rs:159-160]
        │
        ▼
[4] Asynchronous Event Insertion
    - Writes record into SQLite `telemetry_events` table [VERIFY: backend_rust/src/db.rs:186-197]
    - Streams live telemetry events over SSE to connected clients [VERIFY: backend_rust/src/routes/mod.rs:554]
```

---

## 6. Non-Linear Video Editor (NLE) Pipeline

Video editing operations are routed between client-side WebCodecs canvas rendering and server-side FFmpeg processing:

```
[Import Clip into Timeline]
        │
        ▼
[1] Proxy Generation Request
    - POST /api/v1/nle/clips/proxy [VERIFY: backend_rust/src/routes/nle.rs:484]
    - Server invokes FFmpeg to generate lightweight editing proxy
        │
        ▼
[2] Timeline State Serialization
    - Client updates multi-track Zustand store (`nleStore`)
    - PUT /api/v1/nle/projects/:id persists `TimelineState` JSON [VERIFY: backend_rust/src/routes/nle.rs:483]
        │
        ▼
[3] Export Pipeline
    - Client initiates export: POST /api/v1/nle/export [VERIFY: backend_rust/src/routes/mod.rs:491]
    - Option A (Client Fast-Path): WebCodecs frame-by-frame canvas render to `mp4-muxer`
    - Option B (Server High-Quality): FFmpeg complex filtergraph rendering with audio ducking
```

---

## 7. Verification Report

| Data Flow Stage | Implementation Code Reference | Verification Description | Status |
|---|---|---|---|
| Upload Dispatch | `backend_rust/src/routes/photos/upload.rs:34-65` | Header parsing, disk write, deduplication | ✓ Verified |
| EXIF & Dimensions | `backend_rust/src/routes/photos/upload.rs:100-120` | Extraction of width, height, aspect ratio, camera data | ✓ Verified |
| Queue Notification | `backend_rust/src/routes/photos/upload.rs:170-173` | Enqueuing in `background_jobs` and waking worker | ✓ Verified |
| System Telemetry Check | `backend_rust/src/services/worker.rs:298-308` | CPU usage > 85% and battery < 20% throttling | ✓ Verified |
| Stage Priority Filter | `backend_rust/src/services/worker.rs:257-272` | Skipping completed analyzers based on photo columns | ✓ Verified |
| SigLIP2 Vector Flow | `backend_rust/src/services/siglip.rs:54-93` | 224x224 RGB image normalization & tensor output | ✓ Verified |
| Semantic Dot-Product | `backend_rust/src/services/agent_search.rs:50-58` | Vector dot-product with 0.15 threshold filtering | ✓ Verified |
| Keyword Fallback Flow | `backend_rust/src/routes/utilities.rs:804-858` | SQLite LIKE multi-field escape and text supplementation | ✓ Verified |
| Telemetry Sampling | `backend_rust/src/routes/mod.rs:148-160` | Error preservation and 1-in-N atomic counter sampling | ✓ Verified |
| NLE Timeline Flow | `backend_rust/src/routes/nle.rs:481-494` | Project creation, proxy generation, and export status | ✓ Verified |
