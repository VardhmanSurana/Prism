from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
from .helpers import _read_settings, _write_settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class GeneralSettingsRequest(BaseModel):
    # Image background
    ENABLE_IMAGE_BG_PROCESS: bool
    ENABLE_AI_CLIP: bool
    ENABLE_AI_FACE: bool
    ENABLE_AI_CAPTION: bool
    ENABLE_AI_OCR: bool

    # Video background
    ENABLE_VIDEO_BG_PROCESS: bool
    ENABLE_VIDEO_FACE: bool
    ENABLE_AI_SUBTITLES: bool

    # Features
    ENABLE_AI_AGENT: bool
    ENABLE_AI_INPAINTING: bool
    ENABLE_VIDEO_EDITOR_AI: bool

    # GPU
    GPU_MODE: str  # "cuda" | "rocm" | "sycl" | "vulkan" | "cpu"


@router.get("/general")
async def get_general_settings():
    return {
        "ENABLE_IMAGE_BG_PROCESS": settings.ENABLE_IMAGE_BG_PROCESS,
        "ENABLE_AI_CLIP": settings.ENABLE_AI_CLIP,
        "ENABLE_AI_FACE": settings.ENABLE_AI_FACE,
        "ENABLE_AI_CAPTION": settings.ENABLE_AI_CAPTION,
        "ENABLE_AI_OCR": settings.ENABLE_AI_OCR,

        "ENABLE_VIDEO_BG_PROCESS": settings.ENABLE_VIDEO_BG_PROCESS,
        "ENABLE_VIDEO_FACE": settings.ENABLE_VIDEO_FACE,
        "ENABLE_AI_SUBTITLES": settings.ENABLE_AI_SUBTITLES,

        "ENABLE_AI_AGENT": settings.ENABLE_AI_AGENT,
        "ENABLE_AI_INPAINTING": settings.ENABLE_AI_INPAINTING,
        "ENABLE_VIDEO_EDITOR_AI": settings.ENABLE_VIDEO_EDITOR_AI,

        "GPU_MODE": settings.GPU_MODE,
    }


@router.post("/general")
async def update_general_settings(req: GeneralSettingsRequest):
    # Update settings in-memory
    settings.ENABLE_IMAGE_BG_PROCESS = req.ENABLE_IMAGE_BG_PROCESS
    settings.ENABLE_AI_CLIP = req.ENABLE_AI_CLIP
    settings.ENABLE_AI_FACE = req.ENABLE_AI_FACE
    settings.ENABLE_AI_CAPTION = req.ENABLE_AI_CAPTION
    settings.ENABLE_AI_OCR = req.ENABLE_AI_OCR

    settings.ENABLE_VIDEO_BG_PROCESS = req.ENABLE_VIDEO_BG_PROCESS
    settings.ENABLE_VIDEO_FACE = req.ENABLE_VIDEO_FACE
    settings.ENABLE_AI_SUBTITLES = req.ENABLE_AI_SUBTITLES

    settings.ENABLE_AI_AGENT = req.ENABLE_AI_AGENT
    settings.ENABLE_AI_INPAINTING = req.ENABLE_AI_INPAINTING
    settings.ENABLE_VIDEO_EDITOR_AI = req.ENABLE_VIDEO_EDITOR_AI

    settings.GPU_MODE = req.GPU_MODE

    # Persist to settings.json
    config = _read_settings()
    config["ENABLE_IMAGE_BG_PROCESS"] = req.ENABLE_IMAGE_BG_PROCESS
    config["ENABLE_AI_CLIP"] = req.ENABLE_AI_CLIP
    config["ENABLE_AI_FACE"] = req.ENABLE_AI_FACE
    config["ENABLE_AI_CAPTION"] = req.ENABLE_AI_CAPTION
    config["ENABLE_AI_OCR"] = req.ENABLE_AI_OCR

    config["ENABLE_VIDEO_BG_PROCESS"] = req.ENABLE_VIDEO_BG_PROCESS
    config["ENABLE_VIDEO_FACE"] = req.ENABLE_VIDEO_FACE
    config["ENABLE_AI_SUBTITLES"] = req.ENABLE_AI_SUBTITLES

    config["ENABLE_AI_AGENT"] = req.ENABLE_AI_AGENT
    config["ENABLE_AI_INPAINTING"] = req.ENABLE_AI_INPAINTING
    config["ENABLE_VIDEO_EDITOR_AI"] = req.ENABLE_VIDEO_EDITOR_AI

    config["GPU_MODE"] = req.GPU_MODE
    _write_settings(config)

    logger.info("General settings updated dynamically.")
    return {"status": "success"}
