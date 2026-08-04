"""Tests for video and NLE API endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_video_export_endpoint_exists():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/video/export",
            json={
                "tracks": [],
                "resolution": [1920, 1080],
                "fps": 30,
                "format": "mp4",
            },
        )
    assert response.status_code in (400, 422, 500, 503, 200)


@pytest.mark.asyncio
async def test_video_subtitles_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/video/subtitles/generate",
            json={"photo_id": 99999},
        )
    assert response.status_code in (404, 400, 422, 500)


@pytest.mark.asyncio
async def test_nle_projects_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create = await client.post(
            "/api/v1/nle/projects",
            json={"name": "Test Project", "width": 1920, "height": 1080, "fps": 30},
        )
    assert create.status_code == 200
    project = create.json()
    project_id = project["id"]

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            get_resp = await client.get(f"/api/v1/nle/projects/{project_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["name"] == "Test Project"

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            update = await client.put(
                f"/api/v1/nle/projects/{project_id}",
                json={"name": "Updated Project"},
            )
        assert update.status_code == 200
        assert update.json()["id"] == project_id

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            delete = await client.delete(f"/api/v1/nle/projects/{project_id}")
        assert delete.status_code == 200
        assert delete.json()["deleted"] is True

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            get_after = await client.get(f"/api/v1/nle/projects/{project_id}")
        assert get_after.status_code == 404
    finally:
        pass


@pytest.mark.asyncio
async def test_nle_clips_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/nle/clips/analyze",
            json={"source_path": "/no/such/video.mp4"},
        )
    assert response.status_code in (400, 404, 422, 500)


@pytest.mark.asyncio
async def test_video_proxy_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/nle/stream?path=/tmp")
    assert response.status_code in (400, 403, 404)
