"""Centralized security module for filesystem path validations."""
import os
from pathlib import Path
from fastapi import HTTPException
from app.config import settings

def get_allowed_read_roots() -> list[Path]:
    """Retrieve all directories allowed for read operations."""
    roots = [
        settings.UPLOAD_DIR.resolve(),
        settings.THUMBNAILS_DIR.resolve(),
        settings.DATA_DIR.resolve(),
        Path.home().resolve(),
        (Path.home() / "Pictures").resolve(),
        (Path.home() / "Downloads").resolve(),
        (Path.home() / "Documents").resolve(),
        (Path.home() / "Desktop").resolve(),
    ]
    # Include common posix external media mounts safely
    if os.name == 'posix':
        for mount in ["/media", "/run/media", "/Volumes", "/mnt"]:
            try:
                p = Path(mount).resolve()
                if p.exists():
                    roots.append(p)
            except Exception:
                pass

    # User-configured NAS / external locations (settings.json)
    try:
        from app.utils.mounts import get_enabled_external_paths

        for extra in get_enabled_external_paths():
            roots.append(extra)
    except Exception:
        pass

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[Path] = []
    for r in roots:
        key = str(r)
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return unique

def get_allowed_write_roots() -> list[Path]:
    """Retrieve all directories allowed for write operations."""
    # Write boundaries include uploads, thumbnails, and Pictures/external mounts where editing photos could occur
    return get_allowed_read_roots()

def safe_resolve_read(path: str | Path) -> Path:
    """
    Resolve absolute path safely for reading.
    Rejects path traversal, symlink escapes, and checks read boundaries.
    """
    try:
        p = Path(path)
        # Prevent manual traversal parts check
        if ".." in p.parts:
            raise HTTPException(status_code=403, detail="Access denied: path traversal attempt")
            
        resolved = p.resolve()
        roots = get_allowed_read_roots()
        
        if not any(resolved.is_relative_to(r) for r in roots):
            raise HTTPException(status_code=403, detail="Access denied: path outside allowed read directories")
            
        return resolved
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path representation: {str(e)}")

def safe_resolve_write(path: str | Path) -> Path:
    """
    Resolve absolute path safely for writing/mutation.
    Rejects path traversal, symlink escapes, and checks write boundaries.
    Handles non-existent paths by resolving their parent directory.
    """
    try:
        p = Path(path)
        if ".." in p.parts:
            raise HTTPException(status_code=403, detail="Access denied: path traversal attempt")
            
        if p.exists():
            resolved = p.resolve()
        else:
            resolved = p.parent.resolve() / p.name
            
        roots = get_allowed_write_roots()
        
        if not any(resolved.is_relative_to(r) for r in roots):
            raise HTTPException(status_code=403, detail="Access denied: path outside allowed write directories")
            
        return resolved
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path representation: {str(e)}")
