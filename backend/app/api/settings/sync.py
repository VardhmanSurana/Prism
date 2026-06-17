"""Sync configuration endpoints."""
from fastapi import APIRouter
from pydantic import BaseModel
from pathlib import Path

from app.services.sync_service import sync_service
from app.utils.security import safe_resolve_write
from .helpers import _read_settings, _write_settings
from .schemas import SyncConfig

router = APIRouter()


class FoldersConfigRequest(BaseModel):
    watched_folders: list[str]
    excluded_folders: list[str]


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


@router.get("/folders")
async def get_folders():
    config = _read_settings()
    watched = config.get("watched_folders")
    if watched is None:
        watched = [str(Path.home() / "Pictures")]
    excluded = config.get("excluded_folders") or []
    return {"watched_folders": watched, "excluded_folders": excluded}


@router.post("/folders")
async def update_folders(req: FoldersConfigRequest):
    config = _read_settings()
    
    validated_watched = []
    for f in req.watched_folders:
        try:
            resolved = safe_resolve_write(f)
            validated_watched.append(str(resolved))
        except Exception:
            pass
            
    validated_excluded = []
    for f in req.excluded_folders:
        try:
            resolved = safe_resolve_write(f)
            validated_excluded.append(str(resolved))
        except Exception:
            pass

    config["watched_folders"] = validated_watched
    config["excluded_folders"] = validated_excluded
    _write_settings(config)
    
    sync_service.excluded_folders = set(validated_excluded)
    
    return {"status": "success", "watched_folders": validated_watched, "excluded_folders": validated_excluded}
