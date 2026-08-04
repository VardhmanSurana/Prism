"""Discover removable and network mount points for the file browser."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Filesystems typically used for network shares
NETWORK_FSTYPES = frozenset(
    {
        "cifs",
        "smb",
        "smb3",
        "nfs",
        "nfs4",
        "fuse.sshfs",
        "fuse.rclone",
        "rclone",
        "fuse.davfs2",
        "davfs",
        "fuse.afpfs",
        "afpfs",
        "9p",
        "glusterfs",
        "ceph",
        "fuse.ceph",
    }
)

# Skip noisy / system mounts
SKIP_MOUNTPOINTS = frozenset(
    {
        "/",
        "/boot",
        "/boot/efi",
        "/home",
        "/usr",
        "/var",
        "/tmp",
        "/sys",
        "/proc",
        "/dev",
        "/run",
        "/snap",
    }
)

SKIP_PREFIXES = (
    "/snap/",
    "/var/lib/docker",
    "/var/lib/containers",
    "/sys/",
    "/proc/",
    "/dev/",
)


def _safe_listdir(path: Path) -> list[Path]:
    try:
        if not path.is_dir():
            return []
        return [p for p in path.iterdir() if p.is_dir()]
    except (PermissionError, OSError) as e:
        logger.debug("listdir failed for %s: %s", path, e)
        return []


def _label_for_path(path: Path) -> str:
    name = path.name.strip() or str(path)
    # /run/media/user/Drive -> Drive
    return name


def _kind_from_fstype(fstype: str | None, path: str) -> str:
    ft = (fstype or "").lower()
    if ft in NETWORK_FSTYPES or ft.startswith("fuse.ssh") or "cifs" in ft or "nfs" in ft:
        return "network"
    if path.startswith(("/run/media/", "/media/", "/Volumes/")):
        return "removable"
    if path.startswith("/mnt/"):
        # /mnt is often NAS or secondary disks
        if ft in NETWORK_FSTYPES:
            return "network"
        return "volume"
    return "volume"


def _scan_posix_media_trees() -> list[dict[str, Any]]:
    """Walk common external media parents and collect mounted volumes."""
    found: list[dict[str, Any]] = []
    seen: set[str] = set()

    candidates: list[Path] = []
    for base in (Path("/run/media"), Path("/media"), Path("/Volumes"), Path("/mnt")):
        if not base.exists():
            continue
        # /run/media/<user>/<vol>, /media/<user>/<vol>, /media/<vol>, /mnt/<vol>, /Volumes/<vol>
        for child in _safe_listdir(base):
            nested = _safe_listdir(child)
            if nested and base in (Path("/run/media"), Path("/media")):
                # Treat child as username directory; volumes are nested
                for vol in nested:
                    candidates.append(vol)
            else:
                candidates.append(child)

    for p in candidates:
        try:
            resolved = str(p.resolve())
        except OSError:
            resolved = str(p)
        if resolved in seen:
            continue
        if resolved in SKIP_MOUNTPOINTS or any(resolved.startswith(pref) for pref in SKIP_PREFIXES):
            continue
        try:
            if not p.is_dir():
                continue
        except OSError:
            continue
        seen.add(resolved)
        kind = (
            "removable"
            if resolved.startswith(("/run/media/", "/media/", "/Volumes/"))
            else "volume"
        )
        found.append(
            {
                "name": _label_for_path(p),
                "path": resolved,
                "kind": kind,
                "fstype": None,
                "source": "media_tree",
            }
        )
    return found


def _scan_psutil_partitions() -> list[dict[str, Any]]:
    """Use psutil when available for fstype-aware network/removable mounts."""
    try:
        import psutil
    except ImportError:
        return []

    found: list[dict[str, Any]] = []
    try:
        partitions = psutil.disk_partitions(all=True)
    except Exception as e:
        logger.warning("psutil.disk_partitions failed: %s", e)
        return []

    for part in partitions:
        mp = part.mountpoint
        if not mp or mp in SKIP_MOUNTPOINTS:
            continue
        if any(mp.startswith(pref) for pref in SKIP_PREFIXES):
            continue

        fstype = (part.fstype or "").lower()
        kind = _kind_from_fstype(fstype, mp)

        # Keep network always; removable/media trees; skip plain local root disks
        is_interesting = (
            kind == "network"
            or mp.startswith(("/run/media/", "/media/", "/Volumes/", "/mnt/"))
            or fstype in {"exfat", "vfat", "ntfs", "fuseblk", "hfs", "hfsplus", "apfs", "udf", "iso9660"}
        )
        if not is_interesting:
            continue

        try:
            if not Path(mp).exists():
                continue
        except OSError:
            continue

        name = Path(mp).name or mp
        found.append(
            {
                "name": name,
                "path": mp,
                "kind": kind,
                "fstype": part.fstype or None,
                "device": getattr(part, "device", None),
                "source": "psutil",
            }
        )
    return found


def discover_browser_mounts() -> list[dict[str, Any]]:
    """
    Return removable drives and network mounts suitable as browser shortcuts.
    Deduplicated by resolved path; network mounts preferred for labeling.
    """
    by_path: dict[str, dict[str, Any]] = {}

    for item in _scan_posix_media_trees() + _scan_psutil_partitions():
        path = item["path"]
        try:
            key = str(Path(path).resolve())
        except OSError:
            key = path
        existing = by_path.get(key)
        if not existing:
            by_path[key] = {**item, "path": key}
            continue
        # Prefer network kind and richer fstype
        if existing.get("kind") != "network" and item.get("kind") == "network":
            by_path[key] = {**item, "path": key}
        elif not existing.get("fstype") and item.get("fstype"):
            existing["fstype"] = item["fstype"]
            if item.get("kind") == "network":
                existing["kind"] = "network"

    # Stable sort: network first, then removable, then name
    order = {"network": 0, "removable": 1, "volume": 2}
    mounts = list(by_path.values())
    mounts.sort(key=lambda m: (order.get(m.get("kind") or "volume", 9), (m.get("name") or "").lower()))
    return mounts


def load_external_locations_from_settings() -> list[dict[str, Any]]:
    """Load user-configured external/cloud locations from settings.json."""
    try:
        from app.api.settings.helpers import _read_settings

        data = _read_settings()
        locs = data.get("external_locations") or []
        if not isinstance(locs, list):
            return []
        return [loc for loc in locs if isinstance(loc, dict)]
    except Exception as e:
        logger.warning("Failed to load external_locations: %s", e)
        return []


def save_external_locations(locations: list[dict[str, Any]]) -> None:
    from app.api.settings.helpers import _patch_settings

    _patch_settings("external_locations", locations)


def get_enabled_external_paths() -> list[Path]:
    """Paths from external_locations that should be treated as allowed roots."""
    paths: list[Path] = []
    for loc in load_external_locations_from_settings():
        if loc.get("enabled") is False:
            continue
        mount_path = loc.get("mount_path") or loc.get("path")
        if not mount_path:
            continue
        try:
            p = Path(mount_path).expanduser()
            if p.exists() and p.is_dir():
                paths.append(p.resolve())
        except OSError:
            continue
    return paths
