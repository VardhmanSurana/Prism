"""Database maintenance, cache clearing, and library reset endpoints."""
import logging
import os
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import text, delete
from sqlalchemy.future import select

from app.db import async_session, engine
from app.models import Photo, Album, Base
from app.config import settings
from app.utils.security import safe_resolve_write
from .helpers import _read_settings
from .schemas import PurgeFolderRequest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _cleanup_locked_folder_files():
    """Remove encrypted Locked Folder files from uploads directory."""
    from app.services.locked_service import locked_service
    
    deleted_count = 0
    if settings.UPLOAD_DIR.exists():
        for root, _, files in os.walk(settings.UPLOAD_DIR):
            for f in files:
                file_path = os.path.join(root, f)
                try:
                    is_enc = await locked_service.is_file_encrypted(file_path)
                    if is_enc:
                        os.remove(file_path)
                        deleted_count += 1
                        logger.info(f"Deleted encrypted Locked Folder file: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to check/delete encrypted file {file_path}: {e}")
    return deleted_count


def _delete_masks_for_photo(photo_id: int) -> int:
    """Delete any cached mask files for the given photo id. Returns count removed."""
    masks_dir = settings.THUMBNAILS_DIR / "masks"
    if not masks_dir.exists():
        return 0
    removed = 0
    # mask_<id>_background.png and mask_<id>_<face_idx>_<part>.png both
    # start with the photo_id, so we prefix-match safely.
    prefix = f"mask_{photo_id}"
    for entry in masks_dir.iterdir():
        try:
            if entry.is_file() and entry.name.startswith(prefix):
                entry.unlink()
                removed += 1
        except Exception as e:
            logger.warning(f"Failed to delete mask {entry}: {e}")
    return removed


@router.post("/purge-folder")
async def purge_folder(req: PurgeFolderRequest):
    """Deletes all photos whose path starts with the given folder, plus their thumbnails."""
    resolved_folder = safe_resolve_write(req.folder_path)
    folder = str(resolved_folder).rstrip("/") + "/"
    deleted_count = 0

    async with async_session() as db:
        result = await db.execute(select(Photo).where(Photo.path.startswith(folder)))
        photos = result.scalars().all()

        for photo in photos:
            if photo.url and photo.url.startswith("/thumbnails/"):
                thumb_path = settings.THUMBNAILS_DIR / photo.url.split("/thumbnails/")[-1]
                try:
                    if thumb_path.exists():
                        os.remove(thumb_path)
                except Exception:
                    pass
            _delete_masks_for_photo(photo.id)
            await db.delete(photo)
            deleted_count += 1

        await db.commit()

    return {"deleted": deleted_count, "folder": str(resolved_folder)}


@router.post("/trigger-face-sync")
async def trigger_face_sync():
    """Enqueue all photos missing face data for background face scanning."""
    from app.services.processing_queue import processing_queue
    from sqlalchemy import or_

    async with async_session() as db:
        stmt = select(Photo.id, Photo.path).where(
            Photo.is_locked == False,
            Photo.is_trash == False,
            Photo.path.isnot(None),
        )
        result = await db.execute(stmt)
        photos = result.all()

    enqueued = 0
    for photo_id, photo_path in photos:
        processing_queue.enqueue(photo_id, photo_path)
        enqueued += 1

    return {"status": "success", "enqueued": enqueued}


@router.post("/vacuum")
async def vacuum_database():
    """Optimizes the SQLite database by running the VACUUM command."""
    async with engine.connect() as conn:
        await conn.execution_options(isolation_level="AUTOCOMMIT")
        await conn.execute(text("VACUUM"))
    return {"status": "success", "message": "Database vacuumed successfully"}


@router.post("/clear-cache")
async def clear_cache():
    """Purges all generated thumbnail files and resets DB urls."""
    from sqlalchemy import update

    deleted_count = 0
    if settings.THUMBNAILS_DIR.exists():
        for file_path in settings.THUMBNAILS_DIR.iterdir():
            if file_path.is_file():
                try:
                    file_path.unlink()
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete {file_path}: {e}")
        # Also wipe any nested cache folders (e.g. masks/)
        for sub in settings.THUMBNAILS_DIR.iterdir():
            if sub.is_dir():
                for file_path in sub.iterdir():
                    if file_path.is_file():
                        try:
                            file_path.unlink()
                            deleted_count += 1
                        except Exception as e:
                            logger.warning(f"Failed to delete {file_path}: {e}")

    async with async_session() as db:
        await db.execute(
            update(Photo)
            .where(Photo.url.startswith("/thumbnails/"))
            .values(url="local://" + Photo.path)
        )
        await db.commit()

    return {"status": "success", "deleted": deleted_count}


@router.post("/reset-library")
async def reset_library():
    """
    Completely clears the photo library (Scorched Earth).
    settings.json is intentionally preserved so sync config survives the reset.
    """
    from app.services.sync_service import sync_service

    logger.info("Starting full library reset (Scorched Earth)...")

    # 1. Stop sync service
    try:
        await sync_service.reset_scan()
    except Exception as e:
        logger.error(f"Failed to reset sync service: {e}")

    # 2. Dispose all DB connections
    await engine.dispose()

    # 3. Delete the database files (WAL + SHM too)
    db_path = settings.DATABASE_FILE
    for suffix in ["", "-shm", "-wal"]:
        path = Path(str(db_path) + suffix)
        if path.exists():
            try:
                path.unlink()
                logger.info(f"Deleted {path}")
            except Exception as e:
                logger.error(f"Failed to delete {path}: {e}")

    # 4. Recreate the schema (all tables except settings — that's gone)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema recreated successfully.")
    except Exception as e:
        logger.error(f"Failed to recreate schema: {e}")

    # 5. Clear thumbnails
    deleted_assets = 0
    for folder in [settings.THUMBNAILS_DIR]:
        if folder.exists():
            for file_path in folder.iterdir():
                if file_path.is_file():
                    try:
                        file_path.unlink()
                        deleted_assets += 1
                    except Exception as e:
                        logger.warning(f"Failed to delete {file_path}: {e}")

    # 6. Clean up Locked Folder encrypted files in uploads/
    locked_deleted = await _cleanup_locked_folder_files()
    logger.info(f"Deleted {locked_deleted} encrypted Locked Folder files from uploads/")

    # 7. Broadcast SSE event for frontend notification
    try:
        sync_service.broadcast({"type": "library_reset", "data": {"deleted_assets": deleted_assets, "locked_files_deleted": locked_deleted}})
    except Exception as e:
        logger.warning(f"Failed to broadcast library_reset SSE event: {e}")

    logger.info(f"Library reset complete. Deleted {deleted_assets} assets, {locked_deleted} locked files. settings.json preserved.")
    return {"status": "success", "message": "Library completely reset (settings.json preserved)", "deleted_assets": deleted_assets, "locked_files_deleted": locked_deleted}
