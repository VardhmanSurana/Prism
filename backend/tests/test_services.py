"""Tests for the sync service, processing queue, LAN sync service, and AI orchestrator."""

import asyncio
import time
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient, ASGITransport
from PIL import Image as PILImage

from app.main import app
from app.models import Photo
from app.services.sync_service import sync_service
from app.services.processing_queue import processing_queue
from app.config import settings


@pytest.mark.asyncio
async def test_sync_service_ingest_new_photo(db_session):
    sync_service.db_write_semaphore = asyncio.Semaphore()

    path = settings.UPLOAD_DIR / "ingest_new.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (120, 80), color="orange").save(str(path))

    photo = await sync_service.ingest_photo(str(path), db_session)
    assert photo is not None
    assert photo.filename == "ingest_new.jpg"
    assert photo.width == 120
    assert photo.height == 80


@pytest.mark.asyncio
async def test_sync_service_ingest_duplicate(db_session):
    sync_service.db_write_semaphore = asyncio.Semaphore()

    path = settings.UPLOAD_DIR / "ingest_dup.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (120, 80), color="orange").save(str(path))

    first = await sync_service.ingest_photo(str(path), db_session)
    assert first is not None

    second = await sync_service.ingest_photo(str(path), db_session)
    assert second is not None
    assert second.id == first.id


@pytest.mark.asyncio
async def test_processing_queue_enqueue_dequeue(db_session):
    path = settings.UPLOAD_DIR / "queue_test.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    PILImage.new("RGB", (120, 80), color="yellow").save(str(path))

    photo = Photo(
        filename="queue_test.jpg",
        path=str(path),
        url=f"local://{path}",
        width=120,
        height=80,
        aspect_ratio=1.5,
        mime_type="image/jpeg",
        file_type="image",
    )
    db_session.add(photo)
    await db_session.commit()
    await db_session.refresh(photo)

    processing_queue.enqueue(photo.id, photo.path)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/utilities/background-jobs/status")
    assert response.status_code == 200
    data = response.json()
    assert "queue" in data


@pytest.mark.asyncio
async def test_lan_sync_service_start_stop():
    from app.services.lan_sync import lan_sync_service
    original = lan_sync_service._zeroconf
    lan_sync_service._zeroconf = None

    await lan_sync_service.start()
    await lan_sync_service.stop()

    lan_sync_service._zeroconf = original


@pytest.mark.asyncio
async def test_ai_orchestrator_server_lifecycle():
    from app.services.ai_orchestrator import AIOrchestrator

    with patch.object(AIOrchestrator, "_is_process_running", return_value=False):
        with patch("app.services.ai_orchestrator.subprocess.Popen"):
            AIOrchestrator.stop_server()
