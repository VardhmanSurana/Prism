import logging
import asyncio
import time
import uuid
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

MAX_CONCURRENT_EXPORTS = 3
_active_exports = 0
_EXPORT_TTL_SECONDS = 3600


def escape_ffmpeg_text(text: str) -> str:
    """Escape a string for safe use in ffmpeg drawtext filter text= values."""
    text = text.replace("\\", "\\\\\\\\")
    text = text.replace("'", "\\\\'")
    text = text.replace(":", "\\:")
    text = text.replace("[", "\\[")
    text = text.replace("]", "\\]")
    text = text.replace(";", "\\;")
    text = text.replace("\n", " ")
    return text

_jobs: dict[str, dict] = {}


def _cleanup_old_exports():
    """Delete export files older than 1 hour."""
    now = time.time()
    for export_dir_name in ("exports", "nle_exports"):
        export_dir = settings.UPLOAD_DIR / export_dir_name
        if not export_dir.exists():
            continue
        for f in export_dir.iterdir():
            if f.is_file():
                try:
                    age = now - f.stat().st_mtime
                    if age > _EXPORT_TTL_SECONDS:
                        f.unlink()
                        logger.info(f"Cleaned up old export: {f.name} (age {age:.0f}s)")
                except OSError as e:
                    logger.warning(f"Failed to delete {f}: {e}")


class VideoExporter:
    async def start_export(self, req) -> str:
        global _active_exports
        _cleanup_old_exports()
        if _active_exports >= MAX_CONCURRENT_EXPORTS:
            raise RuntimeError("too_many_exports")

        job_id = str(uuid.uuid4())[:8]
        output_dir = settings.UPLOAD_DIR / "exports"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / f"{job_id}.mp4")

        _active_exports += 1
        _jobs[job_id] = {
            "status": "processing",
            "progress": 0,
            "output_path": output_path,
        }

        asyncio.create_task(self._render(job_id, req, output_path))
        return job_id

    def get_status(self, job_id: str) -> dict | None:
        return _jobs.get(job_id)

    async def _render(self, job_id: str, req, output_path: str):
        from app.services.processing_queue import processing_queue
        processing_queue._throttler.increment_video_ops()
        try:
            # Validate all source paths before building command
            from app.utils.video import validate_source_path
            try:
                for track in req.tracks:
                    for clip in track.clips:
                        validated = validate_source_path(clip.source_path)
                        clip.source_path = str(validated)
            except ValueError as e:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = str(e)
                logger.error(f"Export {job_id} path validation failed: {e}")
                return

            # Probe GPU availability (async, cached after first call)
            from app.routes.media import _select_gpu_mode, _probe_nvenc, _probe_scale_cuda, _probe_vaapi
            gpu_mode = _select_gpu_mode()
            use_nvenc = False
            use_vaapi = False

            if gpu_mode in ("auto", "nvenc"):
                use_nvenc = await _probe_nvenc()
            if gpu_mode in ("auto", "vaapi"):
                use_vaapi = await _probe_vaapi()

            use_full_gpu = use_nvenc and await _probe_scale_cuda()

            cmd = self._build_ffmpeg_command(req, output_path, gpu_mode, use_nvenc, use_full_gpu, use_vaapi)
            logger.info(f"Export {job_id}: {' '.join(cmd[:10])}...")

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                _jobs[job_id]["status"] = "completed"
                _jobs[job_id]["progress"] = 1.0
                logger.info(f"Export {job_id} completed: {output_path}")
            else:
                _jobs[job_id]["status"] = "failed"
                _jobs[job_id]["error"] = stderr.decode()[-500:]
                logger.error(f"Export {job_id} failed: {stderr.decode()[-200:]}")
        except Exception as e:
            _jobs[job_id]["status"] = "failed"
            _jobs[job_id]["error"] = str(e)
            logger.error(f"Export {job_id} error: {e}")
        finally:
            processing_queue._throttler.decrement_video_ops()
            _active_exports = max(0, _active_exports - 1)

    def _build_ffmpeg_command(
        self, req, output_path: str,
        gpu_mode: str = "cpu",
        use_nvenc: bool = False,
        use_full_gpu: bool = False,
        use_vaapi: bool = False,
    ) -> list[str]:
        cmd = [settings.FFMPEG_PATH or "ffmpeg", "-y"]
        filter_parts = []

        video_tracks = [t for t in req.tracks if t.type == "video"]
        audio_tracks = [t for t in req.tracks if t.type == "audio"]
        text_tracks = [t for t in req.tracks if t.type in ("text", "subtitle")]

        input_idx = 0
        video_inputs = []
        audio_inputs = []

        for track in video_tracks:
            for clip in track.clips:
                cmd.extend(["-i", clip.source_path])
                filters = []
                if clip.trim_start > 0 or clip.trim_end > 0:
                    end = clip.duration - clip.trim_end
                    filters.append(f"trim=start={clip.trim_start}:end={end}")
                    filters.append("setpts=PTS-STARTPTS")
                if clip.speed != 1.0:
                    filters.append(f"setpts=PTS/{clip.speed}")
                if filters:
                    filter_parts.append(f"[{input_idx}:v]{','.join(filters)}[v{input_idx}]")
                    video_inputs.append(f"[v{input_idx}]")
                else:
                    video_inputs.append(f"[{input_idx}:v]")
                input_idx += 1

        for track in audio_tracks:
            for clip in track.clips:
                cmd.extend(["-i", clip.source_path])
                filters = []
                if clip.trim_start > 0 or clip.trim_end > 0:
                    end = clip.duration - clip.trim_end
                    filters.append(f"atrim=start={clip.trim_start}:end={end}")
                    filters.append("asetpts=PTS-STARTPTS")
                if clip.speed != 1.0:
                    filters.append(f"atempo={clip.speed}")
                if not track.muted and track.volume != 1.0:
                    filters.append(f"volume={clip.volume}")
                if filters:
                    filter_parts.append(f"[{input_idx}:a]{','.join(filters)}[a{input_idx}]")
                    audio_inputs.append(f"[a{input_idx}]")
                else:
                    audio_inputs.append(f"[{input_idx}:a]")
                input_idx += 1

        if len(video_inputs) > 1:
            concat_inputs = "".join(video_inputs)
            filter_parts.append(f"{concat_inputs}concat=n={len(video_inputs)}:v=1:a=0[outv]")
            final_video = "[outv]"
        elif video_inputs:
            final_video = video_inputs[0]
        else:
            final_video = None

        if final_video and text_tracks:
            overlay_chain = final_video
            for track in text_tracks:
                for overlay in track.text_overlays:
                    text_escaped = escape_ffmpeg_text(overlay.text)
                    x = f"(w*{overlay.x}/100)"
                    y = f"(h*{overlay.y}/100)"
                    drawtext = (
                        f"drawtext=text='{text_escaped}'"
                        f":fontsize={overlay.font_size}"
                        f":fontcolor={overlay.font_color}"
                        f":x={x}:y={y}"
                        f":enable='between(t,{overlay.start},{overlay.end})'"
                    )
                    filter_parts.append(f"{overlay_chain},{drawtext}[textout]")
                    overlay_chain = "[textout]"
            final_video = overlay_chain

        if len(audio_inputs) > 1:
            mix_inputs = "".join(audio_inputs)
            filter_parts.append(f"{mix_inputs}amix=inputs={len(audio_inputs)}:duration=longest[outa]")
            final_audio = "[outa]"
        elif audio_inputs:
            final_audio = audio_inputs[0]
        else:
            final_audio = None

        if filter_parts:
            cmd.extend(["-filter_complex", ";".join(filter_parts)])

        if final_video:
            cmd.extend(["-map", final_video])
        if final_audio:
            cmd.extend(["-map", final_audio])

        # GPU-aware encoder selection
        if use_full_gpu:
            logger.info("[GPU] Export: Using h264_nvenc (full GPU pipeline)")
            cmd.extend([
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-rc", "vbr",
                "-cq", "23",
                "-b:v", "0",
                "-pix_fmt", "yuv420p",
                "-profile:v", "high",
                "-c:a", "aac",
                "-ac", "2",
                "-b:a", "192k",
                "-movflags", "+faststart",
                output_path,
            ])
        elif use_nvenc:
            logger.info("[GPU] Export: Using h264_nvenc (partial GPU)")
            cmd.extend([
                "-c:v", "h264_nvenc",
                "-preset", "p4",
                "-rc", "vbr",
                "-cq", "23",
                "-b:v", "0",
                "-pix_fmt", "yuv420p",
                "-profile:v", "high",
                "-c:a", "aac",
                "-ac", "2",
                "-b:a", "192k",
                "-movflags", "+faststart",
                output_path,
            ])
        elif use_vaapi:
            logger.info("[GPU] Export: Using h264_vaapi (VA-API)")
            cmd.extend([
                "-vaapi_device", "/dev/dri/renderD128",
                "-vf", "format=nv12,hwupload",
                "-c:v", "h264_vaapi",
                "-qp", "23",
                "-pix_fmt", "yuv420p",
                "-profile:v", "high",
                "-c:a", "aac",
                "-ac", "2",
                "-b:a", "192k",
                "-movflags", "+faststart",
                output_path,
            ])
        else:
            logger.info("[CPU] Export: Using libx264 (CPU)")
            cmd.extend([
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-ac", "2",
                "-b:a", "192k",
                "-movflags", "+faststart",
                output_path,
            ])

        return cmd
