"""XMP sidecar export/import endpoints."""

import os
import shutil
import tempfile
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db import get_db
from app.models import Photo
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class XMPExportRequest(BaseModel):
    photo_ids: list[int] | None = None  # None = export all
    output_dir: str | None = None


class XMPImportRequest(BaseModel):
    directory: str


@router.post("/export")
async def export_xmp_sidecars(
    request: XMPExportRequest,
    db: AsyncSession = Depends(get_db),
):
    """Export XMP sidecar files for photos.

    If photo_ids is provided, exports only those photos.
    If output_dir is provided, writes all sidecars there.
    Otherwise, writes each .xmp next to its photo file.
    """
    from app.services.xmp_service import export_photo_xmp, export_xmp_to_file, _parse_face_box_json
    from app.models import Photo, PhotoPerson
    from sqlalchemy.orm import selectinload

    if request.photo_ids:
        stmt = (
            select(Photo)
            .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
            .where(Photo.id.in_(request.photo_ids), Photo.is_trash == False)
        )
    else:
        stmt = (
            select(Photo)
            .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
            .where(Photo.is_trash == False)
        )

    result = await db.execute(stmt)
    photos = result.scalars().unique().all()

    exported = 0
    errors = 0

    for photo in photos:
        try:
            face_regions = []
            if photo.people:
                for pp in photo.people:
                    if pp.face_box_json and pp.person:
                        from app.services.xmp_service import _parse_face_box_json
                        normalized = _parse_face_box_json(pp.face_box_json, photo.width, photo.height)
                        if normalized:
                            face_regions.append({
                                "name": pp.person.name,
                                "x": normalized["x"],
                                "y": normalized["y"],
                                "w": normalized["w"],
                                "h": normalized["h"],
                                "confidence": pp.confidence,
                            })

            if request.output_dir:
                base_name = os.path.splitext(os.path.basename(photo.path))[0]
                sidecar_path = os.path.join(request.output_dir, base_name + ".xmp")
            else:
                sidecar_path = None

            export_xmp_to_file(photo, face_regions if face_regions else None, sidecar_path)
            exported += 1
        except Exception as e:
            logger.error(f"Failed to export XMP for photo {photo.id}: {e}")
            errors += 1

    return {
        "status": "success",
        "exported": exported,
        "errors": errors,
        "total": len(photos),
    }


@router.post("/import")
async def import_xmp_sidecars(
    request: XMPImportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Import XMP sidecars from a directory.

    Scans recursively for .xmp files, matches them to photos by filename,
    and updates photo metadata in the database.
    """
    if not os.path.isdir(request.directory):
        raise HTTPException(status_code=400, detail=f"Directory not found: {request.directory}")

    from app.services.xmp_service import import_xmp_from_directory

    result = await import_xmp_from_directory(request.directory, db)
    return {
        "status": "success",
        **result,
    }


@router.post("/upload-import")
async def upload_xmp_import(
    file: UploadFile = File(...),
    photo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload an XMP sidecar file and import its metadata.

    If photo_id is provided, imports directly into that photo.
    Otherwise, tries to match by filename.
    """
    if not file.filename or not file.filename.lower().endswith(".xmp"):
        raise HTTPException(status_code=400, detail="File must be an .xmp file")

    # Save to temp file
    tmp_dir = tempfile.mkdtemp()
    try:
        tmp_path = os.path.join(tmp_dir, file.filename)
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        from app.services.xmp_service import import_xmp_sidecar, _parse_face_box_json
        from sqlalchemy.orm import selectinload

        if photo_id:
            # Import into specific photo
            result = await import_photo_xmp_with_file(photo_id, tmp_path, db)
            return {"status": "success", **result}
        else:
            # Match by filename
            base_name = os.path.splitext(file.filename)[0]
            stmt = select(Photo).where(
                Photo.filename == base_name,
                Photo.is_trash == False,
            )
            res = await db.execute(stmt)
            photo = res.scalar_one_or_none()
            if not photo:
                raise HTTPException(status_code=404, detail=f"No photo found matching filename: {base_name}")

            result = await import_photo_xmp_with_file(photo.id, tmp_path, db)
            return {"status": "success", **result}
    finally:
        shutil.rmtree(tmp_path, ignore_errors=True)
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def import_photo_xmp_with_file(photo_id: int, sidecar_path: str, db: AsyncSession) -> dict:
    """Import an XMP file into a photo's record."""
    from app.services.xmp_service import import_xmp_sidecar, _parse_auto_tags
    import json

    stmt = select(Photo).where(Photo.id == photo_id)
    result = await db.execute(stmt)
    photo = result.scalar_one_or_none()
    if not photo:
        return {"error": "Photo not found"}

    xmp_data = import_xmp_sidecar(sidecar_path)
    if not xmp_data:
        return {"error": "No XMP data found or parse error"}

    updated_fields = []

    if xmp_data.get("caption") and not photo.caption:
        photo.caption = xmp_data["caption"]
        updated_fields.append("caption")

    if xmp_data.get("is_favorite") is not None:
        photo.is_favorite = xmp_data["is_favorite"]
        updated_fields.append("is_favorite")

    if xmp_data.get("date_taken"):
        photo.date_taken = xmp_data["date_taken"]
        updated_fields.append("date_taken")

    if xmp_data.get("auto_tags"):
        existing_tags = _parse_auto_tags(photo.auto_tags)
        new_tags = _parse_auto_tags(xmp_data["auto_tags"])
        if new_tags:
            merged = list(dict.fromkeys(existing_tags + new_tags))
            photo.auto_tags = json.dumps(merged)
            updated_fields.append("auto_tags")

    if xmp_data.get("latitude") is not None:
        photo.latitude = xmp_data["latitude"]
        updated_fields.append("latitude")
    if xmp_data.get("longitude") is not None:
        photo.longitude = xmp_data["longitude"]
        updated_fields.append("longitude")

    if xmp_data.get("city"):
        photo.city = xmp_data["city"]
        updated_fields.append("city")
    if xmp_data.get("state"):
        photo.state = xmp_data["state"]
        updated_fields.append("state")
    if xmp_data.get("country"):
        photo.country = xmp_data["country"]
        updated_fields.append("country")

    if updated_fields:
        await db.commit()

    return {
        "updated_fields": updated_fields,
        "face_regions_found": len(xmp_data.get("face_regions", [])),
        "photo_id": photo_id,
    }


@router.get("/check/{photo_id}")
async def check_xmp_sidecar(
    photo_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Check if an XMP sidecar exists for a photo and return its path."""
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    from app.services.xmp_service import _get_sidecar_path
    sidecar_path = _get_sidecar_path(photo.path)

    return {
        "exists": os.path.exists(sidecar_path),
        "path": sidecar_path,
        "photo_id": photo_id,
    }
