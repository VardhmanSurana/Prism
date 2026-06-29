import logging
import asyncio
import uuid

from app.config import settings

logger = logging.getLogger(__name__)

_jobs: dict[str, dict] = {}


class VideoExporter:
    async def start_export(self, req) -> str:
        job_id = str(uuid.uuid4())[:8]
        output_dir = settings.UPLOAD_DIR / "exports"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = str(output_dir / f"{job_id}.mp4")

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
        try:
            cmd = self._build_ffmpeg_command(req, output_path)
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

    def _build_ffmpeg_command(self, req, output_path: str) -> list[str]:
        cmd = ["ffmpeg", "-y"]
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
                    filters.append(f"volume={track.volume}")
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
                    text_escaped = overlay.text.replace("'", "\\\\'").replace(":", "\\:")
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

        cmd.extend([
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            output_path,
        ])

        return cmd
