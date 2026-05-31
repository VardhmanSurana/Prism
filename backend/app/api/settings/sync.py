"""Sync configuration endpoints."""
from fastapi import APIRouter

from app.services.sync_service import sync_service
from .helpers import _read_settings
from .schemas import SyncConfig

router = APIRouter()


@router.get("/sync")
async def get_sync_config():
    cfg = _read_settings().get("sync_config", {"is_enabled": False, "excluded_folders": []})
    return {
        "is_enabled": cfg.get("is_enabled", sync_service.is_running),
        "excluded_folders": cfg.get("excluded_folders", sync_service.excluded_folders),
    }


@router.post("/sync")
async def update_sync_config(config: SyncConfig):
    await sync_service.update_config(config.is_enabled, config.excluded_folders)
    return {"status": "updated"}


@router.get("/status")
async def get_sync_status():
    return sync_service.get_status()
