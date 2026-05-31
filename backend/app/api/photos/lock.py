"""Photo lock/unlock endpoints."""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import Photo
from app.config import settings
from app.services.locked_service import locked_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/lock")
async def lock_photo(photo_id: int, db: AsyncSession = Depends(get_db)):
    if not locked_service.is_authenticated:
        raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")
        
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    # Encrypt the file on disk
    success = await locked_service.encrypt_file(photo.path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encrypt photo file")
        
    # Delete the thumbnail to prevent unencrypted visual leak
    if photo.url and photo.url.startswith("/thumbnails/"):
        thumb_path = settings.THUMBNAILS_DIR / photo.url.split("/thumbnails/")[-1]
        try:
            if thumb_path.exists():
                os.remove(thumb_path)
        except Exception:
            pass
            
    # Mark as locked in the DB
    photo.is_locked = True
    await db.commit()
    return {"status": "success", "message": f"Photo {photo_id} locked and encrypted."}


@router.post("/{photo_id}/unlock")
async def unlock_photo(photo_id: int, db: AsyncSession = Depends(get_db)):
    if not locked_service.is_authenticated:
        raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")
        
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    # Decrypt the file on disk
    success = await locked_service.decrypt_file(photo.path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to decrypt photo file")
        
    # Mark as unlocked in the DB
    photo.is_locked = False
    await db.commit()
    return {"status": "success", "message": f"Photo {photo_id} unlocked and decrypted."}
