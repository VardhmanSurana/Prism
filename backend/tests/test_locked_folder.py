import pytest
import os
import time
import json
from pathlib import Path
from fastapi import HTTPException
from app.services.locked_service import LockedFolderService
from app.config import settings

@pytest.fixture
def clean_locked_service(tmp_path, monkeypatch):
    # Setup isolated settings and directories
    test_settings_file = tmp_path / "settings.json"
    test_upload_dir = tmp_path / "uploads"
    test_thumb_dir = tmp_path / "thumbnails"
    
    test_upload_dir.mkdir(parents=True, exist_ok=True)
    test_thumb_dir.mkdir(parents=True, exist_ok=True)
    
    monkeypatch.setattr(settings, "SETTINGS_FILE", test_settings_file)
    monkeypatch.setattr(settings, "UPLOAD_DIR", test_upload_dir)
    monkeypatch.setattr(settings, "THUMBNAILS_DIR", test_thumb_dir)
    
    service = LockedFolderService()
    yield service

@pytest.mark.asyncio
async def test_password_length_restriction(clean_locked_service):
    with pytest.raises(HTTPException) as excinfo:
        await clean_locked_service.setup_password("short_pwd")
    assert excinfo.value.status_code == 400
    assert "Password must be at least 12 characters long" in excinfo.value.detail

@pytest.mark.asyncio
async def test_valid_setup_and_authentication(clean_locked_service):
    assert not clean_locked_service.is_password_set()
    
    # Setup valid password (12+ chars)
    setup_success = await clean_locked_service.setup_password("super_secure_password_123")
    assert setup_success is True
    assert clean_locked_service.is_password_set()
    assert clean_locked_service.is_authenticated
    assert clean_locked_service.session_key is not None
    
    # Lock session
    clean_locked_service.lock_session()
    assert not clean_locked_service.is_authenticated
    assert clean_locked_service.session_key is None
    
    # Re-authenticate with correct password
    auth_success = await clean_locked_service.verify_password("super_secure_password_123")
    assert auth_success is True
    assert clean_locked_service.is_authenticated
    assert clean_locked_service.session_key is not None

@pytest.mark.asyncio
async def test_incorrect_password_lockout(clean_locked_service):
    await clean_locked_service.setup_password("super_secure_password_123")
    clean_locked_service.lock_session()
    
    # 1st fail
    assert not await clean_locked_service.verify_password("wrong_password")
    assert clean_locked_service.failed_attempts == 1
    
    # 2nd fail
    assert not await clean_locked_service.verify_password("wrong_password")
    assert clean_locked_service.failed_attempts == 2
    
    # 3rd fail -> triggers lockout
    assert not await clean_locked_service.verify_password("wrong_password")
    assert clean_locked_service.failed_attempts == 3
    assert clean_locked_service.lockout_until > time.time()
    
    # 4th verify attempt must raise HTTPException (429)
    with pytest.raises(HTTPException) as excinfo:
        await clean_locked_service.verify_password("wrong_password")
    assert excinfo.value.status_code == 429
    assert "Too many failed verification attempts" in excinfo.value.detail

@pytest.mark.asyncio
async def test_file_encryption_decryption(clean_locked_service, tmp_path):
    await clean_locked_service.setup_password("super_secure_password_123")
    
    # Create test file to encrypt
    test_file = tmp_path / "my_photo.jpg"
    test_content = b"my raw camera picture binary data"
    test_file.write_bytes(test_content)
    
    # Encrypt
    encrypt_res = await clean_locked_service.encrypt_file(str(test_file))
    assert encrypt_res is True
    assert await clean_locked_service.is_file_encrypted(str(test_file))
    
    # Verify content has encryption header
    enc_content = test_file.read_bytes()
    assert enc_content.startswith(b"Prism_ENC:")
    assert test_content not in enc_content
    
    # Decrypt
    decrypt_res = await clean_locked_service.decrypt_file(str(test_file))
    assert decrypt_res is True
    assert not await clean_locked_service.is_file_encrypted(str(test_file))
    
    # Verify original content is restored
    assert test_file.read_bytes() == test_content

@pytest.mark.asyncio
async def test_thumbnail_encryption_decryption(clean_locked_service, tmp_path):
    await clean_locked_service.setup_password("super_secure_password_123")
    
    thumb_path = tmp_path / "thumb.webp.enc"
    thumb_data = b"small webp thumbnail bytes"
    
    # Save encrypted thumbnail
    save_res = await clean_locked_service.encrypt_and_save_thumbnail(thumb_data, str(thumb_path))
    assert save_res is True
    
    # Read and decrypt
    decrypted_thumb = await clean_locked_service.decrypt_encrypted_thumbnail(str(thumb_path))
    assert decrypted_thumb == thumb_data

def test_interrupted_operation_recovery(clean_locked_service):
    # Setup a dummy original file and a backup file
    test_file = settings.UPLOAD_DIR / "photo.jpg"
    test_file.write_bytes(b"interrupted encrypted state")
    
    backup_file = settings.UPLOAD_DIR / "photo.jpg.prism_backup"
    original_content = b"pre-encryption raw content"
    backup_file.write_bytes(original_content)
    
    # Recover
    clean_locked_service.recover_interrupted_files()
    
    # Original should be restored and backup removed
    assert test_file.read_bytes() == original_content
    assert not backup_file.exists()
