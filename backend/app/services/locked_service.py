import os
import json
import hashlib
import base64
import logging
import asyncio
from pathlib import Path
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)


class LockedFolderService:
    def __init__(self):
        self.session_key = None  # In-memory DEK (Fernet key)
        self.is_authenticated = False

    def is_password_set(self) -> bool:
        data = self._read_settings()
        return "locked_password_hash" in data

    async def setup_password(self, password: str) -> bool:
        # Generate random 16-byte salt
        salt = os.urandom(16)
        
        # CPU-bound KDF offloaded to a thread
        p_hash = await asyncio.to_thread(
            lambda: hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000).hex()
        )
        
        # Generate random 32-byte DEK (Data Encryption Key)
        dek = Fernet.generate_key()
        
        # Derive KEK (Key Encryption Key)
        kek_bytes = await asyncio.to_thread(
            lambda: hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
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
        logger.info("Locked Folder password successfully configured with DEK/KEK envelope encryption.")
        return True

    async def verify_password(self, password: str) -> bool:
        data = self._read_settings()
        p_hash = data.get("locked_password_hash")
        p_salt_hex = data.get("locked_password_salt")
        encrypted_dek = data.get("encrypted_dek")
        if not p_hash or not p_salt_hex or not encrypted_dek:
            return False
        
        salt = bytes.fromhex(p_salt_hex)
        
        # CPU-bound hashing offloaded to a thread
        check_hash = await asyncio.to_thread(
            lambda: hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000).hex()
        )
        
        if check_hash == p_hash:
            # Derive KEK
            kek_bytes = await asyncio.to_thread(
                lambda: hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 100000)
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
        
        logger.warning("Authentication failed: Incorrect password for Locked Folder.")
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
            
        def _sync_encrypt():
            try:
                fernet = Fernet(self.session_key)
                with open(file_path, "rb") as f:
                    data = f.read()
                encrypted_data = fernet.encrypt(data)
                
                # Write with identifier header prefix to easily detect encryption state
                with open(file_path, "wb") as f:
                    f.write(b"Prism_ENC:" + encrypted_data)
                return True
            except Exception as e:
                logger.error(f"Failed to encrypt file {file_path}: {e}")
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
            
        def _sync_write_decrypted():
            try:
                with open(file_path, "wb") as f:
                    f.write(decrypted)
                return True
            except Exception as e:
                logger.error(f"Failed to write decrypted file {file_path}: {e}")
                return False

        return await asyncio.to_thread(_sync_write_decrypted)

    async def is_file_encrypted(self, file_path: str) -> bool:
        if not os.path.exists(file_path):
            return False
            
        def _sync_check_header():
            try:
                with open(file_path, "rb") as f:
                    header = f.read(13)
                return header == b"Prism_ENC:"
            except Exception:
                return False

        return await asyncio.to_thread(_sync_check_header)

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
