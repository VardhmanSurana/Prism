"""Formatting utilities for metadata and size conversion."""


def format_size(size_bytes: int) -> str:
    """Format bytes to human-readable size string."""
    value: float = float(size_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024.0:
            return f"{value:.1f} {unit}"
        value /= 1024.0
    return f"{value:.1f} TB"


def build_metadata_string(meta: dict) -> str:
    """Format image metadata into a human-readable prompt context."""
    lines = [
        f"Image Filename: {meta.get('filename', 'unknown')}",
        f"Dimensions: {meta['width']} x {meta['height']} px",
        f"Aspect ratio: {meta.get('aspect_ratio', 'N/A')}",
        f"Format: {meta['format']}",
        f"Color mode: {meta['mode']}",
        f"File size: {meta['file_size']}",
    ]

    exif = meta.get("exif")
    if exif:
        lines.append("")
        lines.append("Camera EXIF metadata:")
        for key, val in exif.items():
            lines.append(f"  {key}: {val}")

    return "\n".join(lines)
