"""CRUD + validation for external / cloud locations stored in settings.json."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from app.utils.mounts import load_external_locations_from_settings, save_external_locations

PROVIDER_IDS = ("local_path", "smb", "s3", "gdrive")

# Providers that can act as browser roots today (filesystem path exists)
FS_READY_PROVIDERS = frozenset({"local_path", "smb"})


def provider_status(provider: str) -> dict[str, Any]:
    """Describe readiness of each provider for the UI."""
    if provider == "local_path":
        return {
            "id": "local_path",
            "label": "Local / mounted path",
            "ready": True,
            "description": "Any directory already on the filesystem (USB, NAS mount, SMB via system).",
        }
    if provider == "smb":
        return {
            "id": "smb",
            "label": "SMB / CIFS share",
            "ready": True,
            "description": "Register a path where an SMB share is already mounted (e.g. /mnt/nas). Full auto-mount coming later.",
            "notes": "Use mount_path to an existing mount. Auto-mount with credentials is planned.",
        }
    if provider == "s3":
        return {
            "id": "s3",
            "label": "Amazon S3 / S3-compatible",
            "ready": False,
            "description": "Browse and import from S3 buckets (scaffolded; connection not yet active).",
        }
    if provider == "gdrive":
        return {
            "id": "gdrive",
            "label": "Google Drive",
            "ready": False,
            "description": "OAuth-linked Google Drive (scaffolded; connection not yet active).",
        }
    return {
        "id": provider,
        "label": provider,
        "ready": False,
        "description": "Unknown provider",
    }


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def validate_location_payload(data: dict[str, Any], *, partial: bool = False) -> Optional[str]:
    """Return error message or None if valid."""
    provider = data.get("provider")
    if not partial or "provider" in data:
        if provider not in PROVIDER_IDS:
            return f"provider must be one of: {', '.join(PROVIDER_IDS)}"

    name = data.get("name")
    if not partial or "name" in data:
        if not name or not str(name).strip():
            return "name is required"

    p = provider or "local_path"

    if p in ("local_path", "smb"):
        mount_path = data.get("mount_path") or data.get("path")
        if not partial or "mount_path" in data or "path" in data:
            if not mount_path or not str(mount_path).strip():
                return "mount_path is required for local_path / smb"
            # Soft check — may be offline; still allow save
            try:
                path = Path(str(mount_path).strip()).expanduser()
                if path.exists() and not path.is_dir():
                    return "mount_path exists but is not a directory"
            except OSError:
                pass

    if p == "s3":
        if not partial:
            if not data.get("bucket"):
                return "bucket is required for s3"
        # credentials intentionally not required yet (scaffold)

    if p == "gdrive":
        # OAuth not implemented — allow saving placeholder config only
        pass

    if p == "smb" and data.get("smb_host"):
        # optional metadata for future auto-mount
        pass

    return None


def _normalize_location(raw: dict[str, Any], existing_id: Optional[str] = None) -> dict[str, Any]:
    provider = raw.get("provider") or "local_path"
    mount_path = raw.get("mount_path") or raw.get("path")
    if mount_path:
        mount_path = str(Path(str(mount_path).strip()).expanduser())

    loc: dict[str, Any] = {
        "id": existing_id or raw.get("id") or f"ext_{uuid.uuid4().hex[:12]}",
        "provider": provider,
        "name": str(raw.get("name") or "").strip(),
        "enabled": bool(raw.get("enabled", True)),
        "mount_path": mount_path,
        "created_at": raw.get("created_at") or _now_iso(),
        "updated_at": _now_iso(),
    }

    # Provider-specific optional fields (stored for future use; secrets discouraged)
    for key in (
        "smb_host",
        "smb_share",
        "smb_username",
        "bucket",
        "region",
        "endpoint",
        "prefix",
        "gdrive_account",
        "notes",
    ):
        if key in raw and raw[key] is not None:
            loc[key] = raw[key]

    # Never persist raw passwords / secret keys from API if present
    for secret_key in ("password", "secret_access_key", "access_key", "client_secret", "refresh_token"):
        loc.pop(secret_key, None)

    # Runtime status for UI
    if provider in FS_READY_PROVIDERS and mount_path:
        p = Path(mount_path)
        if p.exists() and p.is_dir():
            loc["status"] = "available"
            loc["error"] = None
        else:
            loc["status"] = "unavailable"
            loc["error"] = "Path not found or not a directory"
    elif provider in ("s3", "gdrive"):
        loc["status"] = "scaffold"
        loc["error"] = "Provider integration not yet active — configuration saved only"
    else:
        loc["status"] = "configured"

    return loc


def list_external_locations() -> list[dict[str, Any]]:
    """List locations with refreshed availability status."""
    result = []
    for loc in load_external_locations_from_settings():
        result.append(_normalize_location(loc, existing_id=loc.get("id")))
    return result


def create_external_location(data: dict[str, Any]) -> dict[str, Any]:
    err = validate_location_payload(data)
    if err:
        raise ValueError(err)
    locations = load_external_locations_from_settings()
    loc = _normalize_location(data)
    locations.append(loc)
    save_external_locations(locations)
    return loc


def update_external_location(loc_id: str, data: dict[str, Any]) -> dict[str, Any]:
    locations = load_external_locations_from_settings()
    idx = next((i for i, l in enumerate(locations) if l.get("id") == loc_id), None)
    if idx is None:
        raise KeyError(loc_id)
    merged = {**locations[idx], **data, "id": loc_id}
    err = validate_location_payload(merged)
    if err:
        raise ValueError(err)
    loc = _normalize_location(merged, existing_id=loc_id)
    locations[idx] = loc
    save_external_locations(locations)
    return loc


def delete_external_location(loc_id: str) -> bool:
    locations = load_external_locations_from_settings()
    next_locs = [l for l in locations if l.get("id") != loc_id]
    if len(next_locs) == len(locations):
        return False
    save_external_locations(next_locs)
    return True
