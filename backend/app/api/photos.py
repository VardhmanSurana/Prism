"""Photos API - re-export module for backward compatibility.

This module combines all photo-related endpoints from the modular structure.
New code should import directly from app.api.photos submodules.
"""

from fastapi import APIRouter

# Import all sub-routers
from app.api.photos.directory import router as directory_router
from app.api.photos.listing import router as listing_router
from app.api.photos.upload import router as upload_router
from app.api.photos.metadata import router as metadata_router
from app.api.photos.lock import router as lock_router
from app.api.photos.favorite import router as favorite_router

# Re-export schemas for backward compatibility
from app.api.photos.schemas import UploadRequest

# Create main router that includes all sub-routers
router = APIRouter()

# Include all sub-routers
router.include_router(directory_router)
router.include_router(listing_router)
router.include_router(upload_router)
router.include_router(metadata_router)
router.include_router(lock_router)
router.include_router(favorite_router)

__all__ = [
    "router",
    "UploadRequest",
]
