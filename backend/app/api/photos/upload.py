"""Photo upload and ingestion endpoints."""

import os
import asyncio
import shutil
import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import Photo
from app.services.sync_service import sync_service, SUPPORTED_EXTENSIONS
from app.services.processing_queue import processing_queue
from app.utils.security import safe_resolve_read, safe_resolve_write
from .schemas import UploadRequest

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-memory rate limiting
_rate_limit_store: dict[str, list[float]] = {}
MAX_UPLOADS_PER_MINUTE = 100
MAX_DIRECTORY_FILES = 1000  # Limit directory imports to prevent DoS
_LAST_RATE_CLEANUP = time.time()
_RATE_CLEANUP_INTERVAL = 300  # 5 minutes


def _check_rate_limit(client_id: str) -> bool:
    """Check if client has exceeded upload rate limit."""
    now = time.time()
    global _LAST_RATE_CLEANUP

    if client_id not in _rate_limit_store:
        _rate_limit_store[client_id] = []
    
    # Clean old entries (older than 60 seconds)
    entries = _rate_limit_store[client_id]
    entries = [t for t in entries if now - t < 60]
    if entries:
        _rate_limit_store[client_id] = entries
    else:
        del _rate_limit_store[client_id]
        _rate_limit_store[client_id] = []
    
    # Periodic purge of all stale client keys
    if now - _LAST_RATE_CLEANUP > _RATE_CLEANUP_INTERVAL:
        for cid in list(_rate_limit_store):
            _rate_limit_store[cid] = [t for t in _rate_limit_store[cid] if now - t < 60]
            if not _rate_limit_store[cid]:
                del _rate_limit_store[cid]
        _LAST_RATE_CLEANUP = now
    
    if client_id not in _rate_limit_store:
        _rate_limit_store[client_id] = []
    
    if len(_rate_limit_store[client_id]) >= MAX_UPLOADS_PER_MINUTE:
        return False
    
    _rate_limit_store[client_id].append(now)
    return True


def resize_and_save_image(file_path: str, max_width: int) -> str:
    from PIL import Image
    from PIL import ImageOps
    from app.config import settings
    import uuid
    import os
    
    from pillow_heif import register_heif_opener
    register_heif_opener()

    with Image.open(file_path) as raw_img:
        img = ImageOps.exif_transpose(raw_img)
        
        width, height = img.size
        if width > max_width:
            aspect_ratio = height / width
            new_width = max_width
            new_height = int(new_width * aspect_ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
    base_name = os.path.basename(file_path)
    root, ext = os.path.splitext(base_name)
    if ext.lower() not in ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif', '.bmp', '.gif']:
        ext = '.jpg'
    
    # Ensure upload directory exists
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    out_filename = f"{root}_resized_{uuid.uuid4().hex[:8]}{ext}"
    out_path = settings.UPLOAD_DIR / out_filename
    
    img.save(str(out_path), quality=85)
    return str(out_path)


def resize_and_save_video(file_path: str, resize_width: int) -> str | None:
    from app.services.sync.handler import is_video_file
    import subprocess
    from app.config import settings
    try:
        base, ext = os.path.splitext(file_path)
        output_path = os.path.join(str(settings.UPLOAD_DIR), f"{os.path.basename(base)}_resized{ext}")
        cmd = [
            'ffmpeg', '-y', '-i', file_path,
            '-vf', f'scale={resize_width}:-2',
            '-c:v', 'libx264', '-crf', '23', '-preset', 'fast',
            '-c:a', 'aac',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode == 0 and os.path.exists(output_path):
            return output_path
    except Exception as e:
        logger.error(f"Video resize failed: {e}")
    return None


def resize_and_save_media(file_path: str, resize_width: int) -> str | None:
    from app.services.sync.handler import is_video_file
    if is_video_file(file_path):
        return resize_and_save_video(file_path, resize_width)
    return resize_and_save_image(file_path, resize_width)


@router.post("/upload")
async def upload_photo(
    req: UploadRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Rate limiting check
    client_id = request.client.host if request.client else "unknown"
    if not _check_rate_limit(client_id):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Maximum 10 uploads per minute.")
    
    file_path = req.file_path
    logger.info(f"Received upload request for: {file_path} (resize_width: {req.resize_width})")

    # Validate path safely
    resolved_path = safe_resolve_read(file_path)
    file_path = str(resolved_path)

    # Verify path exists
    if not os.path.exists(file_path):
        logger.warning(f"Path not found on disk: {file_path}")
        raise HTTPException(status_code=404, detail="Path not found on disk")
    
    # Handle Directory
    if os.path.isdir(file_path):
        # Let's find all images in the folder recursively
        def _sync_walk():
            images = []
            found_files = []
            for root, _, files in os.walk(file_path):
                for file in files:
                    found_files.append(file)
                    if file.lower().endswith(SUPPORTED_EXTENSIONS):
                        full_p = os.path.join(root, file)
                        try:
                            # Verify sub-paths do not escape boundaries
                            safe_resolve_read(full_p)
                            images.append(full_p)
                        except Exception:
                            pass
            return images, found_files

        all_images, all_found_files = await asyncio.to_thread(_sync_walk)
        
        if not all_images:
            logger.warning(f"No supported media files found in directory: {file_path}")
            if all_found_files:
                logger.info(f"Files found (first 10): {all_found_files[:10]}")
            else:
                logger.info("Directory appears to be empty.")
            raise HTTPException(status_code=400, detail="No supported media files found in directory")
        
        # Limit directory imports to prevent DoS
        if len(all_images) > MAX_DIRECTORY_FILES:
            logger.warning(f"Directory contains too many images ({len(all_images)}), limiting to {MAX_DIRECTORY_FILES}")
            all_images = all_images[:MAX_DIRECTORY_FILES]
            
        logger.info(f"Found {len(all_images)} images in directory. Processing...")
        # Process them all (this might be slow, but it's what's requested)
        results = []
        for img_path in all_images:
            try:
                # 1. Quick path check
                check_stmt = await db.execute(select(Photo).where(Photo.path == img_path))
                if check_stmt.scalar_one_or_none():
                    continue
                
                # Resize if requested
                actual_path = img_path
                if req.resize_width:
                    try:
                        actual_path = await asyncio.to_thread(resize_and_save_media, img_path, req.resize_width)
                    except Exception as e:
                        logger.error(f"Failed to resize image in folder: {img_path}: {e}")
                    
                photo = await _internal_process_photo(actual_path, db)
                if photo:
                    results.append(photo)
            except Exception as e:
                logger.error(f"Failed to process {img_path}: {e}")
                continue
        
        return results[0] if results else {"status": "skipped", "message": "All images already in library"}
    
    # Handle Single File
    actual_path = file_path
    if req.resize_width:
        try:
            actual_path = await asyncio.to_thread(resize_and_save_media, file_path, req.resize_width)
        except Exception as e:
            logger.error(f"Failed to resize single image {file_path}: {e}")
            
    return await _internal_process_photo(actual_path, db)


@router.post("/upload-blob")
async def upload_blob(
    file: UploadFile = File(...),
    original_path: str = Form(...),
    is_save_as: bool = Form(False),
    save_as_path: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    # Verify original path is allowed and exists
    resolved_orig = safe_resolve_read(original_path)
    original_path = str(resolved_orig)
    
    if not os.path.exists(original_path):
        raise HTTPException(status_code=404, detail="Original file not found")
        
    if is_save_as:
        if save_as_path:
            resolved_target = safe_resolve_write(save_as_path)
            target_path = str(resolved_target)
        else:
            base, ext = os.path.splitext(original_path)
            target_path = f"{base}_edited_{int(time.time())}.jpg"
            resolved_target = safe_resolve_write(target_path)
            target_path = str(resolved_target)
    else:
        resolved_target = safe_resolve_write(original_path)
        target_path = str(resolved_target)
        
    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    return await _internal_process_photo(target_path, db, is_overwrite=not is_save_as)


async def _internal_process_photo(file_path: str, db: AsyncSession, is_overwrite: bool = False):
    # Verify file is an image
    if not file_path.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    photo = await sync_service.ingest_photo(file_path, db, is_overwrite=is_overwrite)
    if not photo:
        raise HTTPException(status_code=500, detail="Failed to process file")
    
    processing_queue.enqueue(photo.id, photo.path)
    
    return photo
