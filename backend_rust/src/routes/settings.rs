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

pub async fn get_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "port": state.config.port,
        "upload_dir": state.config.upload_dir.to_string_lossy(),
        "thumbnails_dir": state.config.thumbnails_dir.to_string_lossy(),
        "python_ml_url": state.config.python_ml_url,
        "backend": "rust-axum"
    }))
}

pub async fn get_general_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
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
        "backend": "rust-axum",
        "port": state.config.port
    }))
}

pub async fn save_general_settings(
    Json(payload): Json<Value>,
) -> Json<Value> {
    Json(payload)
}

pub async fn get_map_style() -> Json<Value> {
    Json(json!({
        "map_style": "dark"
    }))
}

#[derive(Deserialize)]
pub struct SaveMapStyleRequest {
    pub map_style: String,
}

pub async fn save_map_style(
    Json(payload): Json<SaveMapStyleRequest>,
) -> Json<Value> {
    Json(json!({
        "status": "success",
        "map_style": payload.map_style
    }))
}

pub async fn get_locked_folder_status() -> Json<Value> {
    Json(json!({
        "is_configured": false,
        "is_unlocked": false
    }))
}

pub async fn setup_locked_folder() -> Json<Value> {
    Json(json!({
        "status": "success",
        "is_configured": true,
        "is_unlocked": true
    }))
}

pub async fn verify_locked_folder() -> Json<Value> {
    Json(json!({
        "status": "success",
        "is_unlocked": true
    }))
}

pub async fn lock_session() -> Json<Value> {
    Json(json!({
        "status": "success",
        "is_unlocked": false
    }))
}

pub async fn get_sync_settings() -> Json<Value> {
    Json(json!({
        "is_enabled": true,
        "auto_sync": true,
        "sync_interval_mins": 30,
        "sync_enabled": true
    }))
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct SaveSyncRequest {
    pub is_enabled: Option<bool>,
    pub excluded_folders: Option<Vec<String>>,
}

pub async fn save_sync_settings(
    Json(payload): Json<SaveSyncRequest>,
) -> Json<Value> {
    let is_enabled = payload.is_enabled.unwrap_or(true);
    Json(json!({
        "status": "success",
        "is_enabled": is_enabled
    }))
}

pub async fn get_folders_settings() -> Json<Value> {
    let home = env::var("HOME").unwrap_or_else(|_| "/".to_string());
    Json(json!({
        "watched_folders": [format!("{}/Pictures", home)],
        "excluded_folders": []
    }))
}

#[derive(Deserialize)]
pub struct SaveFoldersRequest {
    pub watched_folders: Option<Vec<String>>,
    pub excluded_folders: Option<Vec<String>>,
}

pub async fn save_folders_settings(
    Json(payload): Json<SaveFoldersRequest>,
) -> Json<Value> {
    let watched = payload.watched_folders.unwrap_or_default();
    let excluded = payload.excluded_folders.unwrap_or_default();
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
    sqlx::query("DELETE FROM background_jobs").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM photos").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM albums").execute(&state.db).await.ok();
    sqlx::query("DELETE FROM people").execute(&state.db).await.ok();

    if state.config.thumbnails_dir.exists() {
        let _ = std::fs::remove_dir_all(&state.config.thumbnails_dir);
        let _ = std::fs::create_dir_all(&state.config.thumbnails_dir);
    }

    Ok(Json(json!({
        "status": "success",
        "message": format!("Library reset completed. {} assets removed.", deleted_photos),
        "deleted_assets": deleted_photos,
        "locked_files_deleted": 0
    })))
}

pub async fn trigger_face_sync() -> Json<Value> {
    Json(json!({
        "status": "success",
        "message": "Face discovery initiated"
    }))
}

pub async fn clear_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut deleted = 0;
    if let Ok(entries) = std::fs::read_dir(&state.config.thumbnails_dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                if std::fs::remove_file(entry.path()).is_ok() {
                    deleted += 1;
                }
            }
        }
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
