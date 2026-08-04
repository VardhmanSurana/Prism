"""
Content classifier: determines whether a photo is a screenshot, document, or regular photo.
Uses cheap heuristics first (EXIF, resolution, format, OCR density, whiteness).
No ML model needed for the vast majority of cases.
"""

import os
import logging
from enum import Enum

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class ContentType(str, Enum):
    PHOTO = "photo"
    SCREENSHOT = "screenshot"
    DOCUMENT = "document"


# Common phone and monitor screen resolutions (width, height).
# Includes both portrait and landscape orientations.
SCREEN_RESOLUTIONS = {
    # iPhone
    (1170, 2532), (1179, 2556), (1290, 2796), (1284, 2778),
    (1125, 2436), (1080, 1920), (750, 1334), (640, 1136),
    # Android phones
    (1080, 2400), (1440, 3200), (1080, 2340), (1080, 2160),
    (1440, 2560), (1080, 1920), (720, 1280), (1080, 2280),
    (1080, 2220), (1080, 2200), (1080, 2240),
    # Monitors
    (1920, 1080), (2560, 1440), (3840, 2160), (1280, 720),
    (1680, 1050), (1366, 768), (1440, 900), (2560, 1080),
    (3440, 1440), (5120, 2880),
    # iPad
    (2048, 2732), (1668, 2388), (1640, 2360), (1536, 2048),
    (1620, 2160),
}

# Filename patterns that strongly suggest screenshots
SCREENSHOT_FILENAME_PATTERNS = [
    "screenshot", "screen shot", "screen_shot", "screen-shot",
    "capture", "snip", "clipboard",
]


def _has_camera_exif(exif_make: str | None, exif_model: str | None) -> bool:
    """Check if EXIF indicates a real camera/phone photo."""
    return bool(exif_make and exif_make.strip())


def _is_screen_resolution(width: int, height: int) -> bool:
    """Check if dimensions match a known screen resolution."""
    dims = (width, height)
    return dims in SCREEN_RESOLUTIONS or (height, width) in SCREEN_RESOLUTIONS


def _matches_screenshot_filename(filename: str) -> bool:
    """Check if filename matches common screenshot naming patterns."""
    lower = filename.lower()
    return any(pat in lower for pat in SCREENSHOT_FILENAME_PATTERNS)


def _compute_whiteness_ratio(thumbnail_path: str) -> float:
    """Compute the fraction of near-white pixels in an image.
    Documents typically have >60% white background."""
    try:
        img = cv2.imread(thumbnail_path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0.0
        # Pixels above 230 brightness (out of 255) count as "white"
        white_mask = img > 230
        return float(np.sum(white_mask)) / img.size
    except Exception as e:
        logger.debug(f"Failed to compute whiteness ratio: {e}")
        return 0.0


def _compute_ocr_text_coverage(ocr_text: str | None, width: int, height: int) -> float:
    """Estimate text density from OCR text.
    Returns approximate fraction of image area covered by text."""
    if not ocr_text or not ocr_text.strip():
        return 0.0

    text = ocr_text.strip()
    # Rough heuristic: ~15 characters per line, ~20px per character height at typical DPI
    # for a 1000px-tall image. Normalize by image area.
    char_count = len(text)
    line_count = text.count('\n') + 1
    # Estimate bounding box: each line ~80 chars wide, ~20px tall
    estimated_text_area = line_count * 20 * min(char_count / max(line_count, 1), 80) * 1.2
    image_area = width * height
    if image_area == 0:
        return 0.0
    return min(estimated_text_area / image_area, 1.0)


def classify_content(
    width: int,
    height: int,
    file_ext: str,
    exif_make: str | None = None,
    exif_model: str | None = None,
    ocr_text: str | None = None,
    thumbnail_path: str | None = None,
    filename: str = "",
) -> ContentType:
    """Classify an image as photo, screenshot, or document using heuristics.

    Args:
        width: Image width in pixels.
        height: Image height in pixels.
        file_ext: File extension (e.g. '.jpg', '.png').
        exif_make: EXIF Make field (camera manufacturer).
        exif_model: EXIF Model field (camera model).
        ocr_text: Extracted OCR text (if available).
        thumbnail_path: Path to thumbnail for histogram analysis.
        filename: Original filename for pattern matching.

    Returns:
        ContentType enum value.
    """
    has_camera = _has_camera_exif(exif_make, exif_model)
    is_screen_res = _is_screen_resolution(width, height)
    is_png = file_ext.lower() == ".png"
    matches_screenshot_name = _matches_screenshot_filename(filename)

    # ── Screenshot detection ──
    # High confidence: no camera EXIF + screen resolution
    # Medium confidence: no camera EXIF + PNG + screenshot filename
    if not has_camera:
        if is_screen_res:
            return ContentType.SCREENSHOT
        if is_png and matches_screenshot_name:
            return ContentType.SCREENSHOT
        if is_png and not has_camera:
            # PNG without camera EXIF is very likely a screenshot
            return ContentType.SCREENSHOT

    # ── Document detection ──
    # Uses OCR text density + whiteness as signals
    ocr_coverage = _compute_ocr_text_coverage(ocr_text, width, height)
    whiteness = 0.0
    if thumbnail_path and os.path.exists(thumbnail_path):
        whiteness = _compute_whiteness_ratio(thumbnail_path)

    if ocr_coverage > 0.15 and whiteness > 0.6:
        return ContentType.DOCUMENT

    return ContentType.PHOTO


def classify_photo_from_db(photo) -> ContentType:
    """Convenience wrapper that classifies a Photo model instance.

    Reads width, height, mime_type, ocr_text, and the file from disk.
    EXIF Make/Model should be stored on the Photo model if available,
    but we fall back to filename heuristics.
    """
    ext = os.path.splitext(photo.filename)[1] if photo.filename else ""
    return classify_content(
        width=photo.width,
        height=photo.height,
        file_ext=ext,
        exif_make=getattr(photo, "exif_make", None),
        exif_model=getattr(photo, "exif_model", None),
        ocr_text=photo.ocr_text,
        thumbnail_path=photo.url if photo.url and not photo.url.startswith("local://") else None,
        filename=photo.filename or "",
    )
