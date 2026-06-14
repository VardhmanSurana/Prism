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
        
    # Process and delete the thumbnail to prevent unencrypted visual leak
    if photo.url and photo.url.startswith("/thumbnails/"):
        thumb_name = photo.url.split("/thumbnails/")[-1]
        thumb_path = settings.THUMBNAILS_DIR / thumb_name
        try:
            if thumb_path.exists():
                # Read thumbnail data and save encrypted version
                with open(thumb_path, "rb") as f:
                    thumb_data = f.read()
                
                file_hash = photo.hash
                if file_hash:
                    enc_thumb_path = settings.THUMBNAILS_DIR / f"{file_hash}.webp.enc"
                    await locked_service.encrypt_and_save_thumbnail(thumb_data, str(enc_thumb_path))
                
                os.remove(thumb_path)
        except Exception as e:
            logger.warning(f"Failed to encrypt or delete thumbnail during lock: {e}")
            
    # Purge masks
    masks_dir = settings.THUMBNAILS_DIR / "masks"
    if masks_dir.exists():
        prefix = f"mask_{photo_id}"
        for entry in masks_dir.iterdir():
            try:
                if entry.is_file() and entry.name.startswith(prefix):
                    entry.unlink()
            except Exception:
                pass

    # Purge face thumbnails
    face_dir = settings.THUMBNAILS_DIR / "Face_Thumbnail"
    if face_dir.exists():
        prefix = f"face_{photo_id}_"
        for entry in face_dir.iterdir():
            try:
                if entry.is_file() and entry.name.startswith(prefix):
                    entry.unlink()
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
        
    # Restore the thumbnail from encrypted cache
    file_hash = photo.hash
    if file_hash:
        enc_thumb_path = settings.THUMBNAILS_DIR / f"{file_hash}.webp.enc"
        if enc_thumb_path.exists():
            try:
                decrypted_thumb = await locked_service.decrypt_encrypted_thumbnail(str(enc_thumb_path))
                if decrypted_thumb:
                    thumb_path = settings.THUMBNAILS_DIR / f"{file_hash}.webp"
                    with open(thumb_path, "wb") as f:
                        f.write(decrypted_thumb)
                        f.flush()
                        os.fsync(f.fileno())
                    os.remove(enc_thumb_path)
            except Exception as e:
                logger.warning(f"Failed to restore thumbnail on unlock: {e}")
                
    # Mark as unlocked in the DB
    photo.is_locked = False
    await db.commit()
    return {"status": "success", "message": f"Photo {photo_id} unlocked and decrypted."}
