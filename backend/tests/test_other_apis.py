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
