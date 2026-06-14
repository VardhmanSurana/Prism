import pytest
import os
from pathlib import Path
from fastapi import HTTPException
from app.utils.security import safe_resolve_read, safe_resolve_write, get_allowed_read_roots, get_allowed_write_roots
from app.config import settings

def test_allowed_roots_contain_defaults():
    read_roots = get_allowed_read_roots()
    write_roots = get_allowed_write_roots()
    
    assert settings.UPLOAD_DIR.resolve() in read_roots
    assert settings.THUMBNAILS_DIR.resolve() in read_roots
    assert (Path.home() / "Pictures").resolve() in read_roots
    
    assert settings.UPLOAD_DIR.resolve() in write_roots
    assert settings.THUMBNAILS_DIR.resolve() in write_roots
    assert (Path.home() / "Pictures").resolve() in write_roots

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

def test_safe_resolve_read_outside_roots():
    # Test absolute paths outside allowed roots
    outside_path = "/etc/passwd"
    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_read(outside_path)
    assert excinfo.value.status_code == 403
    assert "Access denied: path outside allowed read directories" in excinfo.value.detail

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

def test_safe_resolve_write_outside_roots():
    outside_path = Path("/var/log/syslog")
    with pytest.raises(HTTPException) as excinfo:
        safe_resolve_write(outside_path)
    assert excinfo.value.status_code == 403
    assert "Access denied: path outside allowed write directories" in excinfo.value.detail

def test_symlink_escape(tmp_path):
    # Setup: Create a symlink inside an allowed directory pointing outside
    # We will temporarily mock UPLOAD_DIR to tmp_path, and set allowed roots
    # to include tmp_path but exclude other roots if necessary, or just test a symlink pointing to /etc
    target_outside = Path("/etc")
    symlink_inside = settings.UPLOAD_DIR / "escape_symlink"
    
    if symlink_inside.exists():
        os.remove(symlink_inside)
        
    try:
        os.symlink(target_outside, symlink_inside)
        # Now trying to resolve the symlink should fail because /etc is not allowed
        with pytest.raises(HTTPException) as excinfo:
            safe_resolve_read(symlink_inside)
        assert excinfo.value.status_code == 403
        assert "Access denied: path outside allowed read directories" in excinfo.value.detail
    except OSError:
        # Skip if symlink creation is not permitted by OS settings (e.g. windows developer mode off)
        pass
    finally:
        if symlink_inside.exists():
            os.remove(symlink_inside)
