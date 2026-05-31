"""Directory scanning endpoints for photo import."""

import os
import logging
from fastapi import APIRouter, HTTPException

from app.services.sync_service import SUPPORTED_EXTENSIONS
from .schemas import UploadRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/expand-directory")
async def expand_directory(req: UploadRequest):
    file_path = req.file_path
    print(f"\n[FOLDER IMPORT] Scanning folder path: {file_path}")
    logger.info(f"Received expand directory request for: {file_path}")

    if not os.path.exists(file_path):
        print(f"[FOLDER IMPORT] ERROR: Folder path does not exist on disk: {file_path}")
        logger.warning(f"Path not found on disk: {file_path}")
        raise HTTPException(status_code=404, detail="Path not found on disk")
        
    if not os.path.isdir(file_path):
        print(f"[FOLDER IMPORT] ERROR: Path is not a directory: {file_path}")
        raise HTTPException(status_code=400, detail="Path is not a directory")

    import asyncio
    def _sync_walk():
        images = []
        for root, _, files in os.walk(file_path):
            for file in files:
                if file.lower().endswith(SUPPORTED_EXTENSIONS):
                    images.append(os.path.join(root, file))
        return images

    all_images = await asyncio.to_thread(_sync_walk)
                
    print(f"[FOLDER IMPORT] Successfully scanned. Found {len(all_images)} supported images in: {file_path}\n")
    return {"files": all_images}
