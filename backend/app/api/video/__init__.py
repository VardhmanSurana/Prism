from fastapi import APIRouter
from app.api.video import export, subtitles

router = APIRouter(prefix="/video", tags=["video"])
router.include_router(export.router)
router.include_router(subtitles.router)
