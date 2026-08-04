"""Photo trash/delete endpoints."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.api.id_utils import resolve_photo

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/trash")
async def move_to_trash(photo_id: str, db: AsyncSession = Depends(get_db)):
    """Move a photo to the trash (logical delete)."""
    photo = await resolve_photo(db, photo_id)
    photo.is_trash = True
    await db.commit()

    return {"status": "success", "message": "Photo moved to trash"}


@router.post("/{photo_id}/restore")
async def restore_from_trash(photo_id: str, db: AsyncSession = Depends(get_db)):
    """Restore a photo from the trash."""
    photo = await resolve_photo(db, photo_id)
    photo.is_trash = False
    await db.commit()

    return {"status": "success", "message": "Photo restored from trash"}
