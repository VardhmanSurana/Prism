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
import subprocess
from pathlib import Path
from app.config import settings
from app.db import engine
import os
import cv2
from typing import List
import time
import logging
import traceback
import json

from app.db import get_db
from app.models import Photo, BackgroundJob
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service, SUPPORTED_EXTENSIONS
from app.utils.security import safe_resolve_read, safe_resolve_write, get_allowed_read_roots
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
import re
import uuid
from PIL import Image

router = APIRouter()


def _get_media_dimensions(path: str, is_image: bool, is_video: bool) -> tuple[int | None, int | None]:
    if is_image:
        try:
            with Image.open(path) as img:
                return int(img.width), int(img.height)
        except Exception:
            return None, None

    if is_video:
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-print_format",
                    "json",
                    "-show_streams",
                    path,
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                return None, None

            data = json.loads(result.stdout)
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    width = stream.get("width")
                    height = stream.get("height")
                    if isinstance(width, int) and isinstance(height, int):
                        return width, height
                    break
        except Exception:
            return None, None

    return None, None

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

@router.get("/visual-duplicates")
async def get_visual_duplicates(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    active_mounts = list(sync_service.active_mounts)
    stmt = select(Photo).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.phash.isnot(None),
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ).order_by(Photo.id)
    result = await db.execute(stmt)
    all_photos = result.scalars().all()

    from app.utils.image import hamming_distance

    visited = set()
    clusters = []
    for i, p1 in enumerate(all_photos):
        if p1.id in visited:
            continue
        cluster = [p1]
        visited.add(p1.id)
        for j in range(i + 1, len(all_photos)):
            p2 = all_photos[j]
            if p2.id in visited:
                continue
            if hamming_distance(p1.phash, p2.phash) <= 3:
                cluster.append(p2)
                visited.add(p2.id)
        if len(cluster) > 1:
            best_photo = min(cluster, key=lambda p: p.blur_score if p.blur_score is not None else float('inf'))
            clusters.append({
                "photo_count": len(cluster),
                "photos": [photo_to_dict(p) for p in cluster],
                "suggested_keep_id": best_photo.id,
            })

    clusters.sort(key=lambda c: c["photo_count"], reverse=True)
    return clusters[offset:offset + limit]

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
    from app.services.vision_pipeline import _siglip_model
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
    try:
        if not resolved_path.exists():
            logger.error(f"[{req_id}] resolved_path does not exist: {str(resolved_path)!r}")
            raise HTTPException(status_code=404, detail="Path not found")
        if not resolved_path.is_dir():
            logger.error(f"[{req_id}] resolved_path not a dir: {str(resolved_path)!r}")
            raise HTTPException(status_code=400, detail="Path is not a directory")
    except OSError as e:
        logger.error(f"[{req_id}] OS/IO error checking directory {resolved_path}: {e}")
        raise HTTPException(status_code=404, detail="Path not found or unreadable due to system error")

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
                try:
                    dir_stat = entry.stat(follow_symlinks=False)
                    modified_ms = int(dir_stat.st_mtime * 1000)
                except OSError:
                    modified_ms = None
                folders.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_hidden": is_hidden,
                    "modified_ms": modified_ms,
                })
            elif entry.is_file(follow_symlinks=False):
                # Check if the file is a supported image extension
                is_supported_image = entry.name.lower().endswith(SUPPORTED_EXTENSIONS)
                ext_lower = entry.name.lower()
                is_supported_video = ext_lower.endswith(('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp'))
                try:
                    file_stat = entry.stat(follow_symlinks=False)
                    size_bytes = file_stat.st_size
                    modified_ms = int(file_stat.st_mtime * 1000)
                except OSError:
                    size_bytes = 0
                    modified_ms = None
                width_px = None
                height_px = None
                if is_supported_image or is_supported_video:
                    width_px, height_px = _get_media_dimensions(
                        entry.path,
                        is_supported_image,
                        is_supported_video,
                    )
                files.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_hidden": is_hidden,
                    "size_bytes": size_bytes,
                    "modified_ms": modified_ms,
                    "width_px": width_px,
                    "height_px": height_px,
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


@router.get("/browser-locations")
async def get_browser_locations():
    """
    Removable/network mounts + user-configured external locations for the file browser.
    """
    from app.utils.mounts import discover_browser_mounts
    from app.services.cloud_locations import list_external_locations, provider_status, PROVIDER_IDS

    mounts = discover_browser_mounts()
    external = list_external_locations()
    providers = [provider_status(p) for p in PROVIDER_IDS]
    return {
        "mounts": mounts,
        "external_locations": external,
        "providers": providers,
        "home_path": str(Path.home().resolve()),
    }


class ExternalLocationCreate(BaseModel):
    provider: str = "local_path"
    name: str
    mount_path: Optional[str] = None
    path: Optional[str] = None  # alias for mount_path
    enabled: bool = True
    smb_host: Optional[str] = None
    smb_share: Optional[str] = None
    smb_username: Optional[str] = None
    bucket: Optional[str] = None
    region: Optional[str] = None
    endpoint: Optional[str] = None
    prefix: Optional[str] = None
    gdrive_account: Optional[str] = None
    notes: Optional[str] = None


class ExternalLocationUpdate(BaseModel):
    name: Optional[str] = None
    mount_path: Optional[str] = None
    path: Optional[str] = None
    enabled: Optional[bool] = None
    smb_host: Optional[str] = None
    smb_share: Optional[str] = None
    smb_username: Optional[str] = None
    bucket: Optional[str] = None
    region: Optional[str] = None
    endpoint: Optional[str] = None
    prefix: Optional[str] = None
    gdrive_account: Optional[str] = None
    notes: Optional[str] = None
    provider: Optional[str] = None


@router.get("/external-locations")
async def list_external_locations_api():
    from app.services.cloud_locations import list_external_locations, provider_status, PROVIDER_IDS

    return {
        "locations": list_external_locations(),
        "providers": [provider_status(p) for p in PROVIDER_IDS],
    }


@router.post("/external-locations")
async def create_external_location_api(req: ExternalLocationCreate):
    from app.services.cloud_locations import create_external_location

    payload = req.model_dump(exclude_none=True)
    if "path" in payload and "mount_path" not in payload:
        payload["mount_path"] = payload.pop("path")
    try:
        loc = create_external_location(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return loc


@router.patch("/external-locations/{loc_id}")
async def update_external_location_api(loc_id: str, req: ExternalLocationUpdate):
    from app.services.cloud_locations import update_external_location

    payload = req.model_dump(exclude_none=True)
    if "path" in payload and "mount_path" not in payload:
        payload["mount_path"] = payload.pop("path")
    try:
        return update_external_location(loc_id, payload)
    except KeyError:
        raise HTTPException(status_code=404, detail="Location not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/external-locations/{loc_id}")
async def delete_external_location_api(loc_id: str):
    from app.services.cloud_locations import delete_external_location

    if not delete_external_location(loc_id):
        raise HTTPException(status_code=404, detail="Location not found")
    return {"status": "ok", "id": loc_id}


class BatchRenameRequest(BaseModel):
    paths: List[str] = Field(..., min_length=1, max_length=500)
    pattern: str = Field(..., min_length=1, max_length=255)
    start_index: int = Field(1, ge=0, le=1_000_000)
    dry_run: bool = False
    preserve_extension: bool = True


_INVALID_NAME_CHARS = re.compile(r'[/\\]|[\x00-\x1f]')
_TOKEN_RE = re.compile(
    r'\{(n{1,4}|name|ext|date|yyyy|mm|dd)\}',
    re.IGNORECASE,
)


def _apply_rename_pattern(
    original_name: str,
    pattern: str,
    index: int,
    preserve_extension: bool,
) -> str:
    """Expand rename pattern tokens into a new basename."""
    path = Path(original_name)
    stem = path.stem
    ext = path.suffix[1:] if path.suffix.startswith('.') else path.suffix
    now = datetime.now()

    def repl(match: re.Match) -> str:
        token = match.group(1).lower()
        if token == 'name':
            return stem
        if token == 'ext':
            return ext
        if token == 'date':
            return now.strftime('%Y-%m-%d')
        if token == 'yyyy':
            return now.strftime('%Y')
        if token == 'mm':
            return now.strftime('%m')
        if token == 'dd':
            return now.strftime('%d')
        # n, nn, nnn, nnnn
        width = len(token)
        return str(index).zfill(width)

    new_name = _TOKEN_RE.sub(repl, pattern)

    if preserve_extension and ext and '{ext}' not in pattern.lower():
        # Keep original extension when pattern does not manage it
        if not new_name.lower().endswith(f'.{ext.lower()}'):
            new_name = f'{new_name}.{ext}'

    return new_name


def _validate_new_basename(name: str) -> Optional[str]:
    if not name or not name.strip():
        return 'New name is empty'
    if name in ('.', '..'):
        return 'Invalid name'
    if _INVALID_NAME_CHARS.search(name):
        return 'Name contains invalid characters'
    if name.startswith('/') or name.startswith('\\'):
        return 'Name must be a basename only'
    return None


@router.post("/batch-rename")
async def batch_rename_files(req: BatchRenameRequest):
    """
    Rename multiple files using a pattern with tokens:
    {n}/{nn}/{nnn}/{nnnn}, {name}, {ext}, {date}, {yyyy}, {mm}, {dd}.
    dry_run=true returns the planned renames without mutating the filesystem.
    """
    logger = logging.getLogger('prism.batch-rename')
    if not req.pattern.strip():
        raise HTTPException(status_code=400, detail='Pattern is required')

    # Preserve order, drop duplicates
    seen: set[str] = set()
    ordered_paths: list[str] = []
    for p in req.paths:
        if p not in seen:
            seen.add(p)
            ordered_paths.append(p)

    planned: list[dict] = []
    dest_keys: set[str] = set()

    for i, path_str in enumerate(ordered_paths):
        index = req.start_index + i
        item: dict = {
            'source_path': path_str,
            'source_name': Path(path_str).name,
            'index': index,
            'ok': False,
            'error': None,
            'dest_path': None,
            'dest_name': None,
            'skipped': False,
        }

        try:
            src = safe_resolve_write(path_str)
            if not src.exists():
                item['error'] = 'Source not found'
                planned.append(item)
                continue
            if not src.is_file():
                item['error'] = 'Only files can be renamed (not directories)'
                planned.append(item)
                continue

            new_name = _apply_rename_pattern(
                src.name, req.pattern, index, req.preserve_extension
            )
            err = _validate_new_basename(new_name)
            if err:
                item['error'] = err
                planned.append(item)
                continue

            dest = src.parent / new_name
            # Ensure destination stays within write roots
            dest = safe_resolve_write(dest)

            item['dest_name'] = new_name
            item['dest_path'] = str(dest)

            if dest == src:
                item['ok'] = True
                item['skipped'] = True
                planned.append(item)
                continue

            dest_key = str(dest)
            if dest_key in dest_keys:
                item['error'] = 'Duplicate destination name in this batch'
                planned.append(item)
                continue
            dest_keys.add(dest_key)

            item['ok'] = True
            planned.append(item)
        except HTTPException as e:
            detail = e.detail if isinstance(e.detail, str) else str(e.detail)
            item['error'] = detail
            planned.append(item)
        except Exception as e:
            logger.exception('plan failed for %s', path_str)
            item['error'] = f'Failed to plan rename: {e}'
            planned.append(item)

    # Collision check: destination exists and is not a source we will move away
    resolved_sources_that_move: set[str] = set()
    for p in planned:
        if p.get('ok') and not p.get('skipped') and p.get('source_path'):
            try:
                resolved_sources_that_move.add(str(safe_resolve_write(p['source_path'])))
            except HTTPException:
                pass

    for item in planned:
        if not item.get('ok') or item.get('skipped') or not item.get('dest_path'):
            continue
        dest = Path(item['dest_path'])
        if dest.exists() and str(dest) not in resolved_sources_that_move:
            item['ok'] = False
            item['error'] = 'Destination already exists'

    ok_count = sum(1 for p in planned if p.get('ok'))
    error_count = sum(1 for p in planned if not p.get('ok'))
    skip_count = sum(1 for p in planned if p.get('skipped'))

    if req.dry_run:
        return {
            'dry_run': True,
            'renamed': 0,
            'skipped': skip_count,
            'failed': error_count,
            'results': planned,
        }

    if error_count > 0:
        # Refuse partial apply when plan has errors (client can filter and retry)
        raise HTTPException(
            status_code=400,
            detail={
                'message': 'Rename plan has errors; fix or remove failing items and retry',
                'failed': error_count,
                'results': planned,
            },
        )

    # Two-phase rename to avoid overwriting within the batch
    temps: list[tuple[Path, Path, dict]] = []  # (temp, final, item)
    results: list[dict] = []

    try:
        for item in planned:
            if item.get('skipped'):
                results.append({**item, 'renamed': False})
                continue
            if not item.get('ok'):
                results.append(item)
                continue

            src = safe_resolve_write(item['source_path'])
            final = Path(item['dest_path'])
            temp = src.parent / f'.prism_rename_{uuid.uuid4().hex[:12]}_{src.name}'
            # temp must be writable
            safe_resolve_write(temp)
            src.rename(temp)
            temps.append((temp, final, item))

        for temp, final, item in temps:
            temp.rename(final)
            results.append({**item, 'renamed': True, 'ok': True, 'error': None})
    except Exception as e:
        logger.exception('batch rename execution failed')
        # Best-effort: try to restore any remaining temps to original names
        for temp, final, item in temps:
            if temp.exists() and not Path(item['source_path']).exists():
                try:
                    temp.rename(Path(item['source_path']))
                except Exception:
                    pass
        raise HTTPException(status_code=500, detail=f'Batch rename failed: {e}')

    renamed = sum(1 for r in results if r.get('renamed'))
    logger.info(
        'batch-rename done renamed=%s skipped=%s pattern=%r',
        renamed,
        skip_count,
        req.pattern,
    )
    return {
        'dry_run': False,
        'renamed': renamed,
        'skipped': skip_count,
        'failed': 0,
        'results': results,
    }


class OpenInExplorerRequest(BaseModel):
    path: str = Field(..., min_length=1, max_length=4096)


def _build_explorer_command(target: Path) -> list[str]:
    if sys.platform == "darwin":
        if target.is_file():
            return ["open", "-R", str(target)]
        return ["open", str(target)]

    if os.name == "nt":
        if target.is_file():
            return ["explorer", "/select,", str(target)]
        return ["explorer", str(target)]

    # Linux / other POSIX desktops: reveal by opening the containing folder for files.
    return ["xdg-open", str(target.parent if target.is_file() else target)]


@router.post("/open-in-os-explorer")
async def open_in_os_explorer(req: OpenInExplorerRequest):
    """
    Open a safe filesystem path in the host OS file explorer.
    For files, reveal/select when supported, otherwise open the containing directory.
    """
    try:
        target = safe_resolve_read(req.path)
    except HTTPException:
        raise

    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    command = _build_explorer_command(target)

    try:
        subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        raise HTTPException(
            status_code=503,
            detail="OS file explorer integration is unavailable on this system",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open file explorer: {e}")

    return {
        "status": "ok",
        "opened_path": str(target),
        "directory_path": str(target.parent if target.is_file() else target),
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

    # 5. OCR processed photos (photos with extracted text)
    ocr_stmt = select(func.count(Photo.id)).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.ocr_text.isnot(None)
    )
    ocr_processed = (await db.execute(ocr_stmt)).scalar() or 0

    # 6. Background queue status
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
    ocr_processed = min(ocr_processed, total_photos)

    clip_progress = (clip_processed / total_photos * 100) if total_photos > 0 else 0
    gemma_progress = (gemma_processed / total_photos * 100) if total_photos > 0 else 0
    face_progress = (face_processed / total_photos * 100) if total_photos > 0 else 0
    ocr_progress = (ocr_processed / total_photos * 100) if total_photos > 0 else 0

    from app.services.processing_queue import processing_queue

    return {
        "total_photos": total_photos,
        "paused": processing_queue._paused,
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
            "is_processing": is_processing and settings.ENABLE_AI_CAPTION
        },
        "face": {
            "processed": face_processed,
            "total": total_photos,
            "progress": round(face_progress, 1),
            "is_processing": is_processing
        },
        "ocr": {
            "processed": ocr_processed,
            "total": total_photos,
            "progress": round(ocr_progress, 1),
            "is_processing": is_processing and settings.ENABLE_AI_OCR
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


@router.get("/search/fused")
async def fused_search_endpoint(
    query: str,
    limit: int = 30,
    db: AsyncSession = Depends(get_db)
):
    from app.agent.search_tools import SearchTools
    tools = SearchTools()
    results = await tools.fused_search(db, query, top_k=limit)
    return results


@router.post("/background-jobs/pause")
async def pause_background_jobs():
    from app.services.processing_queue import processing_queue
    processing_queue._throttler.increment_video_ops()
    return {"status": "paused", "active_ops": processing_queue._throttler._active_video_operations}


@router.post("/background-jobs/resume")
async def resume_background_jobs():
    from app.services.processing_queue import processing_queue
    processing_queue._throttler.decrement_video_ops()
    return {"status": "released", "active_ops": processing_queue._throttler._active_video_operations}


@router.post("/background-jobs/stop")
async def stop_background_jobs():
    from app.services.processing_queue import processing_queue
    processing_queue._paused = True
    logging.getLogger("prism.utilities").info("Background processing queue explicitly stopped by user.")
    return {"status": "stopped", "paused": True}


@router.post("/background-jobs/start")
async def start_background_jobs():
    from app.services.processing_queue import processing_queue
    processing_queue._paused = False
    processing_queue.start()
    enqueued = await processing_queue.enqueue_unfinished_jobs()
    logging.getLogger("prism.utilities").info(f"Background processing queue restarted. Enqueued {enqueued} unfinished jobs.")
    return {"status": "started", "paused": False, "enqueued_count": enqueued}
