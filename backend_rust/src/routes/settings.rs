use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::convert::Infallible;
use std::env;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::IntervalStream;
use tokio_stream::{Stream, StreamExt};

use crate::AppState;
use super::{
    get_telemetry_enabled, get_telemetry_response_logging, get_telemetry_sample_rate,
    set_telemetry_enabled, set_telemetry_response_logging, set_telemetry_sample_rate,
};

pub async fn get_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "port": state.config.port,
        "upload_dir": state.config.upload_dir.to_string_lossy(),
        "thumbnails_dir": state.config.thumbnails_dir.to_string_lossy(),
        "backend": "rust-axum"
    }))
}

pub async fn get_general_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    let defaults = json!({
        "ENABLE_IMAGE_BG_PROCESS": true,
        "ENABLE_AI_CLIP": true,
        "ENABLE_AI_FACE": true,
        "ENABLE_AI_CAPTION": false,
        "ENABLE_AI_OCR": true,
        "ENABLE_VIDEO_BG_PROCESS": true,
        "ENABLE_VIDEO_FACE": true,
        "ENABLE_AI_SUBTITLES": false,
        "ENABLE_AI_AGENT": true,
        "ENABLE_AI_INPAINTING": true,
        "ENABLE_VIDEO_EDITOR_AI": true,
        "GPU_MODE": "auto",
        "AGENT_PROVIDER": "local",
        "AGENT_BASE_URL": "https://api.openai.com/v1",
        "AGENT_API_KEY": "",
        "AGENT_MODEL_NAME": "gemma-4b",
        "backend": "rust-axum",
        "port": state.config.port
    });

    let stored: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'general_settings'"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    if let Some(json_str) = stored {
        if let Ok(mut val) = serde_json::from_str::<Value>(&json_str) {
            // Always inject live read-only fields
            val["backend"] = json!("rust-axum");
            val["port"] = json!(state.config.port);
            return Json(val);
        }
    }

    Json(defaults)
}

pub async fn save_general_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Json<Value> {
    let json_str = serde_json::to_string(&payload).unwrap_or_default();
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('general_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&json_str)
    .execute(&state.db)
    .await
    .ok();
    Json(payload)
}

pub async fn get_map_style(State(state): State<Arc<AppState>>) -> Json<Value> {
    let stored: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'map_style'"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let style = stored.unwrap_or_else(|| "dark".to_string());
    Json(json!({ "map_style": style }))
}

#[derive(Deserialize)]
pub struct SaveMapStyleRequest {
    pub map_style: String,
}

pub async fn save_map_style(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SaveMapStyleRequest>,
) -> Json<Value> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('map_style', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&payload.map_style)
    .execute(&state.db)
    .await
    .ok();
    Json(json!({
        "status": "success",
        "map_style": payload.map_style
    }))
}

pub async fn get_folders_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    let home = env::var("HOME").unwrap_or_else(|_| "/".to_string());
    let default_watched = json!([format!("{}/Pictures", home)]);
    let default_excluded: Vec<String> = vec![];

    let watched_str: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'watched_folders'"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let excluded_str: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'excluded_folders'"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let watched = watched_str
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or(default_watched);
    let excluded = excluded_str
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .unwrap_or_else(|| json!(default_excluded));

    Json(json!({
        "watched_folders": watched,
        "excluded_folders": excluded
    }))
}

#[derive(Deserialize)]
pub struct SaveFoldersRequest {
    pub watched_folders: Option<Vec<String>>,
    pub excluded_folders: Option<Vec<String>>,
}

pub async fn save_folders_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SaveFoldersRequest>,
) -> Json<Value> {
    let watched = payload.watched_folders.unwrap_or_default();
    let excluded = payload.excluded_folders.unwrap_or_default();

    let watched_json = serde_json::to_string(&watched).unwrap_or_default();
    let excluded_json = serde_json::to_string(&excluded).unwrap_or_default();

    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('watched_folders', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&watched_json)
    .execute(&state.db)
    .await
    .ok();

    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('excluded_folders', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&excluded_json)
    .execute(&state.db)
    .await
    .ok();

    Json(json!({
        "status": "success",
        "watched_folders": watched,
        "excluded_folders": excluded
    }))
}

pub async fn reset_library(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let deleted_photos: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    sqlx::query("DELETE FROM photo_albums").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM photo_people").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM photos").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM albums").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM people").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM faces").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM events").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM video_projects").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM agent_messages").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM agent_sessions").execute(&state.db).await.ok();

    // Reclaim freed disk space from SQLite file
    sqlx::query("VACUUM").execute(&state.db).await.ok();

    // Wipe thumbnail cache directory completely
    if state.config.thumbnails_dir.exists() {
        let _ = std::fs::remove_dir_all(&state.config.thumbnails_dir);
        let _ = std::fs::create_dir_all(&state.config.thumbnails_dir);
    }

    // Reset background AI worker queue & progress counters
    state.worker.reset();
    let _ = sqlx::query("DELETE FROM background_jobs").execute(&state.db).await;

    Ok(Json(json!({
        "status": "success",
        "message": format!("Library reset completed. {} assets removed.", deleted_photos),
        "deleted_assets": deleted_photos,
        "locked_files_deleted": 0
    })))
}

pub async fn clear_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut deleted = 0;
    if state.config.thumbnails_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&state.config.thumbnails_dir) {
            for entry in entries.flatten() {
                if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                    deleted += 1;
                }
            }
        }
        let _ = std::fs::remove_dir_all(&state.config.thumbnails_dir);
        let _ = std::fs::create_dir_all(&state.config.thumbnails_dir);
    }
    Ok(Json(json!({
        "status": "success",
        "deleted": deleted,
        "message": format!("Cache cleared. {} thumbnail(s) removed.", deleted)
    })))
}

pub async fn vacuum_db(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    sqlx::query("VACUUM").execute(&state.db).await.ok();
    Ok(Json(json!({
        "status": "success",
        "message": "Database vacuum completed successfully."
    })))
}

#[derive(Deserialize)]
pub struct PurgeFolderRequest {
    pub folder_path: String,
}

pub async fn purge_folder(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PurgeFolderRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let folder = payload.folder_path.trim();
    let deleted = sqlx::query("DELETE FROM photos WHERE path LIKE ?")
        .bind(format!("{}%", folder))
        .execute(&state.db)
        .await
        .map(|r| r.rows_affected())
        .unwrap_or(0);

    Ok(Json(json!({
        "status": "success",
        "folder": folder,
        "deleted_count": deleted
    })))
}

pub async fn sse_events() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let interval = tokio::time::interval(Duration::from_secs(5));
    let stream = IntervalStream::new(interval).map(|_| {
        Ok(Event::default().data(
            r#"{"type":"status","data":{"is_scanning":false,"total_files":0,"processed_files":0,"progress":100}}"#
        ))
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(10))
            .text("keep-alive"),
    )
}

pub async fn get_locked_folder_status(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let has_passcode: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM settings WHERE key = 'locked_folder_passcode_hash')"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    let locked_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_locked = 1"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Json(json!({
        "is_configured": has_passcode,
        "has_passcode": has_passcode,
        "is_authenticated": false,
        "locked_count": locked_count
    }))
}


pub async fn get_sync_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    let stored: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'sync_enabled'"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let is_enabled = stored
        .map(|v| v == "true")
        .unwrap_or(true);

    Json(json!({
        "is_enabled": is_enabled,
        "sync_enabled": is_enabled
    }))
}

pub async fn save_sync_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Json<Value> {
    let is_enabled = payload.get("is_enabled").and_then(|v| v.as_bool()).unwrap_or(true);
    let value_str = if is_enabled { "true" } else { "false" };

    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('sync_enabled', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(value_str)
    .execute(&state.db)
    .await
    .ok();

    Json(json!({
        "status": "success",
        "is_enabled": is_enabled
    }))
}

/// GET /settings/telemetry — returns the current telemetry configuration.
pub async fn get_telemetry_settings() -> Json<Value> {
    Json(json!({
        "enabled": get_telemetry_enabled(),
        "sample_rate": get_telemetry_sample_rate(),
        "response_logging": get_telemetry_response_logging(),
    }))
}

/// POST /settings/telemetry — updates telemetry collection settings at runtime.
/// Supports updating `enabled` (global opt-out) and/or `sample_rate`.
#[derive(Deserialize)]
pub struct SaveTelemetrySettingsRequest {
    pub enabled: Option<bool>,
    pub sample_rate: Option<u64>,
    pub response_logging: Option<bool>,
}

pub async fn save_telemetry_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SaveTelemetrySettingsRequest>,
) -> Json<Value> {
    if let Some(enabled) = payload.enabled {
        set_telemetry_enabled(enabled);
        let val = if enabled { "true" } else { "false" };
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('telemetry_enabled', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .bind(val)
        .execute(&state.db)
        .await
        .ok();
    }

    if let Some(rate) = payload.sample_rate {
        // Clamp to 0..=1000 to prevent abuse
        let clamped = rate.min(1000);
        set_telemetry_sample_rate(clamped);
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('telemetry_sample_rate', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .bind(clamped.to_string())
        .execute(&state.db)
        .await
        .ok();
    }

    if let Some(resp_logging) = payload.response_logging {
        set_telemetry_response_logging(resp_logging);
        let val = if resp_logging { "true" } else { "false" };
        sqlx::query(
            "INSERT INTO settings (key, value) VALUES ('telemetry_response_logging', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value"
        )
        .bind(val)
        .execute(&state.db)
        .await
        .ok();
    }

    Json(json!({
        "status": "success",
        "enabled": get_telemetry_enabled(),
        "sample_rate": get_telemetry_sample_rate(),
        "response_logging": get_telemetry_response_logging(),
    }))
}

pub async fn trigger_face_sync(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let db = state.db.clone();

    tokio::spawn(async move {
        let photos: Vec<(i64, String)> = sqlx::query_as("SELECT id, path FROM photos WHERE is_trash = 0 LIMIT 100")
            .fetch_all(&db)
            .await
            .unwrap_or_default();

        for (_photo_id, path) in photos {
            let _ = crate::services::face_engine::scan_faces(&path).await;
        }
    });

    Json(json!({
        "status": "success",
        "message": "Face discovery scan initiated successfully."
    }))
}

// ── Locked folder sub-endpoints ────────────────────────────────────────────

#[derive(Deserialize)]
pub struct LockedFolderSetupRequest {
    pub passcode: String,
}

#[derive(Deserialize)]
pub struct LockedFolderVerifyRequest {
    pub passcode: String,
}

#[derive(Deserialize)]
pub struct LockSessionRequest {
    pub action: String,
}

/// POST /api/v1/settings/locked-folder/setup — Set up locked folder with passcode.
pub async fn setup_locked_folder(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LockedFolderSetupRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.passcode.len() < 4 {
        return Err((StatusCode::BAD_REQUEST, "Passcode must be at least 4 characters".to_string()));
    }

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM settings WHERE key = 'locked_folder_passcode_hash')"
    )
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if exists {
        return Err((StatusCode::CONFLICT, "Locked folder already configured. Use change-passcode instead.".to_string()));
    }

    // ponytail: sha256 hash, real app should use bcrypt/scrypt
    let hash = {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(payload.passcode.as_bytes());
        format!("{:x}", hasher.finalize())
    };

    sqlx::query("INSERT INTO settings (key, value) VALUES ('locked_folder_passcode_hash', ?)")
        .bind(&hash)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "message": "Locked folder configured" })))
}

/// POST /api/v1/settings/locked-folder/verify — Verify locked folder passcode.
pub async fn verify_locked_folder(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LockedFolderVerifyRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let stored_hash: Option<String> = sqlx::query_scalar(
        "SELECT value FROM settings WHERE key = 'locked_folder_passcode_hash'"
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let verified = if let Some(ref expected) = stored_hash {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(payload.passcode.as_bytes());
        let input_hash = format!("{:x}", hasher.finalize());
        &input_hash == expected
    } else {
        false
    };

    Ok(Json(json!({ "status": "success", "verified": verified })))
}

/// POST /api/v1/settings/locked-folder/lock-session — Start/end lock session.
pub async fn lock_session(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<LockSessionRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match payload.action.as_str() {
        "start" => {
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('locked_folder_session_active', '1')")
                .execute(&state.db).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            Ok(Json(json!({ "status": "success", "session_active": true })))
        }
        "end" | "stop" => {
            sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES ('locked_folder_session_active', '0')")
                .execute(&state.db).await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            Ok(Json(json!({ "status": "success", "session_active": false })))
        }
        _ => Err((StatusCode::BAD_REQUEST, format!("Unknown action: {}", payload.action))),
    }
}

// ── Security / API Key sub-endpoints ─────────────────────────────────────

#[derive(Deserialize)]
pub struct SecuritySettingsRequest {
    pub enabled: bool,
    pub api_key: Option<String>,
}

pub async fn get_security_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    let enabled_setting: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_enabled'")
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);
    let key_setting: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_value'")
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let is_enabled = enabled_setting.map(|v| v == "true").unwrap_or_else(|| state.config.api_key.is_some());
    let current_key = key_setting.or_else(|| state.config.api_key.clone());

    let masked = current_key.as_ref().map(|k| {
        if k.len() > 6 {
            format!("{}***{}", &k[..3], &k[k.len() - 3..])
        } else {
            "***".to_string()
        }
    });

    Json(json!({
        "enabled": is_enabled,
        "api_key_masked": masked,
        "has_key": current_key.is_some()
    }))
}

pub async fn save_security_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SecuritySettingsRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let enabled_str = if payload.enabled { "true" } else { "false" };
    sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(enabled_str)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(key) = payload.api_key {
        if !key.trim().is_empty() {
            sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_value', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                .bind(key.trim())
                .execute(&state.db)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    Ok(Json(json!({ "status": "success", "enabled": payload.enabled })))
}

pub async fn generate_api_key(State(state): State<Arc<AppState>>) -> Result<Json<Value>, (StatusCode, String)> {
    let new_key = format!("prism_key_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));

    sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_value', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(&new_key)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_enabled', 'true') ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "api_key": new_key,
        "enabled": true
    })))
}

// ── Webhooks sub-endpoints ───────────────────────────────────────────────

use crate::services::webhooks::{Webhook, WebhookService};

#[derive(Deserialize)]
pub struct CreateWebhookRequest {
    pub url: String,
    pub events: Option<String>,
    pub secret: Option<String>,
    pub enabled: Option<bool>,
}

pub async fn list_webhooks(State(state): State<Arc<AppState>>) -> Result<Json<Value>, (StatusCode, String)> {
    let webhooks: Vec<Webhook> = sqlx::query_as::<_, Webhook>(
        "SELECT id, url, events, secret, enabled, created_at FROM webhooks ORDER BY id DESC"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "webhooks": webhooks })))
}

pub async fn create_webhook(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateWebhookRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.url.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Webhook URL cannot be empty".to_string()));
    }

    let events = payload.events.unwrap_or_else(|| "*".to_string());
    let enabled = payload.enabled.unwrap_or(true);

    let res = sqlx::query(
        "INSERT INTO webhooks (url, events, secret, enabled) VALUES (?, ?, ?, ?)"
    )
    .bind(payload.url.trim())
    .bind(events.trim())
    .bind(payload.secret)
    .bind(enabled)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let id = res.last_insert_rowid();

    Ok(Json(json!({
        "status": "success",
        "id": id,
        "url": payload.url,
        "events": events,
        "enabled": enabled
    })))
}

pub async fn delete_webhook(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    sqlx::query("DELETE FROM webhooks WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "id": id })))
}

pub async fn test_webhooks(State(state): State<Arc<AppState>>) -> Json<Value> {
    WebhookService::dispatch_event(
        &state.db,
        "test.ping",
        json!({
            "message": "Prism webhook test ping event",
            "server": "rust-axum"
        }),
    ).await;

    Json(json!({
        "status": "success",
        "message": "Test event dispatched to all configured webhooks."
    }))
}



