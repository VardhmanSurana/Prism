import os
import cv2
import logging
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import Photo
from app.services.face_utils import load_image

logger = logging.getLogger(__name__)
router = APIRouter()


class ExportPresetRequest(BaseModel):
    preset: str  # instagram_4_5 | instagram_1_1 | story_9_16 | web_1080p | full_res


@router.post("/{photo_id}/export-preset")
async def export_photo_preset(
    photo_id: int,
    payload: ExportPresetRequest,
    db: AsyncSession = Depends(get_db),
):
    """Crop and resize photo for social media or web export presets."""
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    img = load_image(photo.path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load image for export")

    h, w = img.shape[:2]
    preset = payload.preset

    if preset == "full_res":
        target_img = img
    elif preset == "instagram_4_5":
        # Target aspect ratio: 4/5 = 0.8
        target_aspect = 4.0 / 5.0
        curr_aspect = w / h
        if curr_aspect > target_aspect:
            # Too wide, crop width
            new_w = int(h * target_aspect)
            offset = (w - new_w) // 2
            cropped = img[:, offset:offset + new_w]
        else:
            # Too tall, crop height
            new_h = int(w / target_aspect)
            offset = (h - new_h) // 2
            cropped = img[offset:offset + new_h, :]
        target_img = cv2.resize(cropped, (1080, 1350), interpolation=cv2.INTER_AREA)
    elif preset == "instagram_1_1":
        # Square crop
        min_dim = min(w, h)
        off_x = (w - min_dim) // 2
        off_y = (h - min_dim) // 2
        cropped = img[off_y:off_y + min_dim, off_x:off_x + min_dim]
        target_img = cv2.resize(cropped, (1080, 1080), interpolation=cv2.INTER_AREA)
    elif preset == "story_9_16":
        # 9:16 aspect ratio
        target_aspect = 9.0 / 16.0
        curr_aspect = w / h
        if curr_aspect > target_aspect:
            new_w = int(h * target_aspect)
            offset = (w - new_w) // 2
            cropped = img[:, offset:offset + new_w]
        else:
            new_h = int(w / target_aspect)
            offset = (h - new_h) // 2
            cropped = img[offset:offset + new_h, :]
        target_img = cv2.resize(cropped, (1080, 1920), interpolation=cv2.INTER_AREA)
    elif preset == "web_1080p":
        # Fit inside 1920x1080
        scale = min(1920 / w, 1080 / h)
        if scale < 1.0:
            target_img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            target_img = img
    else:
        target_img = img

    success, encoded_img = cv2.imencode(".jpg", target_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode image")

    filename = f"export_{photo_id}_{preset}.jpg"
    return Response(
        content=encoded_img.tobytes(),
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
