"""Photo metadata retrieval endpoints."""

import os
import logging
import cv2
import numpy as np
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Photo, PhotoPerson
from app.config import settings
from app.utils.image import reverse_geocode_coords
from app.services.xmp_service import export_xmp_to_file

from app.services.portrait_service import portrait_service
from app.services.background_service import background_service
from app.services.semantic_service import semantic_service
from app.services.face_utils import load_image
import base64
import time
from fastapi import Request

logger = logging.getLogger(__name__)
router = APIRouter()


class PhotoLocationUpdateRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


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
    from app.services.face_sdk import face_sdk
    from app.services.face_detection import FaceDetector
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

    import json
    adjustments = None
    if photo.adjustments_json:
        try:
            adjustments = json.loads(photo.adjustments_json)
        except Exception:
            pass

    if not adjustments:
        sidecar_path = photo.path + ".prism"
        if os.path.exists(sidecar_path):
            try:
                with open(sidecar_path, "r") as f:
                    adjustments = json.load(f)
                photo.adjustments_json = json.dumps(adjustments)
                await db.commit()
            except Exception:
                pass

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
        "ocr_text": photo.ocr_text,
        "people": people_data,
        "mime_type": photo.mime_type,
        "file_size": photo.file_size if photo.file_size is not None else 0,
        "adjustments": adjustments
    }


@router.put("/{photo_id}/location")
async def update_photo_location(
    photo_id: int,
    payload: PhotoLocationUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    photo.latitude = payload.latitude
    photo.longitude = payload.longitude

    location_info = reverse_geocode_coords(payload.latitude, payload.longitude)
    photo.city = location_info.get("city") if location_info else None
    photo.state = location_info.get("state") if location_info else None
    photo.country = location_info.get("country") if location_info else None

    location_parts = [part for part in [photo.city, photo.state, photo.country] if part]
    photo.location = ", ".join(location_parts) if location_parts else None

    await db.commit()
    await db.refresh(photo)

    xmp_exported = False
    try:
        export_xmp_to_file(photo)
        xmp_exported = True
    except Exception as exc:
        logger.warning("Failed to export XMP after location update for photo %s: %s", photo_id, exc)

    return {
        "id": photo.id,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location": photo.location,
        "city": photo.city,
        "state": photo.state,
        "country": photo.country,
        "xmp_exported": xmp_exported,
    }


class PhotoAdjustmentsUpdateRequest(BaseModel):
    adjustments: dict


class BulkAdjustmentsRequest(BaseModel):
    photo_ids: list[int]
    adjustments: dict


@router.put("/{photo_id}/adjustments")
async def update_photo_adjustments(
    photo_id: int,
    payload: PhotoAdjustmentsUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Save adjustments non-destructively to DB and sidecar format on disk."""
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    import json
    photo.adjustments_json = json.dumps(payload.adjustments)
    await db.commit()

    # Save to .prism sidecar format next to photo
    sidecar_path = photo.path + ".prism"
    try:
        with open(sidecar_path, "w") as f:
            json.dump(payload.adjustments, f, indent=2)
    except Exception as exc:
        logger.warning("Failed to write sidecar file %s: %s", sidecar_path, exc)

    return {"status": "success", "photo_id": photo_id}


@router.post("/bulk-adjustments")
async def bulk_update_adjustments(
    payload: BulkAdjustmentsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Batch edit: sync adjustments across multiple photos."""
    import json
    adj_str = json.dumps(payload.adjustments)
    updated_count = 0
    for pid in payload.photo_ids:
        photo = await db.get(Photo, pid)
        if photo:
            photo.adjustments_json = adj_str
            sidecar_path = photo.path + ".prism"
            try:
                with open(sidecar_path, "w") as f:
                    json.dump(payload.adjustments, f, indent=2)
            except Exception:
                pass
            updated_count += 1
    await db.commit()
    return {"status": "success", "updated_count": updated_count}


class PhotoMetadataUpdateRequest(BaseModel):
    date_taken: str | None = None
    caption: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    exif_make: str | None = None
    exif_model: str | None = None
    exif_focal_length: float | None = None
    exif_iso: int | None = None


@router.put("/{photo_id}/metadata")
async def update_photo_metadata(
    photo_id: int,
    payload: PhotoMetadataUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update manual EXIF and location metadata for a photo."""
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if payload.date_taken:
        try:
            from datetime import datetime
            photo.date_taken = datetime.fromisoformat(payload.date_taken.replace("Z", "+00:00"))
        except Exception as e:
            logger.warning("Failed to parse date_taken %s: %s", payload.date_taken, e)

    if payload.caption is not None:
        photo.caption = payload.caption
    if payload.city is not None:
        photo.city = payload.city
    if payload.state is not None:
        photo.state = payload.state
    if payload.country is not None:
        photo.country = payload.country
    if payload.exif_make is not None:
        photo.exif_make = payload.exif_make
    if payload.exif_model is not None:
        photo.exif_model = payload.exif_model
    if payload.exif_focal_length is not None:
        photo.exif_focal_length = payload.exif_focal_length
    if payload.exif_iso is not None:
        photo.exif_iso = payload.exif_iso

    location_parts = [part for part in [photo.city, photo.state, photo.country] if part]
    if location_parts:
        photo.location = ", ".join(location_parts)

    await db.commit()
    await db.refresh(photo)

    try:
        export_xmp_to_file(photo)
    except Exception as exc:
        logger.warning("Failed to export XMP after metadata update: %s", exc)

    return {
        "id": photo.id,
        "date_taken": photo.date_taken.isoformat() if photo.date_taken else None,
        "caption": photo.caption,
        "city": photo.city,
        "state": photo.state,
        "country": photo.country,
        "location": photo.location,
        "exif_make": photo.exif_make,
        "exif_model": photo.exif_model,
        "exif_focal_length": photo.exif_focal_length,
        "exif_iso": photo.exif_iso,
    }


@router.get("/{photo_id}/faces")
async def get_photo_faces(photo_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch detected face bounding boxes and assigned people for interactive face tagging."""
    from app.models import Person
    stmt = select(PhotoPerson).options(selectinload(PhotoPerson.person)).where(PhotoPerson.photo_id == photo_id)
    res = await db.execute(stmt)
    photo_people = res.scalars().all()
    
    faces = []
    for pp in photo_people:
        faces.append({
            "photo_id": photo_id,
            "person_id": pp.person_id if pp.person else None,
            "person_name": pp.person.name if pp.person else "Unknown",
            "face_box": pp.face_box_json,
            "confidence": pp.confidence,
        })
    return {"faces": faces}


class FaceTagRequest(BaseModel):
    person_name: str
    face_box: str | None = None  # JSON string e.g. {"x":0.2,"y":0.2,"w":0.3,"h":0.3}
    person_id: int | None = None


@router.post("/{photo_id}/tag-face")
async def tag_photo_face(
    photo_id: int,
    payload: FaceTagRequest,
    db: AsyncSession = Depends(get_db),
):
    """Assign or rename a person tag on a specific face in a photo."""
    from app.models import Person
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    person = None
    if payload.person_id:
        person = await db.get(Person, payload.person_id)
    if not person and payload.person_name.strip():
        stmt = select(Person).where(Person.name == payload.person_name.strip())
        res = await db.execute(stmt)
        person = res.scalar_one_or_none()

    if not person:
        person = Person(name=payload.person_name.strip() or "Person 1")
        db.add(person)
        await db.commit()
        await db.refresh(person)
    elif payload.person_name.strip() and person.name != payload.person_name.strip():
        person.name = payload.person_name.strip()
        await db.commit()

    stmt_pp = select(PhotoPerson).where(PhotoPerson.photo_id == photo_id, PhotoPerson.person_id == person.id)
    res_pp = await db.execute(stmt_pp)
    pp = res_pp.scalar_one_or_none()

    if not pp:
        pp = PhotoPerson(
            photo_id=photo_id,
            person_id=person.id,
            confidence=1.0,
            face_box_json=payload.face_box or '{"x":0.25,"y":0.25,"w":0.5,"h":0.5}'
        )
        db.add(pp)
    else:
        if payload.face_box:
            pp.face_box_json = payload.face_box

    await db.commit()
    return {
        "status": "success",
        "person_id": person.id,
        "person_name": person.name,
        "face_box": pp.face_box_json,
    }

