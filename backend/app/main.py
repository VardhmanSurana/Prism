from pathlib import Path
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
import urllib.parse
from app.utils.security import safe_resolve_read

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.db import engine, init_db
from app.models import Base
from app.api import photos, settings as settings_api, albums as albums_api, agent as agent_api, summaries as summaries_api, people as people_api, utilities as utilities_api
from app.api.photos import inpaint as inpaint_api
from app.services.sync_service import sync_service
import contextlib
import os
import logging

logger = logging.getLogger(__name__)
from loguru import logger as llogger

class LogAccessFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "/thumbnails/" in msg or "/uploads/" in msg:
            return False
        return True

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(LogAccessFilter())

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Main app starting up...")
    # Initialize DB — setup WAL mode and create tables
    from app.db import init_db
    await init_db()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Dynamic migration for blur_score and file_size columns
        from sqlalchemy import text
        res = await conn.execute(text("PRAGMA table_info(photos)"))
        columns = [row[1] for row in res.fetchall()]
        if "blur_score" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN blur_score FLOAT"))
        if "file_size" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN file_size INTEGER"))
        if "auto_tags" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN auto_tags TEXT"))
        if "embedding" not in columns:
            await conn.execute(text("ALTER TABLE photos ADD COLUMN embedding TEXT"))

        # Create index on blur_score
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_photos_blur_score ON photos (blur_score)"))

        # Setup FTS5 Full Text Search Table and Triggers
        await conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5(
                photo_id UNINDEXED,
                filename,
                caption,
                location,
                city,
                country,
                ai_summary,
                auto_tags
            )
        """))

        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_insert AFTER INSERT ON photos
            BEGIN
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags)
                VALUES (new.id, new.filename, new.caption, new.location, new.city, new.country, new.ai_summary, new.auto_tags);
            END;
        """))

        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_delete AFTER DELETE ON photos
            BEGIN
                DELETE FROM photos_fts WHERE photo_id = old.id;
            END;
        """))

        await conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS after_photo_update AFTER UPDATE ON photos
            BEGIN
                UPDATE photos_fts SET
                    filename = new.filename,
                    caption = new.caption,
                    location = new.location,
                    city = new.city,
                    country = new.country,
                    ai_summary = new.ai_summary,
                    auto_tags = new.auto_tags
                WHERE photo_id = old.id;
            END;
        """))

        # Check and populate FTS5 table if it's empty
        res_fts = await conn.execute(text("SELECT COUNT(*) FROM photos_fts"))
        if res_fts.scalar() == 0:
            logger.info("FTS5 table is empty. Populating from existing photos table...")
            await conn.execute(text("""
                INSERT INTO photos_fts(photo_id, filename, caption, location, city, country, ai_summary, auto_tags)
                SELECT id, filename, caption, location, city, country, ai_summary, auto_tags FROM photos
            """))

    # Initialize Sync Service
    await sync_service.initialize()

    # Recover any interrupted file encryption/decryption operations
    from app.services.locked_service import locked_service
    try:
        locked_service.recover_interrupted_files()
    except Exception as e:
        logger.error(f"Failed to recover interrupted files: {e}")

    logger.info(f"Prism Backend ready (PID: {os.getpid()})")

    yield

    # Cleanup services
    await sync_service.shutdown()
    try:
        from app.services.processing_queue import processing_queue
        await processing_queue.shutdown()
    except Exception:
        pass
    try:
        from app.services import face_service
        face_service.shutdown()
    except Exception:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Set all CORS enabled origins strictly to secure Tauri client boundaries
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:3005",  # Tauri frontend dev URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local files directly
@app.get("/local")
async def serve_local_file(path: str):
    decoded_path = urllib.parse.unquote(path)
    llogger.debug(f"[/local] Requested path: {decoded_path!r}")

    # Validate path is within allowed directories safely
    # Raises HTTP 403 if outside allowed roots — log before raising for diagnostics
    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException as e:
        from app.utils.security import get_allowed_read_roots
        allowed = [str(r) for r in get_allowed_read_roots()]
        llogger.warning(
            f"[/local] DENIED path={decoded_path!r} | status={e.status_code} | "
            f"reason={e.detail!r} | allowed_roots={allowed}"
        )
        raise

    llogger.debug(f"[/local] Resolved to: {resolved_path}")

    if not resolved_path.exists():
        llogger.warning(f"[/local] File not found on disk: {resolved_path}")
        raise HTTPException(status_code=404, detail="File not found")

    from app.services.locked_service import locked_service
    is_encrypted = await locked_service.is_file_encrypted(str(resolved_path))
    if is_encrypted:
        if not locked_service.is_authenticated:
            llogger.warning(f"[/local] Encrypted file requested but Locked Folder not authenticated: {resolved_path}")
            raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")

        decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
        if decrypted_data is None:
            llogger.error(f"[/local] Decryption failed for: {resolved_path}")
            raise HTTPException(status_code=500, detail="Failed to decrypt file")

        import mimetypes
        mime_type, _ = mimetypes.guess_type(str(resolved_path))
        if not mime_type:
            mime_type = "image/jpeg"
        llogger.debug(f"[/local] Serving decrypted file ({mime_type}): {resolved_path}")
        return Response(content=decrypted_data, media_type=mime_type)

    llogger.debug(f"[/local] Serving file: {resolved_path}")
    return FileResponse(str(resolved_path))


# Serve thumbnail dynamically with authentication check if locked
@app.get("/api/v1/photos/{photo_id}/thumbnail")
async def serve_photo_thumbnail(photo_id: int):
    from app.db import async_session
    from app.models import Photo
    async with async_session() as db:
        photo = await db.get(Photo, photo_id)
        
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    if photo.is_locked:
        from app.services.locked_service import locked_service
        if not locked_service.is_authenticated:
            raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")
            
        file_hash = photo.hash
        if not file_hash:
            resolved_path = safe_resolve_read(photo.path)
            decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
            if decrypted_data is None:
                raise HTTPException(status_code=500, detail="Failed to decrypt file")
            
            import io
            from PIL import Image
            img = Image.open(io.BytesIO(decrypted_data))
            img.thumbnail((400, 400))
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
        
        import io
        from PIL import Image
        img = Image.open(io.BytesIO(decrypted_data))
        img.thumbnail((400, 400))
        out_bytes = io.BytesIO()
        img.save(out_bytes, format="WEBP", quality=80)
        
        thumb_data = out_bytes.getvalue()
        await locked_service.encrypt_and_save_thumbnail(thumb_data, str(enc_thumb_path))
        
        return Response(content=thumb_data, media_type="image/webp")
        
    else:
        if photo.url and photo.url.startswith("/thumbnails/"):
            thumb_name = photo.url.split("/thumbnails/")[-1]
            thumb_path = settings.THUMBNAILS_DIR / thumb_name
            if thumb_path.exists():
                return FileResponse(str(thumb_path))
                
        resolved_path = safe_resolve_read(photo.path)
        if not resolved_path.exists():
            raise HTTPException(status_code=404, detail="Original photo file not found")
        return FileResponse(str(resolved_path))


# Mount uploads directory to serve static files
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=str(settings.THUMBNAILS_DIR)), name="thumbnails")

# Include Routers - Photos API
logger.debug(f"Adding metadata router: {photos.metadata_router.routes}")
app.include_router(photos.listing_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.directory_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.upload_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.metadata_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.lock_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.favorite_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.trash_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(inpaint_api.router, tags=["inpaint"])
app.include_router(settings_api.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"])
app.include_router(albums_api.router, prefix=f"{settings.API_V1_STR}/albums", tags=["albums"])
app.include_router(agent_api.router, prefix=f"{settings.API_V1_STR}/agent", tags=["agent"])
app.include_router(summaries_api.router, prefix=f"{settings.API_V1_STR}/summaries", tags=["summaries"])
app.include_router(people_api.router, prefix=f"{settings.API_V1_STR}/people", tags=["people"])
app.include_router(utilities_api.router, prefix=f"{settings.API_V1_STR}/utilities", tags=["utilities"])


@app.get("/")
async def root():
    return {"message": "Welcome to Prism Photos API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
