"""Photo favorite toggle endpoint."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.id_utils import resolve_photo

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/favorite")
async def toggle_favorite(photo_id: str, db: AsyncSession = Depends(get_db)):
    photo = await resolve_photo(db, photo_id)
    photo.is_favorite = not photo.is_favorite
    await db.commit()
    return {"status": "success", "is_favorite": photo.is_favorite}
