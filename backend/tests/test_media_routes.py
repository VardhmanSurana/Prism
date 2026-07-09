"""Tests for media serving routes: /local, /transcode, HLS, and photo thumbnails."""

import io
import os
import asyncio
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image as PILImage

from app.main import app
from app.models import Photo
from app.config import settings
from app.routes import hls as hls_routes


@pytest.mark.asyncio
async def test_serve_local_file_exists():
    target = settings.UPLOAD_DIR / "media_test_image.jpg"
    target.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (100, 100), color="red").save(str(target))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/local?path={target}")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_serve_local_file_not_found():
    missing = settings.UPLOAD_DIR / "this_file_does_not_exist_99999.jpg"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/local?path={missing}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_serve_local_file_traversal_blocked():
    traversal = "/etc/passwd"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/local?path={traversal}")
    assert response.status_code in (403, 404)


@pytest.mark.asyncio
async def test_serve_photo_thumbnail_locked_auth_required(db_session):
    image_path = settings.UPLOAD_DIR / "locked_thumb_test.jpg"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (100, 100), color="blue").save(str(image_path))
    photo = Photo(
        filename="locked_thumb_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=100,
        height=100,
        aspect_ratio=1.0,
        is_locked=True,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/photos/{photo.id}/thumbnail")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_serve_photo_thumbnail_unlocked(db_session):
    image_path = settings.UPLOAD_DIR / "unlocked_thumb_test.jpg"
    image_path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (100, 100), color="green").save(str(image_path))
    photo = Photo(
        filename="unlocked_thumb_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=100,
        height=100,
        aspect_ratio=1.0,
        is_locked=False,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/photos/{photo.id}/thumbnail")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_hls_playlist_marks_segment_discontinuities(monkeypatch):
    target = settings.UPLOAD_DIR / "hls_playlist_test.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"fake video payload")

    monkeypatch.setattr(
        hls_routes,
        "_probe_video_info",
        lambda _path: {"duration": 9.5},
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/hls/playlist?path={target}")

    assert response.status_code == 200
    playlist = response.text
    assert "#EXT-X-DISCONTINUITY" in playlist
    assert playlist.count("#EXTINF:") == 3
    assert playlist.count("#EXT-X-DISCONTINUITY") == 2


@pytest.mark.asyncio
async def test_hls_segment_encoder_resets_timestamps_and_maps_audio(monkeypatch, tmp_path):
    target = settings.UPLOAD_DIR / "hls_segment_test.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(b"fake video payload")

    monkeypatch.setattr(
        hls_routes,
        "_probe_video_info",
        lambda _path: {
            "codec": "h264",
            "color_space": "bt709",
            "audio_codec": "aac",
            "pix_fmt": "yuv420p",
        },
    )
    monkeypatch.setattr(hls_routes, "_select_gpu_mode", lambda: "cpu")

    async def _false_probe():
        return False

    monkeypatch.setattr(hls_routes, "_probe_nvenc", _false_probe)
    monkeypatch.setattr(hls_routes, "_probe_scale_cuda", _false_probe)
    monkeypatch.setattr(hls_routes, "_probe_vaapi", _false_probe)

    captured = {}

    class DummyProcess:
        returncode = 0

        async def communicate(self):
            output_path = Path(captured["cmd"][-1])
            output_path.write_bytes(b"fake ts payload")
            return b"", b""

    async def fake_create_subprocess_exec(*cmd, **kwargs):
        captured["cmd"] = list(cmd)
        return DummyProcess()

    monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_create_subprocess_exec)

    from app.services.processing_queue import processing_queue

    monkeypatch.setattr(processing_queue._throttler, "increment_video_ops", lambda: None)
    monkeypatch.setattr(processing_queue._throttler, "decrement_video_ops", lambda: None)

    done_event = asyncio.Event()
    await hls_routes._encode_segment(target, "unit-test-hash", 1, done_event)

    cmd = captured["cmd"]
    assert done_event.is_set()
    assert "-fflags" in cmd and "+genpts" in cmd
    assert "-avoid_negative_ts" in cmd and "make_zero" in cmd
    assert "-mpegts_flags" in cmd and "+resend_headers" in cmd
    assert cmd.count("-map") == 2
    assert "0:v:0" in cmd
    assert "0:a:0?" in cmd
