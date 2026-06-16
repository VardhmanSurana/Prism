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

from app.db import get_db
from app.models import Photo
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service, SUPPORTED_EXTENSIONS
from app.utils.security import safe_resolve_read, get_allowed_read_roots
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

@router.get("/blurry")
async def get_blurry_photos(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    # Query database directly for photos with blur_score below threshold (100.0)
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
    
    # If no path is specified, default to user's home directory
    if not path_str:
        path_str = str(Path.home())
        
    # Check if the path is valid and within allowed boundaries
    try:
        resolved_path = safe_resolve_read(path_str)
    except HTTPException:
        # If access is denied, instead of throwing an error, we return the allowed roots list
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
        raise HTTPException(status_code=404, detail="Path not found")
    if not resolved_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
        
    folders = []
    files = []
    
    try:
        for entry in os.scandir(resolved_path):
            is_hidden = entry.name.startswith('.')
            if is_hidden and not show_hidden:
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
                files.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_hidden": is_hidden,
                    "size_bytes": entry.stat().st_size,
                    "is_image": is_supported_image
                })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to access directory")
        
    # Sort folders and files alphabetically (case-insensitive)
    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())
    
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
