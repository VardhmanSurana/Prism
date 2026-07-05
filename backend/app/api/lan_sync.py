"""LAN Sync API endpoints."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.lan_sync import lan_sync_service

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request/Response Models ──

class PairRequest(BaseModel):
    pin: Optional[str] = None


class PairIncomingRequest(BaseModel):
    peer_id: str
    hostname: str
    pin: str = ""
    device_type: str = "desktop"


class ImportRequest(BaseModel):
    photo_ids: Optional[list[int]] = None


# ── Peer Discovery ──

@router.get("/discover")
async def discover_peers():
    """List all discovered Prism peers on the LAN."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")
    peers = await lan_sync_service.discover_peers()
    return {"peers": peers, "local_peer_id": lan_sync_service._peers.get("_local", {}).get("peer_id", "")}


# ── Pairing ──

@router.post("/peers/{peer_id}/pair")
async def pair_with_peer(peer_id: str, request: PairRequest):
    """Pair with a discovered Prism peer."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    result = await lan_sync_service.pair_with_peer(peer_id, pin=request.pin)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/pair/request")
async def handle_pair_request(request: PairIncomingRequest):
    """Handle an incoming pairing request from another Prism instance."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    accepted = await lan_sync_service.handle_pair_request(
        peer_id=request.peer_id,
        hostname=request.hostname,
        pin=request.pin,
        device_type=request.device_type,
    )
    return {"accepted": accepted}


# ── Sync ──

@router.post("/peers/{peer_id}/sync")
async def initiate_sync(peer_id: str):
    """Initiate a full metadata sync with a paired peer."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    result = await lan_sync_service.initiate_sync(peer_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/sync/status")
async def sync_status():
    """Get current sync progress."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")
    return lan_sync_service.sync_state.to_dict()


# ── Import ──

@router.post("/peers/{peer_id}/import")
async def import_from_peer(peer_id: str, request: ImportRequest):
    """Import photos from a paired peer. If photo_ids is empty, imports all new photos."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    result = await lan_sync_service.import_from_peer(peer_id, photo_ids=request.photo_ids)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Server-side endpoints (serving data to peers) ──

@router.get("/manifest")
async def get_manifest():
    """Return a lightweight manifest of photos available for sync (served to peers)."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")
    return await lan_sync_service.get_manifest()


@router.get("/photos/{photo_id}/metadata")
async def get_photo_metadata(photo_id: int):
    """Return full metadata for a photo (served to peers)."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    metadata = await lan_sync_service.get_photo_metadata(photo_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Photo not found or locked")
    return metadata


from fastapi.responses import FileResponse
from app.services.lan_sync import LOCAL_PEER_ID


@router.get("/photos/{photo_id}/file")
async def get_photo_file(photo_id: int):
    """Serve a photo file to a peer (chunked via HTTP)."""
    if not settings.ENABLE_LAN_SYNC:
        raise HTTPException(status_code=503, detail="LAN sync is disabled")

    file_path = await lan_sync_service.get_photo_file_path(photo_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Photo not found or locked")

    return FileResponse(str(file_path))
