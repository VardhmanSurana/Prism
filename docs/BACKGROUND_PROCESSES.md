# Prism Background Processes

Comprehensive documentation of background processing pipelines, job queues, scheduling, throttling, and event broadcasting in Prism.

All background AI processing runs **in-process** inside the Rust backend (`backend_rust/`) — there is no separate ML service.

---

## Table of Contents

- [Overview](#overview)
- [Processing Queue Architecture](#processing-queue-architecture)
- [Database-Backed Jobs](#database-backed-jobs)
- [4-Stage Analysis Pipeline](#4-stage-analysis-pipeline)
- [Adaptive Scheduling & Throttling](#adaptive-scheduling--throttling)
- [Job Recovery & Retry](#job-recovery--retry)
- [Content Classification](#content-classification)
- [SSE Event Broadcasting](#sse-event-broadcasting)
- [Engine Settings & Worker Gating](#engine-settings--worker-gating)

---

## Overview

Prism runs a background worker that analyzes imported media (embeddings, faces, captions, OCR) without blocking the UI. It is a database-backed job queue driven by a resource-aware scheduler: jobs are stored in SQLite, picked up by a persistent Tokio task, and only run when the system has capacity.

### Background Process Layers

```
┌─────────────────────────────────────────────────────────┐
│                 AI Job Scheduler (worker.rs)             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Stage 1 │ │ Stage 2 │ │ Stage 3 │ │ Stage 4 │       │
│  │ SigLIP  │ │  Face   │ │  Gemma  │ │   OCR   │       │
│  │ Embed.  │ │ Detect. │ │ Vision  │ │ Extract │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                SystemMonitor (CPU/battery/GPU)           │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              SQLite background_jobs table
                         │
                         ▼
                 SSE events → React UI
```

### Key Files

| Component | Path |
|-----------|------|
| Worker loop, scheduler, system monitor | `backend_rust/src/services/worker.rs` |
| Analyzer stages (SigLIP / face / vision / OCR) | `backend_rust/src/services/analyzers/` |
| In-process SigLIP engine | `backend_rust/src/services/siglip.rs` |
| In-process face engine (SCRFD + ArcFace via ONNX) | `backend_rust/src/services/face_engine.rs` |
| Local LLM server (vision / OCR / agent) | `backend_rust/src/services/llm_server.rs`, `llm_client.rs` |
| Background job table | `backend_rust/src/db.rs` (`background_jobs`) |
| Worker control endpoints | `backend_rust/src/routes/utilities.rs` |

---

## Processing Queue Architecture

The worker lives in `backend_rust/src/services/worker.rs`. It is composed of:

- **`JobScheduler`** — polls system state (CPU, battery, GPU, external drives, user activity) and decides which analyzers may run.
- **`AnalyzerRegistry`** — holds the four built-in analyzers, sorted by priority (SigLIP 300 → Face 200 → Vision 100 → OCR 0).
- **`WorkerState`** — shared counters and a pause flag; exposes a `status_snapshot()` used by the status endpoint.
- **`spawn_worker_loop`** — the persistent Tokio task that drains the queue.

### Job Lifecycle

```
Photo Import → enqueue_photo() → status: "pending"
                                   │
                            worker picks up job
                                   │
                         status: "processing"
                                   │
                    plan_analyzers() filters by
                    resume priority + system state
                                   │
                     Run allowed analyzers
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              all stages OK                  any stage failed
                    │                             │
              status: "completed"        retry < MAX_RETRIES (5)?
                                             │            │
                                           yes           no
                                            │            │
                                     status:      status:
                                     "pending"    "failed"
                                     (delayed)
```

### Duplicate Prevention

`enqueue_photo()` skips a photo that already has a `pending` or `processing` `sequential_analysis` job, so imports never create duplicate work.

---

## Database-Backed Jobs

Jobs are stored in the `background_jobs` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Auto-increment |
| `photo_id` | Integer (FK) | References the photo |
| `job_type` | String | `"sequential_analysis"` |
| `status` | String | `pending`, `processing`, `completed`, `failed` |
| `attempt_count` | Integer | Number of retry attempts |
| `last_error` | Text | Error message from last failure |
| `current_stage` | String | Current pipeline stage |
| `stage_progress` | Text | JSON progress data |
| `created_at` | DateTime | Job creation time |
| `updated_at` | DateTime | Last update time |

---

## 4-Stage Analysis Pipeline

Each job runs up to four independent analyzer stages. Stages are priority-ordered and **stage-aware resume** skips any stage whose data already exists (checked per-photo in `get_resume_priority`):

- If a photo already has OCR text → only stages with priority > 0 run.
- If it has a summary → face and SigLIP are skipped.
- If it has faces → only SigLIP runs.
- If it has an embedding → nothing runs (job completes instantly).

### Stage 1: SigLIP2 Embeddings (`SiglipAnalyzer`, priority 300)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_CLIP=True` and photo has no embedding.

**Process**:
1. Run the in-process SigLIP2 model (`models/llm/siglip2_image.onnx`, ONNX Runtime)
2. Generate a 768-dimensional L2-normalized embedding
3. Store as JSON in `photo.embedding`

### Stage 2: Face Detection & Clustering (`FaceAnalyzer`, priority 200)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_FACE=True` (images) or `ENABLE_VIDEO_BG_PROCESS=True` and `ENABLE_VIDEO_FACE=True` (videos).

**Process**:
1. Run `face_engine.rs` (SCRFD + ArcFace w600k via ONNX Runtime)
2. Detect faces, extract embeddings, cluster against known people
3. Store assignments in `photo_people`; create pending assignments for borderline matches

### Stage 3: Gemma Vision Captions (`VisionAnalyzer`, priority 100)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_CAPTION=True` and not a video.

**Process**:
1. Ensure the Gemma E2B vision server is running on port 9091 (via `llm_server.rs`)
2. Generate image summary + structured tags (GBNF grammar)
3. Store: `photo.ai_summary`, `photo.caption`, `photo.auto_tags`

### Stage 4: OCR Text Extraction (`OcrAnalyzer`, priority 0)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_OCR=True` and not a video.

**Process**:
1. Ensure the PaddleOCR-VL server is running on port 9092
2. Extract visible text, store in `photo.ocr_text` (indexed in FTS5)

---

## Adaptive Scheduling & Throttling

The `SystemMonitor` polls the OS and the scheduler throttles when conditions are unfavorable.

### System State Signals

| Signal | Source | Effect |
|--------|--------|--------|
| CPU usage | `sysinfo` | > 85% → throttle (sleep 10s); GPU analyzers need < 65% |
| Battery | `/sys/class/power_supply` | < 20% on battery → throttle (sleep 30s) |
| GPU load | `nvidia-smi` (best-effort) | > 70% → GPU analyzers wait |
| External drives | `/media`, `/mnt`, `/run/media` | Disconnected drives pause external-library analysis |
| User activity | recent file edits in `uploads/` | Suspends analysis during active imports |

### Analyzer Cost Model

Each analyzer declares a `ResourceNeed` (`Gpu`, `CpuHeavy`, `CpuLight`). `plan_analyzers()` only schedules analyzers whose resource class the current system state can support, so analysis yields to active editing and imports.

---

## Job Recovery & Retry

### Startup Recovery

On worker startup, `reset_interrupted_jobs()` resets all `processing` jobs back to `pending` with `last_error = 'Interrupted by restart'`, so nothing is lost across restarts.

### Retry Logic

| Parameter | Value |
|-----------|-------|
| Max retries | 5 (`MAX_RETRIES`) |
| Retry delay | `min(2^attempt * 30, 600)` seconds (exponential backoff, 30s → 10min max) |
| Permanent failure | After 5 attempts, status set to `"failed"` with `last_error` naming the failed stages |

Partial failures (some stages OK, some failed) are recorded and the job is retried — completed stages are skipped by stage-aware resume, so retries only redo what failed.

### Graceful Shutdown

The worker loop is a Tokio task owned by the process; on shutdown, pending jobs simply remain in the database and are recovered at next startup.

---

## Content Classification

Content classification (photo / screenshot / document) is a lightweight in-process heuristic that does not run inside the worker queue. It is applied at import time (`content_type` column, default `photo`) and can be re-run over the whole library via:

- `POST /api/v1/albums/smart/reclassify` — `backend_rust/src/routes/albums.rs`

Heuristics use image dimensions, file extension, EXIF camera data, OCR text presence, and filename patterns.

---

## SSE Event Broadcasting

Real-time UI updates flow through the SSE endpoint at `GET /api/v1/settings/events` (`backend_rust/src/routes/settings.rs`).

### Event Types

| Event Type | Trigger | Data Payload |
|------------|---------|--------------|
| `new_photo` | Photo import complete | Photo ID, filename, thumbnail URL |
| `photo_updated` | Metadata change | Updated photo fields |
| `photo_trashed` | Photo moved to trash | Photo ID |
| `job_stage_progress` | Background stage progress | Stage name, completed/total count |
| `background_job_status` | Queue status change | Queue counts, processed/total per stage |
| `background_job_completed` | All jobs finished | Final status data |
| `reconnected` | SSE reconnected | (triggers full refetch) |

### Broadcast Flow

```
Photo Import → enqueue_photo() → Database Write
                                         │
                                    SSE Broadcast
                                         │
                                    React UI
                                         │
                                    Zustand Store Update
                                         │
                                    UI Re-render
```

---

## Engine Settings & Worker Gating

The Engine Settings panel in the System Utilities UI provides dynamic control over background processing via the worker control endpoints:

- `GET /api/v1/utilities/background-jobs/status` — current queue + per-analyzer counters
- `POST /api/v1/utilities/background-jobs/start` / `stop` — start/stop the worker
- `POST /api/v1/utilities/background-jobs/pause` / `resume` — pause/resume between batches

### Background Worker Toggles

| Analyzer | Config Flag | Effect When Disabled |
|----------|-------------|---------------------|
| SigLIP embeddings | `ENABLE_AI_CLIP` | No semantic search or similar-image lookup |
| Face scanning/clustering | `ENABLE_AI_FACE` | No people detection or person albums |
| Gemma captions | `ENABLE_AI_CAPTION` | No AI summaries or auto tags |
| OCR text extraction | `ENABLE_AI_OCR` | No text search in images |
| Video face tracking | `ENABLE_VIDEO_FACE` | No face detection in videos |
| Subtitle generation | `ENABLE_AI_SUBTITLES` | No auto-generated subtitles |

### Log Console

The Engine Settings panel includes a scrollable CLI-like console that displays real-time execution logs from `backend_rust/backend.log`, with auto-refresh and manual refresh controls.
