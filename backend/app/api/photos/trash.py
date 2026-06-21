"""Photo trash/delete endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import Photo

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/trash")
async def move_to_trash(photo_id: int, db: AsyncSession = Depends(get_db)):
    """Move a photo to the trash (logical delete)."""
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo.is_trash = True
    await db.commit()
    
    return {"status": "success", "message": "Photo moved to trash"}


@router.post("/{photo_id}/restore")
async def restore_from_trash(photo_id: int, db: AsyncSession = Depends(get_db)):
    """Restore a photo from the trash."""
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo.is_trash = False
    await db.commit()
    
    return {"status": "success", "message": "Photo restored from trash"}
