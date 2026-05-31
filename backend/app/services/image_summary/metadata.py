"""Image metadata extraction using Pillow."""

import os
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS

from .formatting import format_size

# EXIF tags we care about — allowlist keeps the LLM prompt clean and concise
_WANTED_EXIF_TAGS = frozenset({
    "DateTimeOriginal", "DateTimeDigitized", "DateTime",
    "Make", "Model", "Software",
    "ISOSpeedRatings", "FocalLength", "FNumber",
    "ExposureTime", "Flash",
    "ImageDescription", "GPSInfo",
    "Orientation",
})


def extract_metadata(image_path: str) -> dict:
    """Extract image properties using Pillow: dimensions, format, EXIF, color info."""
    meta = {}
    with Image.open(image_path) as img:
        meta["format"] = img.format or "unknown"
        meta["width"] = img.width
        meta["height"] = img.height
        meta["mode"] = img.mode
        meta["file_size"] = format_size(os.path.getsize(image_path))
        meta["filename"] = os.path.basename(image_path)

        # Aspect ratio
        ratio = img.width / img.height if img.height else 1
        meta["aspect_ratio"] = f"{ratio:.2f}:1"

        try:
            raw_exif = img.getexif()
        except Exception:
            raw_exif = {}

        if raw_exif:
            exif = {}
            for tag_id, value in raw_exif.items():
                tag_name = TAGS.get(tag_id, tag_id)
                if tag_name not in _WANTED_EXIF_TAGS:
                    continue
                if isinstance(value, bytes):
                    try:
                        value = value.decode("utf-8", errors="replace")
                    except Exception:
                        continue
                exif[tag_name] = str(value)
            if exif:
                meta["exif"] = exif
    return meta
