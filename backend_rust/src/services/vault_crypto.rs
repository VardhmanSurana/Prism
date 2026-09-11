use aes_gcm::{
    aead::{Aead, KeyInit, OsRng, rand_core::RngCore},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use parking_lot::RwLock;
use std::path::Path;
use std::sync::{Arc, OnceLock};

pub fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

pub fn from_hex(hex_str: &str) -> Result<Vec<u8>, String> {
    let clean: String = hex_str.chars().filter(|c| !c.is_whitespace() && *c != '-').collect();
    if clean.len() % 2 != 0 {
        return Err("Invalid hex length".into());
    }
    (0..clean.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&clean[i..i + 2], 16).map_err(|e| e.to_string()))
        .collect()
}

pub struct VaultManager {
    active_key: Arc<RwLock<Option<[u8; 32]>>>,
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            active_key: Arc::new(RwLock::new(None)),
        }
    }

    pub fn is_unlocked(&self) -> bool {
        self.active_key.read().is_some()
    }

    pub fn get_key(&self) -> Option<[u8; 32]> {
        *self.active_key.read()
    }

    pub fn unlock_with_key(&self, key: [u8; 32]) {
        *self.active_key.write() = Some(key);
    }

    pub fn lock(&self) {
        *self.active_key.write() = None;
    }

    /// Derives a 256-bit encryption key from password and salt using Argon2id
    pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32], String> {
        let mut key = [0u8; 32];
        let argon2 = Argon2::default();
        argon2
            .hash_password_into(password.as_bytes(), salt, &mut key)
            .map_err(|e| format!("Argon2id derivation failed: {}", e))?;
        Ok(key)
    }

    /// Encrypts bytes using AES-256-GCM with a random 96-bit nonce
    pub fn encrypt_bytes(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| format!("Invalid AES key length: {}", e))?;

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| format!("Encryption failed: {}", e))?;

        // Format: [12-byte nonce][ciphertext + tag]
        let mut result = Vec::with_capacity(12 + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    /// Decrypts bytes using AES-256-GCM
    pub fn decrypt_bytes(encrypted: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, String> {
        if encrypted.len() < 12 {
            return Err("Encrypted payload too short (missing nonce)".into());
        }

        let (nonce_bytes, ciphertext) = encrypted.split_at(12);
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|e| format!("Invalid AES key length: {}", e))?;
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed (incorrect key or corrupted data)".into())
    }

    /// Encrypts a source file on disk to a destination .prism_enc file
    pub fn encrypt_file(src: &Path, dst: &Path, key: &[u8; 32]) -> Result<(), String> {
        let data = std::fs::read(src).map_err(|e| format!("Failed to read source file: {}", e))?;
        let encrypted = Self::encrypt_bytes(&data, key)?;

        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dir: {}", e))?;
        }

        std::fs::write(dst, encrypted).map_err(|e| format!("Failed to write encrypted file: {}", e))?;
        Ok(())
    }

    /// Decrypts a .prism_enc file on disk and returns the plaintext bytes in memory
    pub fn decrypt_file(src: &Path, key: &[u8; 32]) -> Result<Vec<u8>, String> {
        let encrypted = std::fs::read(src).map_err(|e| format!("Failed to read encrypted file: {}", e))?;
        Self::decrypt_bytes(&encrypted, key)
    }

    /// Option 3: Generates an Emergency Recovery Kit document and armored token
    pub fn generate_emergency_kit(master_key: &[u8; 32]) -> (String, String, String) {
        let mut recovery_raw = [0u8; 32];
        OsRng.fill_bytes(&mut recovery_raw);
        let recovery_key_hex = to_hex(&recovery_raw);

        // Armor token in blocks: PRISM-RECOVERY-XXXX-XXXX-XXXX-...
        let armored_token = format!(
            "PRISM-RECOVERY-{}",
            recovery_key_hex
                .as_bytes()
                .chunks(4)
                .map(|c| std::str::from_utf8(c).unwrap_or(""))
                .collect::<Vec<_>>()
                .join("-")
                .to_uppercase()
        );

        // Wrap the master key with recovery key
        let wrapped_master_key = Self::encrypt_bytes(master_key, &recovery_raw)
            .map(|b| BASE64.encode(b))
            .unwrap_or_default();

        let date_str = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC").to_string();
        let document = format!(
r#"================================================================================
                    PRISM SECURE VAULT - EMERGENCY RECOVERY KIT
================================================================================
Issued: {}
Format: AES-256-GCM Envelope Encryption (Zero-Knowledge)

IMPORTANT:
Keep this document safe and private. Anyone with this recovery key can decrypt
your locked photos and private albums if they have access to your Prism files.
Prism does not store your master password and cannot recover it for you.

--------------------------------------------------------------------------------
YOUR EMERGENCY RECOVERY TOKEN:
{}
--------------------------------------------------------------------------------

HOW TO RESTORE:
1. Open Prism on your computer.
2. Navigate to "Locked Folder" in the sidebar.
3. Click "Forgot Password? Use Recovery Kit".
4. Paste the recovery token above to unlock and reset your master password.
================================================================================
"#,
            date_str, armored_token
        );

        (armored_token, document, wrapped_master_key)
    }

    /// Option 2: Generates an OS Escrow wrapped key token
    pub fn generate_os_escrow(master_key: &[u8; 32]) -> (String, String) {
        let mut escrow_raw = [0u8; 32];
        OsRng.fill_bytes(&mut escrow_raw);
        let escrow_token = format!("PRISM-OS-ESCROW-{}", to_hex(&escrow_raw));

        let wrapped = Self::encrypt_bytes(master_key, &escrow_raw)
            .map(|b| BASE64.encode(b))
            .unwrap_or_default();

        (escrow_token, wrapped)
    }
}

static VAULT_MANAGER: OnceLock<Arc<VaultManager>> = OnceLock::new();

pub fn get_vault() -> Arc<VaultManager> {
    VAULT_MANAGER.get_or_init(|| Arc::new(VaultManager::new())).clone()
}
