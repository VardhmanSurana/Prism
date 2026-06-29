from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_, text
import sys
import platform
import zipfile
import io
import shutil
from pathlib import Path
from app.config import settings
from app.db import engine
import os
import cv2
from typing import List
import time
import logging
import traceback

from app.db import get_db
from app.models import Photo, BackgroundJob
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service, SUPPORTED_EXTENSIONS
from app.utils.security import safe_resolve_read, get_allowed_read_roots
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

router = APIRouter()

@router.get("/blurry")
async def get_blurry_photos(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    active_mounts = list(sync_service.active_mounts)
    stmt = select(Photo).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.blur_score.isnot(None),
        Photo.blur_score < 100.0,
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ).order_by(Photo.blur_score.asc()).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    photos = result.scalars().all()
    
    blurry_photos = []
    for photo in photos:
        p_dict = photo_to_dict(photo)
        p_dict["blur_score"] = round(photo.blur_score, 2)
        blurry_photos.append(p_dict)
            
    return blurry_photos

@router.get("/duplicates")
async def get_duplicate_photos(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    # Finds duplicate clusters based on matching file content hash
    active_mounts = list(sync_service.active_mounts)
    
    # Query photos grouped by hash having count > 1
    stmt = select(
        Photo.hash,
        func.count(Photo.id).label("match_count")
    ).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.hash.isnot(None),
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ).group_by(Photo.hash).having(func.count(Photo.id) > 1).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    hash_groups = result.all()
    
    duplicate_clusters = []
    for group in hash_groups:
        stmt_photos = select(Photo).where(
            Photo.is_locked == False,
            Photo.is_trash == False,
            Photo.hash == group.hash,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        ).order_by(Photo.filename)
        
        res_photos = await db.execute(stmt_photos)
        photos_in_group = res_photos.scalars().all()
        
        if len(photos_in_group) > 1:
            duplicate_clusters.append({
                "key": group.hash,
                "photo_count": len(photos_in_group),
                "photos": [photo_to_dict(p) for p in photos_in_group]
            })
            
    return duplicate_clusters

@router.get("/documents")
async def get_document_photos(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    # Query photos whose ai_summary or caption contains document keywords
    active_mounts = list(sync_service.active_mounts)
    
    keywords = ["receipt", "document", "text", "invoice", "screenshot", "bill", "paper", "page", "license", "card"]
    keyword_clauses = [Photo.ai_summary.ilike(f"%{k}%") for k in keywords]
    keyword_clauses.append(Photo.caption.ilike("%receipt%"))
    keyword_clauses.append(Photo.caption.ilike("%screenshot%"))
    
    stmt = select(Photo).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        ),
        or_(*keyword_clauses)
    ).order_by(Photo.date_taken.desc()).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    photos = result.scalars().all()
    
    return [photo_to_dict(p) for p in photos]


@router.get("/diagnostics")
async def get_diagnostics():
    from app.services.vision_pipeline import _florence_model, _siglip_model
    from app.api.settings.helpers import _read_settings
    
    db_size = 0
    if settings.DATABASE_FILE.exists():
        db_size = settings.DATABASE_FILE.stat().st_size
        
    thumb_size = 0
    if settings.THUMBNAILS_DIR.exists():
        for root, _, files in os.walk(settings.THUMBNAILS_DIR):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    thumb_size += os.path.getsize(fp)
                except Exception:
                    pass
                    
    config = _read_settings()
    watched_folders = config.get("watched_folders") or [str(Path.home() / "Pictures")]
    excluded_folders = config.get("excluded_folders") or []
    
    return {
        "status": "healthy",
        "python_version": sys.version,
        "platform": platform.platform(),
        "database_path": str(settings.DATABASE_FILE),
        "database_size_bytes": db_size,
        "thumbnail_cache_size_bytes": thumb_size,
        "sync_status": sync_service.get_status() if hasattr(sync_service, "get_status") else {},
        "active_mounts": list(sync_service.active_mounts),
        "watched_folders": watched_folders,
        "excluded_folders": excluded_folders,
        "models_loaded": {
            "florence": _florence_model is not None,
            "siglip": _siglip_model is not None
        },
        "features_enabled": {
            "agent": settings.ENABLE_AI_AGENT,
            "inpainting": settings.ENABLE_AI_INPAINTING,
            "face": settings.ENABLE_AI_FACE,
            "clip": settings.ENABLE_AI_CLIP,
            "rembg": settings.ENABLE_AI_REMBG
        }
    }


@router.get("/logs")
async def get_log_tail(lines: int = 100):
    log_path = settings.BASE_DIR / "backend.log"
    if not log_path.exists():
        log_path = settings.BASE_DIR.parent / "backend.log"
        if not log_path.exists():
            log_path = Path("backend.log")
            
    if not log_path.exists():
        return {"logs": "Log file not found."}
        
    try:
        with open(log_path, "r") as f:
            all_lines = f.readlines()
        tail = "".join(all_lines[-lines:])
        return {"logs": tail}
    except Exception as e:
        return {"logs": f"Failed to read log file: {e}"}


@router.post("/backup/export")
async def export_backup():
    temp_db_path = settings.DATABASE_FILE.with_suffix(".db.backup")
    try:
        async with engine.connect() as conn:
            await conn.execute(text(f"VACUUM INTO '{temp_db_path}'"))
    except Exception as e:
        shutil.copy2(settings.DATABASE_FILE, temp_db_path)
        
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        if temp_db_path.exists():
            zip_file.write(temp_db_path, "Prism.db")
        if settings.SETTINGS_FILE.exists():
            zip_file.write(settings.SETTINGS_FILE, "settings.json")
            
    if temp_db_path.exists():
        os.remove(temp_db_path)
        
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=prism_backup.zip"}
    )


@router.post("/backup/restore")
async def restore_backup(file: UploadFile = File(...)):
    contents = await file.read()
    zip_buffer = io.BytesIO(contents)
    
    try:
        with zipfile.ZipFile(zip_buffer, "r") as zip_file:
            namelist = zip_file.namelist()
            if "Prism.db" not in namelist and "settings.json" not in namelist:
                raise HTTPException(status_code=400, detail="Invalid backup file: missing database or settings")
                
            await engine.dispose()
            
            if "Prism.db" in namelist:
                db_tmp = settings.DATABASE_FILE.with_suffix(".db.restore")
                with open(db_tmp, "wb") as f:
                    f.write(zip_file.read("Prism.db"))
                os.replace(db_tmp, settings.DATABASE_FILE)
                
            if "settings.json" in namelist:
                settings_tmp = settings.SETTINGS_FILE.with_suffix(".json.restore")
                with open(settings_tmp, "wb") as f:
                    f.write(zip_file.read("settings.json"))
                os.replace(settings_tmp, settings.SETTINGS_FILE)
                
        return {"status": "success", "message": "Backup successfully restored. Please restart the application."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to restore backup: {e}")


class ListDirRequest(BaseModel):
    path: Optional[str] = None
    show_hidden: bool = False

@router.post("/list-dir")
async def list_directory_contents(req: ListDirRequest):
    path_str = req.path
    show_hidden = req.show_hidden

    logger = logging.getLogger("prism.list-dir")
    req_start = time.time()
    req_id = f"list-dir:{int(req_start * 1000)}"

    # If no path is specified, default to user's home directory
    if not path_str:
        path_str = str(Path.home())

    resolved_path = None
    # Check if the path is valid and within allowed boundaries
    try:
        logger.info(f"[{req_id}] start path_str={path_str!r} show_hidden={show_hidden}")
        resolved_path = safe_resolve_read(path_str)
        logger.info(f"[{req_id}] resolved_path={str(resolved_path)!r}")
    except HTTPException:
        # If access is denied, instead of throwing an error, we return the allowed roots list
        logger.warning(f"[{req_id}] safe_resolve_read denied for path_str={path_str!r}; returning allowed roots")
        roots = get_allowed_read_roots()
        folders = []
        for r in roots:
            if r.exists():
                name = r.name if r.name else str(r)
                folders.append({
                    "name": name,
                    "path": str(r),
                    "is_hidden": False
                })
        return {
            "current_path": "",
            "parent_path": None,
            "folders": folders,
            "files": [],
            "is_root": True
        }

    # Ensure it exists and is a directory
    if not resolved_path.exists():
        logger.error(f"[{req_id}] resolved_path does not exist: {str(resolved_path)!r}")
        raise HTTPException(status_code=404, detail="Path not found")
    if not resolved_path.is_dir():
        logger.error(f"[{req_id}] resolved_path not a dir: {str(resolved_path)!r}")
        raise HTTPException(status_code=400, detail="Path is not a directory")

    folders = []
    files = []

    scan_start = time.time()
    try:
        logger.info(f"[{req_id}] scandir begin: {str(resolved_path)!r}")
        scandir_iter_start = time.time()

        scandir_entry_count = 0
        matched_hidden_skipped = 0

        for entry in os.scandir(resolved_path):
            scandir_entry_count += 1
            is_hidden = entry.name.startswith('.')
            if is_hidden and not show_hidden:
                matched_hidden_skipped += 1
                continue

            if entry.is_dir(follow_symlinks=False):
                folders.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_hidden": is_hidden
                })
            elif entry.is_file(follow_symlinks=False):
                # Check if the file is a supported image extension
                is_supported_image = entry.name.lower().endswith(SUPPORTED_EXTENSIONS)
                ext_lower = entry.name.lower()
                is_supported_video = ext_lower.endswith(('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp'))
                files.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_hidden": is_hidden,
                    "size_bytes": entry.stat().st_size,
                    "is_image": is_supported_image,
                    "is_video": is_supported_video
                })

        scan_ms = int((time.time() - scan_start) * 1000)
        iter_ms = int((time.time() - scandir_iter_start) * 1000)
        logger.info(
            f"[{req_id}] scandir end: {str(resolved_path)!r} "
            f"scan_ms={scan_ms} iter_ms={iter_ms} entries_seen={scandir_entry_count} "
            f"hidden_skipped={matched_hidden_skipped} folders={len(folders)} files={len(files)}"
        )
    except PermissionError:
        logger.exception(f"[{req_id}] PermissionError scanning directory: {str(resolved_path)!r}")
        raise HTTPException(status_code=403, detail="Permission denied to access directory")
    except Exception as e:
        logger.error(f"[{req_id}] Unexpected error scanning directory: {str(resolved_path)!r}: {e!r}")
        logger.error(traceback.format_exc())
        raise

    # Sort folders and files alphabetically (case-insensitive)
    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())

    logger.info(f"[{req_id}] sorting done folders={len(folders)} files={len(files)} total_ms={int((time.time() - req_start) * 1000)}")
    
    # Determine the parent path
    # If the current path is one of the allowed roots, or its parent is not relative to any allowed root, parent_path should go to the roots list ("")
    parent = resolved_path.parent
    roots = get_allowed_read_roots()
    
    parent_is_safe = False
    try:
        safe_resolve_read(parent)
        parent_is_safe = True
    except HTTPException:
        pass
        
    parent_path = str(parent) if parent_is_safe else ""
    
    # Check if we are at one of the roots
    is_at_root = any(resolved_path == r for r in roots)
    if is_at_root:
        parent_path = ""
        
    return {
        "current_path": str(resolved_path),
        "parent_path": parent_path if str(resolved_path) != parent_path else None,
        "folders": folders,
        "files": files,
        "is_root": False
    }


@router.get("/background-jobs/status")
async def get_background_jobs_status(db: AsyncSession = Depends(get_db)):
    # 1. Total photos
    total_photos_stmt = select(func.count(Photo.id)).where(
        Photo.is_locked == False,
        Photo.is_trash == False
    )
    total_photos = (await db.execute(total_photos_stmt)).scalar() or 0

    # 2. CLIP processed photos (photos with embedding)
    clip_stmt = select(func.count(Photo.id)).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.embedding.isnot(None)
    )
    clip_processed = (await db.execute(clip_stmt)).scalar() or 0

    # 3. Gemma processed photos (photos with ai_summary)
    gemma_stmt = select(func.count(Photo.id)).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.ai_summary.isnot(None)
    )
    gemma_processed = (await db.execute(gemma_stmt)).scalar() or 0

    # 4. Face processed photos (completed sequential_analysis background jobs)
    face_stmt = select(func.count(BackgroundJob.id)).where(
        BackgroundJob.job_type == "sequential_analysis",
        BackgroundJob.status == "completed"
    )
    face_processed = (await db.execute(face_stmt)).scalar() or 0

    # 5. Background queue status
    queue_stmt = select(
        BackgroundJob.status,
        func.count(BackgroundJob.id)
    ).group_by(BackgroundJob.status)
    queue_res = await db.execute(queue_stmt)
    
    queue_counts = {"pending": 0, "processing": 0, "failed": 0, "completed": 0}
    for row in queue_res.all():
        status, count = row
        if status in queue_counts:
            queue_counts[status] = count

    is_processing = queue_counts["pending"] > 0 or queue_counts["processing"] > 0

    clip_processed = min(clip_processed, total_photos)
    gemma_processed = min(gemma_processed, total_photos)
    face_processed = min(face_processed, total_photos)

    clip_progress = (clip_processed / total_photos * 100) if total_photos > 0 else 0
    gemma_progress = (gemma_processed / total_photos * 100) if total_photos > 0 else 0
    face_progress = (face_processed / total_photos * 100) if total_photos > 0 else 0

    return {
        "total_photos": total_photos,
        "clip": {
            "processed": clip_processed,
            "total": total_photos,
            "progress": round(clip_progress, 1),
            "is_processing": is_processing and settings.ENABLE_AI_CLIP
        },
        "gemma": {
            "processed": gemma_processed,
            "total": total_photos,
            "progress": round(gemma_progress, 1),
            "is_processing": is_processing and settings.ENABLE_AI_CLIP
        },
        "face": {
            "processed": face_processed,
            "total": total_photos,
            "progress": round(face_progress, 1),
            "is_processing": is_processing
        },
        "queue": queue_counts
    }


@router.post("/purge-trash")
async def purge_old_trash(days: int = 30, db: AsyncSession = Depends(get_db)):
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    stmt = select(Photo).where(and_(Photo.is_trash == True, Photo.upload_date < cutoff))
    result = await db.execute(stmt)
    old_trash = result.scalars().all()
    deleted = 0
    for photo in old_trash:
        try:
            if photo.path and os.path.exists(photo.path):
                os.remove(photo.path)
        except Exception:
            pass
        if photo.hash:
            for suffix in (".webp", ".webp.enc"):
                try:
                    thumb = settings.THUMBNAILS_DIR / f"{photo.hash}{suffix}"
                    if thumb.exists():
                        os.remove(thumb)
                except Exception:
                    pass
        await db.delete(photo)
        deleted += 1
    if deleted > 0:
        await db.commit()
    return {"status": "success", "deleted": deleted, "cutoff_date": cutoff.isoformat()}
