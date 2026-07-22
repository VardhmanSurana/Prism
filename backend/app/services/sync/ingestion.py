import os
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Photo
from app.config import settings
from app.services.sync.tasks import process_image_task
from app.services.sync.handler import is_video_file
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class IngestionMixin:
    """Handles photo ingestion, duplicate detection, and database operations."""

    async def ingest_photo(self: "SyncService", file_path: str, db: AsyncSession, is_overwrite: bool = False) -> Photo | None:
        """
        Unified, thread-safe ingestion pipeline for a single photo.
        Prevents database lock concurrency exceptions on SQLite.
        Detects duplicates by both path and content-based hashes.
        """
        try:
            # 1. Quick path check
            if not is_overwrite:
                check_stmt = await db.execute(select(Photo).where(Photo.path == file_path))
                existing_photo_path = check_stmt.scalar_one_or_none()
                if existing_photo_path:
                    return existing_photo_path

            # 2. Extract metadata and generate thumbnail in Process Pool
            loop = asyncio.get_running_loop()
            if is_video_file(file_path):
                from app.services.sync.tasks import process_video_task
                task_fn = process_video_task
            else:
                task_fn = process_image_task
            pool_result = await loop.run_in_executor(
                self.process_pool,
                task_fn,
                file_path,
                str(settings.THUMBNAILS_DIR)
            )

            if not pool_result or not pool_result[0]:
                return None

            metadata, thumb_url = pool_result
            file_hash = metadata.get("hash")

            # 3. Safe database writes serialized using write Semaphore
            async with self.db_write_semaphore:
                # 4. Content-hash duplicate detection
                if not is_overwrite and file_hash:
                    hash_stmt = await db.execute(select(Photo).where(Photo.hash == file_hash))
                    existing_photo_hash = hash_stmt.scalar_one_or_none()
                    if existing_photo_hash:
                        logger.info(f"Duplicate content detected for {file_path}. Existing photo ID: {existing_photo_hash.id}")
                        return existing_photo_hash

                is_external = not file_path.startswith(str(Path.home()))
                mount_point = self.get_mount_point(file_path)

                photo_to_broadcast = None

                if is_overwrite:
                    # Find the existing photo record
                    check_stmt = await db.execute(select(Photo).where(Photo.path == file_path))
                    existing_photo = check_stmt.scalar_one_or_none()
                    if existing_photo:
                        old_thumb_url = existing_photo.url
                        
                        existing_photo.filename = os.path.basename(file_path)
                        existing_photo.url = thumb_url if thumb_url else f"local://{file_path}"
                        existing_photo.hash = file_hash
                        existing_photo.phash = metadata.get("phash")
                        existing_photo.width = metadata["width"]
                        existing_photo.height = metadata["height"]
                        existing_photo.aspect_ratio = metadata["aspect_ratio"]
                        existing_photo.mime_type = metadata["mime_type"]
                        existing_photo.blur_score = metadata.get("blur_score")
                        existing_photo.file_size = metadata.get("file_size")
                        existing_photo.upload_date = datetime.utcnow()
                        
                        try:
                            db.add(existing_photo)
                            await db.commit()
                            await db.refresh(existing_photo)
                            
                            # Delete the old thumbnail file if different
                            if old_thumb_url and old_thumb_url != existing_photo.url and old_thumb_url.startswith("/thumbnails/"):
                                old_thumb_name = old_thumb_url.split("/thumbnails/")[-1]
                                old_thumb_path = settings.THUMBNAILS_DIR / old_thumb_name
                                if old_thumb_path.exists():
                                    try:
                                        old_thumb_path.unlink()
                                    except Exception as e:
                                        logger.warning(f"Failed to delete old thumbnail {old_thumb_path}: {e}")
                        except Exception as e:
                            await db.rollback()
                            logger.error(f"Failed to commit database update transaction for {file_path}: {e}")
                            return None
                        
                        photo_to_broadcast = existing_photo
                    else:
                        is_overwrite = False

                if not is_overwrite:
                    new_photo = Photo(
                        filename=os.path.basename(file_path),
                        path=file_path,
                        url=thumb_url if thumb_url else f"local://{file_path}",
                        hash=file_hash,
                        phash=metadata.get("phash"),
                        width=metadata["width"],
                        height=metadata["height"],
                        aspect_ratio=metadata["aspect_ratio"],
                        mime_type=metadata["mime_type"],
                        file_type=metadata.get("file_type", "image"),
                        caption=metadata.get("caption"),
                        date=metadata.get("date_taken", datetime.utcnow()),
                        date_taken=metadata.get("date_taken", datetime.utcnow()),
                        upload_date=datetime.utcnow(),
                        city=metadata.get("city"),
                        state=metadata.get("state"),
                        country=metadata.get("country"),
                        location=metadata.get("location"),
                        latitude=metadata.get("latitude"),
                        longitude=metadata.get("longitude"),
                        device_id=mount_point,
                        is_external=is_external,
                        blur_score=metadata.get("blur_score"),
                        file_size=metadata.get("file_size"),
                        exif_make=metadata.get("exif_make"),
                        exif_model=metadata.get("exif_model"),
                        exif_focal_length=metadata.get("exif_focal_length"),
                        exif_iso=metadata.get("exif_iso"),
                        duration=metadata.get("duration"),
                        fps=metadata.get("fps"),
                        codec=metadata.get("codec"),
                        audio_codec=metadata.get("audio_codec"),
                        rotation=metadata.get("rotation", 0),
                        animated_url=metadata.get("animated_url"),
                    )

                    try:
                        db.add(new_photo)
                        await db.commit()
                        await db.refresh(new_photo)
                    except Exception as e:
                        await db.rollback()
                        logger.error(f"Failed to commit database transaction for {file_path}: {e}")
                        return None
                    
                    photo_to_broadcast = new_photo

            # 5. Broadcast SSE event
            from app.api.albums.utils import photo_to_dict
            broadcast_fields = {
                "id", "filename", "path", "url", "width", "height",
                "aspect_ratio", "location", "date", "date_taken",
                "upload_date", "is_favorite", "is_locked",
                "mime_type", "file_type", "device_id", "is_external",
                "duration", "fps", "codec", "audio_codec", "rotation", "animated_url"
            }
            photo_dict = photo_to_dict(photo_to_broadcast, include=broadcast_fields)
            if is_overwrite:
                self.broadcast({"type": "update_photo", "photo": photo_dict})
            else:
                self.broadcast({"type": "new_photo", "photo": photo_dict})

            return photo_to_broadcast

        except Exception as e:
            logger.error(f"Failed to ingest photo {file_path}: {e}")
            return None

    async def delete_photo_by_path(self: "SyncService", file_path: str):
        try:
            from app.db import async_session
            from sqlalchemy import delete

            async with async_session() as db:
                result = await db.execute(select(Photo).where(Photo.path == file_path))
                photo = result.scalar_one_or_none()
                if photo:
                    photo_id = photo.id
                    await db.execute(delete(Photo).where(Photo.id == photo_id))
                    await db.commit()
                    self.broadcast({"type": "delete_photo", "photo_id": photo_id})
                    self._cleanup_masks_for_photo(photo_id)
                    logger.info(f"Removed missing file from DB: {file_path}")
        except Exception as e:
            logger.error(f"Failed to delete photo record for {file_path}: {e}")

    def _cleanup_masks_for_photo(self: "SyncService", photo_id: int) -> None:
        """Best-effort removal of cached AI mask files for a deleted photo."""
        try:
            masks_dir = settings.THUMBNAILS_DIR / "masks"
            if not masks_dir.exists():
                return
            prefix = f"mask_{photo_id}"
            for entry in masks_dir.iterdir():
                if entry.is_file() and entry.name.startswith(prefix):
                    try:
                        entry.unlink()
                    except Exception as e:
                        logger.warning(f"Failed to delete mask {entry}: {e}")
        except Exception as e:
            logger.warning(f"Mask cleanup failed for photo {photo_id}: {e}")
