"""Photos API module."""

from .schemas import UploadRequest
from .directory import router as directory_router
from .listing import router as listing_router
from .upload import router as upload_router
from .metadata import router as metadata_router
from .lock import router as lock_router
from .favorite import router as favorite_router
from .trash import router as trash_router
from .ocr import router as ocr_router

__all__ = [
    "UploadRequest",
    "directory_router",
    "listing_router",
    "upload_router",
    "metadata_router",
    "lock_router",
    "favorite_router",
    "trash_router",
    "ocr_router",
]
