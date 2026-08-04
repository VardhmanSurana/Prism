"""Map style settings endpoints."""
from fastapi import APIRouter

from .helpers import _read_settings, _patch_settings
from .schemas import MapStyleRequest

router = APIRouter()


@router.get("/map-style")
async def get_map_style():
    settings_data = _read_settings()
    return {"map_style": settings_data.get("map_style", "dark")}


@router.post("/map-style")
async def update_map_style(req: MapStyleRequest):
    _patch_settings("map_style", req.map_style)
    return {"status": "success", "map_style": req.map_style}
