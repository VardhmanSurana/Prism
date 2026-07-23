import asyncio
import hashlib
import logging
import mimetypes
import os
import subprocess
import time
import urllib.parse
from pathlib import Path
from typing import AsyncGenerator

from fastapi import HTTPException, Request
from fastapi.responses import Response
from loguru import logger as llogger
from starlette.responses import FileResponse, StreamingResponse

from app.config import settings
from app.middleware.cors import get_cors_headers
from app.services.locked_service import locked_service
from app.utils.security import safe_resolve_read
from app.utils.image import open_raw_image

import io

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except Exception:
    pass

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

TRANSCODE_CACHE_DIR = settings.DATA_DIR / "transcode_cache"
TRANSCODE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_transcode_in_progress: dict[str, asyncio.Event] = {}
_transcode_locks: dict[str, asyncio.Lock] = {}

HEVC_CODECS = {"hevc", "h265", "hev1", "hvc1"}
FULL_RANGE_CODECS = {"h264", "avc", "avc1"}
UNSUPPORTED_CODECS = {
    "vp9", "vp09", "av1", "av01", "mpeg2video", "mpeg4",
    "divx", "xvid", "wmv3", "wmv", "vc1", "theora",
}
HDR_COLOR_SPACES = {"bt2020nc", "bt2020c", "smpte2084", "arib-std-b67"}

# ─── GPU capability cache ─────────────────────────────────────────────────────
_nvenc_available: bool | None = None
_scale_cuda_available: bool | None = None


async def _probe_nvenc() -> bool:
    global _nvenc_available
    if _nvenc_available is not None:
        return _nvenc_available

    llogger.info("[GPU] Probing NVENC availability…")
    try:
        proc = await asyncio.create_subprocess_exec(
            settings.FFMPEG_PATH or "ffmpeg",
            "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=black:s=192x192:d=0.1:r=1",
            "-c:v", "h264_nvenc",
            "-f", "null", "-",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)
        ok = proc.returncode == 0
        if ok:
            llogger.info("[GPU] NVENC probe: h264_nvenc is available ✓")
        else:
            llogger.warning(
                f"[GPU] NVENC probe: h264_nvenc unavailable (rc={proc.returncode}) — "
                f"stderr: {stderr.decode(errors='replace').strip()[:300]}"
            )
        _nvenc_available = ok
        return ok
    except asyncio.TimeoutError:
        llogger.warning("[GPU] NVENC probe timed out — falling back to CPU")
        _nvenc_available = False
        return False
    except FileNotFoundError:
        llogger.error("[GPU] ffmpeg binary not found on PATH")
        _nvenc_available = False
        return False
    except Exception as exc:
        llogger.warning(f"[GPU] NVENC probe error: {exc} — falling back to CPU")
        _nvenc_available = False
        return False


async def _probe_scale_cuda() -> bool:
    """
    Test whether the scale_cuda filter is available in this ffmpeg build.
    Result is cached for the process lifetime, same as _probe_nvenc().
    """
    global _scale_cuda_available
    if _scale_cuda_available is not None:
        return _scale_cuda_available

    llogger.info("[GPU] Probing scale_cuda filter availability…")
    try:
        proc = await asyncio.create_subprocess_exec(
            settings.FFMPEG_PATH or "ffmpeg",
            "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "color=c=black:s=192x192:d=0.1:r=1,format=yuv420p",
            "-vf", "hwupload_cuda,scale_cuda=w=192:h=192,hwdownload,format=yuv420p",
            "-c:v", "h264_nvenc",
            "-f", "null", "-",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)
        ok = proc.returncode == 0
        if ok:
            llogger.info("[GPU] scale_cuda filter is available ✓")
        else:
            err_msg = stderr.decode(errors="replace").strip()[:300]
            llogger.warning(
                f"[GPU] scale_cuda filter unavailable (rc={proc.returncode}) — "
                f"stderr: {err_msg}"
            )
        _scale_cuda_available = ok
        return ok
    except asyncio.TimeoutError:
        llogger.warning("[GPU] scale_cuda probe timed out — falling back to CPU scale")
        _scale_cuda_available = False
        return False
    except Exception as exc:
        llogger.warning(f"[GPU] scale_cuda probe error: {exc} — falling back to CPU scale")
        _scale_cuda_available = False
        return False


_vaapi_available: bool | None = None


async def _probe_vaapi() -> bool:
    """
    Test whether h264_vaapi is actually usable by running a trivial 0.1 s encode.
    Result is cached in _vaapi_available for the lifetime of the process.
    """
    global _vaapi_available
    if _vaapi_available is not None:
        return _vaapi_available

    llogger.info("[GPU] Probing VA-API availability...")
    ffmpeg_candidates = list(dict.fromkeys([
        settings.FFMPEG_PATH or "ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ]))

    for ffmpeg_bin in ffmpeg_candidates:
        devices = ["/dev/dri/renderD128", None]
        for device in devices:
            try:
                args = [
                    ffmpeg_bin,
                    "-hide_banner", "-loglevel", "error",
                ]
                if device:
                    args.extend(["-vaapi_device", device])
                args.extend([
                    "-f", "lavfi", "-i", "color=c=black:s=192x192:d=0.1:r=1",
                    "-vf", "format=nv12,hwupload",
                    "-c:v", "h264_vaapi",
                    "-f", "null", "-",
                ])
                proc = await asyncio.create_subprocess_exec(
                    *args,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, stderr = await asyncio.wait_for(proc.communicate(), timeout=10.0)
                ok = proc.returncode == 0
                if ok:
                    llogger.info(f"[GPU] VA-API probe: h264_vaapi is available ✓ (via {ffmpeg_bin})")
                    _vaapi_available = True
                    return True
                else:
                    llogger.debug(
                        f"[GPU] VA-API probe failed with {ffmpeg_bin} device={device!r} "
                        f"(rc={proc.returncode}) — "
                        f"stderr: {stderr.decode(errors='replace').strip()[:300]}"
                    )
            except asyncio.TimeoutError:
                llogger.warning(f"[GPU] VA-API probe timed out (ffmpeg={ffmpeg_bin} device={device!r})")
            except FileNotFoundError:
                llogger.debug(f"[GPU] ffmpeg not found at {ffmpeg_bin}")
            except Exception as exc:
                llogger.warning(f"[GPU] VA-API probe error (ffmpeg={ffmpeg_bin} device={device!r}): {exc}")

    llogger.warning("[GPU] VA-API probe: h264_vaapi unavailable on all ffmpeg binaries — falling back to CPU")
    _vaapi_available = False
    return False


def _select_gpu_mode() -> str:
    """
    Determine the GPU encoding mode based on settings and backward compatibility.
    """
    from app.config import settings
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    if not settings.ENABLE_GPU_ENCODING:
        mode = "cpu"
    else:
        mode = settings.GPU_ENCODING_MODE.lower().strip()
    if mode not in ("auto", "nvenc", "vaapi", "cpu"):
        _logger.warning(f"[GPU] Unknown GPU_ENCODING_MODE={mode!r} — falling back to 'auto'")
        mode = "auto"

    _logger.info(f"[GPU] Encoding mode: {mode} (ENABLE_GPU_ENCODING={settings.ENABLE_GPU_ENCODING})")
    return mode


def _normalize_rotation(rotation: float | int | None) -> int:
    """Normalize ffprobe rotation metadata to one of 0/90/180/270."""
    if rotation is None:
        return 0
    try:
        value = int(round(float(rotation))) % 360
    except (TypeError, ValueError):
        return 0
    if value < 0:
        value += 360
    if value in (0, 90, 180, 270):
        return value
    nearest = min((0, 90, 180, 270), key=lambda candidate: abs(candidate - value))
    return nearest


def _rotation_filter_prefix(rotation: int) -> str:
    """Return an ffmpeg filter prefix that bakes display rotation into frames.

    ffprobe reads rotation from the displaymatrix side_data as the angle the
    *player* must rotate the frame to display it correctly.  To physically bake
    that correction into the encoded pixels we apply the same rotation direction:

      displaymatrix = -90  → normalized = 270 → player needs 90° CW → transpose=clock
      displaymatrix = +90  → normalized =  90 → player needs 90° CCW → transpose=cclock
      displaymatrix = 180  → normalized = 180 → flip both axes → hflip,vflip

    This is confirmed by visual testing: extracting a raw frame with -noautorotate
    and comparing transpose=clock vs cclock against ffmpeg's built-in autorotate output.
    """
    normalized = _normalize_rotation(rotation)
    if normalized == 90:
        return "transpose=cclock,"
    if normalized == 180:
        return "hflip,vflip,"
    if normalized == 270:
        return "transpose=clock,"
    return ""


def _probe_video_info(file_path: str) -> dict:
    """
    Probe a video file with ffprobe and return codec/color/resolution/audio info.

    Returns an empty dict on any failure — callers must handle missing keys.
    """
    import json

    llogger.debug(f"[ffprobe] Probing {file_path!r}")
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-print_format", "json",
                "-show_format", "-show_streams",
                file_path,
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            llogger.warning(
                f"[ffprobe] Non-zero exit (rc={result.returncode}) for {file_path!r} — "
                f"stderr: {result.stderr.strip()[:400]!r}"
            )
            return {}

        data = json.loads(result.stdout)
        info: dict = {}

        for s in data.get("streams", []):
            if s.get("codec_type") == "video" and "codec" not in info:
                info["codec"]       = s.get("codec_name")
                info["color_range"] = s.get("color_range")
                info["color_space"] = s.get("color_space")
                info["width"]       = s.get("width", 0)
                info["height"]      = s.get("height", 0)
                info["pix_fmt"]     = s.get("pix_fmt")
                rotation = None
                tags = s.get("tags") or {}
                if "rotate" in tags:
                    rotation = tags.get("rotate")
                if rotation is None:
                    for side_data in s.get("side_data_list", []):
                        if "rotation" in side_data:
                            rotation = side_data.get("rotation")
                            break
                info["rotation"] = _normalize_rotation(rotation)
                info["duration"]    = float(s.get("duration") or 0)
            elif s.get("codec_type") == "audio" and "audio_codec" not in info:
                info["audio_codec"] = s.get("codec_name")

        fmt = data.get("format", {})
        info["format_name"] = fmt.get("format_name")
        if not info.get("duration"):
            info["duration"] = float(fmt.get("duration") or 0)

        llogger.debug(
            f"[ffprobe] {file_path!r} → codec={info.get('codec')!r} "
            f"pix_fmt={info.get('pix_fmt')!r} "
            f"color_range={info.get('color_range')!r} "
            f"color_space={info.get('color_space')!r} "
            f"audio={info.get('audio_codec')!r} "
            f"rotation={info.get('rotation', 0)} "
            f"resolution={info.get('width')}x{info.get('height')} "
            f"duration={info.get('duration'):.1f}s "
            f"format={info.get('format_name')!r}"
        )
        return info

    except subprocess.TimeoutExpired:
        llogger.warning(f"[ffprobe] Timed out (>15 s) for {file_path!r}")
    except json.JSONDecodeError as exc:
        llogger.warning(f"[ffprobe] Invalid JSON output for {file_path!r}: {exc}")
    except FileNotFoundError:
        llogger.error("[ffprobe] Binary not found on PATH — install ffmpeg/ffprobe")
    except Exception as exc:
        llogger.warning(f"[ffprobe] Unexpected error for {file_path!r}: {exc}")
    return {}


def _serve_range(
    path: Path,
    start: int,
    end: int,
    mime_type: str,
    cors: dict,
    t_request: float | None = None,
) -> StreamingResponse:
    file_size = path.stat().st_size
    content_length = end - start + 1

    if t_request is not None:
        elapsed_ms = (time.perf_counter() - t_request) * 1000
        llogger.info(
            f"[TIMER] Request received → First stream byte sent: {elapsed_ms:.2f} ms "
            f"| bytes={start}-{end}/{file_size} | file={path.name}"
        )

    llogger.debug(
        f"[range] Serving bytes {start}-{end}/{file_size} "
        f"({content_length / 1024:.1f} KB) from {path.name}"
    )

    async def range_file_iterator():
        with open(str(path), "rb") as f:
            f.seek(start)
            remaining = content_length
            chunk_size = 1024 * 1024
            while remaining > 0:
                read_size = min(chunk_size, remaining)
                data = f.read(read_size)
                if not data:
                    llogger.warning(
                        f"[range] Unexpected EOF at pos={f.tell()} "
                        f"remaining={remaining} file={path.name}"
                    )
                    break
                remaining -= len(data)
                yield data

    return StreamingResponse(
        range_file_iterator(),
        status_code=206,
        headers={
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
            **cors,
        },
    )


def _parse_range(range_header: str, file_size: int):
    if not range_header or not range_header.lower().startswith("bytes="):
        return None
    range_spec = range_header[6:]
    parts = range_spec.split("-")
    if len(parts) != 2:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    start_str, end_str = parts[0].strip(), parts[1].strip()

    if start_str:
        start = int(start_str)
        end = int(end_str) if end_str else min(start + 1024 * 1024 - 1, file_size - 1)
    elif end_str:
        suffix_length = int(end_str)
        start = max(0, file_size - suffix_length)
        end = file_size - 1
    else:
        raise HTTPException(status_code=416, detail="Invalid Range header")

    if start >= file_size or end >= file_size or start > end:
        return None
    return start, end


async def serve_local_file(path: str, request: Request):
    t_request = time.perf_counter()
    decoded_path = urllib.parse.unquote(path)
    llogger.debug(f"[/local] Request headers: {dict(request.headers)}")
    llogger.debug(f"[/local] Requested path: {decoded_path!r}")

    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException as e:
        from app.utils.security import get_allowed_read_roots

        allowed = [str(r) for r in get_allowed_read_roots()]
        llogger.warning(
            f"[/local] DENIED path={decoded_path!r} | status={e.status_code} | "
            f"reason={e.detail!r} | allowed_roots={allowed}"
        )
        raise

    llogger.debug(f"[/local] Resolved to: {resolved_path}")

    try:
        if not resolved_path.exists():
            llogger.warning(f"[/local] File not found on disk: {resolved_path}")
            raise HTTPException(status_code=404, detail="File not found")

        cors = get_cors_headers(request)

        is_heic = str(resolved_path).lower().endswith((".heic", ".heif"))
        if is_heic:
            try:
                out_bytes = io.BytesIO()
                with Image.open(str(resolved_path)) as img:
                    img = ImageOps.exif_transpose(img)
                    img.thumbnail((800, 800))
                    img.save(out_bytes, format="WEBP", quality=85)
                return Response(content=out_bytes.getvalue(), media_type="image/webp", headers=cors)
            except Exception as e:
                llogger.error(f"[/local] HEIC conversion failed for {resolved_path}: {e}")
                raise HTTPException(status_code=500, detail="Failed to convert HEIC image")

        is_raw = str(resolved_path).lower().endswith(
            (
                ".dng",
                ".cr2",
                ".cr3",
                ".nef",
                ".arw",
                ".orf",
                ".raf",
                ".rw2",
                ".pef",
                ".srw",
            )
        )
        if is_raw:
            try:
                img = open_raw_image(str(resolved_path))
                if img is None:
                    raise HTTPException(status_code=500, detail="Failed to process RAW file")
                img = ImageOps.exif_transpose(img)
                img.thumbnail((800, 800))
                out_bytes = io.BytesIO()
                img.save(out_bytes, format="WEBP", quality=85)
                return Response(content=out_bytes.getvalue(), media_type="image/webp", headers=cors)
            except HTTPException:
                raise
            except Exception as e:
                llogger.error(f"[/local] RAW conversion failed for {resolved_path}: {e}")
                raise HTTPException(status_code=500, detail="Failed to convert RAW image")

        is_encrypted = await locked_service.is_file_encrypted(str(resolved_path))
        if is_encrypted:
            if not locked_service.is_authenticated:
                llogger.warning(
                    f"[/local] Encrypted file requested but Locked Folder not authenticated: {resolved_path}"
                )
                raise HTTPException(status_code=403, detail="Locked Folder session not authenticated")

            decrypted_data = await locked_service.decrypt_file_data(str(resolved_path))
            if decrypted_data is None:
                llogger.error(f"[/local] Decryption failed for: {resolved_path}")
                raise HTTPException(status_code=500, detail="Failed to decrypt file")

            mime_type, _ = mimetypes.guess_type(str(resolved_path))
            if not mime_type:
                mime_type = "image/jpeg"
            llogger.debug(f"[/local] Serving decrypted file ({mime_type}): {resolved_path}")
            return Response(content=decrypted_data, media_type=mime_type, headers=cors)

        llogger.debug(f"[/local] Serving file: {resolved_path}")

        mime_type, _ = mimetypes.guess_type(str(resolved_path))
        if not mime_type:
            mime_type = "application/octet-stream"

        file_size = resolved_path.stat().st_size
        range_header = request.headers.get("range")

        llogger.debug(
            f"[/local] Serving {resolved_path.name} "
            f"({file_size / (1024*1024):.1f} MB, {mime_type}) "
            f"range={range_header!r}"
        )

        parsed = _parse_range(range_header, file_size)
        if parsed:
            start, end = parsed
            return _serve_range(resolved_path, start, end, mime_type, cors, t_request=t_request)

        elapsed_ms = (time.perf_counter() - t_request) * 1000
        llogger.info(
            f"[TIMER] [/local] Request received → First stream byte sent: {elapsed_ms:.2f} ms | file={resolved_path.name}"
        )
        return FileResponse(
            str(resolved_path),
            media_type=mime_type,
            headers={"Accept-Ranges": "bytes", **cors},
        )

    except OSError as e:
        llogger.error(f"[/local] System/IO error serving file {resolved_path}: {e}")
        raise HTTPException(status_code=404, detail="File not found or unreadable due to system error")


async def serve_transcoded_video(path: str, request: Request, force: bool = False):
    """Serve a video, transcoding to a clean H.264 when the browser can't play it natively.
    """
    t_request = time.perf_counter()
    decoded_path = urllib.parse.unquote(path)

    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException as e:
        llogger.warning(f"[/transcode] DENIED path={decoded_path!r}")
        raise

    try:
        if not resolved_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        info = _probe_video_info(str(resolved_path))
        codec = (info.get("codec") or "").lower()
        color_range = (info.get("color_range") or "").lower()
        color_space = (info.get("color_space") or "").lower()
        audio_codec = (info.get("audio_codec") or "").lower()
        rotation = int(info.get("rotation") or 0)
        width = info.get("width", 0)
        height = info.get("height", 0)

        suffix = resolved_path.suffix.lower()
        format_name = (info.get("format_name") or "").lower()
        is_non_standard_container = (
            suffix not in {".mp4", ".webm", ".ogg"}
            or "mpegts" in format_name
        )

        SUPPORTED_AUDIO_CODECS = {"aac", "mp3", "opus", "vorbis", "flac", "wav"}
        is_unsupported_audio = audio_codec and (audio_codec not in SUPPORTED_AUDIO_CODECS)

        is_unsupported_codec = codec in UNSUPPORTED_CODECS
        is_hdr = color_space in HDR_COLOR_SPACES
        is_4k = width >= 3840 or height >= 3840

        needs_transcode = (
            force
            or codec in HEVC_CODECS
            or is_unsupported_codec
            or (codec in FULL_RANGE_CODECS and color_range == "pc")
            or is_non_standard_container
            or is_unsupported_audio
            or is_4k
            or is_hdr
        )

        llogger.info(
            f"[/transcode] probe: codec={codec!r} color_range={color_range!r} "
            f"color_space={color_space!r} audio={audio_codec!r} container={suffix!r} "
            f"format={format_name!r} resolution={width}x{height} "
            f"duration={info.get('duration', 0):.1f}s "
            f"force={force} -> needs_transcode={needs_transcode} "
            f"(hevc={codec in HEVC_CODECS}, unsupported_codec={is_unsupported_codec}, "
            f"full_range={codec in FULL_RANGE_CODECS and color_range == 'pc'}, "
            f"non_std_container={is_non_standard_container}, "
            f"unsupported_audio={is_unsupported_audio}, 4k={is_4k}, hdr={is_hdr})"
        )

        if not needs_transcode:
            mime_type, _ = mimetypes.guess_type(str(resolved_path))
            if not mime_type:
                mime_type = "video/mp4"
            cors = get_cors_headers(request)
            elapsed_ms = (time.perf_counter() - t_request) * 1000
            llogger.info(
                f"[TIMER] [/transcode] Direct file stream sent in {elapsed_ms:.2f} ms | file={resolved_path.name}"
            )
            return FileResponse(
                str(resolved_path),
                media_type=mime_type,
                headers={"Accept-Ranges": "bytes", **cors},
            )
    except OSError as e:
        llogger.error(f"[/transcode] System/IO error resolving or probing file {resolved_path}: {e}")
        raise HTTPException(status_code=404, detail="File not found or unreadable due to system error")

    llogger.info(
        f"[/transcode] Transcode needed: codec={codec!r} color_range={color_range!r} "
        f"audio_codec={audio_codec!r} file={resolved_path.name}"
    )

    source_hash = hashlib.md5(str(resolved_path).encode()).hexdigest()[:16]
    cache_path = TRANSCODE_CACHE_DIR / f"{source_hash}.mp4"
    temp_cache_path = TRANSCODE_CACHE_DIR / f"{source_hash}.mp4.tmp"

    is_recent_cache = cache_path.exists() and (time.time() - cache_path.stat().st_mtime < 120)

    if (not force or is_recent_cache) and cache_path.exists():
        file_size = cache_path.stat().st_size
        llogger.info(
            f"[/transcode] Cache hit → {cache_path.name} "
            f"({file_size / (1024*1024):.1f} MB) for {resolved_path.name}"
        )
        cors = get_cors_headers(request)
        mime_type = "video/mp4"
        range_header = request.headers.get("range")

        parsed = _parse_range(range_header, file_size)
        if parsed:
            start, end = parsed
            return _serve_range(cache_path, start, end, mime_type, cors, t_request=t_request)

        elapsed_ms = (time.perf_counter() - t_request) * 1000
        llogger.info(
            f"[TIMER] [/transcode] Request received → First stream byte sent: {elapsed_ms:.2f} ms | file={resolved_path.name}"
        )
        return FileResponse(
            str(cache_path),
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes", **cors},
        )

    if source_hash not in _transcode_locks:
        _transcode_locks[source_hash] = asyncio.Lock()
    lock = _transcode_locks[source_hash]

    async with lock:
        if (not force or is_recent_cache) and cache_path.exists() and cache_path.stat().st_size > 0:
            llogger.debug(f"[/transcode] Cache appeared while waiting: {cache_path}")
            cors = get_cors_headers(request)
            elapsed_ms = (time.perf_counter() - t_request) * 1000
            llogger.info(
                f"[TIMER] [/transcode] Request received → First stream byte sent: {elapsed_ms:.2f} ms | file={resolved_path.name}"
            )
            return FileResponse(
                str(cache_path),
                media_type="video/mp4",
                headers={"Accept-Ranges": "bytes", **cors},
            )

        if force and not is_recent_cache:
            cache_path.unlink(missing_ok=True)
            temp_cache_path.unlink(missing_ok=True)
            _transcode_in_progress.pop(source_hash, None)


        cors = get_cors_headers(request)
        mime_type = "video/mp4"
        is_in_progress = source_hash in _transcode_in_progress
        target_path = temp_cache_path if is_in_progress else cache_path

        range_val = request.headers.get("range")
        # Only try to serve a range from a *growing* temp file when a transcode is
        # already in-progress.  When is_in_progress is False we have no file yet;
        # falling through will start (or wait for) the transcode then serve the
        # completed file with a range response from the bottom of this handler.
        if range_val and range_val.lower().startswith("bytes=") and is_in_progress:
            if not target_path.exists():
                wait_until = asyncio.get_event_loop().time() + 2.0
                while not target_path.exists() and asyncio.get_event_loop().time() < wait_until:
                    await asyncio.sleep(0.05)

            if target_path.exists():
                current_size = target_path.stat().st_size
                if current_size > 0:
                    try:
                        parsed = _parse_range(range_val, current_size)
                        if parsed:
                            start, end = parsed
                            return _serve_range(
                                target_path, start, min(end, current_size - 1), mime_type, cors
                            )
                    except (HTTPException, ValueError):
                        pass

                    return Response(
                        status_code=416,
                        headers={"Content-Range": f"bytes */{current_size}", **cors},
                    )

            return Response(
                status_code=416,
                headers={"Content-Range": "bytes */*", **cors},
            )

        # 3. Handle growing file stream (starts transcode or attaches to running one)
        if is_in_progress:
            done_event = _transcode_in_progress[source_hash]
            llogger.debug(f"[/transcode] Attaching client to running transcode stream: {temp_cache_path}")
        else:
            done_event = asyncio.Event()
            _transcode_in_progress[source_hash] = done_event

            try:
                audio_args = ["-c:a", "aac", "-ac", "2", "-b:a", "128k"] if audio_codec else []
                is_hdr = color_space in HDR_COLOR_SPACES
                hdr_vf = (
                    ",tonemap=hable,"
                    "colorspace=all=bt709:iprimaries=bt2020:itrc=bt2020-10:ispace=bt2020nc"
                    if is_hdr else ""
                )
                pix_fmt = (info.get("pix_fmt") or "").lower()
                is_10bit = "10" in pix_fmt or "p010" in pix_fmt
                hwdownload_fmt = "hwdownload,format=yuv420p10le,format=yuv420p" if is_10bit else "hwdownload,format=yuv420p"
                rotation_prefix = _rotation_filter_prefix(rotation)

                # ── GPU encoder selection ────────────────────────────────────
                # _probe_nvenc(), _probe_scale_cuda(), _probe_vaapi() are cached
                # after the first call — no subprocess overhead on subsequent requests.
                #
                # Tier 1: Full GPU (NVENC + CUDA scale) — auto or nvenc mode
                # Tier 2: Partial GPU (NVENC + CPU scale) — auto or nvenc mode
                # Tier 3: VAAPI (Intel/AMD iGPU) — auto or vaapi mode
                # Tier 4: CPU (libx264 ultrafast) — always available, fallback
                #
                gpu_mode = _select_gpu_mode()
                use_nvenc = False
                use_vaapi = False
                encoder_tag = "libx264"

                if gpu_mode in ("auto", "nvenc"):
                    use_nvenc = await _probe_nvenc()

                if gpu_mode in ("auto", "vaapi") and not use_nvenc:
                    use_vaapi = await _probe_vaapi()

                use_full_gpu = use_nvenc and await _probe_scale_cuda()


                if use_full_gpu:
                    encoder_tag = "h264_nvenc"
                    is_cuda_decodable = rotation == 0 and codec in ("h264", "hevc", "h265", "vp9", "av1")
                    if is_cuda_decodable:
                        input_hwaccel = ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
                        hwdownload_fmt_gpu = "hwdownload,format=p010le" if is_10bit else "hwdownload,format=nv12,format=yuv420p"
                        if is_10bit and not is_hdr:
                            hwdownload_fmt_gpu += ",format=yuv420p"
                        vf = (
                            f"{rotation_prefix}"
                            f"scale_cuda=w=trunc(iw/2)*2:h=trunc(ih/2)*2:interp_algo=lanczos,"
                            f"{hwdownload_fmt_gpu}"
                            f"{hdr_vf}"
                        )
                    else:
                        input_hwaccel = []
                        hwdownload_fmt_cpu = "hwdownload,format=yuv420p10le,format=yuv420p" if is_10bit else "hwdownload,format=yuv420p"
                        vf = (
                            f"{rotation_prefix}"
                            f"format={'yuv420p10le' if is_10bit else 'yuv420p'},"
                            f"hwupload_cuda,"
                            f"scale_cuda=w=trunc(iw/2)*2:h=trunc(ih/2)*2:interp_algo=lanczos,"
                            f"{hwdownload_fmt_cpu}"
                            f"{hdr_vf}"
                        )
                    llogger.info(
                        f"[GPU] Encoding {resolved_path.name} with h264_nvenc "
                        f"(full GPU pipeline: decode={ 'cuda' if is_cuda_decodable else 'cpu' } + scale_cuda + nvenc, "
                        f"input codec={codec!r}, pix_fmt={pix_fmt!r}, 10bit={is_10bit}, "
                        f"{width}x{height}, hdr={is_hdr}, duration={info.get('duration', 0):.0f}s)"
                    )
                    video_args = [
                        "-c:v", "h264_nvenc",
                        "-preset", "p4",
                        "-rc", "vbr",
                        "-cq", "23",
                        "-b:v", "0",
                        "-maxrate", "12M",
                        "-bufsize", "12M",
                        "-pix_fmt", "yuv420p",
                        "-profile:v", "high",
                    ]
                elif use_nvenc:
                    encoder_tag = "h264_nvenc"
                    llogger.info(
                        f"[GPU] Encoding {resolved_path.name} with h264_nvenc "
                        f"(partial GPU: nvenc encoder only, scale_cuda unavailable, "
                        f"input codec={codec!r}, {width}x{height}, "
                        f"hdr={is_hdr}, duration={info.get('duration', 0):.0f}s)"
                    )
                    input_hwaccel = []
                    vf = f"{rotation_prefix}scale=trunc(iw/2)*2:trunc(ih/2)*2{hdr_vf}"
                    video_args = [
                        "-c:v", "h264_nvenc",
                        "-preset", "p4",
                        "-rc", "vbr",
                        "-cq", "23",
                        "-b:v", "0",
                        "-maxrate", "12M",
                        "-bufsize", "12M",
                        "-pix_fmt", "yuv420p",
                        "-profile:v", "high",
                    ]
                elif use_vaapi:
                    encoder_tag = "h264_vaapi"
                    llogger.info(
                        f"[GPU] Encoding {resolved_path.name} with h264_vaapi "
                        f"(VA-API: Intel/AMD iGPU, "
                        f"input codec={codec!r}, {width}x{height}, "
                        f"hdr={is_hdr}, duration={info.get('duration', 0):.0f}s)"
                    )
                    input_hwaccel = ["-vaapi_device", "/dev/dri/renderD128"]
                    vf = (
                        f"{rotation_prefix}"
                        f"format=nv12,hwupload,scale_vaapi=w=trunc(iw/2)*2:h=trunc(ih/2)*2,"
                        f"hwdownload,format=yuv420p{hdr_vf}"
                    )
                    video_args = [
                        "-c:v", "h264_vaapi",
                        "-qp", "23",
                        "-maxrate", "12M",
                        "-bufsize", "12M",
                        "-pix_fmt", "yuv420p",
                        "-profile:v", "high",
                    ]
                else:
                    encoder_tag = "libx264"
                    llogger.info(
                        f"[CPU] Encoding {resolved_path.name} with libx264 "
                        f"(GPU unavailable, mode={gpu_mode!r}, codec={codec!r}, {width}x{height}, "
                        f"hdr={is_hdr}, duration={info.get('duration', 0):.0f}s)"
                    )
                    input_hwaccel = []
                    vf = f"{rotation_prefix}scale=trunc(iw/2)*2:trunc(ih/2)*2{hdr_vf}"
                    video_args = [
                        "-c:v", "libx264",
                        "-preset", "ultrafast",
                        "-crf", "23",
                        "-maxrate", "12M",
                        "-bufsize", "12M",
                        "-pix_fmt", "yuv420p",
                        "-profile:v", "high",
                    ]
                if encoder_tag == "h264_vaapi":
                    ffmpeg_bin = "/usr/bin/ffmpeg"
                else:
                    ffmpeg_bin = settings.FFMPEG_PATH or "ffmpeg"
                cmd = [
                    ffmpeg_bin, "-y",
                    "-hide_banner",
                    *input_hwaccel,
                    "-noautorotate",
                    "-i", str(resolved_path),
                    *video_args,
                    "-vf", vf,
                    "-metadata:s:v:0", "rotate=0",
                    # Strip display-orientation SEI so hls.js/Chrome don't
                    # re-apply rotation on top of already-corrected pixels.
                    "-bsf:v", "h264_metadata=display_orientation=remove",
                    "-colorspace", "bt709",
                    "-color_primaries", "bt709",
                    "-color_trc", "bt709",
                    "-color_range", "tv",
                    *audio_args,
                    "-movflags", "+faststart",
                    "-f", "mp4",
                    str(temp_cache_path),
                ]
                llogger.info(f"[ffmpeg] Command: {' '.join(cmd)}")

                t_start = time.monotonic()
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.PIPE,
                )

                async def _run_ffmpeg_and_cleanup():
                    from app.services.processing_queue import processing_queue
                    processing_queue._throttler.increment_video_ops()
                    try:
                        llogger.info(
                            f"[ffmpeg] Started [{encoder_tag}] pid={process.pid} "
                            f"→ {temp_cache_path.name}"
                        )
                        _, stderr_bytes = await asyncio.wait_for(
                            process.communicate(),
                            timeout=3600.0,
                        )
                        elapsed = time.monotonic() - t_start
                        stderr_tail = stderr_bytes.decode(errors="replace")[-800:]

                        if process.returncode != 0:
                            llogger.error(
                                f"[ffmpeg] FAILED [{encoder_tag}] rc={process.returncode} "
                                f"file={resolved_path.name} elapsed={elapsed:.1f}s\n"
                                f"--- ffmpeg stderr (last 800 chars) ---\n{stderr_tail}"
                            )
                            temp_cache_path.unlink(missing_ok=True)
                        else:
                            if temp_cache_path.exists():
                                temp_cache_path.rename(cache_path)
                                cache_size = cache_path.stat().st_size
                                llogger.info(
                                    f"[ffmpeg] Done [{encoder_tag}] "
                                    f"file={resolved_path.name} "
                                    f"elapsed={elapsed:.1f}s "
                                    f"output={cache_size / (1024*1024):.1f} MB → {cache_path.name}"
                                )
                                # Log any warnings from ffmpeg even on success
                                for line in stderr_tail.splitlines():
                                    if any(k in line.lower() for k in ("warning", "error", "invalid", "failed")):
                                        llogger.debug(f"[ffmpeg] stderr: {line}")
                            else:
                                llogger.error(
                                    f"[ffmpeg] Finished but temp file missing! "
                                    f"file={resolved_path.name} elapsed={elapsed:.1f}s"
                                )
                    except asyncio.TimeoutError:
                        elapsed = time.monotonic() - t_start
                        llogger.error(
                            f"[ffmpeg] Timed out after {elapsed:.0f}s "
                            f"[{encoder_tag}] file={resolved_path.name}"
                        )
                        process.kill()
                        temp_cache_path.unlink(missing_ok=True)
                    except Exception as exc:
                        llogger.error(
                            f"[ffmpeg] Unexpected error [{encoder_tag}] "
                            f"file={resolved_path.name}: {exc}"
                        )
                        temp_cache_path.unlink(missing_ok=True)
                    finally:
                        processing_queue._throttler.decrement_video_ops()
                        done_event.set()
                        _transcode_in_progress.pop(source_hash, None)

                asyncio.create_task(_run_ffmpeg_and_cleanup())

            except FileNotFoundError:
                llogger.error("[ffmpeg] Binary not found on PATH — install ffmpeg")
                done_event.set()
                _transcode_in_progress.pop(source_hash, None)
                raise HTTPException(status_code=500, detail="ffmpeg not available")
            except Exception as exc:
                llogger.error(f"[/transcode] Setup error for {resolved_path.name}: {exc}")
                temp_cache_path.unlink(missing_ok=True)
                done_event.set()
                _transcode_in_progress.pop(source_hash, None)
                raise HTTPException(status_code=500, detail="Transcoding failed")
        wait_start = time.monotonic()
        llogger.info(
            f"[/transcode] Waiting for transcode of {resolved_path.name} to complete…"
        )
        await done_event.wait()
        wait_elapsed = time.monotonic() - wait_start

        if not cache_path.exists() or cache_path.stat().st_size == 0:
            llogger.error(
                f"[/transcode] Transcode failed — cache file missing after "
                f"{wait_elapsed:.1f}s wait for {resolved_path.name}"
            )
            raise HTTPException(status_code=500, detail="Transcoding failed")

        file_size = cache_path.stat().st_size
        llogger.info(
            f"[/transcode] Serving transcoded file after {wait_elapsed:.1f}s wait: "
            f"{cache_path.name} ({file_size / (1024*1024):.1f} MB)"
        )
        range_header = request.headers.get("range")
        parsed = _parse_range(range_header, file_size)
        if parsed:
            start, end = parsed
            return _serve_range(cache_path, start, end, "video/mp4", cors, t_request=t_request)

        elapsed_ms = (time.perf_counter() - t_request) * 1000
        llogger.info(
            f"[TIMER] [/transcode] Request received → First stream byte sent: {elapsed_ms:.2f} ms | file={resolved_path.name}"
        )
        return FileResponse(
            str(cache_path),
            media_type="video/mp4",
            headers={"Accept-Ranges": "bytes", **cors},
        )

