"""Photo favorite toggle endpoint."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db import get_db
from app.models import Photo

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/favorite")
async def toggle_favorite(photo_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    photo.is_favorite = not photo.is_favorite
    await db.commit()
    return {"status": "success", "is_favorite": photo.is_favorite}
