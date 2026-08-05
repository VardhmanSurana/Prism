# Prism — Full Context File

> Paste this into any AI model to give it complete understanding of the Prism codebase, architecture, features, and implementation details.
> Generated: 2026-08-03

---

## 1. What Is Prism

**Prism** is a privacy-first, local-only desktop photo and video library application. It indexes media from watched folders, extracts EXIF metadata, generates high-speed WebP thumbnails, supports FTS5 full-text search, groups media by people/places/memories, provides a non-linear video timeline editor (NLE), and secures private media inside an Argon2id-encrypted Locked Folder.

All photo metadata, search indexes, thumbnails, and Locked Folder operations remain 100% local on the user's machine.

### Core Value Proposition

> "The only local-first photo and video library that combines professional-grade editing, AI-powered organization, and end-to-end encryption — without ever sending your media to the cloud."

---

## 2. Tech Stack

### Frontend
- **React 18.3** + **TypeScript 5.8** + **Vite 6**
- **Tailwind CSS** (custom design system, see DESIGN.md)
- **Zustand** for state management
- **React Router v7** for navigation
- **Framer Motion** for animations
- **TanStack Virtual** for virtualized grid rendering
- **Leaflet** + **React Leaflet** for map view
- **Lucide React** for icons
- **Cropper.js** for image cropping
- **Tauri v2** for desktop shell

### Backend
- **Rust** + **Axum** web framework + **Tokio** async runtime
- **SQLx** async SQLite driver with compile-time query checking
- **SQLite** WAL mode + **FTS5** full-text search
- **uuid** crate for universal UUID generation
- **serde / serde_json** for serialization
- **tower-http** for CORS + tracing middleware
- **ffmpeg/ffprobe** (via CLI) for video metadata and thumbnails
- Optional **Python ML microservice** (`backend/`) for AI inference

### AI Stack (Optional, feature-flagged)
- **Gemma 4 E4B** (`gguf`) for agent LLM search (port 9090)
- **Gemma 4 E2B** for vision/captioning (port 9091)
- **PaddleOCR-VL** for OCR text extraction (port 9092)
- **SigLIP2** (`google/siglip2-base-patch16-224`) for semantic embeddings
- **face-id (SCRFD + ArcFace w600k, ONNX Runtime)** for in-process face detection and embeddings
- **Stable Diffusion 1.5** for inpainting/object removal
- **rembg** for background removal
- **Whisper** for subtitle generation

---

## 3. Architecture

```
┌─────────────────────────────────────────────────┐
│              Tauri v2 Desktop Shell               │
│  ┌───────────────────────────────────────────┐   │
│  │       Vite React UI (port 3005)            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │  Zustand │  │  React   │  │ TanStack│ │   │
│  │  │  Stores  │  │  Router  │  │ Virtual │ │   │
│  │  └──────────┘  └──────────┘  └─────────┘ │   │
│  └───────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────┘
                        │ HTTP (127.0.0.1:8269)
┌───────────────────────┴───────────────────────────┐
│             Rust (Axum) Backend                    │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ CORS /   │  │  Routes  │  │  Services        │  │
│  │  Auth    │  │  / API   │  │  (Business Logic)│  │
│  └──────────┘  └──────────┘  └─────────────────┘  │
│                                 │                  │
│                    ┌────────────┴─────────────┐    │
│                    │    SQLite (WAL + FTS5)   │    │
│                    └──────────────────────────┘    │
│                                 │                  │
│                    ┌────────────┴─────────────┐    │
│                    │  File System             │    │
│                    │  (uploads/, thumbnails/) │    │
│                    └──────────────────────────┘    │
└────────────────────────────────────────────────────┘
        │
        │ REST (127.0.0.1:8270)
        ▼
┌──────────────────────────────────────┐
│   Python ML Microservice (optional)  │
│  - Face detection / embeddings       │
│  - SigLIP2 / Vision / OCR            │
│  - Inpainting / background removal   │
└──────────────────────────────────────┘
```

### Key Design Decisions
1. **Local-first**: All data stays on the user's machine. No cloud dependencies.
2. **Desktop-native**: Tauri v2 provides a lightweight, secure native shell.
3. **High-performance backend**: Rust (Axum) runs as the core backend, with optional Python ML microservice for AI inference.
4. **SQLite WAL + FTS5**: Write-Ahead Logging for concurrent read/write performance, with full-text search.
5. **REST API**: Frontend communicates with backend via HTTP REST.
6. **Opt-in AI**: All AI features are behind feature flags, disabled by default.

---

## 4. Project Structure

```
Prism/
├── README.md                    # Project overview, badges, quickstart
├── DESIGN.md                    # Complete design system (colors, typography, components)
├── PRODUCT.md                   # Product positioning, principles, accessibility
├── package.json                 # Root package.json
├── pnpm-lock.yaml
├── run-web.sh                   # Start web environment (Vite + Rust backend)
├── run-desktop.sh               # Start desktop environment (Tauri + Rust backend)
│
├── docs/
│   ├── ARCHITECTURE.md          # Full architecture overview
│   ├── AI_FEATURES.md           # All AI features, models, ports, flags
│   ├── BACKGROUND_PROCESSES.md  # Background queue, 4-stage pipeline, SSE
│   ├── IMAGE_EDITOR.md          # 19-tool image editor reference
│   ├── VIDEO_EDITOR.md          # NLE video editor reference
│   ├── SECURITY.md              # Encryption, auth, path isolation, CSP
│   ├── PRISM_CLI.md             # CLI command reference (legacy Python)
│   ├── SETUP.md                 # Setup guide, env vars, GPU config
│
├── frontend/
│   ├── src-tauri/               # Tauri v2 desktop shell
│   │   ├── tauri.conf.json      # Tauri config, CSP, window settings
│   │   └── ...
│   ├── App.tsx                  # Main React app entry
│   ├── index.tsx                # React entry point
│   ├── index.html
│   ├── index.css                # Global styles, Tailwind directives
│   ├── tailwind.config.js       # Tailwind config
│   ├── vite.config.ts           # Vite config (port 3005)
│   ├── tsconfig.json
│   ├── constants.ts             # API_BASE, resolveUrl, photoSrc helpers
│   ├── types.ts                 # Core TypeScript types (Photo, Album, ViewMode, etc.)
│   │
│   ├── components/
│   │   ├── layout/              # App shell layout
│   │   │   ├── sidebar/Sidebar.tsx
│   │   │   ├── header/Header.tsx
│   │   │   ├── MainContent.tsx  # View router (switches between gallery, albums, etc.)
│   │   │   ├── bulk-actions-bar/BulkActionsBar.tsx
│   │   │   └── floating-actions/FloatingActions.tsx
│   │   │
│   │   ├── PhotoGrid/           # Virtualized photo grid
│   │   │   ├── PhotoGrid.tsx    # Main grid component with timeline dial
│   │   │   ├── PhotoGridHeader.tsx
│   │   │   ├── PhotoGridRow.tsx
│   │   │   ├── PhotoListItem.tsx
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   └── hooks/
│   │   │
│   │   ├── PhotoView/           # Lightbox viewer, collage, photobook
│   │   │
│   │   ├── AgentView/           # AI assistant chat interface
│   │   │   ├── AgentView.tsx
│   │   │   ├── useAgentView.ts
│   │   │   ├── ChatInput.tsx
│   │   │   ├── SessionSidebar.tsx
│   │   │   ├── ThinkingIndicator.tsx
│   │   │   ├── ThinkingSteps.tsx
│   │   │   ├── GalleryDrawer.tsx
│   │   │   ├── InlinePhotoGrid.tsx
│   │   │   ├── SmartAlbumModal.tsx
│   │   │   ├── SuggestedFollowups.tsx
│   │   │   ├── SuggestionsPanel.tsx
│   │   │   ├── AgentDiagnostics.tsx
│   │   │   ├── MessageReveal.tsx
│   │   │   └── types.ts
│   │   │
│   │   ├── explore/             # AI-powered explore/discovery view
│   │   │   ├── ExploreView.tsx
│   │   │   ├── EventTimeline.tsx
│   │   │   ├── HighlightReelSection.tsx
│   │   │   ├── OnThisDaySection.tsx
│   │   │   ├── PhotographyInsights.tsx
│   │   │   ├── RecentActivityFeed.tsx
│   │   │   ├── RediscoverPrompts.tsx
│   │   │   ├── SeasonalGrid.tsx
│   │   │   ├── AIThemeGrid.tsx
│   │   │   ├── ExploreHeader.tsx
│   │   │   ├── ExploreWidgetCustomizer.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── albums/              # Album views (places, memories, people, custom)
│   │   ├── Editor/              # Image + Video editors
│   │   │   ├── ImageEditor/     # 19-tool non-destructive image editor
│   │   │   └── VideoEditor/     # NLE video editor
│   │   ├── FileFolderBrowser/   # File system browser
│   │   ├── import/              # Import UI
│   │   ├── layout/              # App shell layout
│   │   ├── LockedViewAuth/      # Locked Folder auth + view
│   │   ├── MapView/             # Leaflet map
│   │   ├── PeopleView/          # People management
│   │   ├── PhotoView/           # Lightbox, collage, photobook
│   │   ├── projects/            # Video projects dashboard
│   │   ├── TrashView/           # Trash view
│   │   ├── ui/                  # Reusable UI components
│   │   │   ├── ColorPicker.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── GlassMaterial.tsx
│   │   │   ├── GoogleImportToast.tsx
│   │   │   ├── LazyImage.tsx
│   │   │   ├── MemoriesCarousel.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Slider.tsx
│   │   │   ├── SmoothTab.tsx
│   │   │   ├── Switch.tsx
│   │   │   └── TimelineDial.tsx
│   │   ├── utilities/           # System utilities view
│   │   ├── viewers/             # Media viewers
│   │   └── wrappers/            # HOC wrappers
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAppState.ts       # Master state hook (composes all below)
│   │   ├── usePhotos.ts         # Photo data fetching + SSE subscription
│   │   ├── useSelection.ts      # Selection state
│   │   ├── useBulkActions.ts    # Bulk actions (delete, favorite, lock)
│   │   ├── useLightboxGestures.ts
│   │   ├── useSlideshow.ts
│   │   ├── useStats.ts
│   │   ├── useTelemetry.ts      # Event buffering + flush system
│   │   ├── useAudioMixer.ts
│   │   ├── useVideoProjects.ts
│   │   ├── useZoomShortcuts.ts
│   │   ├── useGalleryLayout.ts
│   │   ├── useImageHighRes.ts
│   │   ├── appState/            # Sub-hooks for useAppState
│   │   └── utilities/
│   │
│   ├── store/                   # Zustand stores
│   │   ├── settingsStore.ts     # App settings, telemetry settings
│   │   ├── editStore.ts         # Image editor state
│   │   ├── nleStore.ts          # Video editor state
│   │   ├── galleryLayoutStore.ts
│   │   ├── syncStore.ts
│   │   ├── uiStore.ts
│   │   ├── videoPlayerStore.ts
│   │   └── nle/                 # NLE-specific store modules
│   │
│   ├── services/
│   │   ├── apiClient.ts         # Fetch wrapper with retry logic
│   │   ├── EventService.ts      # SSE event subscription system
│   │   ├── ConfirmService.ts    # Custom confirm dialogs
│   │   └── FileFolderBrowserService.ts
│   │
│   ├── lib/                     # Utility libraries
│   ├── utils/                   # Utility functions
│   ├── themes/                  # Theme variants (google, apple)
│   ├── public/                  # Static assets
│   └── dist/                    # Built output
│
├── backend_rust/
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── src/
│   │   ├── main.rs              # Axum app factory, server startup
│   │   ├── config.rs            # Configuration from env vars
│   │   ├── db.rs                # SQLite pool, table creation, migrations, UUID population
│   │   ├── models/mod.rs        # Data structs (Photo, Album, Person, etc.)
│   │   ├── routes/mod.rs        # Router composition, middleware (CORS, auth, rate-limit, telemetry)
│   │   │   ├── photos/          # Photo CRUD, upload, metadata, masks, AI endpoints
│   │   │   │   ├── mod.rs
│   │   │   │   ├── listing.rs   # Photo listing, stats, search
│   │   │   │   ├── upload.rs    # File upload and directory import
│   │   │   │   ├── metadata.rs  # Photo metadata, tags, faces, favorites
│   │   │   │   └── masks.rs     # Portrait and background masks
│   │   │   ├── photos_ai.rs     # AI photo endpoints (OCR, inpaint, summary, masks, XMP)
│   │   │   ├── albums.rs        # Album CRUD, smart albums
│   │   │   ├── people.rs        # People listing, rename, person photos, pending faces
│   │   │   ├── nle.rs           # Video project CRUD, clip analysis, export
│   │   │   ├── agent.rs         # AI agent sessions and chat
│   │   │   ├── explore.rs       # Explore view collections (themes, timeline, seasons)
│   │   │   ├── settings.rs      # Settings management, SSE events
│   │   │   ├── system.rs        # Health check, sample images
│   │   │   ├── utilities.rs     # Diagnostics, backup, storage cleanup, duplicates
│   │   │   ├── privacy.rs       # Locked folder endpoints
│   │   │   ├── lan_sync.rs      # LAN sync discovery, pairing, import
│   │   │   ├── stories.rs       # AI story generation
│   │   │   ├── video.rs         # Video export, subtitles
│   │   │   ├── telemetry_api.rs # Telemetry summary, events, SSE stream
│   │   │   └── mod.rs
│   │   └── services/
│   │       ├── mod.rs
│   │       ├── ml_client.rs     # HTTP client for Python ML microservice
│   │       ├── thumbnail.rs     # WebP thumbnail generation
│   │       ├── exif.rs          # EXIF metadata extraction
│   │       ├── telemetry.rs     # Telemetry service
│   │       └── worker.rs        # Background AI worker loop (4-stage pipeline)
│   │
│   ├── models/
│   │   └── mod.rs               # Data models (already in backend_rust/src/models/)
│   │
│   ├── uploads/                 # Imported media files
│   ├── thumbnails/              # Generated thumbnails
│   └── prism.db                 # SQLite database (WAL mode, inside backend_rust/)
│
├── .codecontext.yaml
├── .codecontext/
├── .freebuff/
└── sample_images/               # Sample images for development
```

---

## 5. Database Schema

### Core Tables

#### `photos`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `uuid` | Text | Unique UUID identifier |
| `filename` | String(255) | Original filename |
| `path` | String(512) | Full file path |
| `url` | String(512) | Thumbnail URL |
| `width`, `height` | Integer | Image dimensions |
| `aspect_ratio` | Float | Width/height ratio |
| `hash` | String(64) | Content hash (SHA256) |
| `phash` | String(64) | Perceptual hash |
| `caption` | String(512) | User/AI caption |
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
| `embedding` | Text | JSON float array (SigLIP2, 768-dim L2-normalized) |
| `ocr_text` | Text | Extracted text (OCR) |
| `adjustments_json` | Text | Non-destructive edit adjustments |
| `blur_score` | Float | Blur/sharpness estimate |
| `content_type` | String(20) | `photo`, `screenshot`, `document` |
| `exif_make`, `exif_model` | String(255) | Camera info |
| `exif_focal_length` | Float | Focal length |
| `exif_iso` | Integer | ISO |
| `rotation` | Integer | Video rotation |
| `device_id` | String(255) | Storage device identifier |
| `is_external` | Boolean | External storage flag |
| `video_faces_scanned` | Boolean | Whether video face scan completed |
| `animated_url` | String(512) | Animated WebP URL (for videos/GIFs) |
| `event_id` | Integer | FK to events table |
| `clip_embedding` | Text | Additional embedding column (migration) |

#### `albums`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `uuid` | Text | Unique UUID identifier |
| `name` | String(255) | Album name |
| `type` | String(20) | `places`, `memories`, `people`, `custom` |
| `is_smart` | Boolean | Auto-generated |
| `smart_type` | String(20) | `screenshots`, `documents`, `places` |
| `cover_url` | String(512) | Cover thumbnail |
| `photo_count` | Integer | Number of photos |
| `metadata_json` | Text | JSON metadata |

#### `photo_albums` (Many-to-Many)
| Column | Type | Description |
|--------|------|-------------|
| `photo_id` | Integer (FK) | References photo |
| `album_id` | Integer (FK) | References album |

#### `people`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `uuid` | Text | Unique UUID identifier |
| `name` | String(255) | Person name |
| `cover_face_thumbnail` | String(512) | Cover face thumbnail |
| `face_embedding` | Text | JSON float array |

#### `photo_people` (Many-to-Many)
| Column | Type | Description |
|--------|------|-------------|
| `photo_id` | Integer (FK) | References photo |
| `person_id` | Integer (FK) | References person |
| `confidence` | Float | Detection confidence |
| `face_box_json` | Text | JSON bounding box |

#### `faces`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `photo_id` | Integer (FK) | References photo |
| `confidence` | Float | Detection confidence |
| `box_json` | Text | JSON bounding box |
| `embedding_json` | Text | JSON embedding array |
| `created_at` | DateTime | Creation timestamp |

#### `background_jobs`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `photo_id` | Integer (FK) | References photo |
| `job_type` | String | `sequential_analysis` |
| `status` | String | `pending`, `processing`, `completed`, `failed` |
| `current_stage` | String | Current pipeline stage |
| `stage_progress` | Text | JSON progress data |
| `attempt_count` | Integer | Retry counter |
| `last_error` | Text | Error message |
| `created_at` | DateTime | Job creation time |
| `updated_at` | DateTime | Last update time |

#### `events`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `title` | String | Event title |
| `event_type` | String | `trip`, etc. |
| `start_date` | DateTime | Event start |
| `end_date` | DateTime | Event end |
| `location` | String | Event location |
| `cover_photo_id` | Integer | FK to photos |
| `summary` | Text | Event summary |

#### `video_projects`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `uuid` | Text | Unique UUID identifier |
| `name` | String | Project name |
| `cover_photo_id` | Integer | FK to photos |
| `width` | Integer | Resolution width (default 1920) |
| `height` | Integer | Resolution height (default 1080) |
| `fps` | Integer | Frame rate (default 30) |
| `project_json` | Text | JSON blob containing full timeline state |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Update timestamp |

#### `telemetry_events`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `source` | String | Event source |
| `session_id` | String | Session identifier |
| `event_type` | String | Event type |
| `component` | String | Component name |
| `action` | String | Action name |
| `metadata_json` | Text | JSON metadata |
| `status` | String | `ok`, `error`, `warning` |
| `duration_ms` | Float | Duration in milliseconds |
| `created_at` | DateTime | Creation timestamp |

#### `agent_sessions`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `uuid` | Text | Unique UUID identifier |
| `title` | String | Session title |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Update timestamp |

#### `agent_messages`
| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer (PK) | Primary key |
| `session_id` | String | FK to agent_sessions |
| `role` | String | `user` or `assistant` |
| `content` | Text | Message content |
| `photos_json` | Text | JSON array of photos in result |
| `plan_json` | Text | Execution plan JSON |
| `tools_json` | Text | Tool calls JSON |
| `attached_image_json` | Text | Attached image info |
| `created_at` | DateTime | Creation timestamp |

#### `settings` (Key-Value)
| Column | Type | Description |
|--------|------|-------------|
| `key` | Text (PK) | Setting key |
| `value` | Text | Setting value |

### Entity Relationships
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

---

## 6. Frontend Architecture

### State Management (Zustand Stores)

| Store | File | Purpose |
|-------|------|---------|
| `uiStore` | `frontend/store/uiStore.ts` | UI state (sidebar, modals, theme) |
| `editStore` | `frontend/store/editStore.ts` | Image editor state |
| `nleStore` | `frontend/store/nleStore.ts` | Video editor (NLE) state |
| `settingsStore` | `frontend/store/settingsStore.ts` | App settings, telemetry settings |
| `syncStore` | `frontend/store/syncStore.ts` | Sync status |
| `videoPlayerStore` | `frontend/store/videoPlayerStore.ts` | Video player state |
| `galleryLayoutStore` | `frontend/store/galleryLayoutStore.ts` | Gallery layout settings |

### Core Types (`frontend/types.ts`)

```typescript
export interface Photo {
  id: string | number;
  uuid?: string;
  url: string;
  path: string;
  width: number;
  height: number;
  aspect_ratio?: number;
  date: string;             // ISO string (date_taken)
  dateTimestamp?: number;
  date_taken?: string;
  uploadDate?: string;
  uploadDateTimestamp?: number;
  upload_date?: string;
  location?: string;
  caption?: string;
  filename?: string;
  isFavorite: boolean;
  isLocked?: boolean;
  isTrash?: boolean;
  type?: 'image' | 'video';
  mime_type?: string;
  file_type?: string;
  file_size?: number;
  duration?: number;
  fps?: number;
  codec?: string;
  audio_codec?: string;
  rotation?: number;
  animated_url?: string;
  ai_summary?: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  people?: { id: string | number; uuid?: string; name: string; cover_face_thumbnail: string }[];
  city?: string;
  state?: string;
  country?: string;
  exif_make?: string;
  exif_model?: string;
  exif_focal_length?: number;
  exif_iso?: number;
  hash?: string;
  search_explanation?: { score: number; matched: string[] };
}

export type ViewMode = 'gallery' | 'explore' | 'sharing' | 'albums' | 'favorites' | 'utilities' | 'appearance' | 'locked' | 'map' | 'trash' | 'people' | 'projects' | 'agent';
export type SortMode = 'newest' | 'oldest' | 'added';
```

### View Routing

The `MainContent` component acts as the view router. `currentView` (a `ViewMode` string) determines which view is rendered:

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
| `appearance` | `Appearance` | Theme/gallery settings |
| `locked` | `LockedViewAuth` / `LockedFolderView` | Locked Folder |
| `trash` | `TrashView` | Trash view |
| `favorites` | `PhotoGrid` (with filter) | Favorites filter |
| `sharing` | (future) | Sharing view |

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAppState.ts` | Master state hook composing photos, selection, filters, locked folder, bulk actions, albums |
| `usePhotos.ts` | Photo data fetching (paginated REST), SSE event subscription |
| `useSelection.ts` | Selection state (Set of selected IDs) |
| `useBulkActions.ts` | Bulk delete, favorite, lock, restore |
| `useLightboxGestures.ts` | Touch/gesture support for lightbox |
| `useSlideshow.ts` | Slideshow functionality |
| `useStats.ts` | Library statistics |
| `useTelemetry.ts` | Event buffering + batch flush system |
| `useAudioMixer.ts` | Audio mixer for multi-track video editing |
| `useVideoProjects.ts` | Video project management |
| `useGalleryLayout.ts` | Gallery grid layout calculation |
| `useImageHighRes.ts` | High-resolution image loading |
| `useZoomShortcuts.ts` | Keyboard shortcuts for zoom |

---

## 7. Backend Architecture

### Application Startup (`main.rs`)

1. Load `Config` from environment variables
2. Initialize SQLite database pool (WAL mode, create tables, apply migrations)
3. Auto-purge trashed photos older than 30 days
4. Start LAN sync service
5. Initialize sync (watchdog) service
6. Start background processing queue
7. Recover interrupted Locked Folder files
8. Spawn persistent background AI worker loop
9. Build Axum router with all middleware layers
10. Start TCP listener on configured host:port
11. Serve via `axum::serve()`

### Config (`config.rs`)

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind host |
| `PORT` | `8269` | Bind port |
| `DATABASE_URL` | `sqlite://{cwd}/backend_rust/prism.db` | SQLite database URL |
| `UPLOAD_DIR` | `uploads` | Upload directory |
| `THUMBNAILS_DIR` | `thumbnails` | Thumbnail directory |
| `PYTHON_ML_URL` | `http://127.0.0.1:8270` | Python ML service URL |
| `API_KEY` | `""` (disabled) | API key for auth |

### Middleware Stack (in `routes/mod.rs`)

1. **CORS Layer** — allows `tauri://localhost`, `http://localhost:3005`, `http://127.0.0.1:3005`
2. **TraceLayer** — HTTP request tracing
3. **DefaultBodyLimit** — 1GB max body
4. **Rate Limit Layer** — 20 req/min per IP+path for expensive endpoints (`/video/*`, `/photos/inpaint/process`)
5. **Telemetry Layer** — samples API requests, logs errors always, captures response summaries optionally
6. **API Key Auth Layer** — checks `X-API-Key` header if `API_KEY` env var is set

### API Routes (`/api/v1/*`)

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/photos/stats` | GET | `system::get_photo_stats` | Photo statistics |
| `/photos/upload` | POST | `photos::upload_photo` | Upload single photo |
| `/photos/upload-blob` | POST | `photos::upload_blob` | Upload blob |
| `/photos/expand-directory` | POST | `photos::expand_directory` | Expand directory tree |
| `/photos/bulk-adjustments` | POST | `photos::bulk_update_adjustments` | Bulk edit adjustments |
| `/photos` | GET | `photos::list_photos` | List photos (paginated) |
| `/photos/:id` | GET | `photos::get_photo` | Get single photo |
| `/photos/:id/metadata` | GET | `photos::get_photo_metadata` | Get photo metadata |
| `/photos/:id/file` | GET | `photos::get_photo_file` | Serve original file |
| `/photos/:id/thumbnail` | GET | `photos::get_photo_thumbnail` | Serve thumbnail |
| `/photos/:id/faces` | GET | `people::get_photo_faces` | Get photo faces |
| `/photos/:id/favorite` | POST | `photos::toggle_favorite` | Toggle favorite |
| `/photos/:id/trash` | POST | `photos::toggle_trash` | Move to trash |
| `/photos/:id/restore` | POST | `photos::restore_photo` | Restore from trash |
| `/photos/:id/location` | PUT | `photos::update_photo_location` | Update location |
| `/photos/:id/adjustments` | PUT | `photos::update_photo_adjustments` | Save adjustments |
| `/photos/:id/tag-face` | POST | `photos::tag_photo_face` | Tag face on photo |
| `/photos/:id/ocr` | POST | `photos_ai::trigger_ocr` | Trigger OCR |
| `/photos/inpaint/process` | POST | `photos_ai::process_inpaint` | Run inpainting |
| `/photos/:id/summary` | GET | `photos_ai::get_summary` | Get AI summary |
| `/photos/:id/summary/generate` | POST | `photos_ai::generate_summary` | Generate AI summary |
| `/photos/:id/xmp` | POST | `photos_ai::xmp_operation` | XMP sidecar operation |
| `/photos/:id/lock` | POST | `photos_ai::toggle_lock` | Lock photo |
| `/photos/:id/unlock` | POST | `photos_ai::unlock_photo` | Unlock photo |
| `/photos/:id/export-preset` | POST | `photos_ai::export_photo_preset` | Export preset |
| `/photos/xmp/export` | POST | `photos_ai::xmp_export` | Export XMP sidecars |
| `/photos/xmp/import` | POST | `photos_ai::xmp_import` | Import XMP sidecars |
| `/photos/export` | POST | `photos_ai::export_photos` | Export photos |
| `/photos/directory` | POST | `photos_ai::list_directory` | List directory contents |
| `/photos/semantic-masks/:photo_id` | GET | `photos_ai::get_semantic_masks` | Get semantic masks |
| `/photos/background-mask/:photo_id` | GET | `photos_ai::get_background_mask` | Get background mask |
| `/photos/portrait-masks/:photo_id` | GET | `photos_ai::get_portrait_masks` | Get portrait masks |
| `/photos/auto-enhance/:photo_id` | GET | `photos_ai::get_auto_enhance` | Auto-enhance photo |
| `/albums` | GET/POST | `albums::list_albums/create_album` | List/create albums |
| `/albums/:id` | DELETE | `albums::delete_album` | Delete album |
| `/albums/:id/photos` | GET | `albums::get_album_photos` | Get album photos |
| `/albums/:id/rename` | POST | `albums::rename_album` | Rename album |
| `/albums/:id/add-photos` | POST | `albums::add_photos_to_album` | Add photos to album |
| `/albums/:id/remove-photos` | POST | `albums::remove_photos_from_album` | Remove photos from album |
| `/albums/:id/set-cover` | POST | `albums::set_album_cover` | Set album cover |
| `/albums/smart` | GET | `albums::list_smart_albums` | List smart albums |
| `/albums/smart/:smart_type/photos` | GET | `albums::get_smart_album_photos` | Get smart album photos |
| `/albums/memories/highlights` | GET | `albums::get_memories_highlights` | Get memories highlights |
| `/people` | GET | `people::list_people` | List people |
| `/people/:id/photos` | GET | `people::get_person_photos` | Get person photos |
| `/people/:id/name` | PUT/POST | `people::rename_person` | Rename person |
| `/people/:id/pending-faces` | GET | `people::get_pending_faces` | Get pending face assignments |
| `/people/pending-faces/:id/feedback` | POST | `people::submit_pending_face_feedback` | Submit face feedback |
| `/people/scan/:photo_id` | POST | `people::scan_photo_faces` | Scan faces on photo |
| `/explore` | GET | `explore::explore_photos` | Explore photos |
| `/explore/insights` | GET | `explore::explore_insights` | Get insights |
| `/explore/themes` | GET | `explore::explore_themes` | Get themes |
| `/explore/on-this-day` | GET | `explore::explore_on_this_day` | On this day |
| `/explore/rediscover-prompts` | GET | `explore::explore_rediscover_prompts` | Rediscover prompts |
| `/explore/timeline` | GET | `explore::explore_timeline` | Event timeline |
| `/explore/seasons` | GET | `explore::explore_seasons` | Seasonal grid |
| `/explore/activity` | GET | `explore::explore_activity` | Recent activity |
| `/explore/highlights` | GET | `explore::explore_highlights` | Highlight reels |
| `/nle/projects` | GET/POST | `nle::list_projects/create_project` | List/create NLE projects |
| `/nle/projects/:id` | GET/PUT/DELETE | `nle::get_project/update_project/delete_project` | Project CRUD |
| `/nle/clips/analyze` | POST | `nle::analyze_video_clip` | Analyze video clip |
| `/nle/clips/proxy` | POST | `nle::generate_proxy_video` | Generate proxy video |
| `/nle/clips/waveform` | POST | `nle::get_waveform` | Get audio waveform |
| `/nle/export` | POST | `nle::export_project` | Export video project |
| `/nle/export/:job_id` | GET | `nle::get_export_status` | Get export status |
| `/agent/sessions` | GET/POST | `agent::list_sessions/create_session` | List/create chat sessions |
| `/agent/sessions/:id` | GET/PATCH/DELETE | `agent::get_session/rename_session/delete_session` | Session CRUD |
| `/agent/chat` | POST | `agent::chat` | Send message to agent |
| `/agent/upload_image` | POST | `agent::upload_image` | Upload image to agent |
| `/agent/preload` | POST | `agent::preload_model` | Preload agent model |
| `/agent/upload/:filename` | GET | `agent::serve_agent_upload` | Serve agent uploads |
| `/settings` | GET | `settings::get_settings` | Get all settings |
| `/settings/general` | GET/POST | `settings::get/save_general_settings` | General settings |
| `/settings/map-style` | GET/POST | `settings::get/save_map_style` | Map style settings |
| `/settings/folders` | GET/POST | `settings::get/save_folders_settings` | Folder settings |
| `/settings/sync` | GET/POST | `settings::get/save_sync_settings` | Sync settings |
| `/settings/telemetry` | GET/POST | `settings::get/save_telemetry_settings` | Telemetry settings |
| `/settings/reset-library` | POST | `settings::reset_library` | Reset library |
| `/settings/vacuum` | POST | `settings::vacuum_db` | Vacuum database |
| `/settings/clear-cache` | POST | `settings::clear_cache` | Clear cache |
| `/settings/locked-folder/status` | GET | `settings::get_locked_folder_status` | Locked folder status |
| `/settings/locked-folder/setup` | POST | `settings::setup_locked_folder` | Setup locked folder |
| `/settings/locked-folder/verify` | POST | `settings::verify_locked_folder` | Verify locked folder password |
| `/settings/locked-folder/lock-session` | POST | `settings::lock_session` | Lock session |
| `/settings/trigger-face-sync` | POST | `settings::trigger_face_sync` | Trigger face sync |
| `/privacy/status` | GET | `privacy::get_privacy_status` | Privacy status |
| `/utilities/duplicates` | GET | `utilities::get_duplicates` | Find duplicate photos |
| `/utilities/blurry` | GET | `utilities::get_blurry_photos` | Find blurry photos |
| `/utilities/documents` | GET | `utilities::get_document_photos` | Find document photos |
| `/utilities/diagnostics` | GET | `utilities::get_diagnostics` | System diagnostics |
| `/utilities/backup/export` | POST | `utilities::export_backup` | Export backup |
| `/utilities/backup/restore` | POST | `utilities::restore_backup` | Restore backup |
| `/utilities/batch-rename` | POST | `utilities::batch_rename_files` | Batch rename |
| `/utilities/purge-trash` | POST | `utilities::purge_trash` | Permanently delete trashed |
| `/utilities/background-jobs/status` | GET | `utilities::get_background_jobs_status` | Background job status |
| `/utilities/background-jobs/start` | POST | `utilities::start_background_jobs` | Start worker |
| `/utilities/background-jobs/stop` | POST | `utilities::stop_background_jobs` | Stop worker |
| `/utilities/background-jobs/pause` | POST | `utilities::pause_background_jobs` | Pause worker |
| `/utilities/background-jobs/resume` | POST | `utilities::resume_background_jobs` | Resume worker |
| `/utilities/search/fused` | GET | `utilities::fused_search` | Fused search (FTS + semantic) |
| `/telemetry/summary` | GET | `telemetry_api::get_telemetry_summary` | Telemetry summary |
| `/telemetry/events` | GET/DELETE | `telemetry_api::get_telemetry_events/clear` | Telemetry events |
| `/telemetry/log` | POST | `telemetry_api::log_frontend_event` | Log frontend event |
| `/telemetry/log-batch` | POST | `telemetry_api::log_frontend_event_batch` | Log batch events |
| `/health` | GET | `system::health_check` | Health check |
| `/local` | GET | `photos::serve_local_file` | Serve local file by path |
| `/lan/discover` | GET | `lan_sync::discover_peers` | Discover LAN peers |
| `/lan/peers/:id/pair` | POST | `lan_sync::pair_with_peer` | Pair with peer |
| `/lan/sync/status` | GET | `lan_sync::sync_status` | Sync status |
| `/stories/generate` | POST | `stories::generate_story` | Generate AI story |
| `/video/export` | POST | `video::start_export` | Start video export |
| `/video/subtitles/generate` | POST | `video::generate_subtitles` | Generate subtitles |

---

## 8. AI Features

### Feature Flags (All Disabled by Default Unless Noted)

| Flag | Default | Hardware | Description |
|------|---------|----------|-------------|
| `ENABLE_AI_AGENT` | `False` | GPU recommended | Local AI assistant |
| `ENABLE_AI_FACE` | `False` | GPU optional | Face detection + clustering |
| `ENABLE_AI_CLIP` | `False` | GPU recommended | SigLIP2 embeddings for semantic search |
| `ENABLE_AI_INPAINTING` | `False` | GPU required | Stable Diffusion inpainting |
| `ENABLE_AI_REMBG` | `False` | GPU optional | Background removal |
| `ENABLE_AI_OCR` | `False` | GPU optional | PaddleOCR-VL text extraction |
| `ENABLE_AI_SUBTITLES` | `False` | GPU optional | Whisper subtitle generation |
| `ENABLE_AI_CAPTION` | `True` | GPU recommended | Gemma 4 image captioning |
| `ENABLE_AI_STORY` | `True` | CPU only | AI story generation |
| `ENABLE_AI_CONTENT_CLASSIFY` | `True` | CPU only | Content classification (photo/screenshot/document) |

### Background Processing: 4-Stage Pipeline

Each background job runs 4 sequential stages:

1. **Stage 1: SigLIP2 Embeddings** — Generate 768-dim L2-normalized visual embeddings for semantic search
2. **Stage 2: Face Detection & Clustering** — Detect faces, extract embeddings, cluster into people
3. **Stage 3: Gemma Vision Captions** — Generate AI summaries, captions, auto-tags
4. **Stage 4: OCR Text Extraction** — Extract visible text from images

Jobs support resume from interruption: if a stage already has data, it's skipped.

### GPU Mode Selection

| Mode | Value | Backend |
|------|-------|---------|
| NVIDIA CUDA | `cuda` | CUDA Toolkit |
| AMD ROCm | `rocm` | ROCm stack |
| Intel Arc/SYCL | `sycl` | Intel oneAPI |
| Vulkan | `vulkan` | Vulkan SDK |
| CPU Only | `cpu` | No GPU acceleration |

### Server Port Map

| Service | Port | Purpose |
|---------|------|---------|
| Rust Backend API | 8269 | Main REST API |
| Python ML Microservice | 8270 | ML inference |
| Agent LLM server | 9090 | llama-server (Gemma 4 E4B) |
| Vision/caption server | 9091 | llama-server (Gemma 4 E2B) |
| OCR server | 9092 | llama-server (PaddleOCR-VL) |
| Frontend (dev) | 3005 | Vite dev server |

---

## 9. Security

### Envelope Encryption (Locked Folder)

```
User Password → Argon2id Hash → Store in settings.json
              → Argon2id Key Derivation → KEK (in-memory only)
              → Random 32-byte DEK → Encrypt with KEK (Fernet) → Store encrypted DEK

On Auth:
User Password → Verify Argon2id Hash → Derive KEK → Decrypt DEK → Hold in memory (30-min session)
             → Encrypt/Decrypt Locked Folder files (Fernet)
```

- **Password**: min 12 chars, never stored
- **Salt**: 16 random bytes, stored in settings.json
- **Argon2id Hash**: For password verification
- **KEK**: Key Encryption Key, derived in-memory only
- **DEK**: 32-byte Data Encryption Key, encrypted with KEK, stored in settings.json
- **Fernet**: Symmetric encryption of individual files
- **Session**: 30-minute timeout, in-memory only, cleared on lock/restart
- **Lockout**: After 3 failed attempts, exponential backoff (30s → 30×2^(n-3)s)

### Path Isolation

Read operations restricted to:
- `{UPLOAD_DIR}`, `{THUMBNAILS_DIR}`, `{DATA_DIR}`
- `~/Pictures`, `~/Downloads`, `~/Documents`, `~/Desktop`
- `~` (home), `/media`, `/run/media`, `/Volumes`, `/mnt`
- User-configured paths from `settings.json`

Security checks: reject `..`, resolve symlinks, validate against allowed roots.

### API Authentication
- Optional `API_KEY` env var enables `X-API-Key` header requirement
- CORS restricted to local Tauri/Vite origins

### Tauri CSP
```
default-src 'self';
img-src 'self' http://127.0.0.1:8269 http://localhost:8269 data: blob: [map tile domains]
media-src 'self' http://127.0.0.1:8269 http://localhost:8269 data: blob:
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'self' http://127.0.0.1:8269 http://localhost:8269 ws://localhost:* [map tile domains]
```

---

## 10. Design System

See `DESIGN.md` for the complete design system. Key rules:

- **Darkroom Instrument** creative direction: deep blacks, minimal surface contrast, photographs as the only color
- **Single accent**: Electric Blue (#2563eb) used only on interactive elements (≤10% of screen)
- **Tonal layering**: Void (#050505) → Canvas (#06080c) → Surface (#0a0c10) → Raised (#161A20)
- **No drop shadows on resting elements**: only on hover, focus, drag
- **Typography**: Instrument Serif (display, rare), Sora (body, UI), JetBrains Mono (data)
- **GlassMaterial**: Backdrop blur overlays only (never for cards/sidebars)
- **No gradient text, no over-rounded cards, no decorative glassmorphism**

### Theme Variants
- **Default (Prism)**: Dark theme with grain overlay
- **Google**: Lighter surfaces, no grain
- **Apple**: iOS-inspired, rounded controls

---

## 11. Key Implementation Details

### Photo Normalization (`frontend/types.ts:179`)

`normalizePhoto()` converts backend `RawPhoto` to frontend `Photo`:
- Handles both `snake_case` and `camelCase` field names
- Resolves `url` with fallback to thumbnail endpoint
- Sanitizes date strings (adds `Z` if missing timezone)
- Derives `type` from `file_type`, `mime_type`, or path extension
- Maintains backward-compatible aliases (`is_favorite`, `is_locked`, etc.)

### Pagination (`usePhotos.ts`)

- Page size: 50 photos
- Infinite scroll via offset-based pagination
- SSE events (`new_photo`, `photo_updated`, `photo_trashed`) update state in real-time
- Re-fetches all photos on SSE reconnect

### Photo Grid (`PhotoGrid.tsx`)

- Virtualized via TanStack Virtual
- Two view modes: grid (masonry-like rows) and list
- Three filter pills: All, Favorites, Recent, Videos
- Integrated timeline dial (date-grouped headers)
- Google Photos-style memory carousel (when `galleryStyle === 'google'`)
- Apple Photos-style header (when `galleryStyle === 'apple'`)
- Inline favorite/lock/delete toggles

### Agent View (`AgentView.tsx`)

- Persistent chat sessions with sidebar
- Plan execution with visible tool calls
- Inline photo results in messages (WhatsApp-style grid)
- Suggested follow-up chips
- Smart album creation from search results
- Session persistence in `agent_sessions` / `agent_messages` tables

### Image Editor

19 non-destructive tools:
1. AI Tools (Inpaint) — Stable Diffusion 1.5
2. Clone & Heal — Clone stamp + healing brush
3. Lasso Studio — Freehand, polygonal, magnetic selection
4. Layer Stack — Non-destructive layers, 27 blend modes
5. Camera RAW — Demosaicing, Kelvin WB, highlight recovery
6. Liquify & Reshape
7. Shot Matcher
8. Presets
9. Light (Adjust)
10. Color (HSL)
11. Detail
12. Portrait
13. Regions (Selective)
14. Grain & Leak
15. LUT Grade
16. Frames & Atmosphere
17. Palette
18. Markup & Vector (Annotations)
19. Crop (Transform)

Adjustments stored as JSON in `adjustments_json` column, applied during export.

### Video Editor (NLE)

- Multi-track timeline (video, audio, text, effect)
- WebGL-accelerated preview with shader effects
- Keyframe animation (linear + bezier)
- Multi-cam editing (up to 4 angles)
- Proxy workflow
- Export: MP4/MOV/MKV with hardware encoding (NVENC/VAAPI)

---

## 12. Frontend Services

### `apiClient.ts`
- `fetchWithRetry`: exponential backoff retry (3 retries, 1s base delay)
- `request<T>`: generic JSON request/response wrapper
- `apiClient.get/post/put/delete`: typed API methods

### `EventService.ts`
- SSE connection to `/api/v1/settings/events`
- Event subscription system with named channels (`new_photo`, `status`, `photo_trashed`, `photo_updated`, `reconnected`)
- Auto-reconnect on disconnect

### `Telemetry` (`useTelemetry.ts`)
- Module-level event buffer (max 30 events, flush every 800ms)
- Batched POST to `/api/v1/telemetry/log-batch`
- Session ID generated once per app launch
- Respects telemetry opt-out (errors always captured)
- Flushes on `beforeunload`

---

## 13. Rust Backend Services

### `ml_client.rs`
HTTP client for Python ML microservice (`http://127.0.0.1:8270`). Face scanning is
now in-process (`services/face_engine.rs`, SCRFD + ArcFace via ONNX Runtime) and no
longer uses the ML service:
- `get_siglip_embedding(photo_path)` → `/ml/siglip`
- `get_vision_caption(photo_path)` → `/ml/vision`
- `get_ocr_text(photo_path)` → `/ml/ocr`
- `get_semantic_masks(photo_path)` → `/ml/semantic-masks`
- `get_background_mask(photo_path)` → `/ml/background-mask`
- `get_portrait_masks(photo_path)` → `/ml/portrait-masks`
- `get_auto_enhance(photo_path)` → `/ml/auto-enhance`
- `check_health()` → `/health`

### `worker.rs`
Background AI worker:
- Persistent Tokio task draining DB-backed job queue
- 4-stage pipeline per photo (SigLIP → Face → Vision → OCR)
- Adaptive throttling (CPU > 85% pauses worker)
- Exponential backoff retry (5 max retries, 30s-10min delay)
- Stage-aware resume (skips completed stages on restart)
- Atomic counters per stage for status reporting

### `telemetry.rs`
- Logs API request events to `telemetry_events` table
- Samples 1-in-N requests (configurable)
- Always logs errors (4xx/5xx)
- Optional response body summary extraction

---

## 14. Environment Variables Reference

### Core
| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Backend bind host |
| `PORT` | `8269` | Backend bind port |
| `DATABASE_URL` | `sqlite://{cwd}/backend_rust/prism.db` | SQLite database URL |
| `UPLOAD_DIR` | `uploads` | Upload directory |
| `THUMBNAILS_DIR` | `thumbnails` | Thumbnails directory |
| `PYTHON_ML_URL` | `http://127.0.0.1:8270` | ML service URL |
| `API_KEY` | `""` | API auth key (empty = disabled) |
| `FFMPEG_PATH` | `""` (use PATH) | Custom ffmpeg binary |

### AI Feature Flags
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AI_AGENT` | `False` | AI assistant |
| `ENABLE_AI_INPAINTING` | `False` | Inpainting |
| `ENABLE_AI_FACE` | `False` | Face detection |
| `ENABLE_AI_CLIP` | `False` | SigLIP embeddings |
| `ENABLE_AI_REMBG` | `False` | Background removal |
| `ENABLE_AI_OCR` | `False` | OCR |
| `ENABLE_AI_SUBTITLES` | `False` | Subtitles |
| `ENABLE_AI_STORY` | `True` | Story generation |
| `ENABLE_AI_CONTENT_CLASSIFY` | `True` | Content classification |
| `ENABLE_AI_CAPTION` | `True` | Image captioning |
| `ENABLE_RAW_PROCESSING` | `True` | RAW support |
| `ENABLE_LAN_SYNC` | `False` | LAN sync |

### Background Processing
| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_IMAGE_BG_PROCESS` | `True` | Image analysis master switch |
| `ENABLE_VIDEO_BG_PROCESS` | `True` | Video analysis master switch |
| `ENABLE_VIDEO_EDITOR_AI` | `True` | Video editor AI |
| `GPU_MODE` | `cuda` | GPU backend (`cuda`, `rocm`, `sycl`, `vulkan`, `cpu`) |
| `GPU_ENCODING_MODE` | `auto` | Video encoding (`auto`, `nvenc`, `vaapi`, `cpu`) |

### Face Detection
| Variable | Default | Description |
|----------|---------|-------------|
| `FACE_CONF_THRESHOLD` | `0.65` | Face detection confidence |
| `FACE_YAW_PITCH_LIMIT` | `28.0` | Max yaw/pitch angle (degrees) |
| `FACE_MATCH_THRESHOLD` | `0.41` | Face matching threshold |
| `FACE_UNCERTAIN_MATCH_THRESHOLD` | `0.33` | Pending assignment threshold |
| `FACE_EARLY_EXIT_SCORE` | `0.75` | Early exit score |
| `FACE_DETECT_MAX_DIM` | `1280` | Max detection dimension |

### Job Queue
| Variable | Default | Description |
|----------|---------|-------------|
| `JOB_QUEUE_MAX_RETRIES` | `5` | Max retry attempts |
| `JOB_QUEUE_THROTTLE_CPU_THRESHOLD` | `85.0` | CPU throttle threshold (%) |
| `JOB_QUEUE_THROTTLE_BATTERY_THRESHOLD` | `20` | Battery throttle threshold (%) |

### Telemetry
| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_ENABLED` | `true` | Enable telemetry collection |
| `TELEMETRY_SAMPLE_RATE` | `10` | 1-in-N sampling (0 = disabled) |
| `TELEMETRY_RESPONSE_LOGGING` | `false` | Capture response summaries |

### Data Directories

| OS | Default Data Directory |
|----|----------------------|
| Linux | `~/.local/share/prism` |
| macOS | `~/Library/Application Support/prism` |
| Windows | `%APPDATA%/prism` |

Stored: `Prism.db`, `settings.json`, `uploads/`, `thumbnails/`

---

## 15. Startup Scripts

### `run-web.sh`
Starts Rust backend + Vite frontend for web development.

### `run-desktop.sh`
Starts Rust backend + Tauri desktop shell. Handles:
- Common CUDA `LD_LIBRARY_PATH` entries
- Local `gcc-15` compiler override
- Port 8269 detection (reconnects to existing backend if running)

---

## 16. Important Patterns & Conventions

### Photo ID Handling
- Backend uses integer `id` and string `uuid`
- Frontend uses `string | number` for `id` (backward compatible)
- All API endpoints accept either `id` or `uuid` in URL params

### Date Handling
- Backend stores `date` and `date_taken` as DateTime
- Frontend normalizes to ISO strings with `Z` suffix
- `dateTimestamp` and `uploadDateTimestamp` derived for sorting

### SSE Events
- `new_photo` — new photo imported
- `photo_updated` — metadata changed
- `photo_trashed` — photo moved to trash
- `status` — sync/scanning status
- `reconnected` — SSE reconnected (triggers full refetch)
- `job_stage_progress` — background analysis progress
- `background_job_status` — queue status
- `background_job_completed` — all jobs finished

### Error Handling
- Frontend uses `ApiError` class with status + data
- Backend logs errors to `backend.log`
- Telemetry captures errors with stack traces
- Graceful degradation when ML service is unavailable

### Rate Limiting
- 20 requests per minute per IP+path
- Applies to `/video/*` and `/photos/inpaint/process` endpoints
- In-memory sliding window, resets on restart

---

## 17. Testing

- Tests run against a temporary directory (`/tmp/prism_tests/` when `PRISM_TEST=1`)
- Python pytest for Python ML microservice
- No Rust unit test suite currently in `backend_rust/`

---

## 18. Known Issues / Future Work

- Rust backend is actively replacing Python backend; some CLI docs reference Python
- AI features are opt-in and require model files to be placed in specific directories
- GPU memory management requires careful model scheduling (mutual exclusion)
- Locked Folder is not available in Tauri web mode (desktop only)

---

## 19. Quick Reference: Key Files

| Purpose | File |
|---------|------|
| Main app entry | `frontend/App.tsx` |
| View router | `frontend/components/layout/MainContent.tsx` |
| State management | `frontend/hooks/useAppState.ts` |
| Photo types | `frontend/types.ts` |
| API base URL | `frontend/constants.ts` |
| Photo fetching | `frontend/hooks/usePhotos.ts` |
| Photo grid | `frontend/components/PhotoGrid/PhotoGrid.tsx` |
| Agent view | `frontend/components/AgentView/AgentView.tsx` |
| App settings | `frontend/store/settingsStore.ts` |
| Design system | `DESIGN.md` |
| Rust entry | `backend_rust/src/main.rs` |
| DB schema | `backend_rust/src/db.rs` |
| Route registry | `backend_rust/src/routes/mod.rs` |
| Background worker | `backend_rust/src/services/worker.rs` |
| ML client | `backend_rust/src/services/ml_client.rs` |
| Data models | `backend_rust/src/models/mod.rs` |

---

*End of Prism context file. This document covers all major architectural decisions, data models, API surface, frontend structure, AI pipeline, security mechanisms, and implementation details present in the Prism codebase as of 2026-08-03.*
