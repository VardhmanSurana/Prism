use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use aes_gcm::aead::{rand_core::RngCore, OsRng};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::services::vault_crypto::{from_hex, get_vault, VaultManager};
use crate::AppState;

#[derive(Serialize)]
pub struct VaultStatusResponse {
    pub is_initialized: bool,
    pub is_unlocked: bool,
    pub escrow_enabled: bool,
    pub locked_photos_count: i64,
}

/// GET /api/v1/vault/status
pub async fn get_vault_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<VaultStatusResponse>, (StatusCode, String)> {
    let init_row: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_initialized'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let is_initialized = init_row.as_deref() == Some("true");
    let is_unlocked = get_vault().is_unlocked();

    let escrow_row: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_escrow_enabled'")
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let escrow_enabled = escrow_row.as_deref() == Some("true");

    let locked_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_locked = 1 AND is_trash = 0")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Ok(Json(VaultStatusResponse {
        is_initialized,
        is_unlocked,
        escrow_enabled,
        locked_photos_count: locked_count,
    }))
}

#[derive(Deserialize)]
pub struct VaultSetupRequest {
    pub password: String,
    #[serde(default)]
    pub enable_os_escrow: bool,
}

/// POST /api/v1/vault/setup
pub async fn setup_vault(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VaultSetupRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.password.trim().len() < 6 {
        return Err((StatusCode::BAD_REQUEST, "Password must be at least 6 characters".into()));
    }

    // Generate salt
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    let salt_b64 = BASE64.encode(salt);

    // Derive password encryption key
    let pw_key = VaultManager::derive_key(&payload.password, &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Generate random 256-bit vault master key
    let mut master_key = [0u8; 32];
    OsRng.fill_bytes(&mut master_key);

    // Wrap master key with password key
    let wrapped_with_pw = VaultManager::encrypt_bytes(&master_key, &pw_key)
        .map(|b| BASE64.encode(b))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    // Option 3: Generate emergency kit document & wrapped key
    let (armored_token, emergency_doc, wrapped_recovery) = VaultManager::generate_emergency_kit(&master_key);

    // Option 2: OS Keyring Escrow token
    let (escrow_token, wrapped_escrow) = if payload.enable_os_escrow {
        let (tok, wrp) = VaultManager::generate_os_escrow(&master_key);
        (Some(tok), Some(wrp))
    } else {
        (None, None)
    };

    // Save configuration in settings
    let mut tx = state.db.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_initialized', 'true')")
        .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_salt', ?)")
        .bind(&salt_b64)
        .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_wrapped_key', ?)")
        .bind(&wrapped_with_pw)
        .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_recovery_wrapped_key', ?)")
        .bind(&wrapped_recovery)
        .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(wrp) = &wrapped_escrow {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_escrow_enabled', 'true')")
            .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_escrow_wrapped_key', ?)")
            .bind(wrp)
            .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('vault_escrow_enabled', 'false')")
            .execute(&mut *tx).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Auto-unlock vault
    get_vault().unlock_with_key(master_key);

    Ok(Json(json!({
        "status": "success",
        "emergency_kit_document": emergency_doc,
        "armored_recovery_token": armored_token,
        "os_escrow_token": escrow_token,
    })))
}

#[derive(Deserialize)]
pub struct VaultUnlockRequest {
    pub password: String,
}

/// POST /api/v1/vault/unlock
pub async fn unlock_vault(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VaultUnlockRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let salt_b64: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_salt'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::BAD_REQUEST, "Vault not initialized".into()))?;

    let wrapped_b64: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_wrapped_key'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::BAD_REQUEST, "Vault not initialized".into()))?;

    let salt = BASE64.decode(salt_b64).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Corrupt salt".into()))?;
    let pw_key = VaultManager::derive_key(&payload.password, &salt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let wrapped = BASE64.decode(wrapped_b64).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Corrupt wrapped key".into()))?;
    let master_key_vec = VaultManager::decrypt_bytes(&wrapped, &pw_key)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid master password".into()))?;

    if master_key_vec.len() != 32 {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "Invalid key material".into()));
    }

    let mut master_key = [0u8; 32];
    master_key.copy_from_slice(&master_key_vec);
    get_vault().unlock_with_key(master_key);

    Ok(Json(json!({ "status": "success", "message": "Vault unlocked" })))
}

#[derive(Deserialize)]
pub struct VaultRecoveryRequest {
    pub recovery_token: String,
}

/// POST /api/v1/vault/recover
pub async fn recover_vault(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VaultRecoveryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let wrapped_b64: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_recovery_wrapped_key'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::BAD_REQUEST, "Vault recovery not initialized".into()))?;

    // Token format: PRISM-RECOVERY-XXXX-... or raw hex
    let hex_part = payload.recovery_token
        .trim()
        .trim_start_matches("PRISM-RECOVERY-")
        .replace('-', "");

    let recovery_bytes = from_hex(&hex_part)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid recovery token format: {}", e)))?;

    if recovery_bytes.len() != 32 {
        return Err((StatusCode::BAD_REQUEST, "Recovery token must represent 32 bytes".into()));
    }

    let mut recovery_raw = [0u8; 32];
    recovery_raw.copy_from_slice(&recovery_bytes);

    let wrapped = BASE64.decode(wrapped_b64).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Corrupt wrapped key".into()))?;
    let master_key_vec = VaultManager::decrypt_bytes(&wrapped, &recovery_raw)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid recovery token or corrupted backup".into()))?;

    let mut master_key = [0u8; 32];
    master_key.copy_from_slice(&master_key_vec);
    get_vault().unlock_with_key(master_key);

    Ok(Json(json!({
        "status": "success",
        "message": "Vault successfully unlocked via Emergency Recovery Kit"
    })))
}

#[derive(Deserialize)]
pub struct VaultEscrowUnlockRequest {
    pub escrow_token: String,
}

/// POST /api/v1/vault/unlock-escrow
pub async fn unlock_vault_escrow(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VaultEscrowUnlockRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let wrapped_b64: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'vault_escrow_wrapped_key'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::BAD_REQUEST, "OS Keyring Escrow not enabled".into()))?;

    let hex_part = payload.escrow_token
        .trim()
        .trim_start_matches("PRISM-OS-ESCROW-");

    let escrow_bytes = from_hex(hex_part)
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid escrow token: {}", e)))?;

    if escrow_bytes.len() != 32 {
        return Err((StatusCode::BAD_REQUEST, "Escrow token must represent 32 bytes".into()));
    }

    let mut escrow_raw = [0u8; 32];
    escrow_raw.copy_from_slice(&escrow_bytes);

    let wrapped = BASE64.decode(wrapped_b64).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Corrupt escrow key".into()))?;
    let master_key_vec = VaultManager::decrypt_bytes(&wrapped, &escrow_raw)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid OS escrow key".into()))?;

    let mut master_key = [0u8; 32];
    master_key.copy_from_slice(&master_key_vec);
    get_vault().unlock_with_key(master_key);

    Ok(Json(json!({
        "status": "success",
        "message": "Vault unlocked via OS Keyring Escrow"
    })))
}

/// POST /api/v1/vault/lock
pub async fn lock_vault() -> Json<Value> {
    get_vault().lock();
    Json(json!({ "status": "success", "message": "Vault locked" }))
}
