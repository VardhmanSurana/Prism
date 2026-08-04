"""Tests for the photos API endpoints."""

import asyncio
import os
import time
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image as PILImage
from unittest.mock import patch

from app.main import app
from app.models import Photo, Person, PhotoPerson
from app.config import settings
from app.services.sync_service import sync_service
from app.services.locked_service import locked_service


def _create_test_image(name: str) -> Path:
    path = settings.UPLOAD_DIR / name
    path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (200, 200), color="purple").save(str(path))
    return path


async def _ingest_photo(db_session, path: Path) -> Photo:
    sync_service.db_write_semaphore = asyncio.Semaphore()
    photo = await sync_service.ingest_photo(str(path), db_session)
    return photo


@pytest.mark.asyncio
async def test_list_photos_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/photos/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_list_photos_with_data(db_session):
    img1 = _create_test_image("photo_a.jpg")
    img2 = _create_test_image("photo_b.jpg")
    photo1 = Photo(
        filename="photo_a.jpg",
        path=str(img1),
        url=f"local://{img1}",
        width=200,
        height=200,
        aspect_ratio=1.0,
        mime_type="image/jpeg",
        file_type="image",
    )
    photo2 = Photo(
        filename="photo_b.jpg",
        path=str(img2),
        url=f"local://{img2}",
        width=200,
        height=200,
        aspect_ratio=1.0,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add_all([photo1, photo2])
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/photos/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    filenames = {p["filename"] for p in data}
    assert "photo_a.jpg" in filenames
    assert "photo_b.jpg" in filenames


@pytest.mark.asyncio
async def test_photo_stats(db_session):
    img = _create_test_image("stats_photo.jpg")
    photo = Photo(
        filename="stats_photo.jpg",
        path=str(img),
        url=f"local://{img}",
        width=200,
        height=200,
        aspect_ratio=1.0,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/photos/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_photos" in data
    assert data["total_photos"] >= 1


@pytest.mark.asyncio
async def test_upload_photo_new(db_session):
    path = _create_test_image("upload_new.jpg")
    sync_service.db_write_semaphore = asyncio.Semaphore()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/photos/upload", json={"file_path": str(path)})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data.get("filename") == "upload_new.jpg"


@pytest.mark.asyncio
async def test_upload_photo_duplicate(db_session):
    path = _create_test_image("upload_dup.jpg")
    sync_service.db_write_semaphore = asyncio.Semaphore()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.post("/api/v1/photos/upload", json={"file_path": str(path)})
    assert first.status_code == 200

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        second = await client.post("/api/v1/photos/upload", json={"file_path": str(path)})
    assert second.status_code == 200


@pytest.mark.asyncio
async def test_upload_photo_invalid_path():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/photos/upload", json={"file_path": "/no/such/file.jpg"})
    assert response.status_code in (403, 404)


@pytest.mark.asyncio
async def test_lock_photo(db_session):
    image_path = _create_test_image("lock_test.jpg")
    photo = Photo(
        filename="lock_test.jpg",
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

    original_auth = locked_service._is_authenticated
    original_activity = locked_service.last_activity
    locked_service._is_authenticated = True
    locked_service.last_activity = time.time()

    try:
        with patch.object(locked_service, "encrypt_file", return_value=True):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post(f"/api/v1/photos/{photo.id}/lock")
        assert response.status_code == 200, response.text
        await db_session.refresh(photo)
        assert photo.is_locked is True
    finally:
        locked_service._is_authenticated = original_auth
        locked_service.last_activity = original_activity


@pytest.mark.asyncio
async def test_unlock_photo(db_session):
    image_path = _create_test_image("unlock_test.jpg")
    photo = Photo(
        filename="unlock_test.jpg",
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

    original_auth = locked_service._is_authenticated
    original_activity = locked_service.last_activity
    locked_service._is_authenticated = True
    locked_service.last_activity = time.time()

    try:
        with patch.object(locked_service, "decrypt_file", return_value=True):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                response = await client.post(f"/api/v1/photos/{photo.id}/unlock")
        assert response.status_code == 200, response.text
        await db_session.refresh(photo)
        assert photo.is_locked is False
    finally:
        locked_service._is_authenticated = original_auth
        locked_service.last_activity = original_activity


@pytest.mark.asyncio
async def test_favorite_photo(db_session):
    image_path = _create_test_image("fav_test.jpg")
    photo = Photo(
        filename="fav_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=100,
        height=100,
        aspect_ratio=1.0,
        is_favorite=False,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/photos/{photo.id}/favorite")
    assert response.status_code == 200
    data = response.json()
    assert data["is_favorite"] is True
    await db_session.refresh(photo)
    assert photo.is_favorite is True


@pytest.mark.asyncio
async def test_trash_photo(db_session):
    image_path = _create_test_image("trash_test.jpg")
    photo = Photo(
        filename="trash_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=100,
        height=100,
        aspect_ratio=1.0,
        is_trash=False,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/photos/{photo.id}/trash")
    assert response.status_code == 200
    await db_session.refresh(photo)
    assert photo.is_trash is True


@pytest.mark.asyncio
async def test_metadata_endpoint(db_session):
    image_path = _create_test_image("meta_test.jpg")
    photo = Photo(
        filename="meta_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=200,
        height=200,
        aspect_ratio=1.0,
        city="Testville",
        caption="A test photo",
        ocr_text="sample ocr text",
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/photos/{photo.id}/metadata")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == photo.id
    assert data["city"] == "Testville"
    assert data["ocr_text"] == "sample ocr text"


@pytest.mark.asyncio
async def test_directory_listing():
    directory = settings.UPLOAD_DIR / "test_dir"
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "a.jpg").write_bytes(b"fake")
    (directory / "b.jpg").write_bytes(b"fake")
    (directory / "c.txt").write_bytes(b"text")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/photos/expand-directory",
            json={"file_path": str(directory)},
        )
    assert response.status_code == 200
    data = response.json()
    assert "files" in data
    assert len(data["files"]) == 2
    names = {Path(f).name for f in data["files"]}
    assert "a.jpg" in names
    assert "b.jpg" in names


@pytest.mark.asyncio
async def test_ocr_endpoint(db_session, monkeypatch_flags):
    image_path = _create_test_image("ocr_test.jpg")
    photo = Photo(
        filename="ocr_test.jpg",
        path=str(image_path),
        url=f"local://{image_path}",
        width=200,
        height=200,
        aspect_ratio=1.0,
        ocr_text=None,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    monkeypatch_flags({"ENABLE_AI_OCR": True})

    import app.services.ocr as ocr_module
    original_get_ocr = ocr_module.OCRManager.get_ocr
    original_unload = ocr_module.OCRManager.unload
    ocr_module.OCRManager.get_ocr = staticmethod(lambda: (lambda x: "mocked ocr"))
    ocr_module.OCRManager.unload = staticmethod(lambda: None)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/v1/photos/{photo.id}/ocr")
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["photo_id"] == photo.id
        assert data["ocr_text"] == "mocked ocr"
    finally:
        ocr_module.OCRManager.get_ocr = staticmethod(original_get_ocr if callable(original_get_ocr) else (lambda self: None))
        ocr_module.OCRManager.unload = staticmethod(original_unload if callable(original_unload) else (lambda self: None))
        await db_session.refresh(photo)
        assert photo.ocr_text == "mocked ocr"


@pytest.mark.asyncio
async def test_upload_blob_overwrite(db_session):
    from datetime import datetime
    import io
    from PIL import Image
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.config import settings

    image_path = _create_test_image("blob_overwrite.jpg")
    photo = Photo(
        filename="blob_overwrite.jpg",
        path=str(image_path),
        url="/thumbnails/old_hash.webp",
        width=100,
        height=100,
        aspect_ratio=1.0,
        mime_type="image/jpeg",
        file_type="image",
        hash="old_hash",
        upload_date=datetime.utcnow()
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    old_thumb_file = settings.THUMBNAILS_DIR / "old_hash.webp"
    settings.THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
    with open(old_thumb_file, "w") as f:
        f.write("mock_thumb_content")

    new_image_data = io.BytesIO()
    new_img = Image.new('RGB', (200, 200), color='red')
    new_img.save(new_image_data, format='JPEG')
    new_image_data.seek(0)

    files = {
        "file": ("blob_overwrite.jpg", new_image_data, "image/jpeg")
    }
    data = {
        "original_path": str(image_path),
        "is_save_as": "false"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/photos/upload-blob", files=files, data=data)
    
    assert response.status_code == 200, response.text
    response_data = response.json()
    assert response_data["id"] == photo.id
    
    await db_session.refresh(photo)
    assert photo.width == 200
    assert photo.height == 200
    assert photo.hash != "old_hash"
    assert photo.url.startswith("/thumbnails/")
    assert photo.url != "/thumbnails/old_hash.webp"
    assert not old_thumb_file.exists()
