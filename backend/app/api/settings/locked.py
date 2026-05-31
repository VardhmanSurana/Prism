"""Locked folder settings endpoints."""
from fastapi import APIRouter

from .schemas import LockedSetupRequest

router = APIRouter()


@router.get("/locked-folder/status")
async def get_locked_folder_status():
    from app.services.locked_service import locked_service
    return {
        "is_configured": locked_service.is_password_set(),
        "is_authenticated": locked_service.is_authenticated
    }


@router.post("/locked-folder/setup")
async def setup_locked_folder(req: LockedSetupRequest):
    from app.services.locked_service import locked_service
    success = await locked_service.setup_password(req.password)
    return {"success": success}


@router.post("/locked-folder/verify")
async def verify_locked_folder(req: LockedSetupRequest):
    from app.services.locked_service import locked_service
    success = await locked_service.verify_password(req.password)
    return {"success": success}


@router.post("/locked-folder/lock-session")
async def lock_locked_folder_session():
    from app.services.locked_service import locked_service
    locked_service.lock_session()
    return {"success": True}
