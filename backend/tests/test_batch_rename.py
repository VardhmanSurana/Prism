"""Tests for utilities batch-rename endpoint."""
import pytest
from httpx import AsyncClient, ASGITransport
from pathlib import Path
from app.main import app


@pytest.mark.asyncio
async def test_batch_rename_dry_run_and_apply(tmp_path, monkeypatch):
    """Create files under Pictures (allowed write root) when available, else skip path checks via home Pictures."""
    pictures = (Path.home() / "Pictures").resolve()
    pictures.mkdir(parents=True, exist_ok=True)

    work = pictures / ".prism_test_batch_rename"
    work.mkdir(exist_ok=True)
    f1 = work / "DSC001.JPG"
    f2 = work / "DSC002.JPG"
    f1.write_bytes(b"a")
    f2.write_bytes(b"b")

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Dry run
            res = await client.post(
                "/api/v1/utilities/batch-rename",
                json={
                    "paths": [str(f1), str(f2)],
                    "pattern": "Vacation_{nnn}",
                    "start_index": 1,
                    "dry_run": True,
                    "preserve_extension": True,
                },
            )
            assert res.status_code == 200, res.text
            data = res.json()
            assert data["dry_run"] is True
            assert data["failed"] == 0
            names = [r["dest_name"] for r in data["results"]]
            assert names == ["Vacation_001.JPG", "Vacation_002.JPG"]
            # Files still original
            assert f1.exists() and f2.exists()

            # Apply
            res2 = await client.post(
                "/api/v1/utilities/batch-rename",
                json={
                    "paths": [str(f1), str(f2)],
                    "pattern": "Vacation_{nnn}",
                    "start_index": 1,
                    "dry_run": False,
                    "preserve_extension": True,
                },
            )
            assert res2.status_code == 200, res2.text
            body = res2.json()
            assert body["renamed"] == 2
            assert not f1.exists() and not f2.exists()
            assert (work / "Vacation_001.JPG").exists()
            assert (work / "Vacation_002.JPG").exists()
    finally:
        for p in work.glob("*"):
            try:
                p.unlink()
            except OSError:
                pass
        try:
            work.rmdir()
        except OSError:
            pass


@pytest.mark.asyncio
async def test_batch_rename_rejects_path_traversal():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/utilities/batch-rename",
            json={
                "paths": ["/etc/passwd"],
                "pattern": "evil_{n}",
                "dry_run": True,
            },
        )
        # Plan marks item as failed (access denied) rather than 500
        assert res.status_code == 200
        data = res.json()
        assert data["failed"] >= 1
        assert data["results"][0]["ok"] is False
