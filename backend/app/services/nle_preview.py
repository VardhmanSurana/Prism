"""
NLE Preview — Generate preview frames and short segments from MLT timelines.

Uses melt CLI to render frames at proxy resolution for real-time preview.
"""

import asyncio
import hashlib
import logging
import os
import shutil
from pathlib import Path

from app.config import settings
from app.services.nle_engine import project_to_mlt_xml

logger = logging.getLogger(__name__)

# Path to melt binary — system-installed on Fedora
MELT_BIN = shutil.which("melt-7") or shutil.which("melt") or "/usr/bin/melt-7"


class NLEPreviewService:
    """Generate preview frames and segments for the NLE timeline."""

    def __init__(self) -> None:
        self._cache_dir = settings.DATA_DIR / "nle_cache"
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Cache helpers
    # ------------------------------------------------------------------

    def _cache_key(self, project_id: int, time: float, width: int, height: int,
                   effects_hash: str = "") -> str:
        raw = f"{project_id}:{time:.3f}:{width}x{height}:{effects_hash}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _cache_path(self, key: str) -> Path:
        return self._cache_dir / f"{key}.jpg"

    def _get_cached_frame(self, project_id: int, time: float,
                          width: int, height: int,
                          effects_hash: str = "") -> bytes | None:
        key = self._cache_key(project_id, time, width, height, effects_hash)
        path = self._cache_path(key)
        if path.exists():
            return path.read_bytes()
        return None

    def _cache_frame(self, project_id: int, time: float,
                     width: int, height: int,
                     frame_bytes: bytes,
                     effects_hash: str = "") -> None:
        key = self._cache_key(project_id, time, width, height, effects_hash)
        path = self._cache_path(key)
        path.write_bytes(frame_bytes)

    # ------------------------------------------------------------------
    # Single frame extraction
    # ------------------------------------------------------------------

    async def generate_frame(self, project_json: dict, time: float,
                             width: int = 640, height: int = 360,
                             use_cache: bool = True) -> bytes:
        """Render a single frame at the given timeline position.

        Returns JPEG bytes of the rendered frame.
        """
        project_id = project_json.get("id", 0)
        effects_hash = hashlib.md5(
            str(project_json.get("tracks", [])).encode()
        ).hexdigest()[:8]

        # Check cache
        if use_cache:
            cached = self._get_cached_frame(project_id, time, width, height, effects_hash)
            if cached:
                return cached

        # Build MLT XML
        xml_str = project_to_mlt_xml(project_json)

        # Write temp MLT file
        mlt_path = self._cache_dir / f"preview_{project_id}_{int(time * 1000)}.mlt"
        mlt_path.write_text(xml_str, encoding="utf-8")

        # Build melt command: render single frame as JPEG
        # Use consumer to pipe a single frame
        jpg_path = self._cache_dir / f"frame_{project_id}_{int(time * 1000)}.jpg"

        cmd = [
            MELT_BIN,
            str(mlt_path),
            "-consumer", f"avformat:{jpg_path}",
            f"profile={width}x{height}",
            "frame_padding=0",
            "-progress",
        ]

        from app.services.processing_queue import processing_queue
        processing_queue._throttler.increment_video_ops()
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=30.0
            )

            if jpg_path.exists():
                frame_bytes = jpg_path.read_bytes()
                self._cache_frame(project_id, time, width, height, frame_bytes, effects_hash)
                jpg_path.unlink(missing_ok=True)
                mlt_path.unlink(missing_ok=True)
                return frame_bytes

            logger.warning(f"Melt frame render failed: {stderr.decode()[-300:]}")
        except asyncio.TimeoutError:
            logger.error("Melt frame render timed out")
        except FileNotFoundError:
            logger.error(f"Melt binary not found at {MELT_BIN}")
        finally:
            processing_queue._throttler.decrement_video_ops()
            mlt_path.unlink(missing_ok=True)

        return b""

    # ------------------------------------------------------------------
    # Short segment preview
    # ------------------------------------------------------------------

    async def generate_segment(self, project_json: dict,
                                start: float, duration: float = 3.0,
                                width: int = 640, height: int = 360) -> Path | None:
        """Render a short preview segment as a temp MP4 file.

        Returns the path to the rendered segment, or None on failure.
        """
        project_id = project_json.get("id", 0)

        # Build MLT XML
        xml_str = project_to_mlt_xml(project_json)

        mlt_path = self._cache_dir / f"segment_{project_id}_{int(start * 1000)}.mlt"
        mlt_path.write_text(xml_str, encoding="utf-8")

        output_path = self._cache_dir / f"segment_{project_id}_{int(start * 1000)}.mp4"

        cmd = [
            MELT_BIN,
            str(mlt_path),
            "-consumer", f"avformat:{output_path}",
            f"profile={width}x{height}",
            "vcodec=libx264",
            "acodec=aac",
            "-progress",
        ]

        from app.services.processing_queue import processing_queue
        processing_queue._throttler.increment_video_ops()
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=60.0
            )

            if output_path.exists():
                mlt_path.unlink(missing_ok=True)
                return output_path

            logger.warning(f"Melt segment render failed: {stderr.decode()[-300:]}")
        except asyncio.TimeoutError:
            logger.error("Melt segment render timed out")
        except FileNotFoundError:
            logger.error(f"Melt binary not found at {MELT_BIN}")
        finally:
            processing_queue._throttler.decrement_video_ops()
            mlt_path.unlink(missing_ok=True)

        return None

    # ------------------------------------------------------------------
    # Waveform extraction
    # ------------------------------------------------------------------

    async def extract_waveform(self, source_path: str,
                                num_points: int = 2000) -> list[float]:
        """Extract audio waveform peaks for visualization.

        Returns a list of normalized peak values (0.0 to 1.0).
        """
        from app.utils.video import validate_source_path
        try:
            source_path = str(validate_source_path(source_path))
        except ValueError as e:
            logger.error(f"Waveform source path validation failed: {e}")
            return []

        cmd = [
            "ffmpeg", "-i", source_path,
            "-ac", "1",
            "-filter:a", f"aresample=8000,asetnsamples=n={num_points}",
            "-f", "f32le", "-",
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=30.0
            )

            import struct
            if len(stdout) < 4:
                return []

            num_samples = len(stdout) // 4
            samples = struct.unpack(f"<{num_samples}f", stdout[:num_samples * 4])

            max_val = max(abs(s) for s in samples) if samples else 1.0
            if max_val == 0:
                max_val = 1.0

            return [abs(s) / max_val for s in samples]

        except Exception as e:
            logger.error(f"Waveform extraction failed: {e}")
            return []

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def cleanup_cache(self, max_size_mb: int = 500) -> None:
        """Remove old cached files if cache exceeds max size."""
        total_size = sum(f.stat().st_size for f in self._cache_dir.iterdir() if f.is_file())
        max_bytes = max_size_mb * 1024 * 1024

        if total_size <= max_bytes:
            return

        # Sort by modification time, remove oldest first
        files = sorted(
            self._cache_dir.iterdir(),
            key=lambda f: f.stat().st_mtime if f.is_file() else float("inf"),
        )
        for f in files:
            if f.is_file():
                file_size = f.stat().st_size
                f.unlink(missing_ok=True)
                total_size -= file_size
                if total_size <= max_bytes * 0.8:
                    break


# Singleton
nle_preview = NLEPreviewService()
