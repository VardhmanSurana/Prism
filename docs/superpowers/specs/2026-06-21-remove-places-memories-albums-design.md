# Spec: Remove Places and Memories from Albums

This specification outlines the removal of the auto-generated "Places" and "Memories" album types from Prism, while keeping a simplified, empty "Albums" view ready for future manual/custom albums.

## Proposed Changes

### Backend

#### 1. Remove Places Album Synchronization Service
- Delete the file `backend/app/services/place_service.py` completely.
- Remove all imports and calls to `sync_all_places` across sync handlers:
  - `backend/app/api/photos/trash.py`
  - `backend/app/services/sync/ingestion.py`
  - `backend/app/services/sync/mounts.py`
  - `backend/app/services/sync/scanning.py`

#### 2. Remove Dynamic Album Routers
- Delete `backend/app/api/albums/places.py`.
- Delete `backend/app/api/albums/memories.py`.
- In `backend/app/api/albums/__init__.py`:
  - Simplify the endpoints to return and query the `Album` table directly.
  - Return `[]` for `/api/v1/albums/` since there are no custom albums created yet.

#### 3. Update Library Statistics
- In `backend/app/api/photos/listing.py`:
  - Change the `albums` statistics counter in `get_photo_stats` to directly count the rows in the `Album` table via `select(func.count(Album.id))`.

#### 4. Retain AI Search Agent Tools
- Keep `search_albums` in `backend/app/agent/search_tools.py`, `backend/app/agent/orchestrator.py`, and `backend/app/agent/service.py` to allow searching custom/future albums.

---

### Frontend

#### 1. Delete AlbumTabs Component
- Delete `frontend/components/albums/AlbumTabs.tsx`.

#### 2. Simplify useAlbums Hook
- In `frontend/components/albums/hooks/useAlbums.ts`:
  - Remove references to `places` and `memories` tab state.
  - Simplify the data fetching to query `/api/v1/albums/` directly.

#### 3. Simplify Album Views
- In `frontend/components/albums/AlbumsView.tsx`:
  - Remove references to `AlbumTabs`.
  - Render `AlbumsList` directly.
- In `frontend/components/albums/AlbumsList.tsx`:
  - Remove the `activeTab` prop and its usage.
  - Display a generic "No albums yet" empty state message.
- In `frontend/components/albums/index.ts`:
  - Remove export of `AlbumTabs`.

---

## Verification Plan

### Automated Verification
- Run backend tests: `cd backend && uv run pytest tests -q`
- Run frontend typecheck: `cd frontend && bunx tsc --noEmit`
- Run frontend tests: `cd frontend && bun test`

### Manual Verification
- Verify that the "Albums" option in the Sidebar works and shows an empty state: "No albums yet. Your custom albums will appear here once created."
- Verify that the statistics card for Albums displays `0`.
- Verify that ingestion and trash operations run successfully without attempting to sync place albums.
