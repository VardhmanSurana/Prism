"""Main image summary service — orchestrates metadata extraction and Ollama vision inference.

Uses Ollama vision models (moondream:latest , etc.) to analyze actual image pixels
while preserving metadata extraction for context and database storage.
"""

from .metadata import extract_metadata
from .llm import generate_ollama_summary


async def generate_image_summary(image_path: str) -> str:
    """
    Generate an image summary using Ollama vision model with actual pixel analysis.

    1. Guard against encrypted locked files (Prism_ENC header).
    2. Extract and store metadata (dimensions, format, EXIF, etc.) using Pillow.
    3. Send actual image pixels to Ollama vision model for analysis.
    4. Return generated description while preserving metadata in database.

    Args:
        image_path: Absolute path to the image file.

    Returns:
        A summary string describing the image content based on visual analysis.
    """
    # ── Guard: skip encrypted locked files ─────────────────────
    try:
        with open(image_path, "rb") as fh:
            header = fh.read(13)
        if header.startswith(b"Prism_ENC:"):
            return "Summary unavailable: this photo is stored encrypted in the Locked Folder."
    except FileNotFoundError:
        return "Error: Image file not found."
    except Exception as e:
        return f"Error: Could not read file header — {str(e)}"

    # ── Step 1: Extract technical metadata (stored as-is, NOT sent to Ollama) ─
    try:
        meta = extract_metadata(image_path)
    except FileNotFoundError:
        return "Error: Image file not found."
    except Exception as e:
        return f"Error: Could not read image metadata — {str(e)}"

    # NOTE: metadata is extracted above for internal storage only.
    # It is intentionally NOT passed to the vision model — the model should
    # describe only what it sees in the pixels, not be biased by EXIF data.

    # ── Step 2: Send image to Ollama vision model (pixels only) ────────────────
    try:
        summary = await generate_ollama_summary(image_path)
    except RuntimeError as e:
        return f"Error: Ollama vision model failed — {str(e)}"
    except Exception as e:
        return f"Error: Failed to generate summary — {str(e)}"

    return summary if summary else "Could not generate description from image."
