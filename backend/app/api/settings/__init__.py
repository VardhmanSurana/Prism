"""Settings API — Sync config, cache management, library reset.

All user-facing settings are persisted in `settings.json` (not the database),
so they survive a library reset.
"""
from fastapi import APIRouter

from . import sync, maintenance, map, locked, events, general

router = APIRouter()

# Include all sub-routers
router.include_router(sync.router)
router.include_router(maintenance.router)
router.include_router(map.router)
router.include_router(locked.router)
router.include_router(events.router)
router.include_router(general.router)

# Re-export schemas for external use
from .schemas import SyncConfig, PurgeFolderRequest, MapStyleRequest, LockedSetupRequest
from .helpers import _read_settings, _write_settings, _patch_settings

__all__ = [
    "router",
    "SyncConfig",
    "PurgeFolderRequest",
    "MapStyleRequest",
    "LockedSetupRequest",
    "_read_settings",
    "_write_settings",
    "_patch_settings",
]
