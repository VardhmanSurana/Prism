from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional


class ExportTextOverlay(BaseModel):
    text: str
    start: float
    end: float
    x: float = 50
    y: float = 50
    font_size: int = 24
    font_color: str = "white"
    font_family: str = "Arial"


class ExportClip(BaseModel):
    source_path: str
    start_time: float
    duration: float
    trim_start: float = 0
    trim_end: float = 0
    speed: float = 1.0
    effects: list[dict] = []


class ExportTrack(BaseModel):
    type: str
    clips: list[ExportClip]
    text_overlays: list[ExportTextOverlay] = []
    volume: float = 1.0
    muted: bool = False


class ExportRequest(BaseModel):
    tracks: list[ExportTrack]
    resolution: tuple[int, int] = (1920, 1080)
    fps: int = 30
    format: str = "mp4"


router = APIRouter()


@router.post("/export")
async def start_export(req: ExportRequest):
    from app.services.video_export import VideoExporter
    exporter = VideoExporter()
    job_id = await exporter.start_export(req)
    return {"job_id": job_id, "status": "processing"}


@router.get("/export/{job_id}")
async def get_export_status(job_id: str):
    from app.services.video_export import VideoExporter
    exporter = VideoExporter()
    status = exporter.get_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status


@router.get("/export/{job_id}/download")
async def download_export(job_id: str):
    from app.services.video_export import VideoExporter
    from fastapi.responses import FileResponse
    exporter = VideoExporter()
    status = exporter.get_status(job_id)
    if not status or status["status"] != "completed":
        raise HTTPException(status_code=404, detail="Export not ready")
    return FileResponse(status["output_path"], media_type="video/mp4")
