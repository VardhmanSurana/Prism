from datetime import datetime, timezone
from app.models import Photo

def safe_int(val):
    if val is None: return 0
    if isinstance(val, int): return val
    if isinstance(val, bytes):
        try:
            return int.from_bytes(val, 'little')
        except Exception: return 0
    try:
        return int(val)
    except Exception: return 0

def photo_to_dict(photo: Photo, include: set[str] | None = None) -> dict:
    """Serialize a Photo model to dict. If include is set, only return those keys."""
    location_parts = [p for p in [photo.city, photo.state, photo.country] if p]
    photo_date = (photo.date_taken or photo.date or datetime.now(timezone.utc)).isoformat()

    result = {
        "id": photo.id,
        "filename": photo.filename,
        "path": photo.path,
        "url": photo.url,
        "width": photo.width,
        "height": photo.height,
        "aspect_ratio": photo.aspect_ratio,
        "caption": photo.caption,
        "auto_tags": photo.auto_tags,
        "ai_summary": photo.ai_summary,
        "location": ", ".join(location_parts) if location_parts else photo.location,
        "city": photo.city,
        "state": photo.state,
        "country": photo.country,
        "date": photo_date,
        "date_taken": photo_date,
        "upload_date": photo.upload_date.isoformat(),
        "is_favorite": photo.is_favorite,
        "is_locked": photo.is_locked,
        "is_trash": photo.is_trash,
        "mime_type": photo.mime_type,
        "file_type": photo.file_type,
        "file_size": photo.file_size,
        "blur_score": photo.blur_score,
        "hash": photo.hash,
        "device_id": photo.device_id,
        "is_external": photo.is_external,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
    }

    if include:
        return {k: v for k, v in result.items() if k in include}
    return result
