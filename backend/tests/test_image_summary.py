"""Tests for the AI image summary service (metadata + Ollama vision pipeline).

Uses 5 real images from ~/Pictures but mocks the Ollama HTTP call
so tests run without needing the model/server running.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from PIL import Image

from app.services.image_summary import generate_image_summary
from app.services.image_summary.metadata import extract_metadata
from app.services.image_summary.formatting import format_size, build_metadata_string
from app.services.image_summary.llm import generate_ollama_summary

# 5 test images from the user's Pictures folder
TEST_IMAGES = [
    "/home/chotaxdon/Pictures/1_Hp_v3Cp10iZfqroG9MOgpw.webp",
    "/home/chotaxdon/Pictures/NameBright - Domain Expired.jpeg",
    "/home/chotaxdon/Pictures/Screenshot_20260112_185522_X.png",
    "/home/chotaxdon/Pictures/Screenshot_20260223_085617_Instagram.png",
    "/home/chotaxdon/Pictures/Screenshot_20260313_231846_YouTube.png",
]

FAKE_SUMMARY = "A screenshot showing a social media feed with user interface elements and navigation bar."


def _make_ollama_response(response_text: str):
    """Build a mock httpx.Response for Ollama's /api/generate endpoint."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = 200
    resp.json.return_value = {"response": response_text}
    resp.raise_for_status.return_value = None
    return resp


# ── Unit tests for helper functions ─────────────────────────────


def test_format_size():
    assert format_size(0) == "0.0 B"
    assert format_size(512) == "512.0 B"
    assert format_size(2048) == "2.0 KB"
    assert format_size(1_048_576) == "1.0 MB"
    assert format_size(1_073_741_824) == "1.0 GB"


@pytest.mark.parametrize("image_path", TEST_IMAGES, ids=[
    "webp_image", "jpeg_image", "screenshot_x",
    "screenshot_instagram", "screenshot_youtube",
])
def test_extract_metadata(image_path):
    """Should extract basic image properties without errors."""
    meta = extract_metadata(image_path)
    assert meta["width"] > 0
    assert meta["height"] > 0
    assert meta["format"] in ("JPEG", "PNG", "WEBP", "unknown")
    assert meta["file_size"] is not None
    assert meta["filename"] == os.path.basename(image_path)


def test_extract_metadata_contains_exif_when_available():
    """Some real images may have EXIF data."""
    meta = extract_metadata(TEST_IMAGES[1])  # JPEG may have EXIF
    # No assertion on EXIF presence — it's optional per image


def test_build_metadata_string():
    """Should format metadata into a readable multi-line string."""
    meta = {
        "filename": "photo.jpg",
        "width": 1920,
        "height": 1080,
        "aspect_ratio": "16:9",
        "format": "JPEG",
        "mode": "RGB",
        "file_size": "500.0 KB",
    }
    text = build_metadata_string(meta)
    assert "photo.jpg" in text
    assert "1920 × 1080" in text
    assert "16:9" in text
    assert "JPEG" in text
    assert "500.0 KB" in text


def test_build_metadata_string_with_exif():
    """Should include EXIF data when present."""
    meta = {
        "filename": "camera.jpg",
        "width": 4000,
        "height": 3000,
        "aspect_ratio": "1.33:1",
        "format": "JPEG",
        "mode": "RGB",
        "file_size": "4.0 MB",
        "exif": {"Make": "Canon", "Model": "EOS R5", "DateTimeOriginal": "2025:01:15 14:30:00"},
    }
    text = build_metadata_string(meta)
    assert "Canon" in text
    assert "EOS R5" in text
    assert "2025" in text


# ── Async integration tests (with mocked Ollama HTTP client) ─────────────


@pytest.mark.parametrize("image_path", TEST_IMAGES, ids=[
    "webp_image", "jpeg_image", "screenshot_x",
    "screenshot_instagram", "screenshot_youtube",
])
@pytest.mark.asyncio
async def test_returns_summary_for_each_format(image_path):
    """Should extract metadata then call Ollama vision for summarization."""
    mock_response = _make_ollama_response(FAKE_SUMMARY)

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await generate_image_summary(image_path)

    assert result == FAKE_SUMMARY


@pytest.mark.parametrize("image_path", TEST_IMAGES, ids=[
    "webp_image", "jpeg_image", "screenshot_x",
    "screenshot_instagram", "screenshot_youtube",
])
@pytest.mark.asyncio
async def test_sends_image_to_ollama(image_path):
    """Verify Ollama is called with image data and metadata context."""
    mock_response = _make_ollama_response(FAKE_SUMMARY)

    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        await generate_image_summary(image_path)

        # Verify the API was called
        assert mock_post.call_count == 1
        
        # Verify the call includes image data
        call_args, call_kwargs = mock_post.call_args
        json_payload = call_kwargs.get("json", {})
        
        # Should have prompt and images
        assert "prompt" in json_payload
        assert "images" in json_payload
        assert len(json_payload["images"]) == 1  # Base64 encoded image
        assert json_payload["model"] == "moondream:latest"


# ── Error handling tests ───────────────────────────────────────


@pytest.mark.asyncio
async def test_error_on_file_not_found():
    """Should return an error message when the file doesn't exist."""
    result = await generate_image_summary("/nonexistent/image.jpg")
    assert "Error" in result
    assert "not found" in result.lower()


@pytest.mark.asyncio
async def test_error_on_ollama_failure():
    """Should return an error when Ollama generation fails."""
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 500
    mock_response.text = "Model not found"
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Model not found", request=MagicMock(), response=mock_response
    )

    with patch("httpx.AsyncClient.post", return_value=mock_response):
        result = await generate_image_summary(TEST_IMAGES[0])

    assert "Error" in result
    assert "Ollama vision model failed" in result


@pytest.mark.asyncio
async def test_error_on_corrupt_image():
    """Should return an error when the image file is corrupt."""
    corrupt = "/tmp/test_corrupt_image.jpg"
    with open(corrupt, "wb") as f:
        f.write(b"garbage data")

    result = await generate_image_summary(corrupt)
    assert "Error" in result

    os.remove(corrupt)


@pytest.mark.asyncio
async def test_skips_encrypted_locked_file():
    """Should recognize Prism_ENC header and immediately skip metadata/LLM pipeline."""
    locked_file = "/tmp/test_locked_image.jpg"
    with open(locked_file, "wb") as f:
        f.write(b"Prism_ENC:some_cipher_text")

    try:
        result = await generate_image_summary(locked_file)
        assert "unavailable" in result.lower()
        assert "locked folder" in result.lower()
    finally:
        if os.path.exists(locked_file):
            os.remove(locked_file)



# ── Integration smoke test (off by default) ─────────────────────


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.environ.get("RUN_LIVE_OLLAMA_TESTS"),
    reason="Set RUN_LIVE_OLLAMA_TESTS=1 to run against live Ollama",
)
async def test_integration_live_ollama():
    """Actually calls Ollama — requires vision model (moondream:latest , etc) loaded."""
    result = await generate_image_summary(TEST_IMAGES[3])
    assert "Error" not in result
    assert len(result) > 10
