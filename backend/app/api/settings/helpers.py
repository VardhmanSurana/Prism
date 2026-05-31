"""JSON settings file helpers."""
import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def _read_settings() -> dict:
    """Read the full settings.json, returning {} if missing or corrupt."""
    try:
        if settings.SETTINGS_FILE.exists():
            with open(settings.SETTINGS_FILE, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to read settings.json: {e}")
    return {}


def _write_settings(data: dict) -> None:
    """Overwrite settings.json atomically (write to tmp then rename)."""
    try:
        tmp = settings.SETTINGS_FILE.with_suffix(".json.tmp")
        with open(tmp, "w") as f:
            json.dump(data, f, indent=4)
        tmp.replace(settings.SETTINGS_FILE)
    except Exception as e:
        logger.error(f"Failed to write settings.json: {e}")


def _patch_settings(key: str, value) -> None:
    """Update a single top-level key in settings.json."""
    data = _read_settings()
    data[key] = value
    _write_settings(data)
