"""Photo upload and ingestion endpoints."""

import os
import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import Photo
from app.services.sync_service import sync_service, SUPPORTED_EXTENSIONS
from app.services.processing_queue import processing_queue
from .schemas import UploadRequest

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple in-memory rate limiting
_rate_limit_store = {}
MAX_UPLOADS_PER_MINUTE = 10
MAX_DIRECTORY_FILES = 1000  # Limit directory imports to prevent DoS


def _check_rate_limit(client_id: str) -> bool:
    """Check if client has exceeded upload rate limit."""
    now = time.time()
    if client_id not in _rate_limit_store:
        _rate_limit_store[client_id] = []
    
    # Clean old entries (older than 60 seconds)
    _rate_limit_store[client_id] = [
        t for t in _rate_limit_store[client_id] if now - t < 60
    ]
    
    if len(_rate_limit_store[client_id]) >= MAX_UPLOADS_PER_MINUTE:
        return False
    
    _rate_limit_store[client_id].append(now)
    return True


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
    logger.info(f"Received upload request for: {file_path}")

    # Verify path exists
    if not os.path.exists(file_path):
        logger.warning(f"Path not found on disk: {file_path}")
        raise HTTPException(status_code=404, detail="Path not found on disk")
    
    # Handle Directory
    if os.path.isdir(file_path):
        # Let's find all images in the folder recursively
        import asyncio
        def _sync_walk():
            images = []
            found_files = []
            for root, _, files in os.walk(file_path):
                for file in files:
                    found_files.append(file)
                    if file.lower().endswith(SUPPORTED_EXTENSIONS):
                        images.append(os.path.join(root, file))
            return images, found_files

        all_images, all_found_files = await asyncio.to_thread(_sync_walk)
        
        if not all_images:
            logger.warning(f"No supported images found in directory: {file_path}")
            if all_found_files:
                logger.info(f"Files found (first 10): {all_found_files[:10]}")
            else:
                logger.info("Directory appears to be empty.")
            raise HTTPException(status_code=400, detail="No supported images found in directory")
        
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
                    
                photo = await _internal_process_photo(img_path, db)
                if photo:
                    results.append(photo)
            except Exception as e:
                logger.error(f"Failed to process {img_path}: {e}")
                continue
        
        return results[0] if results else {"status": "skipped", "message": "All images already in library"}

    # Handle Single File
    return await _internal_process_photo(file_path, db)


@router.post("/upload-blob")
async def upload_blob(
    file: UploadFile = File(...),
    original_path: str = Form(...),
    is_save_as: bool = Form(False),
    save_as_path: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    import shutil
    
    # Verify original path exists and is allowed
    if not os.path.exists(original_path):
        raise HTTPException(status_code=404, detail="Original file not found")
        
    if is_save_as:
        if save_as_path:
            target_path = save_as_path
        else:
            base, ext = os.path.splitext(original_path)
            target_path = f"{base}_edited_{int(time.time())}.jpg"
    else:
        target_path = original_path
        
    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    return await _internal_process_photo(target_path, db)


async def _internal_process_photo(file_path: str, db: AsyncSession):
    # Verify file is an image
    if not file_path.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file format")

    photo = await sync_service.ingest_photo(file_path, db)
    if not photo:
        raise HTTPException(status_code=500, detail="Failed to process image")
    
    processing_queue.enqueue(photo.id, photo.path)
    
    return photo
