import os
import asyncio
import logging
from pathlib import Path
from sqlalchemy.future import select
from sqlalchemy import delete

from app.db import async_session
from app.models import Photo
from app.services.sync.handler import SUPPORTED_EXTENSIONS
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class ScanningMixin:
    """Handles file system scanning, counting, and cleanup of missing files."""

    def get_status(self: "SyncService"):
        return {
            "is_scanning": self.is_scanning,
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "progress": (self.processed_files / self.total_files * 100) if self.total_files > 0 else 0
        }

    async def full_scan(self: "SyncService"):
        self.is_scanning = True
        self.total_files = 0
        self.processed_files = 0

        paths_to_scan = [Path.home() / "Pictures", Path.home()]
        if os.name == 'posix':
            media_path = "/media" if os.path.exists("/media") else "/Volumes"
            if os.path.exists(media_path):
                paths_to_scan.append(Path(media_path))

        for p in paths_to_scan:
            if p.exists():
                self.total_files += await self._count_files(p)

        pictures_path = Path.home() / "Pictures"
        if pictures_path.exists():
            await self.scan_path(pictures_path)

        await self.scan_path(Path.home(), skip_paths=[pictures_path])

        if os.name == 'posix':
            media_path = "/media" if os.path.exists("/media") else "/Volumes"
            if os.path.exists(media_path):
                await self.scan_path(Path(media_path))

        await self.cleanup_missing_files()
        self.is_scanning = False

        # Trigger background processing
        from app.services.place_service import sync_all_places
        asyncio.create_task(sync_all_places())

    async def cleanup_missing_files(self: "SyncService"):
        import aiosqlite
        try:
            async with async_session() as db:
                result = await db.execute(select(Photo))
                photos = result.scalars().all()

                def _check_paths():
                    return {p.id: os.path.exists(p.path) for p in photos}

                exists_map = await asyncio.to_thread(_check_paths)

                deleted_count = 0
                for photo in photos:
                    if not exists_map.get(photo.id, True):
                        await db.delete(photo)
                        deleted_count += 1
                        self.broadcast({"type": "delete_photo", "photo_id": photo.id})
                        self._cleanup_masks_for_photo(photo.id)
                if deleted_count > 0:
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to cleanup missing files: {e}")

    async def _count_files(self: "SyncService", start_path: Path):
        excluded = self.excluded_folders

        def _sync_count():
            count = 0
            for root, dirs, files in os.walk(start_path):
                dirs[:] = [d for d in dirs if not d.startswith('.') and os.path.join(root, d) not in excluded]
                count += sum(1 for f in files if f.lower().endswith(SUPPORTED_EXTENSIONS))
            return count

        return await asyncio.to_thread(_sync_count)

    async def scan_path(self: "SyncService", start_path: Path, skip_paths: list = None):
        skip_paths = skip_paths or []
        skip_paths_str = [str(p) for p in skip_paths]
        excluded = self.excluded_folders

        def _sync_scan():
            batch_paths = []
            for root, dirs, files in os.walk(start_path):
                dirs[:] = [d for d in dirs if not d.startswith('.') and os.path.join(root, d) not in excluded and os.path.join(root, d) not in skip_paths_str]
                for file in files:
                    if file.lower().endswith(SUPPORTED_EXTENSIONS):
                        batch_paths.append(os.path.join(root, file))
            return batch_paths

        collected = await asyncio.to_thread(_sync_scan)
        BATCH_SIZE = os.cpu_count() * 2
        for i in range(0, len(collected), BATCH_SIZE):
            batch = [self.process_file_sync(fp) for fp in collected[i:i + BATCH_SIZE]]
            await asyncio.gather(*batch)
            await asyncio.sleep(0.01)

    async def process_file_sync(self: "SyncService", file_path: str):
        try:
            async with async_session() as db:
                await self.ingest_photo(file_path, db)
        except Exception as e:
            logger.error(f"Failed to save photo record for {file_path}: {e}")
        finally:
            self.processed_files += 1
