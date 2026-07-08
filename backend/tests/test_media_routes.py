"""Tests for media serving routes: /local, /transcode, and photo thumbnails."""

import io
import os
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image as PILImage

from app.main import app
from app.models import Photo
from app.config import settings


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
