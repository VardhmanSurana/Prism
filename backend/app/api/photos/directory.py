"""Directory scanning endpoints for photo import."""

import os
import asyncio
import logging
from fastapi import APIRouter, HTTPException

from app.services.sync_service import SUPPORTED_EXTENSIONS
from app.utils.security import safe_resolve_read
from .schemas import UploadRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/expand-directory")
async def expand_directory(req: UploadRequest):
    file_path = req.file_path
    logger.info(f"Received expand directory request for: {file_path}")

    # Validate path safely
    resolved_path = safe_resolve_read(file_path)
    file_path = str(resolved_path)

    if not os.path.exists(file_path):
        logger.warning(f"Path not found on disk: {file_path}")
        raise HTTPException(status_code=404, detail="Path not found on disk")
        
    if not os.path.isdir(file_path):
        logger.error(f"Path is not a directory: {file_path}")
        raise HTTPException(status_code=400, detail="Path is not a directory")

    def _sync_walk():
        images = []
        for root, _, files in os.walk(file_path):
            for file in files:
                if file.lower().endswith(SUPPORTED_EXTENSIONS):
                    full_p = os.path.join(root, file)
                    try:
                        # Verify sub-paths do not escape boundaries
                        safe_resolve_read(full_p)
                        images.append(full_p)
                    except Exception:
                        pass
        return images

    all_images = await asyncio.to_thread(_sync_walk)
                
    logger.info(f"Scanned {len(all_images)} supported images in: {file_path}")
    return {"files": all_images}

