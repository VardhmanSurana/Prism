# Prism Background Processes

Comprehensive documentation of background processing pipelines, job queues, throttling, and event broadcasting in Prism.

---

## Table of Contents

- [Overview](#overview)
- [Processing Queue Architecture](#processing-queue-architecture)
- [4-Stage Analysis Pipeline](#4-stage-analysis-pipeline)
- [Adaptive Throttling](#adaptive-throttling)
- [Job Recovery & Lifecycle](#job-recovery--lifecycle)
- [Sync Service](#sync-service)
- [Content Classification](#content-classification)
- [SSE Event Broadcasting](#sse-event-broadcasting)
- [Engine Settings & Worker Gating](#engine-settings--worker-gating)

---

## Overview

Prism runs several background processes that handle media analysis, file system watching, and data maintenance. These processes are designed to be non-blocking, resilient to failures, and adaptive to system load.

### Background Process Layers

```
┌─────────────────────────────────────────────────────────┐
│                  Background Processing Queue              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ Stage 1 │ │ Stage 2 │ │ Stage 3 │ │ Stage 4 │       │
│  │ SigLIP  │ │  Face   │ │  Gemma  │ │   OCR   │       │
│  │ Embed.  │ │ Detect. │ │ Vision  │ │ Extract │       │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                    Sync Service                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Watchdog │→ │Ingestion │→ │ Broadcast│              │
│  │ Observer │  │ Pipeline │  │  (SSE)   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                         │
┌─────────────────────────────────────────────────────────┐
│                 Content Classification                    │
│  (photo / screenshot / document detection)               │
└─────────────────────────────────────────────────────────┘
```

### Key Files

| Component | Path |
|-----------|------|
| Processing Queue | `backend/app/services/processing_queue.py` |
| AI Orchestrator | `backend/app/services/ai_orchestrator.py` |
| Sync Service | `backend/app/services/sync/` |
| Content Classifier | `backend/app/services/content_classifier.py` |
| Vision Pipeline | `backend/app/services/vision_pipeline.py` |
| Background Job Model | `backend/app/models.py` (BackgroundJob table) |

---

## Processing Queue Architecture

**File**: `backend/app/services/processing_queue.py`

The processing queue is a persistent, database-backed job queue that runs as a background asyncio task within the FastAPI application.

### Architecture

```
ProcessingQueue
├── _worker_task: asyncio.Task (main processing loop)
├── _active: bool
├── _wakeup_event: asyncio.Event
├── _throttler: AdaptiveThrottler
└── Methods:
    ├── start()           # Start the worker
    ├── shutdown()        # Graceful shutdown
    ├── enqueue()         # Add a job
    ├── enqueue_unfinished_jobs()  # Recover pending jobs on restart
    └── _worker()         # Main processing loop
```

### Database-Backed Jobs

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

### Job Lifecycle

```
Photo Import → enqueue() → status: "pending"
                                 │
                          _worker() picks up job
                                 │
                          status: "processing"
                                 │
                          Run 4 stages sequentially
                                 │
                          ┌──────┴──────┐
                          │             │
                     All stages      Stage failed
                     succeed           │
                          │       retry < max_retries?
                          │       ┌────┴────┐
                          │      Yes       No
                          │       │         │
                          │   status:    status:
                          │   "pending"  "failed"
                          │   (delayed)
                          │
                    status: "completed"
```

### Duplicate Prevention

Before enqueuing a new job, the system checks for existing pending/processing jobs for the same photo to avoid duplicates.

---

## 4-Stage Analysis Pipeline

Each background job runs 4 sequential stages on the photo. Stages are run in order and can be skipped if the data already exists (allowing resume from interruption).

### Stage 1: SigLIP2 Embeddings (Critical)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_CLIP=True` and photo has no embedding

**Process**:
1. Load SigLIP2 model (`google/siglip2-base-patch16-224`)
2. Mutual exclusion: Unload llama-server, Face SDK, and Vision LLM
3. Open image, convert to RGB
4. Generate 768-dimensional L2-normalized embedding
5. Store as JSON in `photo.embedding`
6. Unload SigLIP2 model to free VRAM

**Skip condition**: Photo already has an embedding (resume index >= 1)

### Stage 2: Face Detection & Clustering (Critical)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_FACE=True` (images) or `ENABLE_VIDEO_BG_PROCESS=True` and `ENABLE_VIDEO_FACE=True` (videos)

**Process for images**:
1. Initialize InspireFace SDK
2. Detect faces with configurable confidence threshold
3. Extract face embeddings
4. Cluster against known people
5. Store face assignments in `photo_people` table
6. Create pending face assignments for borderline matches

**Process for videos**:
1. Hybrid scene-change detection + uniform frame sampling
2. Face detection across sampled frames
3. Cross-frame face deduplication
4. Track faces across frame sequences

**Skip condition**: Photo already has face assignments (resume index >= 2)

### Stage 3: Gemma Vision Captions (Optional)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_CAPTION=True` and not a video

**Process**:
1. Start Gemma 4 E2B vision server on port 9091 (if not running)
2. Generate detailed image summary using Florence-2/Gemma
3. Extract structured tags using GBNF grammar
4. Clean and deduplicate tags
5. Store: `photo.ai_summary` (full description), `photo.caption` (summary, 120 chars), `photo.auto_tags` (JSON array)

**Skip condition**: Photo already has AI summary (resume index >= 3)

### Stage 4: OCR Text Extraction (Optional)

**Condition**: `ENABLE_IMAGE_BG_PROCESS=True` and `ENABLE_AI_OCR=True` and not a video

**Process**:
1. Start PaddleOCR-VL server on port 9092 (if not running)
2. Extract visible text from image
3. Store in `photo.ocr_text`
4. Text is indexed in FTS5 for full-text search

**Skip condition**: Photo already has OCR text (resume index >= 4)

### Stage 5: Content Classification

**Condition**: `ENABLE_AI_CONTENT_CLASSIFY=True` (enabled by default)

**Process**:
1. Classify photo as `photo`, `screenshot`, or `document`
2. Uses: dimensions, file extension, EXIF camera data, OCR text, thumbnail analysis
3. Stores in `photo.content_type` column

This runs on all non-encrypted photos regardless of other stage results.

---

## Adaptive Throttling

**File**: `processing_queue.py` → `AdaptiveThrottler` class

The adaptive throttler monitors system resources and pauses background processing when conditions are unfavorable.

### Throttle Conditions

| Condition | Threshold | Behavior |
|-----------|-----------|----------|
| CPU usage | > 85% (`JOB_QUEUE_THROTTLE_CPU_THRESHOLD`) | Pause until CPU < 60% |
| Battery | < 20% and not plugged in (`JOB_QUEUE_THROTTLE_BATTERY_THRESHOLD`) | Pause until plugged in |
| Video processing | Active video transcoding operations | Pause until video ops complete |

### Throttle Checks

- CPU and battery are checked every 30 seconds
- Video operations increment/decrement a counter to signal pause/resume
- Wait loop: `asyncio.sleep(5)` between checks

### Video Operation Coordination

The throttler integrates with video processing:

```python
# Video processing starts
throttler.increment_video_ops()  # Pauses background queue

# Video processing completes
throttler.decrement_video_ops()  # Releases background queue
```

---

## Job Recovery & Lifecycle

### Startup Recovery

On application startup (`lifespan.py`):

1. **Reset interrupted jobs**: All jobs with status `"processing"` are reset to `"pending"` with error "Interrupted by application restart"
2. **Enqueue unfinished photos**: Scan all non-locked, non-trashed photos and enqueue jobs for those missing any analysis data (embeddings, captions, OCR, faces)
3. **Start worker**: The background worker automatically starts

### Retry Logic

| Parameter | Value |
|-----------|-------|
| Max retries | 5 (`JOB_QUEUE_MAX_RETRIES`) |
| Retry delay | `min(2^attempt * 30, 600)` seconds (exponential backoff, 30s to 10min max) |
| Permanent failure | After 5 attempts, status set to `"failed"` |

### Mid-Batch Interruption

If the worker is paused or stopped mid-batch:
1. Remaining jobs in the batch are reset to `"pending"`
2. Their attempt counts are decremented (to avoid burning retries)
3. Jobs are picked up on the next worker cycle

### Graceful Shutdown

On application shutdown:
1. Worker task is cancelled
2. Active connections are cleaned up
3. Any pending jobs remain in the database for recovery on next startup

---

## Sync Service

**Directory**: `backend/app/services/sync/`

The sync service watches configured directories for file system changes and automatically ingests new media files.

### Architecture

The sync service is decomposed into modular submodules:

```
services/sync/
├── core.py          # Main SyncService class
├── lifecycle.py     # Initialization, shutdown, parent process monitoring
├── config.py        # Settings persistence and configuration updates
├── broadcast.py     # SSE client subscription and event broadcasting
├── mounts.py        # Mount point detection and monitoring
├── observer.py      # File system watcher setup
├── scanning.py      # File system scanning and cleanup
├── ingestion.py     # Photo ingestion and duplicate detection
└── handler.py       # PhotoEventHandler for file system events
```

### File System Watching

- Uses the **Watchdog** library for cross-platform file system monitoring
- Watches user-configured directories for new, modified, and deleted files
- Supported extensions: PNG, JPG, JPEG, WebP, HEIC, HEIF, DNG, TIFF, TIF, BMP, GIF, MP4, MOV, M4V, AVI, MKV, WebM, 3GP

### Ingestion Pipeline

When a new file is detected:

1. **Path validation**: Check against allowed read/write roots
2. **Thumbnail generation**: Create WebP thumbnail (animated WebP for videos via ffmpeg)
3. **Metadata extraction**: EXIF date, GPS, dimensions, MIME type, file size, blur score, content hash. For videos: duration, FPS, codec, audio codec
4. **Duplicate check**: By path and content hash
5. **Database insert**: Write `Photo` record to SQLite
6. **SSE broadcast**: Emit `new_photo` event to UI
7. **Background job enqueue**: Enqueue sequential analysis (SigLIP → Face → Gemma → OCR)
8. **Reverse geocoding**: Resolve GPS coordinates to city/state/country

### Mount Point Detection

**File**: `services/sync/mounts.py`

- Detects new mount points (USB drives, external disks, NAS mounts)
- Automatically watches configured external paths
- Monitors for mounts being added or removed

### Broadcast System

**File**: `services/sync/broadcast.py`

Server-Sent Events (SSE) system for real-time UI updates:

- `new_photo`: A new photo has been imported
- `photo_updated`: Photo metadata changed
- `photo_deleted`: Photo was removed
- `job_stage_progress`: Background analysis stage progress
- `background_job_status`: Overall background processing status
- `background_job_completed`: All background jobs finished

---

## Content Classification

**File**: `backend/app/services/content_classifier.py`

Automatically classifies each photo into one of three content types.

### Classification Categories

| Type | Description | Examples |
|------|-------------|----------|
| `photo` | Natural photographs | Camera photos, DSLR images |
| `screenshot` | Screen captures | Screenshots, screen recordings |
| `document` | Document scans | Scanned documents, whiteboard photos |

### Classification Heuristics

The classifier uses a combination of signals:

1. **Dimensions**: Screenshots tend to match common display resolutions
2. **File extension**: Screenshot tools may produce specific formats
3. **EXIF camera data**: Cameras have make/model; screenshots lack EXIF
4. **OCR text presence**: Documents have significant text content
5. **Thumbnail analysis**: Visual features from the generated thumbnail
6. **Filename patterns**: Screenshot filenames often contain "Screenshot" or "Screen Shot"

### Storage

The classification result is stored in the `content_type` column of the `photos` table and indexed for filtering.

---

## SSE Event Broadcasting

The sync service's broadcast module manages Server-Sent Events (SSE) for real-time UI updates.

### Event Types

| Event Type | Trigger | Data Payload |
|------------|---------|--------------|
| `new_photo` | Photo import complete | Photo ID, filename, thumbnail URL |
| `photo_updated` | Metadata change | Updated photo fields |
| `photo_deleted` | Photo removed from library | Photo ID |
| `job_stage_progress` | Background stage progress | Stage name, completed/total count |
| `background_job_status` | Queue status change | Queue counts, processed/total per stage |
| `background_job_completed` | All jobs finished | Final status data |

### Broadcast Flow

```
Photo Import → Ingestion Pipeline → Database Write
                                         │
                                    SSE Broadcast
                                         │
                                    React UI
                                         │
                                    Zustand Store Update
                                         │
                                    UI Re-render
```

### Client Subscription

SSE clients subscribe via the sync service's SSE endpoint. Multiple clients can subscribe simultaneously.

---

## Engine Settings & Worker Gating

The Engine Settings panel in the System Utilities UI provides dynamic control over background processes.

### Background Worker Toggles

Users can enable/disable individual worker pipelines in real-time:

| Worker | Config Flag | Effect When Disabled |
|--------|-------------|---------------------|
| SigLIP embeddings | `ENABLE_AI_CLIP` | No semantic search or similar-image lookup |
| Face scanning/clustering | `ENABLE_AI_FACE` | No people detection or person albums |
| Gemma captions | `ENABLE_AI_CAPTION` | No AI summaries or auto tags |
| OCR text extraction | `ENABLE_AI_OCR` | No text search in images |
| Video face tracking | `ENABLE_VIDEO_FACE` | No face detection in videos |
| Subtitle generation | `ENABLE_AI_SUBTITLES` | No auto-generated subtitles |

### Worker Process Controls

- **Stop**: Gracefully stops the background queue worker after the current batch completes
- **Start/Restart**: Resumes processing; automatically scans for and enqueues unfinished assets

### Configuration Persistence

All dynamic settings are saved to `settings.json` in the platform data directory, overriding default `.env` properties and persisting across backend restarts.

### Log Console

The Engine Settings panel includes a scrollable CLI-like console that displays real-time execution logs from `backend.log`, with auto-refresh and manual refresh controls.
