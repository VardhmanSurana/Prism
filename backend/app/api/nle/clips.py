"""NLE Clip analysis, waveform, and thumbnail endpoints."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import VideoClip, Photo
from app.utils.rate_limit import rate_limit

router = APIRouter()


class ClipAnalyzeRequest(BaseModel):
    photo_id: Optional[int] = None
    source_path: str
    speed: Optional[float] = None
    in_point: Optional[float] = None
    out_point: Optional[float] = None


@router.post("/clips/analyze")
async def analyze_clip(req: ClipAnalyzeRequest, db: AsyncSession = Depends(get_db), request: Request = None):
    """Analyze a source video file: probe metadata, check for existing clip record."""
    if request:
        rate_limit(request)
    import subprocess
    import json as _json

    # Validate source path before any subprocess use
    from app.utils.video import validate_source_path
    try:
        validated_path = validate_source_path(req.source_path)
        req.source_path = str(validated_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check if we already have this clip
    if req.photo_id:
        result = await db.execute(
            select(VideoClip).where(VideoClip.photo_id == req.photo_id)
        )
        existing = result.first()
        if existing:
            # Deduplicate: keep first row, delete any other rows for same photo_id
            existing_clip = existing[0]
            await db.execute(
                delete(VideoClip).where(
                    VideoClip.photo_id == req.photo_id,
                    VideoClip.id != existing_clip.id,
                )
            )
            await db.commit()

            proxy_path = None
            try:
                from app.services.nle_proxy import nle_proxy
                proxy = await nle_proxy.get_or_create_proxy(existing_clip.source_path)
                if proxy:
                    proxy_path = str(proxy)
            except Exception:
                pass

            return {
                "clip_id": existing_clip.id,
                "photo_id": existing_clip.photo_id,
                "source_path": existing_clip.source_path,
                "duration": existing_clip.duration,
                "width": existing_clip.width,
                "height": existing_clip.height,
                "fps": existing_clip.fps,
                "codec": existing_clip.codec,
                "has_audio": existing_clip.has_audio,
                "proxy_status": existing_clip.proxy_status,
                "proxy_path": proxy_path,
            }

    # Probe the file with ffprobe
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json",
             "-show_format", "-show_streams", req.source_path],
            capture_output=True, text=True, timeout=15,
        )
        info = _json.loads(proc.stdout)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to probe file: {e}")

    format_info = info.get("format", {})
    streams = info.get("streams", [])

    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    if not video_stream:
        raise HTTPException(status_code=400, detail="No video stream found")

    duration = float(format_info.get("duration", 0))
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))

    # Parse FPS from r_frame_rate (e.g., "30/1" or "30000/1001")
    fps = None
    rfr = video_stream.get("r_frame_rate", "0/1")
    if "/" in rfr:
        num, den = rfr.split("/")
        if int(den) > 0:
            fps = round(int(num) / int(den), 2)
    else:
        fps = float(rfr)

    codec = video_stream.get("codec_name")
    has_audio = audio_stream is not None

    # Create clip record
    clip = VideoClip(
        photo_id=req.photo_id,
        source_path=req.source_path,
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        codec=codec,
        has_audio=has_audio,
    )
    db.add(clip)
    await db.commit()
    await db.refresh(clip)

    # Generate proxy in background (non-blocking)
    proxy_path = None
    try:
        from app.services.nle_proxy import nle_proxy
        proxy = await nle_proxy.get_or_create_proxy(req.source_path)
        if proxy:
            proxy_path = str(proxy)
            clip.proxy_status = "ready"
            await db.commit()
    except Exception:
        pass

    return {
        "clip_id": clip.id,
        "photo_id": clip.photo_id,
        "source_path": clip.source_path,
        "proxy_path": proxy_path,
        "duration": clip.duration,
        "width": clip.width,
        "height": clip.height,
        "fps": clip.fps,
        "codec": clip.codec,
        "has_audio": clip.has_audio,
        "proxy_status": clip.proxy_status,
    }


@router.post("/clips/waveform")
async def get_waveform(req: ClipAnalyzeRequest, db: AsyncSession = Depends(get_db), request: Request = None):
    """Extract audio waveform peaks for visualization."""
    if request:
        rate_limit(request)
    from app.services.nle_preview import nle_preview

    # Validate source path
    from app.utils.video import validate_source_path
    try:
        validated_path = validate_source_path(req.source_path)
        req.source_path = str(validated_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Check existing clip
    clip = None
    if req.photo_id:
        result = await db.execute(
            select(VideoClip).where(VideoClip.photo_id == req.photo_id)
        )
        row = result.first()
        if row:
            clip = row[0]
            await db.execute(
                delete(VideoClip).where(
                    VideoClip.photo_id == req.photo_id,
                    VideoClip.id != clip.id,
                )
            )
            await db.commit()

    # Check cached waveform
    if clip and clip.audio_waveform_json:
        try:
            return {"peaks": json.loads(clip.audio_waveform_json)}
        except json.JSONDecodeError:
            pass

    # Extract waveform
    peaks = await nle_preview.extract_waveform(req.source_path, num_points=2000)

    # Cache in DB
    if clip:
        clip.audio_waveform_json = json.dumps(peaks)
        await db.commit()

    return {"peaks": peaks}


class ThumbnailStripRequest(BaseModel):
    source_path: str
    num_thumbnails: int = 20
    width: int = 160
    speed: float = 1.0
    in_point: float = 0.0
    out_point: float = 0.0


@router.post("/clips/thumbnail-strip")
async def get_thumbnail_strip(req: ThumbnailStripRequest):
    """Extract N evenly-spaced thumbnails from a video for timeline filmstrip."""
    from app.services.nle_proxy import nle_proxy

    # Validate source path
    from app.utils.video import validate_source_path
    try:
        validated_path = validate_source_path(req.source_path)
        req.source_path = str(validated_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Calculate effective duration for the trimmed/speed-adjusted portion
    if req.out_point > req.in_point:
        effective_duration = (req.out_point - req.in_point) / max(req.speed, 0.01)
    else:
        effective_duration = None  # Use full video duration

    thumbnails = await nle_proxy.generate_thumbnail_strip(
        req.source_path,
        num_thumbnails=req.num_thumbnails,
        width=req.width,
        start_time=req.in_point if req.out_point > req.in_point else None,
        duration=effective_duration,
    )

    import base64
    return {
        "thumbnails": [
            base64.b64encode(t).decode() for t in thumbnails
        ]
    }
