# Prism Technical Analysis: Data Structures

> **Document**: ANALYSIS_01-DataStructures.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 2  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [Part 1: Concept Layer (Conceptual Architecture)](#part-1-concept-layer-conceptual-architecture)
- [Part 2: Structure Layer (Detailed Entity Breakdown)](#part-2-structure-layer-detailed-entity-breakdown)
  - [2.1 The `Photo` Core Media Entity](#21-the-photo-core-media-entity)
  - [2.2 Collections: `Album` & Junction `PhotoAlbum`](#22-collections-album--junction-photoalbum)
  - [2.3 Identity & Biometrics: `Person` & `Face`](#23-identity--biometrics-person--face)
  - [2.4 Video Synthesis: `VideoProject` & Timeline Types](#24-video-synthesis-videoproject--timeline-types)
  - [2.5 Background Operations: `BackgroundJob` & `PhotoRecord`](#25-background-operations-backgroundjob--photorecord)
  - [2.6 Hardware & System: `SystemState` & `ResourceShare`](#26-hardware--system-systemstate--resourceshare)
  - [2.7 Conversational Agent: `AgentSession` & `AgentMessage`](#27-conversational-agent-agentsession--agentmessage)
  - [2.8 Authentication & Security: `User`](#28-authentication--security-user)
- [Part 3: Operation Layer (Memory Layout & Index Topology)](#part-3-operation-layer-memory-layout--index-topology)
- [Part 4: Integration Layer (Frontend Zustand State Synchronization)](#part-4-integration-layer-frontend-zustand-state-synchronization)
- [Part 5: Entity-Relationship Schema Diagram](#part-5-entity-relationship-schema-diagram)
- [Part 6: Verification Report](#part-6-verification-report)

---

# Part 1: Concept Layer (Conceptual Architecture)

Prism models multimedia assets, AI representations, and application runtime state through a strict three-tier structural paradigm:

1. **Persistent Relational Schema (SQLite 3 with WAL)**:
   All structural entities reside in a local SQLite file with Write-Ahead Logging (`PRAGMA journal_mode = WAL`), normal synchronization (`PRAGMA synchronous = NORMAL`), and strict foreign key integrity (`PRAGMA foreign_keys = ON`).
2. **Asynchronous Rust In-Memory State**:
   Domain representations utilize `sqlx::FromRow` derivation, `Option<T>` for nullable metadata, `Arc<AppState>` for shared thread-safe contexts, and `mimalloc` for fragmentation-free heap allocation.
3. **Reactive Frontend State (Zustand & TypeScript)**:
   Strict TypeScript interfaces mirror the Rust backend representations, driving UI reactivity across virtualized grid renderers, canvas pipelines, and interactive agent chats.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Data Structure Hierarchy                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Primary Asset Entities                                                     │
│  ├── Photo (Core image/video record with EXIF & ML fields)                 │
│  ├── Album & PhotoAlbum (Logical collections & junction records)           │
│  ├── Person & Face (Clustered identities & ArcFace bounding boxes)         │
│  └── VideoProject (Non-linear multi-track timeline documents)               │
│                                                                             │
│  Operational & Scheduling Entities                                          │
│  ├── BackgroundJob (Multi-stage AI processing state & error trace)         │
│  ├── PhotoRecord (Lean pre-flight evaluation struct for Analyzers)         │
│  ├── SystemState (Hardware telemetry: CPU%, Battery%, GPU flag)            │
│  └── ResourceShare (Time-limited, password-protected sharing tokens)       │
│                                                                             │
│  Conversational Entities                                                    │
│  ├── AgentSession (UUID-keyed conversational threads)                       │
│  └── AgentMessage (Structured message with tool invocations & photo payloads)│
│                                                                             │
│  Authentication & Access Control                                            │
│  └── User (Argon2-hashed local user accounts & roles)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Evidence**:
- [VERIFY: backend_rust/src/models.rs:55-104] - `pub struct Photo` definition.
- [VERIFY: backend_rust/src/models.rs:107-117] - `pub struct Album` definition.
- [VERIFY: backend_rust/src/models.rs:132-138] - `pub struct Person` definition.
- [VERIFY: backend_rust/src/routes/nle.rs:17-28] - `pub struct VideoProject` definition.
- [VERIFY: backend_rust/src/services/worker.rs:42-50] - `pub struct PhotoRecord` definition.
- [VERIFY: backend_rust/src/services/worker.rs:78-85] - `pub struct SystemState` definition.

---

# Part 2: Structure Layer (Detailed Entity Breakdown)

## 2.1 The `Photo` Core Media Entity

The `Photo` struct represents the fundamental atomic asset in Prism. It unifies filesystem paths, camera EXIF parameters, and outputs from five ONNX neural networks.

### Rust Representation
```rust
// [VERIFY: backend_rust/src/models.rs:55-104]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Photo {
    pub id: i64,
    pub uuid: Option<String>,
    pub filename: String,
    pub path: String,
    pub url: Option<String>,
    pub width: i64,
    pub height: i64,
    pub aspect_ratio: f64,
    pub hash: Option<String>,
    pub phash: Option<String>,
    pub caption: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location: Option<String>,
    pub date: Option<DateTime<Utc>>,
    pub date_taken: Option<DateTime<Utc>>,
    pub upload_date: Option<DateTime<Utc>>,
    pub is_favorite: bool,
    pub is_locked: bool,
    pub is_trash: bool,
    pub mime_type: String,
    pub file_type: String,
    pub device_id: Option<String>,
    pub is_external: bool,
    pub ai_summary: Option<String>,
    pub auto_tags: Option<String>,
    pub embedding: Option<String>,
    pub ocr_text: Option<String>,
    pub ocr_bboxes: Option<String>,
    pub adjustments_json: Option<String>,
    pub blur_score: Option<f64>,
    pub file_size: Option<i64>,
    pub content_type: Option<String>,
    pub exif_make: Option<String>,
    pub exif_model: Option<String>,
    pub exif_focal_length: Option<f64>,
    pub exif_iso: Option<i64>,
    pub duration: Option<f64>,
    pub fps: Option<f64>,
    pub codec: Option<String>,
    pub audio_codec: Option<String>,
    pub rotation: Option<i64>,
    pub video_faces_scanned: Option<bool>,
    pub animated_url: Option<String>,
    pub event_id: Option<i64>,
}
```

### SQLite Schema Definition
```sql
-- [VERIFY: backend_rust/src/db.rs:50-98]
CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    url TEXT,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    aspect_ratio REAL NOT NULL,
    hash TEXT,
    phash TEXT,
    caption TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    latitude REAL,
    longitude REAL,
    location TEXT,
    date DATETIME,
    date_taken DATETIME,
    upload_date DATETIME,
    is_favorite BOOLEAN DEFAULT 0,
    is_locked BOOLEAN DEFAULT 0,
    is_trash BOOLEAN DEFAULT 0,
    mime_type TEXT DEFAULT 'image/jpeg',
    file_type TEXT DEFAULT 'image',
    device_id TEXT,
    is_external BOOLEAN DEFAULT 0,
    ai_summary TEXT,
    auto_tags TEXT,
    embedding TEXT,
    embedding_blob BLOB,
    ocr_text TEXT,
    ocr_bboxes TEXT,
    adjustments_json TEXT,
    blur_score REAL,
    file_size INTEGER,
    content_type TEXT DEFAULT 'photo',
    exif_make TEXT,
    exif_model TEXT,
    exif_focal_length REAL,
    exif_iso INTEGER,
    duration REAL,
    fps REAL,
    codec TEXT,
    audio_codec TEXT,
    rotation INTEGER DEFAULT 0,
    video_faces_scanned BOOLEAN DEFAULT 0,
    animated_url TEXT,
    event_id INTEGER
);
```

### TypeScript Frontend Interface
```typescript
// [VERIFY: frontend/types.ts:1-52]
export interface Photo {
  id: number;
  uuid?: string;
  filename: string;
  path: string;
  url?: string;
  width: number;
  height: number;
  aspect_ratio: number;
  hash?: string;
  phash?: string;
  caption?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  date?: string;
  date_taken?: string;
  upload_date?: string;
  is_favorite: boolean;
  is_locked: boolean;
  is_trash: boolean;
  mime_type: string;
  file_type: string;
  device_id?: string;
  is_external: boolean;
  ai_summary?: string;
  auto_tags?: string;
  embedding?: string;
  ocr_text?: string;
  ocr_bboxes?: string;
  adjustments_json?: string;
  blur_score?: number;
  file_size?: number;
  content_type?: string;
  exif_make?: string;
  exif_model?: string;
  exif_focal_length?: number;
  exif_iso?: number;
  duration?: number;
  fps?: number;
  codec?: string;
  audio_codec?: string;
  rotation?: number;
  video_faces_scanned?: boolean;
  animated_url?: string;
  event_id?: number;
}
```

---

## 2.2 Collections: `Album` & Junction `PhotoAlbum`

Albums provide user-curated and smart dynamic groupings:

### Rust Representation
```rust
// [VERIFY: backend_rust/src/models.rs:107-117]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Album {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub r#type: String,
    pub is_smart: bool,
    pub smart_type: Option<String>,
    pub cover_url: Option<String>,
    pub photo_count: i64,
    pub metadata_json: Option<String>,
}
```

### SQLite Schema Definition
```sql
-- [VERIFY: backend_rust/src/db.rs:101-117]
CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_smart BOOLEAN DEFAULT 0,
    smart_type TEXT,
    cover_url TEXT,
    photo_count INTEGER DEFAULT 0,
    metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS photo_albums (
    photo_id INTEGER NOT NULL,
    album_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, album_id)
);
```

---

## 2.3 Identity & Biometrics: `Person` & `Face`

Prism clusters human identities using 512-dimensional ArcFace neural embeddings:

### Rust Representation
```rust
// [VERIFY: backend_rust/src/models.rs:132-138]
#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Person {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub cover_face_thumbnail: Option<String>,
    pub face_embedding: Option<String>,
}
```

### SQLite Schema Definition
```sql
-- [VERIFY: backend_rust/src/db.rs:119-143]
CREATE TABLE IF NOT EXISTS people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    name TEXT NOT NULL,
    cover_face_thumbnail TEXT,
    face_embedding TEXT
);

CREATE TABLE IF NOT EXISTS photo_people (
    photo_id INTEGER NOT NULL,
    person_id INTEGER NOT NULL,
    confidence REAL DEFAULT 1.0,
    face_box_json TEXT,
    PRIMARY KEY (photo_id, person_id)
);

CREATE TABLE IF NOT EXISTS faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL,
    confidence REAL DEFAULT 1.0,
    box_json TEXT,
    embedding_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);
```

---

## 2.4 Video Synthesis: `VideoProject` & Timeline Types

### Rust Representation
```rust
// [VERIFY: backend_rust/src/routes/nle.rs:17-28]
#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VideoProject {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub cover_photo_id: Option<i64>,
    pub width: i32,
    pub height: i32,
    pub fps: i32,
    pub project_json: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}
```

### SQLite Schema Definition
```sql
-- [VERIFY: backend_rust/src/db.rs:178-189]
CREATE TABLE IF NOT EXISTS video_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE,
    name TEXT NOT NULL DEFAULT 'Untitled Edit',
    cover_photo_id INTEGER,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    fps INTEGER DEFAULT 30,
    project_json TEXT,
    created_at DATETIME,
    updated_at DATETIME
);
```

---

## 2.5 Background Operations: `BackgroundJob` & `PhotoRecord`

### Background Jobs Table
```sql
-- [VERIFY: backend_rust/src/db.rs:145-163]
CREATE TABLE IF NOT EXISTS background_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER,
    job_type TEXT NOT NULL DEFAULT 'sequential_analysis',
    title TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    current_stage TEXT,
    stage_progress TEXT,
    progress_pct REAL DEFAULT 0.0,
    total_items INTEGER DEFAULT 1,
    processed_items INTEGER DEFAULT 0,
    metadata_json TEXT,
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_photo ON background_jobs(photo_id);
```

### `PhotoRecord` (Lean Pre-Flight Evaluation Struct)
```rust
// [VERIFY: backend_rust/src/services/worker.rs:42-50]
pub struct PhotoRecord {
    pub id: i64,
    pub path: String,
    pub has_embedding: bool,
    pub has_faces: bool,
    pub has_summary: bool,
    pub has_ocr: bool,
    pub ocr_attempted: bool,
}
```

---

## 2.6 Hardware & System: `SystemState` & `ResourceShare`

### Rust Telemetry Struct
```rust
// [VERIFY: backend_rust/src/services/worker.rs:78-85]
#[derive(Debug, Clone, Default)]
pub struct SystemState {
    pub cpu_usage: f32,
    pub on_battery: bool,
    pub battery_percent: u32,
    pub external_disconnected: bool,
    pub gpu_busy: bool,
    pub user_active: bool,
}
```

### Cryptographic Resource Sharing
```sql
-- [VERIFY: backend_rust/src/db.rs:250-264]
CREATE TABLE IF NOT EXISTS shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    share_token TEXT UNIQUE NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    password_hash TEXT,
    expires_at DATETIME,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    hide_exif BOOLEAN DEFAULT 0,
    hide_gps BOOLEAN DEFAULT 0,
    download_original BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2.7 Conversational Agent: `AgentSession` & `AgentMessage`

```sql
-- [VERIFY: backend_rust/src/db.rs:205-223]
CREATE TABLE IF NOT EXISTS agent_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    photos_json TEXT,
    plan_json TEXT,
    tools_json TEXT,
    attached_image_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 2.8 Authentication & Security: `User`

```sql
-- [VERIFY: backend_rust/src/db.rs:274-287]
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

---

# Part 3: Operation Layer (Memory Layout & Index Topology)

### 3.1 Memory Layout & Alignment

1. **Global Heap Allocator**:
   Prism binds `mimalloc::MiMalloc` as `#[global_allocator]` to eliminate memory fragmentation during continuous ONNX tensor operations and parallel Rayon vector scans.
   - [VERIFY: backend_rust/src/main.rs:9-10]
2. **Embedding BLOB Layout**:
   The `embedding_blob` column stores raw little-endian IEEE 754 float32 bytes ($768 \times 4 = 3072\text{ bytes}$). When memory-aligned to 4-byte boundaries, it is transmuted directly into `&[f32]` without heap allocation:
   - [VERIFY: backend_rust/src/services/agent_search.rs:36-40]

---

# Part 4: Integration Layer (Frontend Zustand State Synchronization)

Prism maps database entities into reactive Zustand stores:
- `photoStore.ts`: Manages photo lists, active selections, favorites, and trash toggling.
- `nleStore.ts`: Manages video timeline tracks, keyframes, playhead scrubbing, and preview renders.
- `settingsStore.ts`: Coordinates telemetry, API keys, and theme settings.
- `agentStore.ts`: Manages conversational agent chat history, tool calls, and attached photos.

---

# Part 5: Entity-Relationship Schema Diagram

```
┌──────────────┐          ┌──────────────────┐          ┌──────────────┐
│    users     │          │      photos      │1        *│    faces     │
├──────────────┤          ├──────────────────┼──────────┤──────────────┤
│ id (PK)      │          │ id (PK)          │          │ id (PK)      │
│ uuid         │          │ uuid             │          │ photo_id(FK) │
│ username     │          │ filename         │          │ box_json     │
│ password_hash│          │ path             │          │ embedding    │
└──────────────┘          │ embedding_blob   │          └──────────────┘
                          │ ai_summary       │
                          │ ocr_text         │
                          └─────────┬────────┘
                                    │ 1
                                    │
                                    ├──────────────────────────┐
                                    │ *                        │ *
                          ┌─────────┴────────┐       ┌─────────┴────────┐
                          │   photo_albums   │       │   photo_people   │
                          ├──────────────────┤       ├──────────────────┤
                          │ photo_id (PK, FK)│       │ photo_id (PK, FK)│
                          │ album_id (PK, FK)│       │ person_id(PK, FK)│
                          └─────────┬────────┘       └─────────┬────────┘
                                    │ *                        │ *
                                    │ 1                        │ 1
                          ┌─────────┴────────┐       ┌─────────┴────────┐
                          │      albums      │       │      people      │
                          ├──────────────────┤       ├──────────────────┤
                          │ id (PK)          │       │ id (PK)          │
                          │ uuid             │       │ uuid             │
                          │ name             │       │ name             │
                          │ is_smart         │       │ face_embedding   │
                          └──────────────────┘       └──────────────────┘
```

---

# Part 6: Verification Report

| Target Struct / Table | Source Code Location | Description | Status |
|---|---|---|---|
| `Photo` Rust Model | `backend_rust/src/models.rs:55-104` | 48-field domain struct | ✓ Verified |
| `photos` SQLite Schema | `backend_rust/src/db.rs:50-98` | Primary relational media table | ✓ Verified |
| `Photo` TypeScript Interface | `frontend/types.ts:1-52` | Mirrored frontend type | ✓ Verified |
| `Album` Rust & SQLite Model | `backend_rust/src/models.rs:107-117`, `db.rs:101-111` | Album collection record | ✓ Verified |
| `photo_albums` Junction Table | `backend_rust/src/db.rs:113-117` | M:N association table | ✓ Verified |
| `Person` & `people` Table | `backend_rust/src/models.rs:132-138`, `db.rs:119-125` | Facial clustering identity | ✓ Verified |
| `Face` & `faces` Table | `backend_rust/src/db.rs:135-143` | Face bounding boxes & vectors | ✓ Verified |
| `BackgroundJob` Table | `backend_rust/src/db.rs:145-163` | Task scheduler state machine | ✓ Verified |
| `PhotoRecord` Preflight Struct | `backend_rust/src/services/worker.rs:42-50` | Lean struct for scheduler planning | ✓ Verified |
| `SystemState` Telemetry Struct| `backend_rust/src/services/worker.rs:78-85` | OS resource snapshot struct | ✓ Verified |
| `ResourceShare` & `shares` Table| `backend_rust/src/db.rs:250-264` | Ephemeral cryptographic token record| ✓ Verified |
| `VideoProject` NLE Model | `backend_rust/src/routes/nle.rs:17-28`, `db.rs:178-189`| Multi-track NLE project entity | ✓ Verified |
| `User` & `users` Table | `backend_rust/src/db.rs:274-287` | Argon2 local user credential record | ✓ Verified |
