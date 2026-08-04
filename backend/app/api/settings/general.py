from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
from .helpers import _read_settings, _write_settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_settings():
    """GET /api/v1/settings — Return backend configuration info.

    Mirrors the Rust backend's ``settings::get_settings`` endpoint.
    """
    return {
        "port": 8269,
        "upload_dir": str(settings.UPLOAD_DIR),
        "thumbnails_dir": str(settings.THUMBNAILS_DIR),
        "python_ml_url": "http://127.0.0.1:8270",
        "backend": "python-fastapi",
    }


# ── Telemetry settings ──────────────────────────────────────────────────────

TELEMETRY_DEFAULTS = {
    "enabled": True,
    "sample_rate": 10,
    "response_logging": False,
}


def _read_telemetry() -> dict:
    stored = _read_settings().get("telemetry", {})
    return {**TELEMETRY_DEFAULTS, **{k: stored[k] for k in TELEMETRY_DEFAULTS if k in stored}}


@router.get("/telemetry")
async def get_telemetry_settings():
    """GET /api/v1/settings/telemetry — current telemetry config."""
    return _read_telemetry()


@router.post("/telemetry")
async def save_telemetry_settings(payload: dict):
    """POST /api/v1/settings/telemetry — update telemetry config at runtime.

    Accepts any subset of `enabled`, `sample_rate` (clamped 0..=1000),
    and `response_logging`. Persisted to settings.json.
    """
    telemetry = _read_telemetry()

    if "enabled" in payload:
        telemetry["enabled"] = bool(payload["enabled"])
    if "sample_rate" in payload:
        telemetry["sample_rate"] = max(0, min(int(payload["sample_rate"]), 1000))
    if "response_logging" in payload:
        telemetry["response_logging"] = bool(payload["response_logging"])

    config = _read_settings()
    config["telemetry"] = telemetry
    _write_settings(config)

    logger.info("Telemetry settings updated dynamically.")
    return {"status": "success", **telemetry}

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
