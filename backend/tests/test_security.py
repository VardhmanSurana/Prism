import pytest
import os
from pathlib import Path
from fastapi import HTTPException
from app.utils.security import safe_resolve_read, safe_resolve_write, get_allowed_read_roots, get_allowed_write_roots
from app.config import settings

def test_allowed_roots_grant_full_access():
    # The photo library allows full filesystem access so users can browse any folder.
    read_roots = get_allowed_read_roots()
    write_roots = get_allowed_write_roots()
    root = Path("/").resolve() if os.name == "posix" else Path(Path.cwd().anchor).resolve()

    assert root in read_roots
    assert root in write_roots
    # Everything under root is reachable (e.g. home and the library dirs)
    assert settings.UPLOAD_DIR.resolve().is_relative_to(root)
    assert settings.THUMBNAILS_DIR.resolve().is_relative_to(root)
    assert (Path.home() / "Pictures").resolve().is_relative_to(root)

def test_safe_resolve_read_valid():
    # Test valid paths inside allowed directories
    valid_upload_path = settings.UPLOAD_DIR / "test_photo.jpg"
    resolved = safe_resolve_read(valid_upload_path)
    assert resolved == valid_upload_path.resolve()

def test_safe_resolve_read_traversal():
    # Test path traversal with ..
    traversal_path = settings.UPLOAD_DIR / "../test.jpg"
    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_read(traversal_path)
    assert excinfo.value.status_code == 403
    assert "Access denied: path traversal attempt" in excinfo.value.detail

def test_safe_resolve_read_any_system_path():
    # Full filesystem access: arbitrary system paths resolve without error
    resolved = safe_resolve_read("/etc/passwd")
    assert resolved == Path("/etc/passwd").resolve()

def test_safe_resolve_write_valid_and_nonexistent(tmp_path):
    # Test writing to non-existent file whose parent is allowed
    # Note: We must test inside allowed roots. UPLOAD_DIR is always allowed.
    new_file = settings.UPLOAD_DIR / "new_dir" / "new_photo.jpg"
    resolved = safe_resolve_write(new_file)
    assert resolved == (settings.UPLOAD_DIR / "new_dir").resolve() / "new_photo.jpg"

def test_safe_resolve_write_traversal():
    traversal_path = settings.THUMBNAILS_DIR / "some_dir" / ".." / ".." / "etc" / "passwd"
    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_write(traversal_path)
    assert excinfo.value.status_code == 403
    assert "Access denied: path traversal attempt" in excinfo.value.detail

def test_safe_resolve_write_any_system_path():
    # Full filesystem access: arbitrary system paths resolve for write planning
    resolved = safe_resolve_write(Path("/var/log/syslog"))
    assert resolved == Path("/var/log/syslog").resolve()

def test_symlink_escape(tmp_path):
    # Setup: Create a symlink inside an allowed directory pointing outside
    target_outside = Path("/etc")
    symlink_inside = settings.UPLOAD_DIR / "escape_symlink"

    if symlink_inside.exists():
        os.remove(symlink_inside)

    try:
        os.symlink(target_outside, symlink_inside)
        # Full access: the symlink resolves to its target rather than being rejected
        resolved = safe_resolve_read(symlink_inside)
        assert resolved == target_outside.resolve()
    except OSError:
        # Skip if symlink creation is not permitted by OS settings
        pass
    finally:
        if symlink_inside.exists():
            os.remove(symlink_inside)
