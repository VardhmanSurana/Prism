from fastapi import APIRouter
from app.api.nle import projects, clips, preview, export, video_proxy

router = APIRouter(prefix="/nle", tags=["nle"])
router.include_router(projects.router)
router.include_router(clips.router)
router.include_router(preview.router)
router.include_router(export.router)
router.include_router(video_proxy.router)
