"""NLE Export endpoints — full-resolution render via MLT."""

import asyncio
import logging
import os
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.config import settings
from app.utils.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory job tracking (same pattern as video_export.py)
_export_jobs: dict[str, dict] = {}

MAX_CONCURRENT_EXPORTS = 3
_active_exports = 0
_EXPORT_TTL_SECONDS = 3600


class NLEExportRequest(BaseModel):
    project_json: dict[str, Any]
    resolution: tuple[int, int] = (1920, 1080)
    fps: int = 30
    format: str = "mp4"
    quality: str = "high"
    output_mode: str = "new"  # "new" or "overwrite"
    overwrite_path: Optional[str] = None


def _cleanup_old_exports():
    """Delete NLE export files older than 1 hour."""
    now = time.time()
    export_dir = settings.UPLOAD_DIR / "nle_exports"
    if not export_dir.exists():
        return
    for f in export_dir.iterdir():
        if f.is_file():
            try:
                age = now - f.stat().st_mtime
                if age > _EXPORT_TTL_SECONDS:
                    f.unlink()
                    logger.info(f"Cleaned up old NLE export: {f.name} (age {age:.0f}s)")
            except OSError as e:
                logger.warning(f"Failed to delete {f}: {e}")


@router.post("/export")
async def start_nle_export(req: NLEExportRequest, request: Request):
    """Start a full-resolution export job."""
    rate_limit(request)
    _cleanup_old_exports()

    if _active_exports >= MAX_CONCURRENT_EXPORTS:
        raise HTTPException(status_code=429, detail="Too many concurrent exports. Try again later.")

    # Validate project has at least one clip
    from app.services.nle_engine import Timeline
    timeline = Timeline(req.project_json)
    has_clips = any(t.clips for t in timeline.tracks)
    if not has_clips:
        raise HTTPException(status_code=400, detail="Cannot export: timeline has no clips")

    # Bulk validate all clip source files exist before starting render
    from pathlib import Path

    missing_files = []
    for track in req.project_json.get("tracks", []):
        for clip in track.get("clips", []):
            source_path = clip.get("sourcePath", "")
            if source_path and not Path(source_path).exists():
                missing_files.append(source_path)

    if missing_files:
        raise HTTPException(
            status_code=400,
            detail=f"{len(missing_files)} source file(s) not found. Please check your media files.",
        )

    # Validate all sourcePath entries in project_json before rendering
    from app.utils.video import validate_source_path

    def _validate_source_paths(obj):
        if isinstance(obj, dict):
            if "sourcePath" in obj:
                validated = validate_source_path(obj["sourcePath"])
                obj["sourcePath"] = str(validated)
            for v in obj.values():
                _validate_source_paths(v)
        elif isinstance(obj, list):
            for item in obj:
                _validate_source_paths(item)

    try:
        _validate_source_paths(req.project_json)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    job_id = str(uuid.uuid4())[:8]
    output_dir = settings.UPLOAD_DIR / "nle_exports"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = str(output_dir / f"{job_id}.mp4")

    _active_exports += 1
    _export_jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "output_path": output_path,
    }

    asyncio.create_task(_render_export(job_id, req, output_path))
    return {"job_id": job_id, "status": "processing"}


@router.post("/export/xml")
async def get_nle_export_xml(req: NLEExportRequest, request: Request):
    """Generate and return the MLT XML for the project JSON."""
    rate_limit(request)
    from app.services.nle_engine import project_to_mlt_xml
    try:
        xml_str = project_to_mlt_xml(req.project_json)
        return {"xml": xml_str}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/export/{job_id}")
async def get_export_status(job_id: str):
    """Poll export job status."""
    job = _export_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/export/{job_id}/download")
async def download_export(job_id: str):
    """Download completed export."""
    job = _export_jobs.get(job_id)
    if not job or job["status"] != "completed":
        raise HTTPException(status_code=404, detail="Export not ready")
    return FileResponse(job["output_path"], media_type="video/mp4",
                        filename=f"prism_export_{job_id}.mp4")


async def _render_export(job_id: str, req: NLEExportRequest, output_path: str):
    """Render the NLE project to a full-res MP4 via melt."""
    import shutil
    from app.services.nle_engine import project_to_mlt_xml, Timeline

    melt_bin = shutil.which("melt-7") or shutil.which("melt") or "/usr/bin/melt-7"

    # Build MLT XML
    xml_str = project_to_mlt_xml(req.project_json)

    # Determine video codec: use NVENC if GPU encoding is enabled and available
    from app.config import settings
    vcodec = "libx264"
    if settings.ENABLE_GPU_ENCODING:
        from app.routes.media import _select_gpu_mode, _probe_nvenc, _probe_scale_cuda, _probe_vaapi
        gpu_mode = _select_gpu_mode()
        use_nvenc = False
        use_vaapi = False

        if gpu_mode in ("auto", "nvenc"):
            use_nvenc = await _probe_nvenc()
        if gpu_mode in ("auto", "vaapi"):
            use_vaapi = await _probe_vaapi()

        use_full_gpu = use_nvenc and await _probe_scale_cuda()

        if use_full_gpu:
            vcodec = "h264_nvenc"
            logger.info("[GPU] NLE export: Using h264_nvenc (full GPU)")
        elif use_nvenc:
            vcodec = "h264_nvenc"
            logger.info("[GPU] NLE export: Using h264_nvenc (partial GPU)")
        elif use_vaapi:
            vcodec = "h264_vaapi"
            logger.info("[GPU] NLE export: Using h264_vaapi (VA-API)")
        else:
            logger.info("[CPU] NLE export: Using libx264 (CPU)")

    # Estimate total duration for progress calculation
    timeline = Timeline(req.project_json)
    estimated_total_secs = timeline.duration / max(req.fps / 30.0, 1.0)
    # Add 30% buffer so progress doesn't stall near 100%
    estimated_total_secs *= 1.3

    # Write temp MLT file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mlt", mode="w", delete=False) as f:
        f.write(xml_str)
        mlt_path = f.name

    start_time = time.time()

    try:
        cmd = [
            melt_bin,
            mlt_path,
            "-consumer", f"avformat:{output_path}",
            f"profile={req.resolution[0]}x{req.resolution[1]}",
            f"vcodec={vcodec}",
            "acodec=aac",
            "-progress",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Read stdout line-by-line to parse melt progress output.
        # melt -progress emits lines like "current=150" and "duration=9000".
        current_frame = 0
        total_frames = 0

        async def _read_progress():
            nonlocal current_frame, total_frames
            assert process.stdout is not None
            while True:
                line = await process.stdout.readline()
                if not line:
                    break
                decoded = line.decode("utf-8", errors="replace").strip()
                if decoded.startswith("current="):
                    try:
                        current_frame = int(decoded.split("=", 1)[1])
                    except (ValueError, IndexError):
                        pass
                elif decoded.startswith("duration="):
                    try:
                        total_frames = int(decoded.split("=", 1)[1])
                    except (ValueError, IndexError):
                        pass

                # Update progress using frame counts or time-based fallback
                if total_frames > 0:
                    progress = min(current_frame / total_frames, 0.99)
                else:
                    elapsed = time.time() - start_time
                    progress = min(elapsed / estimated_total_secs, 0.99) if estimated_total_secs > 0 else 0.0
                _export_jobs[job_id]["progress"] = round(progress, 4)

        # Run progress reader concurrently with process completion
        progress_task = asyncio.create_task(_read_progress())

        # Wait for process to finish (with timeout)
        try:
            _, stderr = await asyncio.wait_for(
                process.communicate(), timeout=600.0  # 10 min timeout
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            _export_jobs[job_id]["status"] = "failed"
            _export_jobs[job_id]["error"] = "Export timed out"
            logger.error(f"NLE export {job_id} timed out")
            return
        finally:
            # Ensure progress reader finishes
            await progress_task

        if process.returncode == 0:
            _export_jobs[job_id]["status"] = "completed"
            _export_jobs[job_id]["progress"] = 1.0
            logger.info(f"NLE export {job_id} completed: {output_path}")
        else:
            _export_jobs[job_id]["status"] = "failed"
            _export_jobs[job_id]["error"] = stderr.decode()[-500:] if stderr else "Unknown error"
            logger.error(f"NLE export {job_id} failed: {(stderr.decode()[-200:] if stderr else 'no stderr')}")
    except Exception as e:
        _export_jobs[job_id]["status"] = "failed"
        _export_jobs[job_id]["error"] = str(e)
        logger.error(f"NLE export {job_id} error: {e}")
    finally:
        global _active_exports
        _active_exports = max(0, _active_exports - 1)
        import os
        os.unlink(mlt_path)
