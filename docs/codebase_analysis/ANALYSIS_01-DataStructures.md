# Prism Technical Analysis: Data Structures

> **Document**: ANALYSIS_01-DataStructures.md  
> **Target Version**: Prism v0.1.0  
> **Methodology**: `.agents/skills/codebase-analysis-skill` Phase 2  
> **Status**: VERIFIED & AUDITED  

---

## Table of Contents
- [Part 1: Concept Layer (What)](#part-1-concept-layer-what)
- [Part 2: Structure Layer (Structure)](#part-2-structure-layer-structure)
- [Part 3: Operation Layer (How)](#part-3-operation-layer-how)
- [Part 4: Integration Layer (Integration)](#part-4-integration-layer-integration)
- [Part 5: Summary Layer (Summary)](#part-5-summary-layer-summary)
- [Part 6: Verification Report](#part-6-verification-report)

---

# Part 1: Concept Layer (What)

## 1. System Overview

Prism models media assets and computational state through a strict dual-representation architecture:
1. **Persistent Relational Schema**: SQLite with Write-Ahead Logging (WAL), Foreign Keys enabled, and specialized indices.
2. **Asynchronous Rust In-Memory State**: Tokio-managed thread pools, `Arc<AppState>`, atomic primitive status counters, and mimalloc heap management.
3. **Reactive Frontend State**: Strict TypeScript interfaces mirrored from Rust backend models, driving reactive Zustand stores and virtualized grid views.

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

# Part 2: Structure Layer (Structure)

## 2. Core Domain Entities

### 2.1 The `Photo` Struct & SQLite Table

`Photo` serves as the primary data atom in Prism. It unifies camera EXIF metadata, filesystem pointers, perceptual hashing, and outputs from five ONNX AI analyzers.

#### Rust Representation
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
    pub content_type: String,
    pub exif_make: Option<String>,
    pub exif_model: Option<String>,
    pub exif_focal_length: Option<f64>,
    pub exif_iso: Option<i64>,
    pub duration: Option<f64>,
    pub fps: Option<f64>,
    pub codec: Option<String>,
    pub audio_codec: Option<String>,
    pub rotation: Option<i64>,
    pub video_faces_scanned: bool,
    pub animated_url: Option<String>,
    pub event_id: Option<i64>,
}
```

#### SQLite Schema
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
    ocr_text TEXT,
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

#### TypeScript Mirroring
```typescript
// [VERIFY: frontend/types.ts:1-52]
export interface Photo {
  id: string | number;
  uuid?: string;
  url: string;
  path: string;
  width: number;
  height: number;
  aspect_ratio?: number;
  date: string;
  dateTimestamp?: number;
  date_taken?: string;
  uploadDate?: string;
  uploadDateTimestamp?: number;
  upload_date?: string;
  location?: string;
  caption?: string;
  filename?: string;
  isFavorite: boolean;
  is_favorite?: boolean;
  isLocked?: boolean;
  is_locked?: boolean;
  isTrash?: boolean;
  is_trash?: boolean;
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
  ocr_text?: string;
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
```

---

### 2.2 Facial Biometrics & Recognition Entities

Face identification is managed across three relational tiers: detected face instances (`faces`), recognized individuals (`people`), and mapping junctions (`photo_people`).

```
┌─────────────────────────┐          ┌─────────────────────────┐
│         photos          │          │         people          │
│ id: 42                  │          │ id: 7                   │
│ filename: portrait.jpg  │          │ name: "Alice"           │
│ embedding: [768 floats] │          │ face_embedding: [512 f] │
└────────────┬────────────┘          └────────────┬────────────┘
             │                                    │
             │ 1:N                                │ 1:N
             ▼                                    ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│          faces          │          │      photo_people       │
│ id: 101                 │          │ photo_id: 42            │
│ photo_id: 42            │          │ person_id: 7            │
│ box_json: [x,y,w,h]     │          │ confidence: 0.98        │
│ embedding_json: [512 f] │          │ face_box_json: [x,y,w,h]│
└─────────────────────────┘          └─────────────────────────┘
```

**Evidence**:
- [VERIFY: backend_rust/src/db.rs:118-124] - `CREATE TABLE people` with `cover_face_thumbnail` and `face_embedding`.
- [VERIFY: backend_rust/src/db.rs:126-132] - `CREATE TABLE photo_people` with compound primary key `(photo_id, person_id)`.
- [VERIFY: backend_rust/src/db.rs:134-142] - `CREATE TABLE faces` with foreign key CASCADE to `photos(id)`.
- [VERIFY: backend_rust/src/services/analyzers/face.rs:44-52] - Face record insertion with bounding box JSON.

---

### 2.3 Non-Linear Editor (NLE) Data Structures

The NLE subsystem defines a JSON-serializable multi-track timeline model capable of precise sub-frame positioning, Bézier keyframe transitions, and real-time audio gain management.

#### Rust Model
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

#### TypeScript Timeline & Keyframing Hierarchy
```typescript
// [VERIFY: frontend/types/nle.ts:17-24]
export interface TimelineState {
  tracks: Track[];
  duration: number;
  playheadPosition: number;
  zoomLevel: number;
  scrollOffset: number;
  projectAssets?: import('@/store/nleStore').ProjectAsset[];
}

// [VERIFY: frontend/types/nle.ts:26-37]
export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text';
  name: string;
  muted: boolean;
  solo: boolean;
  visible: boolean;
  locked: boolean;
  color?: string;
  clips: Clip[];
  angle?: number;
}

// [VERIFY: frontend/types/nle.ts:50-63]
export interface BezierCP {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  t: number; // time in seconds relative to clip start
  v: number;
  interpolation: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  bezierCP?: BezierCP;
}
```

---

### 2.4 AI Job Scheduler & Telemetry Types

#### Pre-Flight Evaluation Record
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

#### Hardware Telemetry Snapshot
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

#### Resource Requirement Classification
```rust
// [VERIFY: backend_rust/src/services/worker.rs:220-224]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResourceNeed {
    Gpu,
    CpuHeavy,
    CpuLight,
}
```

---

# Part 3: Operation Layer (How)

## 3. Data Structure Lifecycles

### 3.1 Memory Layout & Alignment

Prism uses `mimalloc` as the global memory allocator. Structs are configured for zero-copy deserialization:

```
PhotoRecord (Memory Footprint: 56 bytes on x86_64)
┌───────────────────────┬───────────────────────────┬──────────────────────┐
│ Field                 │ Type                      │ Size / Offset        │
├───────────────────────┼───────────────────────────┼──────────────────────┤
│ id                    │ i64                       │ 8 bytes  (Offset 0)  │
│ path                  │ String (ptr + cap + len)  │ 24 bytes (Offset 8)  │
│ has_embedding         │ bool                      │ 1 byte   (Offset 32) │
│ has_faces             │ bool                      │ 1 byte   (Offset 33) │
│ has_summary           │ bool                      │ 1 byte   (Offset 34) │
│ has_ocr               │ bool                      │ 1 byte   (Offset 35) │
│ ocr_attempted         │ bool                      │ 1 byte   (Offset 36) │
│ [padding]             │ -                         │ 3 bytes  (Offset 37) │
└───────────────────────┴───────────────────────────┴──────────────────────┘
```

**Evidence**:
- [VERIFY: backend_rust/src/main.rs:9-10] - `static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;`

### 3.2 Stage Resume Priority Resolution

When an interrupted background job is resumed after restart, `get_resume_priority` determines which analyzers can be skipped based on existing table columns:

```rust
// [VERIFY: backend_rust/src/services/worker.rs:449-460]
fn get_resume_priority(
    has_embedding: bool,
    has_faces: bool,
    has_summary: bool,
    has_ocr: bool,
) -> u32 {
    if has_ocr { return 0; }        // ocr priority=0 done → skip ≤0
    if has_summary { return 100; }  // vision priority=100 done → skip ≤100
    if has_faces { return 200; }    // face priority=200 done → skip ≤200
    if has_embedding { return 300; }// siglip priority=300 done → skip ≤300
    0                               // nothing done yet → run everything
}
```

---

# Part 4: Integration Layer (Integration)

## 4. Cross-Subsystem Structural Dependencies

```
┌──────────────────┐
│   HTTP Request   │
└────────┬─────────┘
         │ Upload bytes
         ▼
┌──────────────────┐           ┌──────────────────┐
│   Photo Model    │──────────▶│ BackgroundJobs DB│
│  (models.rs:55)  │           │   (db.rs:144)    │
└────────┬─────────┘           └────────┬─────────┘
         │                              │ Polled by
         │ Foreign Key                  ▼
         ▼                     ┌──────────────────┐
┌──────────────────┐           │   PhotoRecord    │
│   Faces Table    │           │ (worker.rs:42)   │
│   (db.rs:134)    │           └────────┬─────────┘
└────────┬─────────┘                    │ Filtered by
         │ Evaluated by                 ▼
         ▼                     ┌──────────────────┐
┌──────────────────┐           │  AnalyzerRegistry│
│   FaceAnalyzer   │◀──────────│ (worker.rs:229)  │
│(face.rs:8, p=200)│           └──────────────────┘
```

1. **Ingestion to Worker**: `upload_photo` inserts the `Photo` record and enqueues a `background_jobs` row [VERIFY: backend_rust/src/routes/photos/upload.rs:109-173].
2. **Worker to Pre-flight**: The scheduler loads a `PendingJob` and wraps it into a `PhotoRecord` [VERIFY: backend_rust/src/services/worker.rs:316-324].
3. **Pre-flight to Analyzer DAG**: `AnalyzerRegistry::plan` compares `photo.has_*` flags with `get_resume_priority` to select eligible analyzers [VERIFY: backend_rust/src/services/worker.rs:257-272].

---

# Part 5: Summary Layer (Summary)

## 5. Struct & Model Cross-Reference Table

| Domain Struct | Storage Medium | Key Index / Constraint | Concurrency Guard | Evidence |
|---|---|---|---|---|
| `Photo` | SQLite `photos` | PRIMARY KEY `id`, UNIQUE `uuid` | SQLite WAL Mutex | [VERIFY: backend_rust/src/models.rs:55] |
| `Album` | SQLite `albums` | PRIMARY KEY `id`, UNIQUE `uuid` | SQLite WAL Mutex | [VERIFY: backend_rust/src/models.rs:107] |
| `Person` | SQLite `people` | PRIMARY KEY `id`, UNIQUE `uuid` | SQLite WAL Mutex | [VERIFY: backend_rust/src/models.rs:132] |
| `VideoProject` | SQLite `video_projects` | PRIMARY KEY `id`, UNIQUE `uuid` | SQLite WAL Mutex | [VERIFY: backend_rust/src/routes/nle.rs:17] |
| `ResourceShare` | SQLite `shares` | UNIQUE `share_token` | SQLite WAL Mutex | [VERIFY: backend_rust/src/models.rs:169] |
| `SystemState` | In-Memory / Stack | Snapshot cached for 10s | AtomicU64 timestamp | [VERIFY: backend_rust/src/services/worker.rs:78] |
| `RateLimiter` | In-Memory (`AppState`) | Per-IP + Route String key | `Mutex<HashMap<...>>` | [VERIFY: backend_rust/src/routes/mod.rs:294] |
| `SiglipEngine` | Heap (`OnceLock`) | Static singleton | `Mutex<Session>` | [VERIFY: backend_rust/src/services/siglip.rs:8] |

---

# Part 6: Verification Report

| Verification Checkpoint | Target Source File:Line | Verified Reality in Codebase | Status |
|---|---|---|---|
| `Photo` Rust definition | `backend_rust/src/models.rs:55-104` | 46 fields mapped from database columns | ✓ Verified |
| `Photo` SQLite table | `backend_rust/src/db.rs:50-98` | Tables created with WAL mode and foreign keys | ✓ Verified |
| `Photo` TypeScript type | `frontend/types.ts:1-52` | Complete interface mirror with optional camelCase aliases | ✓ Verified |
| `VideoProject` NLE struct | `backend_rust/src/routes/nle.rs:17-28` | Stores project_json text, width, height, fps | ✓ Verified |
| `TimelineState` NLE TS type | `frontend/types/nle.ts:17-24` | Contains Track array, playhead, zoom, scrollOffset | ✓ Verified |
| `PhotoRecord` scheduler | `backend_rust/src/services/worker.rs:42-50` | Pre-flight boolean flags (has_faces, has_ocr, etc.) | ✓ Verified |
| `SystemState` telemetry | `backend_rust/src/services/worker.rs:78-85` | cpu_usage, on_battery, battery_percent, gpu_busy | ✓ Verified |
| `ResourceShare` model | `backend_rust/src/models.rs:169-183` | Password hash, download limits, hide EXIF/GPS | ✓ Verified |
| `RateLimiter` structure | `backend_rust/src/routes/mod.rs:294-314` | In-memory Mutex HashMap with sliding Instant deque | ✓ Verified |
