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
        try:
            async with async_session() as db:
                result = await db.execute(select(Photo))
                photos = result.scalars().all()
                deleted_count = 0
                for photo in photos:
                    if not os.path.exists(photo.path):
                        photo_id = photo.id
                        await db.delete(photo)
                        deleted_count += 1
                        self.broadcast({"type": "delete_photo", "photo_id": photo_id})
                if deleted_count > 0:
                    await db.commit()
        except Exception as e:
            logger.error(f"Failed to cleanup missing files: {e}")

    async def _count_files(self: "SyncService", start_path: Path):
        count = 0
        for root, dirs, files in os.walk(start_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and os.path.join(root, d) not in self.excluded_folders]
            count += sum(1 for f in files if f.lower().endswith(SUPPORTED_EXTENSIONS))
            await asyncio.sleep(0.001)
        return count

    async def scan_path(self: "SyncService", start_path: Path, skip_paths: list = None):
        skip_paths = skip_paths or []
        skip_paths_str = [str(p) for p in skip_paths]
        batch = []
        BATCH_SIZE = os.cpu_count() * 2

        for root, dirs, files in os.walk(start_path):
            dirs[:] = [d for d in dirs if not d.startswith('.') and os.path.join(root, d) not in self.excluded_folders and os.path.join(root, d) not in skip_paths_str]
            for file in files:
                if file.lower().endswith(SUPPORTED_EXTENSIONS):
                    file_path = os.path.join(root, file)
                    batch.append(self.process_file_sync(file_path))
                    if len(batch) >= BATCH_SIZE:
                        await asyncio.gather(*batch)
                        batch = []
                        await asyncio.sleep(0.01)
        if batch:
            await asyncio.gather(*batch)

    async def process_file_sync(self: "SyncService", file_path: str):
        try:
            async with async_session() as db:
                await self.ingest_photo(file_path, db)
        except Exception as e:
            logger.error(f"Failed to save photo record for {file_path}: {e}")
        finally:
            self.processed_files += 1
