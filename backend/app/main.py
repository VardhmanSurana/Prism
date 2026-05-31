from pathlib import Path
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
import urllib.parse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.db import engine, init_db
from app.models import Base
from app.api import photos, settings as settings_api, albums as albums_api, agent as agent_api, summaries as summaries_api, people as people_api, utilities as utilities_api
from app.services.sync_service import sync_service
import contextlib
import os
import logging

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

    # Initialize Sync Service
    await sync_service.initialize()
    print(f"\n[BACKEND] Prism Backend ready (PID: {os.getpid()})")

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

def _is_path_allowed(file_path: str) -> bool:
    """
    Validate that the requested path is within allowed directories.
    Prevents path traversal attacks like ../../../etc/passwd
    """
    try:
        resolved_path = Path(file_path).resolve()
        allowed_roots = [
            settings.UPLOAD_DIR.resolve(),
            settings.THUMBNAILS_DIR.resolve(),
            (Path.home() / "Pictures").resolve(),
        ]
        # Include common posix external media mounts safely
        if os.name == 'posix':
            for mount in ["/media", "/Volumes", "/mnt"]:
                if os.path.exists(mount):
                    allowed_roots.append(Path(mount).resolve())
                    
        return any(resolved_path.is_relative_to(root) for root in allowed_roots)
    except (ValueError, OSError):
        return False


# Serve local files directly
@app.get("/local")
async def serve_local_file(path: str):
    decoded_path = urllib.parse.unquote(path)
    
    # Validate path is within allowed directories
    if not _is_path_allowed(decoded_path):
        raise HTTPException(status_code=403, detail="Access denied: path outside allowed directories")
    
    if not os.path.exists(decoded_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    from app.services.locked_service import locked_service
    is_encrypted = await locked_service.is_file_encrypted(decoded_path)
    if is_encrypted:
        if not locked_service.is_authenticated:
            raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")
            
        decrypted_data = await locked_service.decrypt_file_data(decoded_path)
        if decrypted_data is None:
            raise HTTPException(status_code=500, detail="Failed to decrypt file")
            
        import mimetypes
        mime_type, _ = mimetypes.guess_type(decoded_path)
        if not mime_type:
            mime_type = "image/jpeg"
        return Response(content=decrypted_data, media_type=mime_type)
        
    return FileResponse(decoded_path)

# Mount uploads directory to serve static files
app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=str(settings.THUMBNAILS_DIR)), name="thumbnails")

# Include Routers - Photos API
app.include_router(photos.listing_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.directory_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.upload_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.metadata_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.lock_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
app.include_router(photos.favorite_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"])
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
