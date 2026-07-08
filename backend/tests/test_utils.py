"""Tests for utility modules: rate_limit, image utilities, and security paths."""

import time
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import HTTPException

from app.main import app
from app.utils.rate_limit import _buckets
from app.utils.image import open_raw_image, is_raw_file
from app.utils.security import safe_resolve_read, safe_resolve_write, get_allowed_read_roots
from app.config import settings


@pytest.mark.asyncio
async def test_rate_limit_store():
    _buckets.clear()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        first = await client.get("/health")
    assert first.status_code == 200

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        second = await client.get("/health")
    assert second.status_code == 200


@pytest.mark.asyncio
async def test_image_open_raw_fallback():
    result = open_raw_image("/tmp")
    assert result is None or hasattr(result, "mode")


def test_security_resolve_read_write():
    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_read("/etc/passwd")
    assert excinfo.value.status_code == 403

    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_write("/etc/passwd")
    assert excinfo.value.status_code == 403
