"""NLE Preview endpoints — render frames and segments from timeline."""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel
from typing import Any
from pathlib import Path

from app.services.nle_preview import nle_preview
from app.utils.rate_limit import rate_limit

import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter()


class PreviewFrameRequest(BaseModel):
    timeline: dict[str, Any]
    time: float = 0.0
    width: int = 640
    height: int = 360
    use_cache: bool = True


class PreviewSegmentRequest(BaseModel):
    timeline: dict[str, Any]
    start: float = 0.0
    duration: float = 3.0
    width: int = 640
    height: int = 360


@router.post("/preview/frame")
async def render_preview_frame(req: PreviewFrameRequest, request: Request):
    """Render a single preview frame at the given timeline position."""
    rate_limit(request)

    missing = []
    for track in req.timeline.get("tracks", []):
        for clip in track.get("clips", []):
            source_path = clip.get("sourcePath", "")
            if source_path and not Path(source_path).exists():
                missing.append(source_path)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} source file(s) not found. Please check your media files.",
        )

    frame_bytes = await nle_preview.generate_frame(
        project_json=req.timeline,
        time=req.time,
        width=req.width,
        height=req.height,
        use_cache=req.use_cache,
    )

    if not frame_bytes:
        return {"error": "Failed to render frame"}

    from fastapi.responses import Response
    return Response(content=frame_bytes, media_type="image/jpeg")


@router.post("/preview/segment")
async def render_preview_segment(req: PreviewSegmentRequest, request: Request):
    """Render a short preview segment as a temp MP4."""
    rate_limit(request)

    missing = []
    for track in req.timeline.get("tracks", []):
        for clip in track.get("clips", []):
            source_path = clip.get("sourcePath", "")
            if source_path and not Path(source_path).exists():
                missing.append(source_path)
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing)} source file(s) not found. Please check your media files.",
        )

    segment_path = await nle_preview.generate_segment(
        project_json=req.timeline,
        start=req.start,
        duration=req.duration,
        width=req.width,
        height=req.height,
    )

    if not segment_path:
        return {"error": "Failed to render segment"}

    def _cleanup_temp(path: str) -> None:
        """Delete the temp MP4 after the response has been sent."""
        try:
            os.unlink(path)
        except OSError as exc:
            logger.debug(f"Failed to clean up preview temp {path}: {exc}")

    return FileResponse(
        str(segment_path),
        media_type="video/mp4",
        background=BackgroundTask(_cleanup_temp, str(segment_path)),
    )
