"""Tests for people, explore, stories, privacy, LAN sync, utilities, and settings APIs."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_people_api_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/people/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_people_api_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/people/", json={"name": "Test Person"})
    assert response.status_code == 405

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        get_resp = await client.get("/api/v1/people/")
    assert get_resp.status_code == 200
    assert isinstance(get_resp.json(), list)


@pytest.mark.asyncio
async def test_explore_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/explore/themes")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


@pytest.mark.asyncio
async def test_stories_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/stories/event/1")
    assert response.status_code in (404, 400, 500)


@pytest.mark.asyncio
async def test_privacy_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/privacy/status")
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data or "features" in data or "verdict" in data


@pytest.mark.asyncio
async def test_lan_sync_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/lan/discover")
    assert response.status_code in (503, 200)
    if response.status_code == 200:
        assert isinstance(response.json(), dict)


@pytest.mark.asyncio
async def test_utilities_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/utilities/diagnostics")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


@pytest.mark.asyncio
async def test_settings_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/settings/sync")
    assert response.status_code == 200
    assert isinstance(response.json(), dict)


@pytest.mark.asyncio
async def test_general_settings_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET general settings
        get_res = await client.get("/api/v1/settings/general")
        assert get_res.status_code == 200
        data = get_res.json()
        assert "ENABLE_IMAGE_BG_PROCESS" in data
        assert "GPU_MODE" in data

        # POST to disable AI inpainting
        post_payload = {
            "ENABLE_IMAGE_BG_PROCESS": True,
            "ENABLE_AI_CLIP": True,
            "ENABLE_AI_FACE": True,
            "ENABLE_AI_CAPTION": True,
            "ENABLE_AI_OCR": True,
            "ENABLE_VIDEO_BG_PROCESS": True,
            "ENABLE_VIDEO_FACE": True,
            "ENABLE_AI_SUBTITLES": True,
            "ENABLE_AI_AGENT": True,
            "ENABLE_AI_INPAINTING": False,  # disable inpainting
            "ENABLE_VIDEO_EDITOR_AI": True,
            "GPU_MODE": "cpu"
        }
        post_res = await client.post("/api/v1/settings/general", json=post_payload)
        assert post_res.status_code == 200
        
        # Verify in-memory settings are updated
        from app.config import settings
        assert settings.ENABLE_AI_INPAINTING is False
        assert settings.GPU_MODE == "cpu"

        # Try to call inpaint process endpoint; should fail with 400
        inpaint_payload = {
            "mask_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "operation": "remove",
            "model": "lama"
        }
        inpaint_res = await client.post("/api/v1/photos/inpaint/process", json=inpaint_payload)
        assert inpaint_res.status_code == 400
        assert "disabled in settings" in inpaint_res.json()["detail"]

        # Restore original settings
        post_payload["ENABLE_AI_INPAINTING"] = True
        post_payload["GPU_MODE"] = "cuda"
        restore_res = await client.post("/api/v1/settings/general", json=post_payload)
        assert restore_res.status_code == 200
        assert settings.ENABLE_AI_INPAINTING is True


@pytest.mark.asyncio
async def test_background_jobs_control_apis():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Stop background jobs
        stop_res = await client.post("/api/v1/utilities/background-jobs/stop")
        assert stop_res.status_code == 200
        assert stop_res.json()["status"] == "stopped"
        assert stop_res.json()["paused"] is True

        # Get status and verify paused is True
        status_res = await client.get("/api/v1/utilities/background-jobs/status")
        assert status_res.status_code == 200
        assert status_res.json()["paused"] is True

        # Start background jobs
        start_res = await client.post("/api/v1/utilities/background-jobs/start")
        assert start_res.status_code == 200
        assert start_res.json()["status"] == "started"
        assert start_res.json()["paused"] is False
        assert "enqueued_count" in start_res.json()

        # Get status and verify paused is False
        status_res2 = await client.get("/api/v1/utilities/background-jobs/status")
        assert status_res2.status_code == 200
        assert status_res2.json()["paused"] is False
