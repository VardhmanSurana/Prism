# Prism Architecture

Architectural overview of the Prism photo and video library desktop application.

---

## Table of Contents

- [High-Level Architecture](#high-level-architecture)
- [Runtime Flow](#runtime-flow)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Database Schema](#database-schema)
- [Background Processing Pipeline](#background-processing-pipeline)
- [Sync Service](#sync-service)
- [Locked Folder Encryption Flow](#locked-folder-encryption-flow)
- [API Route Structure](#api-route-structure)

---

## High-Level Architecture

Prism follows a three-tier desktop application architecture:

```
┌─────────────────────────────────────────────────┐
│                  Tauri v2 Shell                   │
│  ┌───────────────────────────────────────────┐   │
│  │         Vite React UI (port 3005)          │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐   │   │
│  │  │ Zustand  │  │  React   │  │  TanStack│   │   │
│  │  │  Stores  │  │  Router  │  │  Virtual │   │   │
│  │  └────┬────┘  └──────────┘  └─────────┘   │   │
│  │       │                                     │   │
│  │       └────────── REST ──────────────────┐  │   │
│  └──────────────────────────────────────────┘  │   │
└──────────────────────┬─────────────────────────┘   │
                       │ HTTP (127.0.0.1:8269)        │
┌──────────────────────┴──────────────────────────────┘
│                   FastAPI Backend                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ CORS /  │  │  Routes  │  │    Services       │    │
│  │  Auth   │  │  / API   │  │  (Business Logic) │    │
│  └────┬────┘  └────┬─────┘  └────────┬─────────┘    │
│       │            │                  │              │
│       └────────────┴──────────────────┘              │
│                              │                        │
│                    ┌─────────┴──────────┐             │
│                    │    SQLite (WAL)    │             │
│                    │   + FTS5 Index     │             │
│                    └────────────────────┘             │
│                              │                        │
│                    ┌─────────┴──────────┐             │
│                    │  File System       │             │
│                    │  (uploads/         │             │
│                    │   thumbnails/)     │             │
│                    └────────────────────┘             │
└───────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Local-first**: All data stays on the user's machine. No cloud dependencies.
2. **Desktop-native**: Tauri v2 provides a lightweight, secure native shell.
3. **Separate backend process**: FastAPI runs as a subprocess, enabling rich Python ecosystem.
4. **SQLite WAL mode**: Write-Ahead Logging for concurrent read/write performance.
5. **REST API**: Frontend communicates with backend via HTTP REST (no IPC bridge).
6. **Opt-in AI**: All AI features are behind feature flags, disabled by default.

---

## Runtime Flow

```mermaid
graph TD
    Tauri[Tauri v2] --> React[Vite React UI]
    React --> Zustand[Zustand Stores]
    React -->|REST| FastAPI[FastAPI on 127.0.0.1:8269]
    FastAPI --> Middleware[CORS / API Key / Logging]
    Middleware --> Routes[Media / Thumbnail / System]
    Middleware --> APIRouters[Feature Routers]
    APIRouters --> Services[Services Layer]
    Services --> DB[(SQLite WAL + FTS5)]
    Services --> Storage[Thumbnails / Uploads]
    Watchdog[Watchdog Observer] --> Queue[Processing Queue]
    Queue --> Services
    FastAPI -. optional .-> AI[Optional Local AI]
```

### Startup Sequence

1. `pnpm run desktop` launches the Tauri shell
2. Tauri spawns the FastAPI backend (`uvicorn`) as a subprocess
3. FastAPI startup (`lifespan.py`):
   - Initializes the database (WAL mode, create tables, apply schema migrations)
   - Auto-purges trashed photos older than 30 days
   - Starts the LAN sync service
   - Initializes the sync (watchdog) service
   - Starts the background processing queue
   - Recovers interrupted Locked Folder files
   - Cleans up any orphaned llama-server processes
4. Vite dev server (or built frontend) loads the React UI
5. React UI connects to FastAPI via REST API at `http://127.0.0.1:8269`

---

## Frontend Architecture

### Technology Stack

- **React 18.3** with TypeScript
- **Vite 6** build tool and dev server
- **Tailwind CSS** for styling
- **Zustand** state management stores
- **React Router** for navigation
- **Framer Motion** for animations
- **TanStack Virtual** for virtualized grid rendering
- **Leaflet + React Leaflet** for map view
- **Lucide** icons

### State Management (Zustand Stores)

| Store | Purpose | File |
|-------|---------|------|
| `uiStore` | UI state (sidebar, modals, theme) | `frontend/store/uiStore.ts` |
| `editStore` | Image editor state | `frontend/store/editStore.ts` |
| `nleStore` | Video editor (NLE) state | `frontend/store/nleStore.ts` |
| `settingsStore` | App settings | `frontend/store/settingsStore.ts` |
| `syncStore` | Sync status | `frontend/store/syncStore.ts` |
| `videoPlayerStore` | Video player state | `frontend/store/videoPlayerStore.ts` |

### Component Structure

```
frontend/components/
├── AgentView/        # AI agent chat interface
├── albums/           # Album views (places, memories, people)
├── Editor/           # Image and Video editors
│   ├── ImageEditor/  # 19-tool image editor (see IMAGE_EDITOR.md)
│   └── VideoEditor/  # NLE video editor (see VIDEO_EDITOR.md)
├── explore/          # AI-powered discovery view
├── FileFolderBrowser/ # File system browser
├── import/           # Import UI
├── layout/           # App shell layout
├── LockedViewAuth/   # Locked Folder auth
├── MapView/          # Leaflet map
├── PeopleView/       # People management
├── PhotoGrid/        # Virtualized photo grid
├── PhotoView/        # Lightbox viewer
├── projects/         # Video projects
├── ui/               # Reusable UI components
├── utilities/        # System utilities view
├── viewers/          # Media viewers
└── wrappers/         # HOC wrappers
```

### Custom Hooks

Key hooks found in `frontend/hooks/`:

| Hook | Purpose |
|------|---------|
| `useAppState.ts` | Application state management |
| `useAudioContext.ts` | Audio context for video editing |
| `useAudioMixer.ts` | Audio mixer for multi-track audio |
| `useBulkActions.ts` | Bulk selection and actions |
| `useGalleryLayout.ts` | Gallery grid layout calculation |
| `useImageHighRes.ts` | High-resolution image loading |
| `useLightboxGestures.ts` | Touch/gesture support for lightbox |
| `usePhotos.ts` | Photo data fetching |
| `useSelection.ts` | Selection state management |
| `useSlideshow.ts` | Slideshow functionality |
| `useStats.ts` | Library statistics |
| `useVideoProjects.ts` | Video project management |
| `useZoomShortcuts.ts` | Keyboard shortcuts for zoom |

---

## Backend Architecture

### Technology Stack

- **FastAPI 0.136** with Uvicorn
- **SQLAlchemy 2.x** async ORM with `aiosqlite`
- **SQLite** WAL mode, `synchronous=NORMAL`, 64 MB cache, memory temp store
- **Pydantic v2** settings and validation
- **OpenCV** blur scoring
- **Pillow/Pillow-Heif** metadata extraction, thumbnail generation
- **ffmpeg/ffprobe** video metadata extraction, frame sampling, transcoding
- **Watchdog** directory observer for file system changes
- **Argon2** password hashing for Locked Folder
- **Cryptography (Fernet)** envelope encryption

### Application Structure

```
backend/app/
├── main.py              # FastAPI app factory, router registration
├── config.py            # Pydantic settings with dynamic loading
├── db.py                # SQLAlchemy engine and session
├── models.py            # SQLAlchemy ORM models
├── schema_migrations.py # Additive schema patches
├── lifespan.py          # Startup/shutdown lifecycle
├── api/                 # API route handlers
│   ├── photos/          # Photo CRUD, upload, metadata, lock, etc.
│   ├── settings/        # Settings management
│   ├── albums/          # Album management
│   ├── nle/             # Non-linear video editing
│   ├── video/           # Video export, subtitles
│   └── ...              # Agent, people, explore, utilities
├── routes/              # Low-level route handlers
│   ├── media.py         # Local file serving, transcoding
│   ├── photos.py        # Thumbnail serving
│   ├── hls.py           # HLS streaming
│   └── system.py        # Health check, root
├── services/            # Business logic layer
│   ├── sync/            # File system watching, ingestion
│   ├── ocr/             # PaddleOCR text extraction
│   ├── inference/       # ML inference (SD inpainting, SAM)
│   ├── image_summary/   # AI caption/tag generation
│   ├── cloud_locations/ # External mount management
│   └── ...              # Face, locked, NLE, etc.
├── middleware/           # FastAPI middleware
│   ├── cors.py          # CORS configuration
│   ├── logging.py       # Request logging
│   └── security.py      # API key verification
├── agent/               # AI agent (planner, tools, orchestrator)
└── utils/               # Utility functions
    ├── security.py      # Path traversal protection
    ├── image.py         # Image operations
    ├── video.py         # Video operations
    ├── rate_limit.py    # Rate limiting
    └── mounts.py        # Mount point detection
```

### Services Layer

The services layer contains all business logic, organized by domain:

| Service | File | Purpose |
|---------|------|---------|
| Sync Service | `services/sync/service.py` | File system watching and ingestion |
| Processing Queue | `services/processing_queue.py` | Background analysis pipeline |
| AI Orchestrator | `services/ai_orchestrator.py` | Manages llama-server lifecycle |
| Vision Pipeline | `services/vision_pipeline.py` | SigLIP2 embeddings |
| Face Detection | `services/face_detection.py` | Face detection via InspireFace |
| Face Clustering | `services/face_clustering.py` | Person clustering |
| Locked Service | `services/locked_service.py` | Envelope encryption management |
| LAN Sync | `services/lan_sync.py` | Peer-to-peer sync |
| NLE Engine | `services/nle_engine.py` | Video editing engine |
| Story Service | `services/story_service.py` | AI story generation |
| Content Classifier | `services/content_classifier.py` | Photo classification |

---

## Database Schema

### Entity Relationship

```
Photo ──1:N──→ PhotoPerson ──N:1──→ Person
  │                                      │
  │                                      │
  ├──N:1──→ Event                        │
  │                                      │
  ├──N:M──→ Album (via PhotoAlbum)       │
  │                                      │
  ├──1:N──→ BackgroundJob                │
  │                                      │
  └──1:N──→ PendingFaceAssignment ──N:1──┘

VideoProject ──1:N──→ VideoClip (via photo_id → Photo)
AgentSession  ──1:N──→ AgentMessage
SyncPeer (standalone)
```

### Core Tables

#### `photos`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `filename` | String(255) | Original filename |
| `path` | String(512) | Full file path |
| `url` | String(512) | Thumbnail URL |
| `width`, `height` | Integer | Image dimensions |
| `aspect_ratio` | Float | Width/height ratio |
| `hash` | String(64) | Content hash (SHA256) |
| `phash` | String(64) | Perceptual hash |
| `caption` | String(512) | User caption |
| `city`, `state`, `country` | String(255) | Reverse-geocoded location |
| `latitude`, `longitude` | Float | GPS coordinates |
| `date` | DateTime | Import date |
| `date_taken` | DateTime | EXIF capture date |
| `is_favorite` | Boolean | Favorites flag |
| `is_locked` | Boolean | Locked Folder flag |
| `is_trash` | Boolean | Trash flag |
| `mime_type` | String(50) | MIME type |
| `file_type` | String(20) | `image` or `video` |
| `duration` | Float (video) | Duration in seconds |
| `fps` | Float (video) | Frames per second |
| `codec`, `audio_codec` | String(50) | Video/audio codec |
| `ai_summary` | Text | AI-generated description |
| `auto_tags` | Text | JSON array of tags |
| `embedding` | Text | JSON float array (SigLIP2) |
| `ocr_text` | Text | Extracted text (OCR) |
| `blur_score` | Float | Blur/sharpness estimate |
| `content_type` | String(20) | `photo`, `screenshot`, `document` |
| `exif_make`, `exif_model` | String(255) | Camera info |
| `rotation` | Integer | Video rotation |
| `device_id` | String(255) | Storage device identifier |
| `is_external` | Boolean | External storage flag |

#### `people`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `name` | String(255) | Person name |
| `cover_face_thumbnail` | String(512) | Cover photo thumbnail |
| `face_embedding` | Text | JSON float array |

#### `photo_people` (Many-to-Many)

| Column | Type | Description |
|--------|------|-------------|
| `photo_id` | Integer (FK) | References photo |
| `person_id` | Integer (FK) | References person |
| `confidence` | Float | Detection confidence |
| `face_box_json` | Text | JSON bounding box |

#### `albums`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `name` | String(255) | Album name |
| `type` | String(20) | `places`, `memories`, `people`, `custom` |
| `is_smart` | Boolean | Auto-generated |
| `cover_url` | String(512) | Cover thumbnail |
| `photo_count` | Integer | Number of photos |

#### `background_jobs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `photo_id` | Integer (FK) | References photo |
| `job_type` | String(50) | Job type |
| `status` | String(20) | `pending`, `processing`, `completed`, `failed` |
| `attempt_count` | Integer | Retry counter |
| `last_error` | Text | Error message |
| `current_stage` | String(50) | Current
