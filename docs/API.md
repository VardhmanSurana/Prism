# API Reference

Prism exposes a REST API for the frontend and external clients. The API runs on port `8269` by default.

## Base URL

```
http://127.0.0.1:8269/api/v1
```

## Authentication

<p align="center">
  <img src="diagrams/api-route-topology.svg" alt="Prism API Authentication and Dispatch Flow" width="100%" />
</p>

### API Key (Optional)

If `API_KEY` is configured, include it in the header:

```
X-API-Key: your-secret-key
```

## System Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "prism-backend-rust",
  "version": "0.1.0",
  "database": "sqlite:prism.db"
}
```

### Photo Statistics
```http
GET /api/v1/photos/stats
```

**Response:**
```json
{
  "total_photos": 1234,
  "total_videos": 56,
  "favorites_count": 89,
  "trash_count": 12,
  "locked_count": 5,
  "storage_used_bytes": 48318382080
}
```

## Shared Capability Registry

Provides clients with a single machine-readable contract describing available features, installed neural models, RAM residency, and hardware compute backends. Distinguishes three states: `installed`, `enabled`, and `resident_in_ram`.

### Get Capabilities & Hardware
```http
GET /api/v1/capabilities
```

**Response:**
```json
{
  "capabilities": {
    "core_media": {
      "name": "Core Media & Library",
      "category": "core",
      "state": "ready",
      "installed": true,
      "enabled": true,
      "resident_in_ram": true,
      "model_id": null,
      "download_size_bytes": 0,
      "description": "Local library management, EXIF parsing, albums, timeline, and trash lifecycle"
    },
    "semantic_search": {
      "name": "Semantic Natural Language Search",
      "category": "ai",
      "state": "ready",
      "installed": true,
      "enabled": true,
      "resident_in_ram": true,
      "model_id": "siglip2",
      "download_size_bytes": 970900000,
      "description": "Natural language photo search via SigLIP2 image and text embeddings"
    },
    "magic_eraser": {
      "name": "Magic Eraser (Object Removal)",
      "category": "ai",
      "state": "model_not_installed",
      "installed": false,
      "enabled": true,
      "resident_in_ram": false,
      "model_id": "mobile_sam",
      "download_size_bytes": 45000000,
      "description": "Zero-shot segmentation and contextual texture inpainting via MobileSAM and LaMa"
    }
  },
  "hardware": {
    "gpu_name": "NVIDIA GeForce RTX 4070",
    "vram_mb": 12288,
    "ram_mb": 32768,
    "cpu_model": "AMD Ryzen 9 7900X",
    "cpu_threads": 24,
    "backend": "cuda",
    "supports_heavyweight_generative": true
  },
  "server_mode": "local_bundled",
  "ram_resident_models": ["siglip2"]
}
```

### Unload Capability Session
Frees RAM/VRAM by explicitly dropping loaded ONNX inference sessions from memory.
```http
POST /api/v1/capabilities/:feature/unload
```

### Unload All Models
```http
POST /api/v1/capabilities/unload-all
```

### Toggle Feature Flag
```http
POST /api/v1/capabilities/:feature/toggle
```
**Request:**
```json
{
  "enabled": false
}
```

## Durable Background Jobs

Unified queue tracking all long-running tasks: neural model downloads, photo sequential analysis, thumbnail backfills, and video exports.

### List Background Jobs
```http
GET /api/v1/jobs?status=processing&limit=50&offset=0
```

**Response:**
```json
{
  "jobs": [
    {
      "id": 42,
      "photo_id": 12,
      "photo_filename": "IMG_0042.jpg",
      "job_type": "sequential_analysis",
      "title": "Analyze Photo (IMG_0042.jpg)",
      "status": "processing",
      "current_stage": "face_detection",
      "stage_progress": "Detected 2 faces",
      "progress_pct": 65.0,
      "total_items": 1,
      "processed_items": 0,
      "attempt_count": 1,
      "last_error": null,
      "created_at": "2026-09-11T12:00:00",
      "updated_at": "2026-09-11T12:00:05"
    }
  ],
  "counts": {
    "pending": 0,
    "processing": 1,
    "completed": 120,
    "failed": 2,
    "cancelled": 1
  },
  "is_worker_paused": false,
  "is_worker_processing": true
}
```

### Cancel Job
```http
POST /api/v1/jobs/:id/cancel
```

### Retry Job
```http
POST /api/v1/jobs/:id/retry
```

### Prune Finished Jobs
```http
DELETE /api/v1/jobs/prune
```

### Pause Worker Queue
```http
POST /api/v1/jobs/pause
```

### Resume Worker Queue
```http
POST /api/v1/jobs/resume
```

## Photo Endpoints

### List Photos
```http
GET /api/v1/photos?limit=25&offset=0
```

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | 25 | Number of photos to return |
| `offset` | 0 | Pagination offset |

**Response:**
```json
[
  {
    "id": 1,
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef123456",
    "filename": "IMG_001.jpg",
    "url": "/api/v1/photos/1/thumbnail",
    "path": "/uploads/IMG_001.jpg",
    "width": 4032,
    "height": 3024,
    "date_taken": "2024-01-15T18:30:00Z",
    "is_favorite": false,
    "is_locked": false,
    "is_trash": false,
    "file_type": "image",
    "city": "Paris",
    "state": "Île-de-France",
    "country": "France"
  }
]
```

### Get Single Photo
```http
GET /api/v1/photos/:id
```

### Get Photo Metadata
```http
GET /api/v1/photos/:id/metadata
```

### Serve Photo File
```http
GET /api/v1/photos/:id/file
```

### Serve Thumbnail
```http
GET /api/v1/photos/:id/thumbnail
```

### Upload Photo
```http
POST /api/v1/photos/upload
Content-Type: multipart/form-data
```

**Body:**
- `file` — Photo file to upload

### Upload Blob
```http
POST /api/v1/photos/upload-blob
Content-Type: application/octet-stream
```

### Expand Directory
```http
POST /api/v1/photos/expand-directory
Content-Type: application/json
```

**Body:**
```json
{
  "path": "/home/user/Photos",
  "recursive": true
}
```

### Toggle Favorite
```http
POST /api/v1/photos/:id/favorite
```

### Toggle Trash
```http
POST /api/v1/photos/:id/trash
```

### Restore Photo
```http
POST /api/v1/photos/:id/restore
```

### Update Location
```http
PUT /api/v1/photos/:id/location
Content-Type: application/json
```

**Body:**
```json
{
  "latitude": 48.8566,
  "longitude": 2.3522,
  "city": "Paris",
  "country": "France"
}
```

### Update Adjustments
```http
PUT /api/v1/photos/:id/adjustments
Content-Type: application/json
```

**Body:**
```json
{
  "brightness": 10,
  "contrast": 5,
  "saturation": 20
}
```

### Tag Photo Face
```http
POST /api/v1/photos/:id/tag-face
Content-Type: application/json
```

**Body:**
```json
{
  "person_id": 1,
  "face_id": 123
}
```

### Bulk Update Adjustments
```http
POST /api/v1/photos/bulk-adjustments
Content-Type: application/json
```

**Body:**
```json
{
  "photo_ids": [1, 2, 3],
  "adjustments": {
    "brightness": 10
  }
}
```

## AI Photo Endpoints

### Extract OCR & Bounding Boxes
```http
POST /api/v1/photos/:id/ocr-bboxes
```

### Process Inpainting
```http
POST /api/v1/photos/inpaint/process
Content-Type: application/json
```

**Body:**
```json
{
  "photo_id": 1,
  "mask": "base64-encoded-mask"
}
```

### Get AI Summary
```http
GET /api/v1/photos/:id/summary
```

### Generate AI Summary
```http
POST /api/v1/photos/:id/summary/generate
```

### XMP Operations
```http
POST /api/v1/photos/:id/xmp
Content-Type: application/json
```

### Toggle Lock
```http
POST /api/v1/photos/:id/lock
```

### Unlock Photo
```http
POST /api/v1/photos/:id/unlock
```

### Get Semantic Masks
```http
GET /api/v1/photos/semantic-masks/:photo_id
```

### Get Background Mask
```http
GET /api/v1/photos/background-mask/:photo_id
```

### Get Portrait Masks
```http
GET /api/v1/photos/portrait-masks/:photo_id
```

### Auto-Enhance
```http
POST /api/v1/photos/auto-enhance/:photo_id
```

### XMP Export
```http
POST /api/v1/photos/xmp/export
Content-Type: application/json
```

### XMP Import
```http
POST /api/v1/photos/xmp/import
Content-Type: application/json
```

### Export Photos
```http
POST /api/v1/photos/export
Content-Type: application/json
```

**Body:**
```json
{
  "album_id": 1,
  "output_dir": "/home/user/Export"
}
```

## Album Endpoints

### List Albums
```http
GET /api/v1/albums
```

### Create Album
```http
POST /api/v1/albums
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Vacation 2024",
  "type": "custom"
}
```

### Delete Album
```http
DELETE /api/v1/albums/:id
```

### Get Album Photos
```http
GET /api/v1/albums/:id/photos
```

### Rename Album
```http
POST /api/v1/albums/:id/rename
Content-Type: application/json
```

**Body:**
```json
{
  "name": "New Album Name"
}
```

### Add Photos to Album
```http
POST /api/v1/albums/:id/add-photos
Content-Type: application/json
```

**Body:**
```json
{
  "photo_ids": [1, 2, 3]
}
```

### Remove Photos from Album
```http
POST /api/v1/albums/:id/remove-photos
Content-Type: application/json
```

### Set Album Cover
```http
POST /api/v1/albums/:id/set-cover
Content-Type: application/json
```

**Body:**
```json
{
  "photo_id": 1
}
```

### List Smart Albums
```http
GET /api/v1/albums/smart
```

### Get Smart Album Photos
```http
GET /api/v1/albums/smart/:smart_type/photos
```

## People Endpoints

### List People
```http
GET /api/v1/people
```

### Get Person Photos
```http
GET /api/v1/people/:id/photos
```

### Rename Person
```http
PUT /api/v1/people/:id/name
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Alice"
}
```

### Get Pending Faces
```http
GET /api/v1/people/:id/pending-faces
```

### Submit Face Feedback
```http
POST /api/v1/people/pending-faces/:pending_id/feedback
Content-Type: application/json
```

### Scan Photo Faces
```http
POST /api/v1/people/scan/:photo_id
```

## Explore Endpoints

### Explore Photos
```http
GET /api/v1/explore
```

### Explore Insights
```http
GET /api/v1/explore/insights
```

### Explore Themes
```http
GET /api/v1/explore/themes
```

### On This Day
```http
GET /api/v1/explore/on-this-day
```

### Rediscover Prompts
```http
GET /api/v1/explore/rediscover-prompts
```

### Timeline
```http
GET /api/v1/explore/timeline
```

### Seasons
```http
GET /api/v1/explore/seasons
```

### Activity
```http
GET /api/v1/explore/activity
```

### Highlights
```http
GET /api/v1/explore/highlights
```

### Generate Highlight Project
```http
POST /api/v1/explore/highlights/generate
Content-Type: application/json
```

## NLE (Video Editor) Endpoints

### List Projects
```http
GET /api/v1/nle/projects
```

### Create Project
```http
POST /api/v1/nle/projects
Content-Type: application/json
```

### Get Project
```http
GET /api/v1/nle/projects/:id
```

### Update Project
```http
PUT /api/v1/nle/projects/:id
Content-Type: application/json
```

### Delete Project
```http
DELETE /api/v1/nle/projects/:id
```

### Analyze Video Clip
```http
POST /api/v1/nle/clips/analyze
Content-Type: application/json
```

**Body:**
```json
{
  "photo_id": 1,
  "source_path": "/path/to/video.mp4"
}
```

### Generate Proxy
```http
POST /api/v1/nle/clips/proxy
Content-Type: application/json
```

### Thumbnail Strip
```http
POST /api/v1/nle/clips/thumbnail-strip
Content-Type: application/json
```

### Get Waveform
```http
POST /api/v1/nle/clips/waveform
Content-Type: application/json
```

### Render Preview
```http
POST /api/v1/nle/preview/render
Content-Type: application/json
```

### Preview Frame
```http
POST /api/v1/nle/preview/frame
Content-Type: application/json
```

### Export Project
```http
POST /api/v1/nle/export
Content-Type: application/json
```

### Export XML
```http
POST /api/v1/nle/export/xml
Content-Type: application/json
```

### Get Export Status
```http
GET /api/v1/nle/export/:job_id
```

### Download Export
```http
GET /api/v1/nle/export/:job_id/download
```

## Privacy Endpoints

### Get Privacy Status
```http
GET /api/v1/privacy/status
```

### Get Privacy Feature Detail
```http
GET /api/v1/privacy/feature/:feature_id
```

## Settings Endpoints

### Get Settings
```http
GET /api/v1/settings
```

### Get General Settings
```http
GET /api/v1/settings/general
```

### Save General Settings
```http
POST /api/v1/settings/general
Content-Type: application/json
```

### Get Map Style
```http
GET /api/v1/settings/map-style
```

### Save Map Style
```http
POST /api/v1/settings/map-style
Content-Type: application/json
```

### SSE Events
```http
GET /api/v1/settings/events
```

### Get Folders Settings
```http
GET /api/v1/settings/folders
```

### Save Folders Settings
```http
POST /api/v1/settings/folders
Content-Type: application/json
```

### Reset Library
```http
POST /api/v1/settings/reset-library
```

### Clear Cache
```http
POST /api/v1/settings/clear-cache
```

### Vacuum Database
```http
POST /api/v1/settings/vacuum
```

### Purge Folder
Removes all library records for photos under a folder. Scope is an exact path-prefix on the absolute photo path (`/a/b` purges `/a/b/**` but never sibling `/a/bc`); `~` is expanded. For each matched photo it removes relational data (`photo_albums`, `photo_people`, `faces`, `background_jobs`), clears dangling `cover_photo_id` references, deletes derived files (thumbnails, segmentation masks), and removes vault artifacts (`<path>.prism_enc`) for locked photos. Original media files are never touched.
```http
POST /api/v1/settings/purge-folder
Content-Type: application/json

{ "folder_path": "~/Pictures/OldTrip" }
```

**Response**
```json
{
  "status": "success",          // or "partial" when some photos failed
  "folder": "/home/user/Pictures/OldTrip",
  "deleted_count": 42,
  "failed_count": 0             // present only on "partial"
}
```

### Watch Folders (Automatic Indexing)
Watched folders are indexed automatically by the background watcher service:
- **Startup scan** — media under `watched_folders` is imported in place shortly after boot.
- **Periodic rescan** — every 60s, new files are picked up.
- **Live FS events** — newly created files are imported near-real-time (debounced ~2s) via OS file notifications.

Behavior:
- Imports are in place (no copying), deduped by absolute path.
- `excluded_folders` paths (and subfolders) are never imported.
- The **Automatic System File Watcher** toggle (`sync_enabled`) pauses both scanning and live events.
- Hidden entries, `*.prism_enc` / `*.prism_backup*` artifacts are skipped.

Settings endpoints (already existing):
```http
GET  /api/v1/settings/folders
POST /api/v1/settings/folders      # { watched_folders: [...], excluded_folders: [...] }
GET  /api/v1/settings/sync
POST /api/v1/settings/sync         # { is_enabled: true|false }
```

#### Watcher Status & Manual Rescan
```http
GET  /api/v1/settings/watcher-status
POST /api/v1/settings/watcher/rescan
```

`GET /watcher-status` returns a live snapshot for the settings UI:
```json
{
  "is_scanning": false,
  "auto_enabled": true,
  "total_imported": 128,
  "last_scan_imported": 4,
  "last_scan_skipped": 0,
  "last_scan_failed": 0,
  "last_scan_manual": true,
  "last_scan_started_ms": 1734000000000,
  "last_scan_finished_ms": 1734000001500
}
```

`POST /watcher/rescan` queues an immediate manual rescan of all watched
folders (bypasses the `sync_enabled` toggle since the user asked explicitly;
coalesces with any in-progress scan) and returns immediately:
```json
{ "status": "success", "message": "Rescan queued. Watched folders will be scanned now." }
```

### Locked Folder Endpoints
```http
GET /api/v1/settings/locked-folder/status
POST /api/v1/settings/locked-folder/setup
POST /api/v1/settings/locked-folder/verify
POST /api/v1/settings/locked-folder/lock-session
```

### Sync Settings
```http
GET /api/v1/settings/sync
POST /api/v1/settings/sync
Content-Type: application/json
```

### Telemetry Settings
```http
GET /api/v1/settings/telemetry
POST /api/v1/settings/telemetry
Content-Type: application/json
```

## Utilities Endpoints

### Get Duplicates
```http
GET /api/v1/utilities/duplicates
```

### Get Blurry Photos
```http
GET /api/v1/utilities/blurry
```

### Get Document Photos
```http
GET /api/v1/utilities/documents
```

### Get Diagnostics
```http
GET /api/v1/utilities/diagnostics
```

### Get Logs
```http
GET /api/v1/utilities/logs
```

### List Directory Contents
```http
POST /api/v1/utilities/list-dir
Content-Type: application/json
```

### External Locations
```http
GET /api/v1/utilities/external-locations
POST /api/v1/utilities/external-locations
PATCH /api/v1/utilities/external-locations/:loc_id
DELETE /api/v1/utilities/external-locations/:loc_id
```

### Visual Duplicates
```http
GET /api/v1/utilities/visual-duplicates
```

### Backup Export
```http
POST /api/v1/utilities/backup/export
Content-Type: application/json
```

### Backup Restore
```http
POST /api/v1/utilities/backup/restore
Content-Type: application/json
```

### Batch Rename
```http
POST /api/v1/utilities/batch-rename
Content-Type: application/json
```

### Fused Search
```http
GET /api/v1/utilities/search/fused?q=sunset&limit=25
```

### Purge Trash
```http
POST /api/v1/utilities/purge-trash
Content-Type: application/json
```

### Background Jobs
```http
GET /api/v1/utilities/background-jobs/status
POST /api/v1/utilities/background-jobs/start
POST /api/v1/utilities/background-jobs/stop
POST /api/v1/utilities/background-jobs/pause
POST /api/v1/utilities/background-jobs/resume
```

### System State
```http
GET /api/v1/utilities/system-state
```

## Telemetry Endpoints

### Get Telemetry Summary
```http
GET /api/v1/telemetry/summary
```

### Get Telemetry Events
```http
GET /api/v1/telemetry/events
```

### Clear Telemetry Events
```http
DELETE /api/v1/telemetry/events
```

### Telemetry SSE Stream
```http
GET /api/v1/telemetry/stream
```

### Log Frontend Event
```http
POST /api/v1/telemetry/log
Content-Type: application/json
```

### Log Frontend Event Batch
```http
POST /api/v1/telemetry/log-batch
Content-Type: application/json
```

## LAN Sync Endpoints

### Discover Peers
```http
GET /api/v1/lan/discover
```

### Pair With Peer
```http
POST /api/v1/lan/peers/:peer_id/pair
```

### Handle Pair Request
```http
POST /api/v1/lan/pair/request
```

### Initiate Sync
```http
POST /api/v1/lan/peers/:peer_id/sync
```

### Sync Status
```http
GET /api/v1/lan/sync/status
```

### Import From Peer
```http
POST /api/v1/lan/peers/:peer_id/import
```

### Get Manifest
```http
GET /api/v1/lan/manifest
```

## Stories Endpoints

### Generate Story
```http
POST /api/v1/stories/generate
Content-Type: application/json
```

### Get Event Story
```http
GET /api/v1/stories/event/:event_id
```

## Vault (Encrypted Locked Folder) Endpoints

### Get Vault Status
```http
GET /api/v1/vault/status
```

**Response:**
```json
{
  "is_initialized": true,
  "is_unlocked": true,
  "escrow_enabled": false,
  "locked_photos_count": 3
}
```

### Setup Vault
```http
POST /api/v1/vault/setup
Content-Type: application/json
```

**Body:**
```json
{
  "password": "min-6-chars",
  "enable_os_escrow": false
}
```

**Response:** returns the armored recovery token, the downloadable Emergency
Recovery Kit document (`prism-vault-recovery.txt`), and the wrapped key records.

### Unlock Vault
```http
POST /api/v1/vault/unlock
```

### Recover Vault (Emergency Kit)
```http
POST /api/v1/vault/recover
```

Accepts the armored recovery token (or pasted kit contents), unwraps the master
key, and sets a new password.

### Unlock via OS Keyring Escrow
```http
POST /api/v1/vault/unlock-escrow
```

### Lock Vault Session
```http
POST /api/v1/vault/lock
```

> Locking individual photos via `POST /api/v1/photos/:id/lock` encrypts the
> original to `<path>.prism_enc` (AES-256-GCM) and shreds plaintext once the
> vault is initialized; `POST /api/v1/photos/:id/unlock` reverses it. Locked
> media is decrypted in memory when served — never written back to disk.

## Culling Endpoints

### Get Burst Groups
```http
GET /api/v1/cull/bursts?window_seconds=2.0&min_count=2
```

Clusters adjacent photos within `window_seconds` (configurable: 1.0, 2.0, 3.0,
5.0; default 2.0) sharing a camera model or perceptual-hash Hamming distance
≤ 12. Returns burst stacks with sharpest-frame (`blur_score`) cover candidates.

### Update Cull Status
```http
POST /api/v1/cull/status
Content-Type: application/json
```

**Body:**
```json
{
  "photo_ids": [1, 2, 3],
  "cull_status": "picked",
  "rating": 4
}
```

`cull_status` ∈ `picked` | `rejected` | `unflagged`; `rating` 0–5.

### Purge Rejected
```http
POST /api/v1/cull/purge-rejected
```

Atomically moves all `rejected` photos to trash and returns an undo token with
the purged photo IDs.

### Undo Purge
```http
POST /api/v1/cull/undo-purge
```

Restores recently purged photos by ID list, or all still-trashed rejected
photos when no IDs are supplied.

## Library Health Endpoints

### Get Health Status
```http
GET /api/v1/library/health/status
```

Returns storage breakdown, SQLite integrity (`PRAGMA integrity_check`), missing
originals, and last backup info from the `library_backups` table.

### Scan Missing Media
```http
POST /api/v1/library/health/scan-missing
```

Verifies every active photo path on disk, setting `missing_since`/
`last_verified` columns accordingly.

### Relink Folder
```http
POST /api/v1/library/health/relink
```

Batch-maps an old base path prefix to a new mount point.

### Verify Checksums
```http
POST /api/v1/library/health/verify-checksums
```

Recomputes file hashes to detect silent bit-rot.

## Video Export Endpoints

### Start Export
```http
POST /api/v1/video/export
Content-Type: application/json
```

### Get Export Status
```http
GET /api/v1/video/export/:job_id
```

### Download Export
```http
GET /api/v1/video/export/:job_id/download
```

### Generate Subtitles
```http
POST /api/v1/video/subtitles/generate
Content-Type: application/json
```

## Agent (AI Chat) Endpoints

### List Sessions
```http
GET /api/v1/agent/sessions
```

### Create Session
```http
POST /api/v1/agent/sessions
```

### Get Session
```http
GET /api/v1/agent/sessions/:id
```

### Rename Session
```http
PATCH /api/v1/agent/sessions/:id
Content-Type: application/json
```

### Delete Session
```http
DELETE /api/v1/agent/sessions/:id
```

### Upload Image
```http
POST /api/v1/agent/upload_image
Content-Type: multipart/form-data
```

### Preload Model
```http
POST /api/v1/agent/preload
```

### Chat
```http
POST /api/v1/agent/chat
Content-Type: application/json
```

**Body:**
```json
{
  "session_id": "uuid",
  "message": "Find photos from Paris",
  "attached_image": null
}
```

## Shares Endpoints

### Create Share
```http
POST /api/v1/shares
Content-Type: application/json
```

**Body:**
```json
{
  "resource_type": "photo",
  "resource_id": "1",
  "expires_in_secs": 86400,
  "max_downloads": null,
  "hide_exif": true,
  "hide_gps": true,
  "download_original": true,
  "password": "optional-passcode"
}
```

**Response:**
```json
{
  "share_token": "a1b2c3d4e5f67890abcdef1234567890",
  "share_url": "http://192.168.1.10:8269/share/a1b2c3d4e5f67890abcdef1234567890",
  "share": {
    "token": "a1b2c3d4e5f67890abcdef1234567890",
    "resource_type": "photo",
    "resource_id": "1",
    "expires_at": "2026-09-12T12:00:00Z",
    "password_hash": "...",
    "hide_exif": 1,
    "hide_gps": 1
  }
}
```

### Get Shared Resource
```http
GET /api/v1/shares/:token?password=optional-passcode
```

**Response:**
```json
{
  "share": { ... },
  "resource_type": "photo",
  "photo": {
    "id": 1,
    "filename": "IMG_001.jpg",
    "caption": "Sunset",
    "camera_make": null,
    "latitude": null
  },
  "album": null,
  "album_photos": null
}
```

### Revoke Share
```http
DELETE /api/v1/shares/:token
```

**Response:**
```json
{
  "success": true
}
```

### Download Shared File
```http
GET /api/v1/shares/:token/download?password=optional-passcode&photo_id=optional-photo-id
```

Returns binary photo file with `Content-Disposition: attachment; filename="..."`.

## LAN & EasyShare Endpoints

Direct device-to-device media push and local network peer discovery powered by continuous UDP beacon broadcasting on port `8272`.

### Get Network Info
Returns the server's detected LAN IP address and HTTP port for constructing mobile/cross-device URLs.

```http
GET /api/v1/lan/network-info
```

**Response:**
```json
{
  "local_ip": "192.168.1.10",
  "port": 8269
}
```

### Discover Nearby Peers
Returns active Prism instances discovered on the local subnet within the last 10 seconds.

```http
GET /api/v1/lan/nearby
```

**Response:**
```json
[
  {
    "peer_id": "c1f7b3a2-9a8b-4c5d-ae01-7b9c1d3e5f7a",
    "hostname": "MacBook-Pro",
    "ip": "192.168.1.42",
    "port": 8269,
    "device_type": "laptop",
    "version": "0.1.0",
    "last_seen_epoch_secs": 1726053600
  }
]
```

### Push Photos to Peer (EasyShare)
Pushes media files directly from local storage to a discovered peer's upload endpoint over the local network.

```http
POST /api/v1/lan/push-to-peer
Content-Type: application/json
```

**Body:**
```json
{
  "peer_ip": "192.168.1.42",
  "peer_port": 8269,
  "photo_ids": [101, 102, 103]
}
```

**Response:**
```json
{
  "success": true,
  "transferred_count": 3,
  "total_requested": 3,
  "failed_count": 0,
  "failed_ids": []
}
```


## Plugin Endpoints

Manage modular extensions and plugins stored in the `plugins/` directory. For instructions on creating custom plugins, see [Plugin Development Guide](PLUGINS.md).

### List Installed Plugins
```http
GET /api/v1/plugins
```

**Response:**
```json
{
  "plugins": [
    {
      "id": "background-removal",
      "manifest": {
        "id": "background-removal",
        "name": "AI Background Removal Studio",
        "version": "1.2.0",
        "author": "Prism Core & Open Source AI",
        "description": "Deep learning matting pack supporting ISNet, BiRefNet, and RMBG-1.4.",
        "category": "AI & Machine Learning",
        "capabilities": ["matting", "segmentation", "image-editor"],
        "entrypoint": "index.js"
      },
      "config": {
        "enabled": true,
        "installed_at": "2026-08-23T10:00:00Z",
        "updated_at": "2026-08-23T10:00:00Z",
        "settings": {}
      },
      "path": "plugins/background-removal",
      "is_active": true,
      "has_models": true
    }
  ],
  "plugins_dir": "plugins",
  "total": 1
}
```

### Browse Plugin Catalog
```http
GET /api/v1/plugins/catalog
```

**Response:**
```json
{
  "catalog": [
    {
      "id": "background-removal",
      "name": "AI Background Removal Studio",
      "version": "1.2.0",
      "author": "Prism Core & Open Source AI",
      "description": "Deep learning matting pack supporting ISNet Universal, BiRefNet High-Resolution, and RMBG-1.4.",
      "category": "AI & Machine Learning",
      "icon": "Scissors",
      "is_installed": true,
      "is_active": true,
      "size_display": "~170 MB",
      "tags": ["matting", "segmentation", "onnx", "cutout"],
      "manifest": { ... }
    }
  ],
  "total": 4
}
```

### Install Plugin
Installs a plugin into `plugins/<id>/` from a catalog ID, manifest JSON file (`background-removal.json`), local directory, or GitHub URL.

```http
POST /api/v1/plugins/install
Content-Type: application/json

{
  "source": "background-removal.json"
}
```

*Supported `source` formats:*
- **Catalog ID or JSON**: `"background-removal"`, `"background-removal.json"`
- **Local JSON manifest file**: `"/path/to/my-plugin/plugin.json"`
- **Local Directory**: `"/path/to/my-plugin/"`
- **Direct Manifest URL**: `"https://raw.githubusercontent.com/owner/repo/main/plugin.json"`

**Response:**
```json
{
  "status": "success",
  "message": "Plugin 'background-removal' successfully installed into plugins/background-removal",
  "plugin": {
    "id": "background-removal",
    "manifest": { ... },
    "config": { ... },
    "path": "plugins/background-removal",
    "is_active": true,
    "has_models": true
  }
}
```

*Legacy route:* `POST /api/v1/plugins/install/:id` is also supported.


### Uninstall Plugin
Deletes `plugins/<id>/` folder and contents from disk.

```http
POST /api/v1/plugins/uninstall/:id
```

### Toggle Plugin Active State
```http
POST /api/v1/plugins/toggle/:id
Content-Type: application/json

{
  "enabled": false
}
```

### Update Plugin Settings
```http
POST /api/v1/plugins/config/:id
Content-Type: application/json

{
  "settings": {
    "default_model": "birefnet"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request parameters"
}
```

### 401 Unauthorized
```json
{
  "error": "Invalid or missing API key"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/v1/video/*` | 20 requests | 1 minute |
| `/api/v1/photos/inpaint/process` | 20 requests | 1 minute |
| Other endpoints | No limit | — |

## Content Types

| Content Type | Usage |
|--------------|-------|
| `application/json` | JSON request/response |
| `multipart/form-data` | File uploads |
| `application/octet-stream` | Binary data |
| `text/event-stream` | SSE streams |
| `image/*` | Image responses |
| `video/*` | Video responses |
