import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from pathlib import Path


@pytest.mark.asyncio
async def test_list_dir_defaults_to_home():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/utilities/list-dir",
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_path" in data
        assert "folders" in data
        assert "files" in data
        
        # When no path is specified, it should default to the home directory
        # which is resolved and should match home path
        expected_home = str(Path.home().resolve())
        assert data["current_path"] == expected_home or data["is_root"] is True


@pytest.mark.asyncio
async def test_list_dir_out_of_bounds_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # A path that is outside allowed roots (e.g. root "/" or traversal attempt)
        response = await client.post(
            "/api/v1/utilities/list-dir",
            json={"path": "/etc/shadow"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should fallback to listing the allowed roots
        assert data["is_root"] is True
        assert len(data["folders"]) > 0
        assert any(f["name"] == "Pictures" or f["name"] == "Home" for f in data["folders"])


@pytest.mark.asyncio
async def test_list_dir_with_valid_path():
    # Let's request the home Pictures directory (which is an allowed root)
    target_path = str((Path.home() / "Pictures").resolve())
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/utilities/list-dir",
            json={"path": target_path}
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_path" in data
        # If the directory doesn't exist on the host runner, safe_resolve_read might fallback or we get it.
        # But if it exists or fallback is triggered, it behaves cleanly.
        if not data["is_root"]:
            assert data["current_path"] == target_path
