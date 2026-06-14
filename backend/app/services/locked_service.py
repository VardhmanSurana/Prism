import os
import json
import base64
import logging
import asyncio
import shutil
import tempfile
import time
from pathlib import Path
from cryptography.fernet import Fernet
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)

FACE_THUMB_SUBDIR = "Face_Thumbnail"


class LockedFolderService:
    def __init__(self):
        self.session_key = None  # In-memory DEK (Fernet key)
        self.is_authenticated = False
        self.failed_attempts = 0
        self.lockout_until = 0.0

    def is_password_set(self) -> bool:
        data = self._read_settings()
        return "locked_password_hash" in data

    async def setup_password(self, password: str) -> bool:
        if len(password) < 12:
            raise HTTPException(status_code=400, detail="Password must be at least 12 characters long")
            
        from argon2 import PasswordHasher
        from argon2.low_level import hash_secret_raw, Type

        # Generate random 16-byte salt
        salt = os.urandom(16)
        
        # CPU-bound hashing offloaded to a thread
        ph = PasswordHasher()
        p_hash = await asyncio.to_thread(ph.hash, password)
        
        # Generate random 32-byte DEK (Data Encryption Key)
        dek = Fernet.generate_key()
        
        # Derive KEK (Key Encryption Key) using Argon2id
        kek_bytes = await asyncio.to_thread(
            lambda: hash_secret_raw(
                secret=password.encode(),
                salt=salt,
                time_cost=2,
                memory_cost=65536,
                parallelism=4,
                hash_len=32,
                type=Type.ID
            )
        )
        kek = base64.urlsafe_b64encode(kek_bytes)
        
        # Encrypt DEK with KEK
        fernet_kek = Fernet(kek)
        encrypted_dek = fernet_kek.encrypt(dek).decode("utf-8")
        
        # Write password metadata and encrypted DEK to settings.json
        data = self._read_settings()
        data["locked_password_hash"] = p_hash
        data["locked_password_salt"] = salt.hex()
        data["encrypted_dek"] = encrypted_dek
        self._write_settings(data)
        
        # Auto-authenticate user immediately on password setup
        self.session_key = dek
        self.is_authenticated = True
        self.failed_attempts = 0
        self.lockout_until = 0.0
        logger.info("Locked Folder password successfully configured with Argon2id and DEK/KEK envelope encryption.")
        return True

    async def verify_password(self, password: str) -> bool:
        now = time.time()
        if self.lockout_until > now:
            remaining = int(self.lockout_until - now)
            raise HTTPException(
                status_code=429, 
                detail=f"Too many failed verification attempts. Locked out for {remaining} seconds."
            )

        data = self._read_settings()
        p_hash = data.get("locked_password_hash")
        p_salt_hex = data.get("locked_password_salt")
        encrypted_dek = data.get("encrypted_dek")
        if not p_hash or not p_salt_hex or not encrypted_dek:
            return False
        
        from argon2 import PasswordHasher
        from argon2.low_level import hash_secret_raw, Type

        salt = bytes.fromhex(p_salt_hex)
        ph = PasswordHasher()
        
        try:
            await asyncio.to_thread(ph.verify, p_hash, password)
        except Exception:
            self.failed_attempts += 1
            if self.failed_attempts >= 3:
                # Lockout increases exponentially starting at 30 seconds
                lockout_duration = 30 * (2 ** (self.failed_attempts - 3))
                self.lockout_until = time.time() + lockout_duration
                logger.warning(f"Verification lockout triggered for {lockout_duration} seconds.")
            return False
        
        # Reset failed attempts on success
        self.failed_attempts = 0
        self.lockout_until = 0.0

        # Derive KEK
        kek_bytes = await asyncio.to_thread(
            lambda: hash_secret_raw(
                secret=password.encode(),
                salt=salt,
                time_cost=2,
                memory_cost=65536,
                parallelism=4,
                hash_len=32,
                type=Type.ID
            )
        )
        kek = base64.urlsafe_b64encode(kek_bytes)
        
        # Decrypt DEK using KEK
        try:
            fernet_kek = Fernet(kek)
            dek = fernet_kek.decrypt(encrypted_dek.encode("utf-8"))
            self.session_key = dek
            self.is_authenticated = True
            logger.info("Locked Folder session successfully authenticated.")
            return True
        except Exception as e:
            logger.error(f"Failed to decrypt DEK: {e}")
            return False

    def lock_session(self):
        self.session_key = None
        self.is_authenticated = False
        logger.info("Locked Folder session closed.")

    async def encrypt_file(self, file_path: str) -> bool:
        if not self.session_key:
            raise ValueError("Session not authenticated")
        if not os.path.exists(file_path):
            return False
            
        # Do not double-encrypt
        is_already_enc = await self.is_file_encrypted(file_path)
        if is_already_enc:
            return True
            
        # Define backup path
        backup_path = file_path + ".prism_backup"

        def _sync_encrypt():
            try:
                # 1. Create a backup file copy
                shutil.copy2(file_path, backup_path)

                # 2. Perform encryption
                fernet = Fernet(self.session_key)
                with open(file_path, "rb") as f:
                    data = f.read()
                encrypted_data = fernet.encrypt(data)
                
                # 3. Write atomically to temp file
                temp_dir = os.path.dirname(file_path)
                with tempfile.NamedTemporaryFile(dir=temp_dir, delete=False) as tmp_file:
                    tmp_name = tmp_file.name
                    tmp_file.write(b"Prism_ENC:" + encrypted_data)
                    tmp_file.flush()
                    os.fsync(tmp_file.fileno())
                
                # 4. Atomically replace original
                os.replace(tmp_name, file_path)

                # 5. Clean up backup
                if os.path.exists(backup_path):
                    os.remove(backup_path)

                return True
            except Exception as e:
                logger.error(f"Failed to encrypt file {file_path}: {e}")
                # Restore from backup if encryption failed mid-way
                if os.path.exists(backup_path):
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        os.rename(backup_path, file_path)
                    except Exception as restore_err:
                        logger.error(f"Failed to restore original file from backup: {restore_err}")
                return False

        return await asyncio.to_thread(_sync_encrypt)

    async def decrypt_file_data(self, file_path: str) -> bytes | None:
        if not self.session_key:
            raise ValueError("Session not authenticated")
        if not os.path.exists(file_path):
            return None
            
        def _sync_decrypt_data():
            try:
                with open(file_path, "rb") as f:
                    data = f.read()
                    
                if not data.startswith(b"Prism_ENC:"):
                    return data  # Already raw or unencrypted
                    
                encrypted_data = data[len(b"Prism_ENC:"):]
                fernet = Fernet(self.session_key)
                return fernet.decrypt(encrypted_data)
            except Exception as e:
                logger.error(f"Failed to decrypt file data for {file_path}: {e}")
                return None

        return await asyncio.to_thread(_sync_decrypt_data)

    async def decrypt_file(self, file_path: str) -> bool:
        if not self.session_key:
            raise ValueError("Session not authenticated")
        if not os.path.exists(file_path):
            return False
            
        decrypted = await self.decrypt_file_data(file_path)
        if decrypted is None:
            return False
            
        backup_path = file_path + ".prism_backup"

        def _sync_write_decrypted():
            try:
                # 1. Create a backup file copy
                shutil.copy2(file_path, backup_path)

                # 2. Write atomically to temp file
                temp_dir = os.path.dirname(file_path)
                with tempfile.NamedTemporaryFile(dir=temp_dir, delete=False) as tmp_file:
                    tmp_name = tmp_file.name
                    tmp_file.write(decrypted)
                    tmp_file.flush()
                    os.fsync(tmp_file.fileno())

                # 3. Atomically replace original
                os.replace(tmp_name, file_path)

                # 4. Clean up backup
                if os.path.exists(backup_path):
                    os.remove(backup_path)

                return True
            except Exception as e:
                logger.error(f"Failed to write decrypted file {file_path}: {e}")
                if os.path.exists(backup_path):
                    try:
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        os.rename(backup_path, file_path)
                    except Exception as restore_err:
                        logger.error(f"Failed to restore file: {restore_err}")
                return False

        return await asyncio.to_thread(_sync_write_decrypted)

    async def is_file_encrypted(self, file_path: str) -> bool:
        if not os.path.exists(file_path):
            return False
            
        def _sync_check_header():
            try:
                with open(file_path, "rb") as f:
                    header = f.read(13)
                return header.startswith(b"Prism_ENC:")
            except Exception:
                return False

        return await asyncio.to_thread(_sync_check_header)

    async def encrypt_and_save_thumbnail(self, thumb_data: bytes, enc_path: str) -> bool:
        """Encrypts thumbnail data and saves it atomically to disk."""
        if not self.session_key:
            return False
        
        def _sync_encrypt_thumb():
            try:
                fernet = Fernet(self.session_key)
                encrypted = fernet.encrypt(thumb_data)
                
                temp_dir = os.path.dirname(enc_path)
                os.makedirs(temp_dir, exist_ok=True)
                with tempfile.NamedTemporaryFile(dir=temp_dir, delete=False) as tmp_file:
                    tmp_name = tmp_file.name
                    tmp_file.write(b"Prism_ENC_THUMB:" + encrypted)
                    tmp_file.flush()
                    os.fsync(tmp_file.fileno())
                os.replace(tmp_name, enc_path)
                return True
            except Exception as e:
                logger.error(f"Failed to save encrypted thumbnail {enc_path}: {e}")
                return False
                
        return await asyncio.to_thread(_sync_encrypt_thumb)

    async def decrypt_encrypted_thumbnail(self, enc_path: str) -> bytes | None:
        """Decrypts and returns encrypted thumbnail data from disk."""
        if not self.session_key:
            return None
            
        def _sync_decrypt_thumb():
            try:
                with open(enc_path, "rb") as f:
                    data = f.read()
                if not data.startswith(b"Prism_ENC_THUMB:"):
                    return None
                encrypted = data[len(b"Prism_ENC_THUMB:"):]
                fernet = Fernet(self.session_key)
                return fernet.decrypt(encrypted)
            except Exception as e:
                logger.error(f"Failed to decrypt thumbnail {enc_path}: {e}")
                return None
                
        return await asyncio.to_thread(_sync_decrypt_thumb)

    def recover_interrupted_files(self):
        """Scans the uploads and thumbnails directories for any interrupted operations (.prism_backup files) and restores them."""
        dirs_to_check = [settings.UPLOAD_DIR, settings.THUMBNAILS_DIR]
        for d in dirs_to_check:
            if not d.exists():
                continue
            for root, _, files in os.walk(d):
                for f in files:
                    if f.endswith(".prism_backup"):
                        backup_path = os.path.join(root, f)
                        main_path = backup_path[:-13]  # Strip ".prism_backup"
                        logger.warning(f"Found interrupted backup file: {backup_path}. Restoring to {main_path}...")
                        try:
                            if os.path.exists(main_path):
                                os.remove(main_path)
                            shutil.copy2(backup_path, main_path)
                            os.remove(backup_path)
                            logger.info(f"Successfully restored {main_path} from backup.")
                        except Exception as e:
                            logger.error(f"Failed to restore {main_path} from backup: {e}")

    def _read_settings(self) -> dict:
        try:
            if settings.SETTINGS_FILE.exists():
                with open(settings.SETTINGS_FILE, "r") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read locked folder settings: {e}")
        return {}

    def _write_settings(self, data: dict) -> None:
        try:
            tmp = settings.SETTINGS_FILE.with_suffix(".json.tmp")
            with open(tmp, "w") as f:
                json.dump(data, f, indent=4)
            tmp.replace(settings.SETTINGS_FILE)
        except Exception:
            pass


locked_service = LockedFolderService()
