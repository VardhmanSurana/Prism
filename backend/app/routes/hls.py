"""
HLS (HTTP Live Streaming) segmented transcoding route.

Architecture (Jellyfin-style "best of both worlds"):
  1. GET /hls/playlist?path=<file>
     → ffprobe to get duration; build .m3u8 playlist listing all segment URLs.
       No encoding yet.  Duration is known immediately.

  2. GET /hls/segment?path=<file>&index=<N>
     → Transcode only the N-th 6-second segment on demand; cache to disk.
       Segment 0 starts playing in ~1-3 s while later segments are decoded
       lazily when the player actually requests them.

Cache layout:
  DATA_DIR/hls_cache/<source_hash>/
      playlist.m3u8           ← generated once from ffprobe
      seg_000.ts              ← cached segment files (MPEG-TS)
      seg_001.ts
      ...

Seeking:
  When the user seeks to t=90s the player requests seg_015 (90/6=15).
  The backend immediately starts encoding that segment.
  Only segments that are actually watched are ever encoded.
"""

import asyncio
import hashlib
import math
import re
import time
import urllib.parse
from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import Response
from loguru import logger as llogger
from starlette.responses import FileResponse, StreamingResponse

from app.config import settings
from app.middleware.cors import get_cors_headers
from app.routes.media import _probe_video_info, _probe_nvenc, _probe_scale_cuda, _probe_vaapi, _select_gpu_mode, _serve_range, _parse_range, _rotation_filter_prefix
from app.utils.security import safe_resolve_read

# ── Constants ──────────────────────────────────────────────────────────────────

HLS_CACHE_DIR = settings.DATA_DIR / "hls_cache"
HLS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Segment duration in seconds.  6 s is the Apple-recommended default.
# Shorter = faster seek response; longer = fewer files / less overhead.
SEGMENT_DURATION = 4

HEVC_CODECS = {"hevc", "h265", "hev1", "hvc1"}
HDR_COLOR_SPACES = {"bt2020nc", "bt2020c", "smpte2084", "arib-std-b67"}
UNSUPPORTED_CODECS = {
    "vp9", "vp09", "av1", "av01", "mpeg2video", "mpeg4",
    "divx", "xvid", "wmv3", "wmv", "vc1", "theora",
}
SUPPORTED_AUDIO_CODECS = {"aac", "mp3", "opus", "vorbis", "flac", "wav"}

# Per-segment encode locks: source_hash → {seg_index → asyncio.Event}
_seg_in_progress: dict[str, dict[int, asyncio.Event]] = {}
_seg_locks: dict[str, asyncio.Lock] = {}


def _source_hash(resolved_path: Path) -> str:
    """Cache key includes path + size + mtime so replaced files invalidate."""
    stat = resolved_path.stat()
    key = f"{resolved_path}:{stat.st_size}:{stat.st_mtime}"
    return hashlib.md5(key.encode()).hexdigest()[:16]


def _seg_dir(source_hash: str) -> Path:
    d = HLS_CACHE_DIR / source_hash
    d.mkdir(parents=True, exist_ok=True)
    return d


def _seg_path(source_hash: str, index: int) -> Path:
    return _seg_dir(source_hash) / f"seg_{index:04d}.ts"


def _playlist_path(source_hash: str) -> Path:
    return _seg_dir(source_hash) / "playlist.m3u8"


def _needs_transcode(info: dict, resolved_path: Path) -> bool:
    codec = (info.get("codec") or "").lower()
    color_range = (info.get("color_range") or "").lower()
    color_space = (info.get("color_space") or "").lower()
    audio_codec = (info.get("audio_codec") or "").lower()
    width = info.get("width", 0)
    height = info.get("height", 0)
    suffix = resolved_path.suffix.lower()
    format_name = (info.get("format_name") or "").lower()
    is_non_standard_container = (
        suffix not in {".mp4", ".webm", ".ogg"}
        or "mpegts" in format_name
    )
    is_unsupported_audio = bool(audio_codec and audio_codec not in SUPPORTED_AUDIO_CODECS)
    return (
        codec in HEVC_CODECS
        or codec in UNSUPPORTED_CODECS
        or (codec in {"h264", "avc", "avc1"} and color_range == "pc")
        or is_non_standard_container
        or is_unsupported_audio
        or width >= 3840
        or height >= 3840
        or color_space in HDR_COLOR_SPACES
    )


# ── Playlist endpoint ──────────────────────────────────────────────────────────

async def serve_hls_playlist(path: str, request: Request):
    """
    Return an HLS VOD playlist for the given video file.

    The playlist is built from ffprobe data only — no encoding happens here.
    Duration is embedded in the playlist so the player knows the total length
    before a single frame is decoded.
    """
    decoded_path = urllib.parse.unquote(path)
    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException:
        llogger.warning(f"[HLS] DENIED playlist for path={decoded_path!r}")
        raise

    if not resolved_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    cors = get_cors_headers(request)
    info = _probe_video_info(str(resolved_path))
    duration = float(info.get("duration") or 0)

    if duration <= 0:
        llogger.warning(
            f"[HLS] ffprobe returned duration={duration} for {resolved_path.name} — "
            "cannot build playlist; falling back to transcode endpoint"
        )
        raise HTTPException(status_code=422, detail="Cannot determine video duration")

    h = _source_hash(resolved_path)
    playlist_file = _playlist_path(h)

    # Build and cache playlist if not already on disk
    if not playlist_file.exists():
        num_segments = math.ceil(duration / SEGMENT_DURATION)
        lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            f"#EXT-X-TARGETDURATION:{SEGMENT_DURATION}",
            "#EXT-X-MEDIA-SEQUENCE:0",
            "#EXT-X-PLAYLIST-TYPE:VOD",
        ]
        for i in range(num_segments):
            seg_dur = min(SEGMENT_DURATION, duration - i * SEGMENT_DURATION)
            # Encode the original path so the segment handler can resolve it
            encoded = urllib.parse.quote(str(resolved_path), safe="")
            if i > 0:
                # Each segment is encoded by an independent FFmpeg process.
                # Tell HLS clients not to assume timestamp continuity across files.
                lines.append("#EXT-X-DISCONTINUITY")
            lines.append(f"#EXTINF:{seg_dur:.6f},")
            lines.append(f"/hls/segment?path={encoded}&index={i}")
        lines.append("#EXT-X-ENDLIST")
        playlist_content = "\n".join(lines) + "\n"
        playlist_file.write_text(playlist_content)
        llogger.info(
            f"[HLS] Playlist built: {resolved_path.name} "
            f"duration={duration:.1f}s segments={num_segments} hash={h}"
        )
    else:
        llogger.debug(f"[HLS] Serving cached playlist for {resolved_path.name} ({h})")

    return Response(
        content=playlist_file.read_bytes(),
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": cors.get("Access-Control-Allow-Origin", "*"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Expose-Headers": "Content-Length",
        },
    )


# ── Segment endpoint ───────────────────────────────────────────────────────────

async def serve_hls_segment(path: str, index: int, request: Request):
    """
    Return the N-th MPEG-TS segment, transcoding on demand and caching to disk.

    Concurrency model:
      - A per-file asyncio.Lock serialises access to _seg_in_progress[hash].
      - Once an encode task is launched for (hash, index), subsequent requests
        for the same segment grab the existing asyncio.Event and await it.
      - Different segment indices for the same file encode in parallel.
    """
    decoded_path = urllib.parse.unquote(path)
    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException:
        llogger.warning(f"[HLS] DENIED segment path={decoded_path!r} index={index}")
        raise

    if not resolved_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    cors = get_cors_headers(request)
    h = _source_hash(resolved_path)
    seg = _seg_path(h, index)

    # ── Fast path: segment already on disk ──────────────────────────────────
    if seg.exists() and seg.stat().st_size > 0:
        llogger.debug(f"[HLS] Cache hit: {resolved_path.name} seg={index}")
        return _serve_seg_file(seg, request, cors)

    # ── Acquire per-file lock to check/set in-progress state atomically ─────
    if h not in _seg_locks:
        _seg_locks[h] = asyncio.Lock()

    async with _seg_locks[h]:
        # Re-check under lock — may have been written while we waited
        if seg.exists() and seg.stat().st_size > 0:
            return _serve_seg_file(seg, request, cors)

        segs = _seg_in_progress.setdefault(h, {})
        if index in segs:
            # Encode already running — grab its event to await outside the lock
            done_event = segs[index]
            llogger.debug(
                f"[HLS] Attaching to in-progress encode: {resolved_path.name} seg={index}"
            )
        else:
            # Launch a new encode task
            done_event = asyncio.Event()
            segs[index] = done_event
            asyncio.create_task(_encode_segment(resolved_path, h, index, done_event))
            llogger.info(
                f"[HLS] Encode task started: {resolved_path.name} seg={index} "
                f"(start={index * SEGMENT_DURATION}s)"
            )

    # ── Wait for encode to finish (outside the lock) ─────────────────────────
    await done_event.wait()

    if not seg.exists() or seg.stat().st_size == 0:
        llogger.error(
            f"[HLS] Segment encode failed or empty: {resolved_path.name} seg={index}"
        )
        raise HTTPException(status_code=500, detail="Segment transcoding failed")

    return _serve_seg_file(seg, request, cors)


def _serve_seg_file(seg: Path, request: Request, cors: dict):
    """Serve a cached .ts segment with range-request support."""
    file_size = seg.stat().st_size
    range_header = request.headers.get("range")
    parsed = _parse_range(range_header, file_size)
    if parsed:
        start, end = parsed
        return _serve_range(seg, start, end, "video/mp2t", cors)
    return FileResponse(
        str(seg),
        media_type="video/mp2t",
        headers={"Accept-Ranges": "bytes", **cors},
    )


# ── Segment encoder ────────────────────────────────────────────────────────────

async def _encode_segment(
    resolved_path: Path,
    source_hash: str,
    index: int,
    done_event: asyncio.Event,
) -> None:
    """
    Encode a single 6-second segment of the source file to MPEG-TS and cache it.

    Uses -ss / -t for input seeking (ffmpeg decodes from the nearest keyframe
    before the requested start time and discards up to the exact start, which is
    accurate and fast for moderate-length files).
    """
    from app.services.processing_queue import processing_queue

    seg = _seg_path(source_hash, index)
    tmp = seg.with_suffix(".ts.tmp")
    start_time = index * SEGMENT_DURATION
    t0 = time.monotonic()

    info = _probe_video_info(str(resolved_path))
    codec = (info.get("codec") or "").lower()
    color_space = (info.get("color_space") or "").lower()
    audio_codec = (info.get("audio_codec") or "").lower()
    pix_fmt = (info.get("pix_fmt") or "").lower()
    rotation = int(info.get("rotation") or 0)
    is_hdr = color_space in HDR_COLOR_SPACES
    is_10bit = "10" in pix_fmt or "p010" in pix_fmt

    rotation_prefix = _rotation_filter_prefix(rotation)
    hdr_vf = (
        ",tonemap=hable,"
        "colorspace=all=bt709:iprimaries=bt2020:itrc=bt2020-10:ispace=bt2020nc"
        if is_hdr else ""
    )
    # For 10-bit input: hwdownload must use native format, then convert to 8-bit on CPU.
    # For 8-bit input: hwdownload directly to yuv420p.
    hwdownload_fmt = "hwdownload,format=yuv420p10le,format=yuv420p" if is_10bit else "hwdownload,format=yuv420p"
    audio_args = ["-c:a", "aac", "-ac", "2", "-b:a", "128k"] if audio_codec else ["-an"]

    gpu_mode = _select_gpu_mode()
    use_nvenc = False
    use_vaapi = False
    encoder_tag = "libx264"

    if gpu_mode in ("auto", "nvenc"):
        use_nvenc = await _probe_nvenc()

    if gpu_mode in ("auto", "vaapi"):
        use_vaapi = await _probe_vaapi()

    use_full_gpu = use_nvenc and await _probe_scale_cuda()

    if use_full_gpu:
        encoder_tag = "h264_nvenc"
        # Full GPU pipeline: CUDA decode -> scale_cuda -> hwdownload -> nvenc.
        # Fallback to CPU decode -> hwupload_cuda -> scale_cuda if codec is unsupported.
        # CPU-side rotation filters cannot run on CUDA frames directly.
        # If the source carries display rotation metadata, decode on CPU first,
        # then upload to CUDA for scale/encode.
        is_cuda_decodable = rotation == 0 and codec in ("h264", "hevc", "h265", "vp9", "av1")
        if is_cuda_decodable:
            input_hwaccel = ["-hwaccel", "cuda", "-hwaccel_output_format", "cuda"]
            hwdownload_fmt = "hwdownload,format=p010le" if is_10bit else "hwdownload,format=nv12,format=yuv420p"
            if is_10bit and not is_hdr:
                hwdownload_fmt += ",format=yuv420p"
            vf = (
                f"{rotation_prefix}"
                f"scale_cuda=w=trunc(iw/2)*2:h=trunc(ih/2)*2:interp_algo=lanczos,"
                f"{hwdownload_fmt}{hdr_vf}"
            )
        else:
            input_hwaccel = []
            hwdownload_fmt_cpu = "hwdownload,format=yuv420p10le,format=yuv420p" if is_10bit else "hwdownload,format=yuv420p"
            vf = (
                f"{rotation_prefix}"
                f"format={'yuv420p10le' if is_10bit else 'yuv420p'},"
                f"hwupload_cuda,"
                f"scale_cuda=w=trunc(iw/2)*2:h=trunc(ih/2)*2:interp_algo=lanczos,"
                f"{hwdownload_fmt_cpu}{hdr_vf}"
            )
        video_args = [
            "-c:v", "h264_nvenc",
            "-preset", "p4",
            "-rc", "vbr", "-cq", "23", "-b:v", "0",
            "-maxrate", "12M", "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
        ]
    elif use_nvenc:
        encoder_tag = "h264_nvenc"
        # NVENC encoder works but scale_cuda filter is missing.
        # Use CPU decode + CPU scale + NVENC encode.
        input_hwaccel = []
        vf = f"{rotation_prefix}scale=trunc(iw/2)*2:trunc(ih/2)*2{hdr_vf}"
        video_args = [
            "-c:v", "h264_nvenc",
            "-preset", "p4",
            "-rc", "vbr", "-cq", "23", "-b:v", "0",
            "-maxrate", "12M", "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
        ]
    elif use_vaapi:
        encoder_tag = "h264_vaapi"
        input_hwaccel = ["-vaapi_device", "/dev/dri/renderD128"]
        vf = (
            f"{rotation_prefix}"
            f"format=nv12,hwupload,scale_vaapi=w=trunc(iw/2)*2:h=trunc(ih/2)*2,"
            f"hwdownload,format=yuv420p{hdr_vf}"
        )
        video_args = [
            "-c:v", "h264_vaapi",
            "-qp", "23",
            "-maxrate", "12M", "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
        ]
    else:
        encoder_tag = "libx264"
        input_hwaccel = []
        vf = f"{rotation_prefix}scale=trunc(iw/2)*2:trunc(ih/2)*2{hdr_vf}"
        video_args = [
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-maxrate", "12M", "-bufsize", "12M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high",
        ]

    # Use the correct ffmpeg binary for the selected encoder.
    # NVENC requires the custom CUDA build; VAAPI needs system ffmpeg.
    # Check encoder_tag (actual selection), not use_vaapi (which is just the probe result).
    if encoder_tag == "h264_vaapi":
        ffmpeg_bin = "/usr/bin/ffmpeg"
    else:
        ffmpeg_bin = settings.FFMPEG_PATH or "ffmpeg"
    cmd = [
        ffmpeg_bin, "-y", "-hide_banner",
        "-fflags", "+genpts",
        *input_hwaccel,
        "-noautorotate",
        # Seek before -i is fast (keyframe seek); ffmpeg then does a fine seek
        # to the exact start_time after the input is opened.
        "-ss", str(start_time),
        "-i", str(resolved_path),
        "-t", str(SEGMENT_DURATION),
        "-map", "0:v:0",
        "-map", "0:a:0?",
        *video_args,
        "-vf", vf,
        "-metadata:s:v:0", "rotate=0",
        "-colorspace", "bt709",
        "-color_primaries", "bt709",
        "-color_trc", "bt709",
        "-color_range", "tv",
        *audio_args,
        "-avoid_negative_ts", "make_zero",
        "-muxdelay", "0",
        "-muxpreload", "0",
        "-mpegts_flags", "+resend_headers",
        # Output as MPEG-TS — the only container that can be written without
        # knowing the final duration (no moov atom problem).
        "-f", "mpegts",
        str(tmp),
    ]
    llogger.info(
        f"[HLS] Encoding seg={index} [{encoder_tag}] "
        f"start={start_time}s file={resolved_path.name}"
    )
    llogger.debug(f"[HLS] ffmpeg cmd: {' '.join(cmd)}")

    process = None
    try:
        processing_queue._throttler.increment_video_ops()
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr_bytes = await asyncio.wait_for(
            process.communicate(), timeout=120.0
        )
        elapsed = time.monotonic() - t0
        stderr_tail = stderr_bytes.decode(errors="replace")[-600:]

        if process.returncode != 0:
            llogger.error(
                f"[HLS] ffmpeg FAILED seg={index} [{encoder_tag}] "
                f"rc={process.returncode} file={resolved_path.name} "
                f"elapsed={elapsed:.1f}s\n--- stderr ---\n{stderr_tail}"
            )
            tmp.unlink(missing_ok=True)
        else:
            if tmp.exists() and tmp.stat().st_size > 0:
                tmp.rename(seg)
                llogger.info(
                    f"[HLS] Segment done: seg={index} [{encoder_tag}] "
                    f"file={resolved_path.name} elapsed={elapsed:.1f}s "
                    f"size={seg.stat().st_size // 1024} KB"
                )
            else:
                llogger.error(
                    f"[HLS] ffmpeg produced empty segment: seg={index} "
                    f"file={resolved_path.name}"
                )
                tmp.unlink(missing_ok=True)
    except asyncio.TimeoutError:
        elapsed = time.monotonic() - t0
        llogger.error(
            f"[HLS] Segment encode timed out after {elapsed:.0f}s: "
            f"seg={index} file={resolved_path.name}"
        )
        if process:
            process.kill()
        tmp.unlink(missing_ok=True)
    except Exception as exc:
        llogger.error(
            f"[HLS] Unexpected error encoding seg={index} "
            f"file={resolved_path.name}: {exc}"
        )
        tmp.unlink(missing_ok=True)
    finally:
        processing_queue._throttler.decrement_video_ops()
        done_event.set()
        # Clean up the in-progress tracking entry
        segs = _seg_in_progress.get(source_hash)
        if segs:
            segs.pop(index, None)
            if not segs:
                _seg_in_progress.pop(source_hash, None)
