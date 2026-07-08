import io
import logging
from fastapi import HTTPException, Request
from fastapi.responses import Response, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.db import async_session
from app.models import Photo
from app.middleware.cors import get_cors_headers
from app.services.locked_service import locked_service
from app.utils.security import safe_resolve_read
from app.utils.image import open_raw_image

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


async def serve_photo_thumbnail(request: Request, photo_id: int, size: int = 400):
    async with async_session() as db:
        photo = await db.get(Photo, photo_id)

    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    size = min(max(size, 32), 4096)

    try:
        if photo.is_locked:
            if not locked_service.is_authenticated:
                raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")

            file_hash = photo.hash
            if not file_hash:
                resolved_path = safe_resolve_read(photo.path)
                decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
                if decrypted_data is None:
                    raise HTTPException(status_code=500, detail="Failed to decrypt file")

                img = Image.open(io.BytesIO(decrypted_data))
                img.thumbnail((size, size))
                out_bytes = io.BytesIO()
                img.save(out_bytes, format="WEBP", quality=80)
                return Response(content=out_bytes.getvalue(), media_type="image/webp")

            if size != 400:
                resolved_path = safe_resolve_read(photo.path)
                decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
                if decrypted_data is None:
                    raise HTTPException(status_code=500, detail="Failed to decrypt file")

                img = Image.open(io.BytesIO(decrypted_data))
                img.thumbnail((size, size))
                out_bytes = io.BytesIO()
                img.save(out_bytes, format="WEBP", quality=80)
                return Response(content=out_bytes.getvalue(), media_type="image/webp")

            enc_thumb_path = settings.THUMBNAILS_DIR / f"{file_hash}.webp.enc"
            if enc_thumb_path.exists():
                decrypted_thumb = await locked_service.decrypt_encrypted_thumbnail(str(enc_thumb_path))
                if decrypted_thumb:
                    return Response(content=decrypted_thumb, media_type="image/webp")

            resolved_path = safe_resolve_read(photo.path)
            decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
            if decrypted_data is None:
                raise HTTPException(status_code=500, detail="Failed to decrypt file")

            img = Image.open(io.BytesIO(decrypted_data))
            img.thumbnail((size, size))
            out_bytes = io.BytesIO()
            img.save(out_bytes, format="WEBP", quality=80)

            thumb_data = out_bytes.getvalue()
            await locked_service.encrypt_and_save_thumbnail(thumb_data, str(enc_thumb_path))

            return Response(content=thumb_data, media_type="image/webp")

        else:
            is_video = photo.file_type == "video"
            if is_video:
                if photo.url and photo.url.startswith("/thumbnails/"):
                    thumb_name = photo.url.split("/thumbnails/")[-1]
                    thumb_path = settings.THUMBNAILS_DIR / thumb_name
                    if thumb_path.exists():
                        return FileResponse(str(thumb_path), headers={"Accept-Ranges": "bytes"})

            is_heic = photo.path.lower().endswith(".heic") or photo.filename.lower().endswith(".heic")
            is_raw = photo.path.lower().endswith(
                (
                    ".dng",
                    ".cr2",
                    ".cr3",
                    ".nef",
                    ".arw",
                    ".orf",
                    ".raf",
                    ".rw2",
                    ".pef",
                    ".srw",
                )
            ) or photo.filename.lower().endswith(
                (
                    ".dng",
                    ".cr2",
                    ".cr3",
                    ".nef",
                    ".arw",
                    ".orf",
                    ".raf",
                    ".rw2",
                    ".pef",
                    ".srw",
                )
            )
            if size != 400 or is_heic or is_raw:
                resolved_path = safe_resolve_read(photo.path)
                if not resolved_path.exists():
                    raise HTTPException(status_code=404, detail="Original photo file not found")

                if not is_heic and not is_raw and size == 400 and photo.url and photo.url.startswith("/thumbnails/"):
                    thumb_name = photo.url.split("/thumbnails/")[-1]
                    thumb_path = settings.THUMBNAILS_DIR / thumb_name
                    if thumb_path.exists():
                        return FileResponse(str(thumb_path))

                if is_raw:
                    img = open_raw_image(str(resolved_path))
                    if img is None:
                        raise HTTPException(status_code=500, detail="Failed to process RAW file")
                else:
                    img = Image.open(str(resolved_path))

                with img:
                    img = ImageOps.exif_transpose(img)
                    img.thumbnail((size, size))
                    out_bytes = io.BytesIO()
                    img.save(out_bytes, format="WEBP", quality=85)
                    return Response(content=out_bytes.getvalue(), media_type="image/webp")

            if photo.url and photo.url.startswith("/thumbnails/"):
                thumb_name = photo.url.split("/thumbnails/")[-1]
                thumb_path = settings.THUMBNAILS_DIR / thumb_name
                if thumb_path.exists():
                    return FileResponse(str(thumb_path), headers={"Accept-Ranges": "bytes"})

            resolved_path = safe_resolve_read(photo.path)
            if not resolved_path.exists():
                raise HTTPException(status_code=404, detail="Original photo file not found")

            file_size = resolved_path.stat().st_size
            cors = get_cors_headers(request) if request else {}

            mime_type = photo.mime_type or "video/mp4"
            return FileResponse(
                str(resolved_path),
                media_type=mime_type,
                headers={"Accept-Ranges": "bytes", **cors},
            )
    except OSError as e:
        raise HTTPException(status_code=404, detail="Original file not found or unreadable due to system error")
