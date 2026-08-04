from fastapi import APIRouter, Depends, HTTPException
from app.config import settings
from app.api.nle import projects, clips, preview, export, video_proxy

async def verify_video_editor_enabled():
    if not settings.ENABLE_VIDEO_EDITOR_AI:
        raise HTTPException(status_code=400, detail="Video Editor is disabled in settings.")

router = APIRouter(prefix="/nle", tags=["nle"], dependencies=[Depends(verify_video_editor_enabled)])
router.include_router(projects.router)
router.include_router(clips.router)
router.include_router(preview.router)
router.include_router(export.router)
router.include_router(video_proxy.router)
