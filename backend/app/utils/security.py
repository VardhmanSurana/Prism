"""Centralized security module allowing full filesystem access for photo library operations."""
import os
from pathlib import Path
from fastapi import HTTPException

def get_allowed_read_roots() -> list[Path]:
    """Retrieve allowed read directories (unrestricted full system access)."""
    root = Path("/").resolve() if os.name == 'posix' else Path(Path.cwd().anchor).resolve()
    return [root]

def get_allowed_write_roots() -> list[Path]:
    """Retrieve allowed write directories (unrestricted full system access)."""
    return get_allowed_read_roots()

def safe_resolve_read(path: str | Path) -> Path:
    """
    Resolve absolute path safely for reading.
    Allows access to any valid file/directory on the filesystem.
    """
    try:
        p = Path(path)
        if ".." in p.parts:
            raise HTTPException(status_code=403, detail="Access denied: path traversal attempt")
        return p.resolve()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path representation: {str(e)}")

def safe_resolve_write(path: str | Path) -> Path:
    """
    Resolve absolute path safely for writing/mutation.
    Allows writing to any valid directory on the filesystem.
    """
    try:
        p = Path(path)
        if ".." in p.parts:
            raise HTTPException(status_code=403, detail="Access denied: path traversal attempt")
        if p.exists():
            return p.resolve()
        else:
            return p.parent.resolve() / p.name
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path representation: {str(e)}")
