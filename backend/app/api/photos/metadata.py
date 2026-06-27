"""Photo metadata retrieval endpoints."""

import os
import logging
import cv2
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Photo, PhotoPerson
from app.config import settings

from app.services.portrait_service import portrait_service
from app.services.background_service import background_service
from app.services.semantic_service import semantic_service
from app.services.face_utils import load_image
import base64
import time
from fastapi import Request

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/semantic-masks/{photo_id}")
async def get_semantic_masks(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Analyzes the photo and returns masks for all detected semantic objects.
    """
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    img = load_image(photo.path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load image")

    # 1. Generate Masks
    mask_results = semantic_service.get_semantic_masks(img)
    if mask_results is None:
        return {"regions": []}

    # 2. Save masks and return URLs
    response_data = []
    mask_dir = os.path.join(settings.THUMBNAILS_DIR, "masks")
    os.makedirs(mask_dir, exist_ok=True)

    for name, mask_img in mask_results.items():
        mask_filename = f"mask_{photo_id}_semantic_{name}.png"
        mask_path = os.path.join(mask_dir, mask_filename)
        cv2.imwrite(mask_path, mask_img)

        response_data.append({
            "id": f"{name}-{photo_id}",
            "label": name.capitalize(),
            "type": "custom",
            "mask_url": f"/thumbnails/masks/{mask_filename}"
        })

    return {"regions": response_data}



@router.get("/background-mask/{photo_id}")
async def get_background_mask(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Generates a high-precision mask for the background.
    """
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    mask_dir = os.path.join(settings.THUMBNAILS_DIR, "masks")
    os.makedirs(mask_dir, exist_ok=True)
    mask_filename = f"mask_{photo_id}_background.png"
    mask_path = os.path.join(mask_dir, mask_filename)

    # Return the cached mask if it already exists on disk
    if os.path.exists(mask_path):
        return {"mask_url": f"/thumbnails/masks/{mask_filename}"}

    img = load_image(photo.path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load image")

    # Generate Background Mask
    mask_img = background_service.get_background_mask(img)
    if mask_img is None:
        raise HTTPException(status_code=500, detail="Failed to generate mask")

    cv2.imwrite(mask_path, mask_img)

    return {"mask_url": f"/thumbnails/masks/{mask_filename}"}


@router.get("/portrait-masks/{photo_id}")
async def get_portrait_masks(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Detects faces and generates high-precision semantic masks.
    """
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    img = load_image(photo.path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load image")

    # 1. Detect faces (lazy import - only when endpoint is called)
    from app.services import face_sdk, FaceDetector
    detector = FaceDetector(face_sdk)
    faces_data, _, scale, _ = detector.detect_faces(img)
    if not faces_data:
        return {"faces": []}

    # Extract coordinates
    faces_coords = []
    for face in faces_data:
        x1, y1, x2, y2 = detector.get_face_location_scaled(face, scale)
        faces_coords.append((x1, y1, x2, y2))

    # 2. Generate Masks
    results = portrait_service.get_face_masks(img, faces_coords)
    if not results:
        return {"faces": []}

    # 3. Save masks as static assets and return URLs
    response_data = []
    mask_dir = os.path.join(settings.THUMBNAILS_DIR, "masks")
    os.makedirs(mask_dir, exist_ok=True)

    for i, res in enumerate(results):
        face_entry = {
            "id": f"face_{i}",
            "box": res["box"],
            "masks": {}
        }
        
        for mask_name, mask_img in res["masks"].items():
            mask_filename = f"mask_{photo_id}_{i}_{mask_name}.png"
            mask_path = os.path.join(mask_dir, mask_filename)
            cv2.imwrite(mask_path, mask_img)
            face_entry["masks"][mask_name] = f"/thumbnails/masks/{mask_filename}"
            
        response_data.append(face_entry)

    return {"faces": response_data}


@router.get("/auto-enhance/{photo_id}")
async def get_auto_enhance_params(photo_id: int, db: AsyncSession = Depends(get_db)):
    """
    Analyzes image and returns recommended adjustment parameters.
    """
    photo = await db.get(Photo, photo_id)
    
    if not photo:
        raise HTTPException(status_code=404, detail=f"DEBUG: Photo {photo_id} not found in DB")
        
    # Load image for analysis (downscale for speed)
    img = load_image(photo.path)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to load image for analysis")
    
    # Analyze image
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    
    # 1. Luminance Analysis
    avg_v = np.mean(v)
    std_v = np.std(v)
    
    # 2. Color Analysis
    avg_s = np.mean(s)
    
    # Suggested Adjustments
    params = {
        "brightness": 0,
        "exposure": 0,
        "contrast": 0,
        "highlights": 0,
        "shadows": 0,
        "saturation": 0,
        "vibrance": 0,
        "temperature": 0,
        "whites": 0,
        "blacks": 0
    }

    # Exposure / Brightness correction
    if avg_v < 80: # Underexposed
        params["exposure"] = int(min(45, (80 - avg_v) * 0.8))
        params["shadows"] = int(min(30, (80 - avg_v) * 0.5))
    elif avg_v > 180: # Overexposed
        params["exposure"] = int(max(-40, (180 - avg_v) * 0.6))
        params["highlights"] = int(max(-35, (180 - avg_v) * 0.4))

    # Contrast correction
    if std_v < 40: # Flat image
        params["contrast"] = int(min(40, (50 - std_v) * 0.7))
        params["whites"] = 10
        params["blacks"] = 10

    # Saturation correction
    if avg_s < 50: # Dull colors
        params["vibrance"] = 25
        params["saturation"] = 10
    elif avg_s > 150: # Oversaturated
        params["saturation"] = -15

    return params


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
