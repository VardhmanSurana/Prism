# Remove Places and Memories from Albums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the auto-generated "Places" and "Memories" album types from Prism, while keeping a simplified, empty "Albums" view ready for future manual/custom albums.

**Architecture:** Purge place album sync services, delete place/memory api endpoints, simplify the backend `/albums/` endpoint to return empty `[]` representing zero custom albums, and simplify the frontend AlbumsView/AlbumsList components and useAlbums hook to fetch `/albums/` directly without tab divisions.

**Tech Stack:** React, TypeScript, Python, FastAPI, SQLAlchemy, SQLite.

## Global Constraints
- Do not commit changes to gitignored files like `backend/.env`, `backend/settings.json`, or SQLite databases.
- Ensure type-correctness on both frontend and backend.
- Verify changes with pytest (`cd backend && uv run pytest tests -q`) and TypeScript typecheck (`cd frontend && bunx tsc --noEmit`).

---

### Task 1: Clean Up Sync Handlers and Remove Place Sync Service

**Files:**
- Modify: [trash.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/photos/trash.py)
- Modify: [ingestion.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/ingestion.py)
- Modify: [mounts.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/mounts.py)
- Modify: [scanning.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/scanning.py)
- Delete: `backend/app/services/place_service.py`

**Interfaces:**
- Consumes: None
- Produces: Synced ingestion/trash processes that do not query or trigger place sync.

- [ ] **Step 1: Modify trash.py**
  Remove the `if photo.city:` blocks that call `sync_all_places` in both `move_to_trash` and `restore_from_trash` endpoints.
  
  Code change in [trash.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/photos/trash.py):
  ```python
  # Remove lines 26-29:
  # if photo.city:
  #     import asyncio
  #     from app.services.place_service import sync_all_places
  #     asyncio.create_task(sync_all_places())
  
  # Remove lines 45-48:
  # if photo.city:
  #     import asyncio
  #     from app.services.place_service import sync_all_places
  #     asyncio.create_task(sync_all_places())
  ```

- [ ] **Step 2: Modify ingestion.py**
  Remove the `trigger_place_sync_debounced` and `_delayed_place_sync` methods from `IngestionMixin`. Remove the trigger calls inside `ingest_photo` and `delete_photo_by_path`.
  
  Code changes in [ingestion.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/ingestion.py):
  - Delete `trigger_place_sync_debounced` and `_delayed_place_sync` (lines 23-37).
  - Delete lines 125-127:
    ```python
    # 6. Trigger debounced places sync task
    if new_photo.city or new_photo.location:
        self.trigger_place_sync_debounced()
    ```
  - Delete lines 150-151:
    ```python
    from app.services.place_service import sync_all_places
    asyncio.create_task(sync_all_places())
    ```

- [ ] **Step 3: Modify mounts.py**
  Remove the `sync_all_places` call inside `period_mount_check` (lines 24-25).
  
  Code change in [mounts.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/mounts.py):
  - Replace lines 23-25:
    ```python
    if old_mounts != self.active_mounts:
        from app.services.place_service import sync_all_places
        asyncio.create_task(sync_all_places())
    ```
    with:
    ```python
    if old_mounts != self.active_mounts:
        pass
    ```

- [ ] **Step 4: Modify scanning.py**
  Remove calls to `sync_all_places` inside `full_scan` and `cleanup_missing_files`.
  
  Code changes in [scanning.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/services/sync/scanning.py):
  - Delete lines 56-58:
    ```python
    # Trigger background processing
    from app.services.place_service import sync_all_places
    asyncio.create_task(sync_all_places())
    ```
  - Delete lines 81-82:
    ```python
    from app.services.place_service import sync_all_places
    asyncio.create_task(sync_all_places())
    ```

- [ ] **Step 5: Delete place_service.py**
  Remove `backend/app/services/place_service.py` from the filesystem.

- [ ] **Step 6: Run tests to verify backend sync still passes**
  Run: `cd backend && uv run pytest -q`
  Expected: PASS

- [ ] **Step 7: Commit changes**
  ```bash
  git rm backend/app/services/place_service.py
  git commit -am "backend: clean up sync handlers and remove place sync service"
  ```

---

### Task 2: Simplify Backend Album Endpoints & Statistics

**Files:**
- Delete: `backend/app/api/albums/places.py`
- Delete: `backend/app/api/albums/memories.py`
- Modify: [__init__.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/albums/__init__.py)
- Modify: [listing.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/photos/listing.py)
- Modify: [test_agent.py](file:///home/chotaxdon/Work/Projects/Prism/backend/tests/test_agent.py)

**Interfaces:**
- Consumes: `Album` database model.
- Produces: Simple `/api/v1/albums/` routing returning list of Albums (empty list `[]` for now), and direct count from `Album` table in stats.

- [ ] **Step 1: Delete sub-routers**
  Delete `backend/app/api/albums/places.py` and `backend/app/api/albums/memories.py`.

- [ ] **Step 2: Simplify albums routing init**
  In [__init__.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/albums/__init__.py), remove sub-router inclusions and return a simple list of custom albums (empty for now).
  
  Code in [__init__.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/albums/__init__.py):
  ```python
  from fastapi import APIRouter, Depends
  from sqlalchemy.ext.asyncio import AsyncSession
  from sqlalchemy.future import select
  from app.db import get_db
  from app.models import Album
  
  router = APIRouter()
  
  @router.get("/")
  async def list_albums(db: AsyncSession = Depends(get_db)):
      # Return custom albums from database (empty list since none exist yet)
      stmt = select(Album)
      result = await db.execute(stmt)
      albums = result.scalars().all()
      return albums
  
  @router.get("/{album_id}/photos")
  async def get_album_photos(album_id: int, db: AsyncSession = Depends(get_db)):
      return []
  ```

- [ ] **Step 3: Modify stats in listing.py**
  Count entries in the `Album` table directly via `select(func.count(Album.id))`.
  
  Code changes in [listing.py](file:///home/chotaxdon/Work/Projects/Prism/backend/app/api/photos/listing.py):
  Replace lines 109-139:
  ```python
      # 3. Albums: place-based + memories (calendar months)
      places_stmt = select(func.count(Album.id)).where(Album.type == "places")
      res_places = await db.execute(places_stmt)
      places_count = res_places.scalar() or 0
      
      # Memories albums: count distinct year/month combinations from Photos
      if locked_service.is_authenticated:
          memories_stmt = select(
              func.count(func.distinct(func.strftime("%Y-%m", Photo.date_taken)))
          ).where(
              Photo.is_trash == False,
              or_(
                  Photo.is_external == False,
                  Photo.device_id.in_(active_mounts)
              )
          )
      else:
          memories_stmt = select(
              func.count(func.distinct(func.strftime("%Y-%m", Photo.date_taken)))
          ).where(
              Photo.is_trash == False,
              Photo.is_locked == False,
              or_(
                  Photo.is_external == False,
                  Photo.device_id.in_(active_mounts)
              )
          )
      res_memories = await db.execute(memories_stmt)
      memories_count = res_memories.scalar() or 0
      
      albums_count = places_count + memories_count
  ```
  with:
  ```python
      # 3. Albums: count entries in Album table directly
      albums_stmt = select(func.count(Album.id))
      res_albums = await db.execute(albums_stmt)
      albums_count = res_albums.scalar() or 0
  ```

- [ ] **Step 4: Clean up test_agent.py**
  In [test_agent.py](file:///home/chotaxdon/Work/Projects/Prism/backend/tests/test_agent.py), remove the mock setup for `search_albums` since it is not deleted but kept. Wait, the test has:
  - `search_tools.search_albums = AsyncMock(return_value=set())` (line 256). Since `search_albums` is kept, we don't have to remove it or we can keep it as is. Let's make sure it passes.

- [ ] **Step 5: Run tests**
  Run: `cd backend && uv run pytest -q`
  Expected: PASS

- [ ] **Step 6: Commit changes**
  ```bash
  git commit -am "backend: clean up album routes and statistics to count albums directly"
  ```

---

### Task 3: Simplify Frontend Albums View & Hooks

**Files:**
- Delete: `frontend/components/albums/AlbumTabs.tsx`
- Modify: [useAlbums.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/hooks/useAlbums.ts)
- Modify: [AlbumsView.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/AlbumsView.tsx)
- Modify: [AlbumsList.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/AlbumsList.tsx)
- Modify: [index.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/index.ts)

**Interfaces:**
- Consumes: `/api/v1/albums/` base API endpoint.
- Produces: Tabless Albums UI displaying clean empty state for custom/future albums.

- [ ] **Step 1: Delete AlbumTabs.tsx**
  Remove `frontend/components/albums/AlbumTabs.tsx` from the filesystem.

- [ ] **Step 2: Simplify index.ts exports**
  In [index.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/index.ts):
  Remove `export { AlbumTabs } from './AlbumTabs';` and `type AlbumType`.
  
  Code in [index.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/index.ts):
  ```typescript
  export { AlbumsView } from './AlbumsView';
  export { AlbumCard } from './AlbumCard';
  export { AlbumsList } from './AlbumsList';
  export { AlbumDetail } from './AlbumDetail';
  export { useAlbums } from './hooks/useAlbums';
  ```

- [ ] **Step 3: Modify useAlbums.ts hook**
  Simplify `useAlbums` to fetch from `/api/v1/albums/` without tabs or `places`/`memories` filters.
  
  Code in [useAlbums.ts](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/hooks/useAlbums.ts):
  ```typescript
  import { useState, useEffect, useCallback } from 'react';
  import { API_BASE } from '../../../constants';
  import { Album, Photo } from '../../../types';
  
  interface UseAlbumsReturn {
    albums: Album[];
    selectedAlbum: Album | null;
    setSelectedAlbum: (album: Album | null) => void;
    albumPhotos: Photo[];
    isLoading: boolean;
    fetchAlbums: () => Promise<void>;
    fetchAlbumPhotos: (album: Album) => Promise<void>;
    renameAlbum: (album: Album, newName: string) => Promise<void>;
  }
  
  export const useAlbums = (): UseAlbumsReturn => {
    const [albums, setAlbums] = useState<Album[]>([]);
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
  
    const fetchAlbums = useCallback(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/albums/`);
        const data = await response.json();
        setAlbums(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch albums', e);
      }
    }, []);
  
    useEffect(() => {
      fetchAlbums();
    }, [fetchAlbums]);
  
    const fetchAlbumPhotos = useCallback(async (album: Album) => {
      setIsLoading(true);
      setAlbumPhotos([]);
      try {
        const url = `${API_BASE}/api/v1/albums/${album.id}/photos`;
        const response = await fetch(url);
        const data = await response.json();
        setAlbumPhotos(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch album photos', e);
        setAlbumPhotos([]);
      } finally {
        setIsLoading(false);
      }
    }, []);
  
    const renameAlbum = useCallback(async (album: Album, newName: string) => {
      const id = album.id;
      if (!id) return;
  
      try {
        const endpoint = `${API_BASE}/api/v1/albums/${id}/rename`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        if (response.ok) {
          fetchAlbums();
        }
      } catch (e) {
        console.error('Failed to rename album', e);
      }
    }, [fetchAlbums]);
  
    return {
      albums,
      selectedAlbum,
      setSelectedAlbum,
      albumPhotos,
      isLoading,
      fetchAlbums,
      fetchAlbumPhotos,
      renameAlbum
    };
  };
  ```

- [ ] **Step 4: Modify AlbumsView.tsx**
  Remove reference to `AlbumTabs` and render `AlbumsList` directly.
  
  Code in [AlbumsView.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/AlbumsView.tsx):
  ```typescript
  import React from 'react';
  import { Photo } from '../../types';
  import { useAlbums } from './hooks/useAlbums';
  import { AlbumsList } from './AlbumsList';
  import { AlbumDetail } from './AlbumDetail';
  
  interface AlbumsViewProps {
    onPhotoClick: (photo: Photo) => void;
  }
  
  export const AlbumsView: React.FC<AlbumsViewProps> = ({ onPhotoClick }) => {
    const {
      albums,
      selectedAlbum,
      setSelectedAlbum,
      albumPhotos,
      isLoading,
      fetchAlbums,
      fetchAlbumPhotos,
      renameAlbum
    } = useAlbums();
  
    const handleAlbumClick = async (album: typeof albums[0]) => {
      setSelectedAlbum(album);
      await fetchAlbumPhotos(album);
    };
  
    const handleRenameAlbum = async (album: typeof albums[0]) => {
      const newName = window.prompt(`Enter name for this album:`, album.name);
      if (newName && newName !== album.name) {
        await renameAlbum(album, newName);
      }
    };
  
    if (selectedAlbum) {
      return (
        <AlbumDetail
          album={selectedAlbum}
          photos={albumPhotos}
          isLoading={isLoading}
          onPhotoClick={onPhotoClick}
          onBack={() => setSelectedAlbum(null)}
        />
      );
    }
  
    return (
      <div className="p-4 sm:p-8 h-full flex flex-col">
        <AlbumsList
          albums={albums}
          onAlbumClick={handleAlbumClick}
          onRenameAlbum={handleRenameAlbum}
        />
      </div>
    );
  };
  ```

- [ ] **Step 5: Modify AlbumsList.tsx**
  Remove `activeTab` props and simplify empty state to display custom albums text.
  
  Code in [AlbumsList.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/AlbumsList.tsx):
  ```typescript
  import React from 'react';
  import { FolderOpen } from 'lucide-react';
  import { Album } from '../../types';
  import { AlbumCard } from './AlbumCard';
  
  interface AlbumsListProps {
    albums: Album[];
    onAlbumClick: (album: Album) => void;
    onRenameAlbum: (album: Album) => void;
  }
  
  export const AlbumsList: React.FC<AlbumsListProps> = ({ 
    albums, 
    onAlbumClick, 
    onRenameAlbum 
  }) => {
    if (albums.length === 0) {
      return (
        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 space-y-4">
          <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-gray-600 border border-white/5">
            <FolderOpen size={32} />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-1">No albums yet</h3>
            <p className="text-xs font-mono uppercase tracking-widest opacity-40 max-w-xs mx-auto">
              Your custom albums will appear here once created.
            </p>
          </div>
        </div>
      );
    }
  
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        {albums.map((album) => (
          <AlbumCard 
            key={album.id}
            album={album}
            onClick={onAlbumClick}
            onRename={onRenameAlbum}
          />
        ))}
      </div>
    );
  };
  ```

- [ ] **Step 6: Update AlbumCard.tsx**
  Clean up references to `activeTab` in `AlbumCard.tsx`.
  Let's see what [AlbumCard.tsx](file:///home/chotaxdon/Work/Projects/Prism/frontend/components/albums/AlbumCard.tsx) does. Let's make sure it doesn't break if `activeTab` is removed.
  We will view it first, then update it.

- [ ] **Step 7: Run frontend typecheck and tests**
  Run: `cd frontend && bunx tsc --noEmit && bun test`
  Expected: PASS

- [ ] **Step 8: Commit changes**
  ```bash
  git rm frontend/components/albums/AlbumTabs.tsx
  git commit -am "frontend: remove AlbumTabs and simplify Albums list view and useAlbums hook"
  ```
