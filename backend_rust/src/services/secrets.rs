//! Encrypted secrets vault for Prism.
//!
//! Secrets (API keys, provider credentials) are stored in the `settings`
//! table as AES-256-GCM ciphertext produced by the existing
//! [`crate::services::vault_crypto`] primitives. The master key is
//! auto-generated on first startup at `<database_dir>/.prism-vault.key`
//! with 0600 permissions, so no user setup and no .env file is required.

use aes_gcm::aead::OsRng;
use aes_gcm::aead::rand_core::RngCore;
use base64::Engine;
use sqlx::SqlitePool;

use crate::services::vault_crypto::VaultManager;

const MASTER_KEY_FILE: &str = ".prism-vault.key";
const SEALED_PREFIX: &str = "sealed:";

/// Load the auto-generated master key, creating it on first use.
pub fn load_or_create_master_key(db_dir: &std::path::Path) -> Result<[u8; 32], String> {
    let key_path = db_dir.join(MASTER_KEY_FILE);
    if key_path.exists() {
        let bytes = std::fs::read(&key_path).map_err(|e| format!("vault key unreadable: {e}"))?;
        if bytes.len() != 32 {
            return Err("vault key is corrupted (wrong length)".to_string());
        }
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        Ok(key)
    } else {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        std::fs::write(&key_path, &key).map_err(|e| format!("vault key write failed: {e}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&key_path, std::fs::Permissions::from_mode(0o600))
                .map_err(|e| format!("vault key chmod failed: {e}"))?;
        }
        Ok(key)
    }
}

/// Encrypt a secret value; returns `sealed:<base64([12-byte nonce] + ciphertext)>`.
pub fn seal(master_key: &[u8; 32], plaintext: &str) -> Result<String, String> {
    let encrypted = VaultManager::encrypt_bytes(plaintext.as_bytes(), master_key)?;
    Ok(format!(
        "{}{}",
        SEALED_PREFIX,
        base64::engine::general_purpose::STANDARD.encode(encrypted)
    ))
}

/// Decrypt a value previously produced by [`seal`]. Returns None for
/// plaintext (legacy) values so migration is non-destructive.
pub fn open(master_key: &[u8; 32], sealed: &str) -> Option<String> {
    let encrypted_b64 = sealed.strip_prefix(SEALED_PREFIX)?;
    let encrypted = base64::engine::general_purpose::STANDARD
        .decode(encrypted_b64)
        .ok()?;
    let plaintext = VaultManager::decrypt_bytes(&encrypted, master_key).ok()?;
    String::from_utf8(plaintext).ok()
}

/// Read a secret from the settings table (auto-decrypted).
pub async fn get_secret(db: &SqlitePool, master_key: &[u8; 32], key: &str) -> Option<String> {
    let stored: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(format!("secret_{key}"))
        .fetch_optional(db)
        .await
        .ok()
        .flatten();
    let stored = stored?;
    if stored.starts_with(SEALED_PREFIX) {
        open(master_key, &stored)
    } else {
        Some(stored) // legacy plaintext value
    }
}

/// Write a secret to the settings table (encrypted at rest).
pub async fn set_secret(
    db: &SqlitePool,
    master_key: &[u8; 32],
    key: &str,
    value: &str,
) -> Result<(), String> {
    let sealed = seal(master_key, value)?;
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(format!("secret_{key}"))
    .bind(sealed)
    .execute(db)
    .await
    .map_err(|e| format!("secret write failed: {e}"))?;
    Ok(())
}

/// Mask a secret for display: keeps at most the last 4 characters.
pub fn mask(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }
    if value.len() <= 4 {
        "••••".to_string()
    } else {
        format!("••••{}", &value[value.len() - 4..])
    }
}

/// Generate a cryptographically secure random API key with OS entropy.
pub fn generate_secure_api_key() -> String {
    let mut random_bytes = [0u8; 24];
    OsRng.fill_bytes(&mut random_bytes);
    format!("prism_live_{}", crate::services::vault_crypto::to_hex(&random_bytes))
}

