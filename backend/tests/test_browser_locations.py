"""Tests for browser mount discovery and external locations API."""
import pytest
from httpx import AsyncClient, ASGITransport
from pathlib import Path
import subprocess
from app.main import app
from app.utils.mounts import discover_browser_mounts
from app.utils.security import get_allowed_read_roots, safe_resolve_read


def test_home_is_allowed_read_root():
    home = Path.home().resolve()
    roots = get_allowed_read_roots()
    assert any(home == r or home.is_relative_to(r) for r in roots)
    # Direct access to home should succeed
    resolved = safe_resolve_read(str(home))
    assert resolved == home


def test_discover_browser_mounts_returns_list():
    mounts = discover_browser_mounts()
    assert isinstance(mounts, list)
    for m in mounts:
        assert "name" in m and "path" in m and "kind" in m
        assert m["kind"] in ("network", "removable", "volume")


@pytest.mark.asyncio
async def test_browser_locations_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/utilities/browser-locations")
        assert res.status_code == 200
        data = res.json()
        assert "mounts" in data
        assert "external_locations" in data
        assert "providers" in data
        assert "home_path" in data
        assert len(data["providers"]) >= 4
        ids = {p["id"] for p in data["providers"]}
        assert "local_path" in ids and "s3" in ids


@pytest.mark.asyncio
async def test_external_location_crud(tmp_path, monkeypatch):
    # Use a real subdir under home Pictures so allowed roots accept it
    pictures = Path.home() / "Pictures"
    pictures.mkdir(parents=True, exist_ok=True)
    work = pictures / ".prism_test_ext_loc"
    work.mkdir(exist_ok=True)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Create
            res = await client.post(
                "/api/v1/utilities/external-locations",
                json={
                    "provider": "local_path",
                    "name": "Test NAS Path",
                    "mount_path": str(work),
                },
            )
            assert res.status_code == 200, res.text
            loc = res.json()
            assert loc["id"]
            assert loc["status"] == "available"
            loc_id = loc["id"]

            # List
            res2 = await client.get("/api/v1/utilities/external-locations")
            assert res2.status_code == 200
            ids = [l["id"] for l in res2.json()["locations"]]
            assert loc_id in ids

            # Delete
            res3 = await client.delete(f"/api/v1/utilities/external-locations/{loc_id}")
            assert res3.status_code == 200
    finally:
        try:
            work.rmdir()
        except OSError:
            pass


@pytest.mark.asyncio
async def test_open_in_os_explorer_for_allowed_file(monkeypatch):
    pictures = Path.home() / "Pictures"
    pictures.mkdir(parents=True, exist_ok=True)
    target = pictures / ".prism_test_open_in_explorer.jpg"
    target.write_bytes(b"test")

    calls: list[list[str]] = []

    class DummyProcess:
        def __init__(self, args):
            self.args = args

    def fake_popen(args, stdout=None, stderr=None):
        calls.append(list(args))
        return DummyProcess(args)

    monkeypatch.setattr(subprocess, "Popen", fake_popen)

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post(
                "/api/v1/utilities/open-in-os-explorer",
                json={"path": str(target)},
            )

        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "ok"
        assert data["opened_path"] == str(target.resolve())
        assert calls, "expected explorer command to be launched"
    finally:
        target.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_open_in_os_explorer_rejects_outside_allowed_roots():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/utilities/open-in-os-explorer",
            json={"path": "/etc/shadow"},
        )

    assert res.status_code == 403
