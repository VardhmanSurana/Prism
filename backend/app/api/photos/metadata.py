"""Photo metadata retrieval endpoints."""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Photo, PhotoPerson

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{photo_id}/metadata")
async def get_photo_metadata(photo_id: int, db: AsyncSession = Depends(get_db)):
    # Get photo with people loaded
    stmt = select(Photo).options(
        selectinload(Photo.people).selectinload(PhotoPerson.person)
    ).where(Photo.id == photo_id)
    result = await db.execute(stmt)
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    people_data = []
    for pp in photo.people:
        if pp.person:
            people_data.append({
                "id": pp.person.id,
                "name": pp.person.name,
                "cover_face_thumbnail": pp.person.cover_face_thumbnail,
                "face_box": pp.face_box_json
            })

    return {
        "id": photo.id,
        "filename": photo.filename,
        "path": photo.path,
        "width": photo.width,
        "height": photo.height,
        "date": photo.date.isoformat(),
        "location": photo.location,
        "city": photo.city,
        "state": photo.state,
        "country": photo.country,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "summary": photo.ai_summary,
        "people": people_data,
        "mime_type": photo.mime_type,
        "file_size": photo.file_size if photo.file_size is not None else 0
    }
