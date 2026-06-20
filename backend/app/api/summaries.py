from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Photo
from app.services.image_summary import generate_image_summary

router = APIRouter()

@router.get("/{photo_id}")
async def get_summary(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get the stored AI summary for a photo.
    """
    result = await db.execute(
        select(Photo.id, Photo.ai_summary).where(Photo.id == photo_id)
    )
    photo = result.one_or_none()

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not photo.ai_summary:
        raise HTTPException(status_code=404, detail="No summary found for this photo")

    return {"photo_id": photo_id, "summary": photo.ai_summary}


@router.post("/{photo_id}/generate")
async def generate_summary(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Generate an AI summary for a photo and save it to the database.
    """
    # Load photo from DB
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    photo = result.scalar_one_or_none()

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Generate summary
    summary = await generate_image_summary(photo.path)

    # Save to ai_summary field
    photo.ai_summary = summary
    await db.commit()

    return {"photo_id": photo_id, "summary": summary}

