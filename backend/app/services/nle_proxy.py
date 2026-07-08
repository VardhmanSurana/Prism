"""
NLE Proxy — Generate low-res proxy files for timeline preview.

Proxies are used during editing for smooth scrubbing. Export re-links
to full-resolution source files.
"""

import asyncio
import logging
import shutil
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

# Proxy settings
PROXY_WIDTH = 640
PROXY_HEIGHT = 360
PROXY_CRF = 28  # lower quality for speed


class NLEProxyService:
    """Generate and manage proxy files for NLE editing."""

    def __init__(self) -> None:
        self._proxy_dir = settings.DATA_DIR / "nle_proxies"
        self._proxy_dir.mkdir(parents=True, exist_ok=True)

    def _proxy_path(self, source_path: str) -> Path:
        """Generate a proxy file path from the source path."""
        import hashlib
        source_hash = hashlib.md5(source_path.encode()).hexdigest()[:12]
        ext = Path(source_path).suffix
        return self._proxy_dir / f"proxy_{source_hash}{ext}"

    async def get_or_create_proxy(self, source_path: str) -> Path | None:
        """Get an existing proxy or create one if needed.

        Returns the path to the proxy file, or None on failure.
        """
        from app.utils.video import validate_source_path
        try:
            source_path = str(validate_source_path(source_path))
        except ValueError as e:
            logger.error(f"Proxy source path validation failed: {e}")
            return None

        proxy_path = self._proxy_path(source_path)

        if proxy_path.exists():
            return proxy_path

        return await self._generate_proxy(source_path, proxy_path)

    async def _generate_proxy(self, source_path: str, proxy_path: Path) -> Path | None:
        """Generate a low-res proxy using ffmpeg."""
        if not Path(source_path).exists():
            logger.error(f"Source file not found: {source_path}")
            return None

        cmd = [
            "ffmpeg", "-y",
            "-i", source_path,
            "-vf", f"scale={PROXY_WIDTH}:{PROXY_HEIGHT}:force_original_aspect_ratio=decrease,pad={PROXY_WIDTH}:{PROXY_HEIGHT}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", str(PROXY_CRF),
            "-c:a", "aac",
            "-b:a", "64k",
            "-movflags", "+faststart",
            str(proxy_path),
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=120.0
            )

            if proxy_path.exists():
                logger.info(f"Proxy created: {proxy_path}")
                return proxy_path

            logger.warning(f"Proxy generation failed: {stderr.decode()[-300:]}")
        except asyncio.TimeoutError:
            logger.error(f"Proxy generation timed out for {source_path}")
            proxy_path.unlink(missing_ok=True)
        except FileNotFoundError:
            logger.error("ffmpeg not found")
        except Exception as e:
            logger.error(f"Proxy generation error: {e}")
            proxy_path.unlink(missing_ok=True)

        return None

    async def generate_thumbnail_strip(self, source_path: str,
                                        num_thumbnails: int = 20,
                                        width: int = 160,
                                        start_time: float | None = None,
                                        duration: float | None = None) -> list[bytes]:
        """Extract N evenly-spaced thumbnails from a video for timeline filmstrip.

        Args:
            start_time: Start time in seconds (None = beginning of video).
            duration: Duration in seconds (None = full video duration).

        Returns a list of JPEG thumbnail bytes.
        """
        from app.utils.video import validate_source_path
        try:
            source_path = str(validate_source_path(source_path))
        except ValueError as e:
            logger.error(f"Thumbnail strip source path validation failed: {e}")
            return []

        # Get video duration if not provided
        if duration is None:
            duration = await self._get_duration(source_path)
        if duration <= 0:
            return []

        effective_start = start_time or 0.0
        thumbnails: list[bytes] = []
        interval = duration / (num_thumbnails + 1)

        for i in range(num_thumbnails):
            seek_time = effective_start + interval * (i + 1)
            thumb_bytes = await self._extract_frame(source_path, seek_time, width)
            if thumb_bytes:
                thumbnails.append(thumb_bytes)

        return thumbnails

    async def _get_duration(self, source_path: str) -> float:
        """Get video duration in seconds via ffprobe."""
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            source_path,
        ]

        try:
            import json
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(
                process.communicate(), timeout=10.0
            )
            data = json.loads(stdout)
            return float(data.get("format", {}).get("duration", 0))
        except Exception:
            return 0.0

    async def _extract_frame(self, source_path: str, seek_time: float,
                              width: int = 160) -> bytes | None:
        """Extract a single JPEG frame at the given timestamp."""
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(seek_time),
            "-i", source_path,
            "-vframes", "1",
            "-vf", f"scale={width}:-1",
            "-q:v", "5",
            tmp_path,
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(process.communicate(), timeout=10.0)

            path = Path(tmp_path)
            if path.exists():
                data = path.read_bytes()
                path.unlink()
                return data
        except Exception:
            Path(tmp_path).unlink(missing_ok=True)

        return None

    def cleanup(self) -> None:
        """Remove all proxy files."""
        import shutil as _shutil
        if self._proxy_dir.exists():
            _shutil.rmtree(self._proxy_dir)
            self._proxy_dir.mkdir(parents=True, exist_ok=True)


# Singleton
nle_proxy = NLEProxyService()
