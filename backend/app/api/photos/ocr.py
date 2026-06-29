"""On-demand OCR extraction endpoint."""

import logging
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Photo
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/{photo_id}/ocr")
async def trigger_ocr(photo_id: int, db: AsyncSession = Depends(get_db)):
    if not settings.ENABLE_AI_OCR:
        raise HTTPException(status_code=400, detail="OCR feature is not enabled")

    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.is_locked:
        raise HTTPException(status_code=403, detail="OCR not supported for locked photos")

    from app.services.ocr import OCRManager, extract_ocr_text

    ocr_func = OCRManager.get_ocr()
    if not ocr_func:
        raise HTTPException(status_code=503, detail="OCR server failed to start")

    try:
        text_result = await asyncio.to_thread(extract_ocr_text, photo.path)
        if text_result:
            photo.ocr_text = text_result
            await db.commit()
            return {"photo_id": photo_id, "ocr_text": text_result}
        return {"photo_id": photo_id, "ocr_text": None, "message": "No text found in image"}
    except Exception as e:
        logger.error(f"OCR extraction failed for photo {photo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        OCRManager.unload()
