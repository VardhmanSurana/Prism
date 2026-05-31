"""Ollama vision client for image summarization.

Sends actual image data to Ollama vision models 
for pixel-level analysis while preserving metadata extraction.
"""

import base64
import logging
from pathlib import Path

import httpx
from app.config import settings

logger = logging.getLogger(__name__)

# Default Ollama endpoint - can be overridden via config
OLLAMA_BASE_URL = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = getattr(settings, "OLLAMA_VISION_MODEL", "moondream:latest").strip()
OLLAMA_TIMEOUT = getattr(settings, "OLLAMA_TIMEOUT", 120)


async def generate_ollama_summary(image_path: str) -> str:
    """
    Generate image summary using Ollama vision model with actual image data.
    Only the raw image pixels are sent — no metadata, EXIF, or location context
    is injected into the prompt so the model analyses what it visually sees.

    Args:
        image_path: Absolute path to the image file

    Returns:
        Generated summary string describing the image content
    """
    image_path_obj = Path(image_path)
    if not image_path_obj.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    # Read and encode image as base64
    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to read/encode image {image_path}: {e}")
        raise RuntimeError(f"Failed to encode image: {e}")

    # Pure visual prompt — robust against self-referential UI screenshot text
    prompt = "Describe what is shown in this image."
    
    # Call Ollama API with vision
    try:
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 150,
                    }
                }
            )
            response.raise_for_status()
            data = response.json()
            
            summary = data.get("response", "").strip()
            # Clean up known hallucinated/nonsense outputs from smaller vision models
            if not summary or summary.lower() in ("urn", "unknown", "error", "null", "none"):
                logger.warning(f"Ollama returned empty or invalid summary for {image_path}: {summary}")
                return "Could not generate description from image."
            
            logger.info(f"Generated Ollama summary for {image_path}: {summary[:100]}...")
            return summary
            
    except httpx.ConnectError as e:
        logger.error(f"Cannot connect to Ollama at {OLLAMA_BASE_URL}: {e}")
        raise RuntimeError(
            f"Ollama not available at {OLLAMA_BASE_URL}. "
            "Please ensure Ollama is running and the vision model is pulled."
        )
    except httpx.HTTPStatusError as e:
        logger.error(f"Ollama API error: {e.response.status_code} - {e.response.text}")
        raise RuntimeError(f"Ollama API error: {e.response.text}")
    except Exception as e:
        logger.error(f"Unexpected error calling Ollama: {e}")
        raise RuntimeError(f"Failed to generate summary: {e}")


def check_ollama_available() -> bool:
    """Check if Ollama server is reachable."""
    try:
        import httpx
        response = httpx.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        return response.status_code == 200
    except Exception:
        return False
