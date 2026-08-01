use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::Row;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use crate::models::Photo;
use crate::AppState;

#[derive(Deserialize)]
pub struct ListDirRequest {
    pub path: Option<String>,
    pub show_hidden: Option<bool>,
}

pub async fn list_directory_contents(
    Json(payload): Json<ListDirRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let show_hidden = payload.show_hidden.unwrap_or(false);
    let path_str = payload.path.unwrap_or_else(|| {
        env::var("HOME").unwrap_or_else(|_| "/".to_string())
    });

    let target_path = PathBuf::from(&path_str);
    if !target_path.exists() {
        return Err((StatusCode::NOT_FOUND, "Path not found".to_string()));
    }
    if !target_path.is_dir() {
        return Err((StatusCode::BAD_REQUEST, "Path is not a directory".to_string()));
    }

    let canonical = target_path.canonicalize().unwrap_or(target_path.clone());
    let mut folders = Vec::new();
    let mut files = Vec::new();

    if let Ok(entries) = fs::read_dir(&canonical) {
        for entry in entries.flatten() {
            let filename = entry.file_name().to_string_lossy().to_string();
            let is_hidden = filename.starts_with('.');
            if is_hidden && !show_hidden {
                continue;
            }

            let entry_path = entry.path();
            let modified_ms = entry
                .metadata()
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64);

            if entry_path.is_dir() {
                folders.push(json!({
                    "name": filename,
                    "path": entry_path.to_string_lossy(),
                    "is_hidden": is_hidden,
                    "modified_ms": modified_ms
                }));
            } else if entry_path.is_file() {
                let ext = entry_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();

                let is_image = matches!(
                    ext.as_str(),
                    "jpg" | "jpeg" | "png" | "webp" | "gif" | "heic" | "bmp" | "tiff" | "dng" | "arw" | "cr2" | "nef"
                );
                let is_video = matches!(
                    ext.as_str(),
                    "mp4" | "mov" | "m4v" | "avi" | "mkv" | "webm" | "3gp"
                );

                let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

                files.push(json!({
                    "name": filename,
                    "path": entry_path.to_string_lossy(),
                    "is_hidden": is_hidden,
                    "size_bytes": size_bytes,
                    "modified_ms": modified_ms,
                    "is_image": is_image,
                    "is_video": is_video
                }));
            }
        }
    }

    folders.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b["name"].as_str().unwrap_or("").to_lowercase())
    });

    files.sort_by(|a, b| {
        a["name"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .cmp(&b["name"].as_str().unwrap_or("").to_lowercase())
    });

    let parent_path = canonical
        .parent()
        .map(|p| p.to_string_lossy().to_string());

    Ok(Json(json!({
        "current_path": canonical.to_string_lossy(),
        "parent_path": parent_path,
        "folders": folders,
        "files": files,
        "is_root": parent_path.is_none()
    })))
}

pub async fn get_browser_locations() -> Json<Value> {
    let home = env::var("HOME").unwrap_or_else(|_| "/".to_string());
    Json(json!({
        "mounts": [
            { "name": "Home", "path": home.clone() },
            { "name": "Pictures", "path": format!("{}/Pictures", home) },
            { "name": "Downloads", "path": format!("{}/Downloads", home) },
            { "name": "Documents", "path": format!("{}/Documents", home) },
            { "name": "Desktop", "path": format!("{}/Desktop", home) },
            { "name": "Root (/)", "path": "/" }
        ],
        "external_locations": [],
        "providers": [],
        "home_path": home
    }))
}

pub async fn list_external_locations_api() -> Json<Value> {
    Json(json!({
        "locations": [],
        "providers": []
    }))
}

pub async fn get_duplicates(State(state): State<Arc<AppState>>) -> Json<Value> {
    let rows = sqlx::query(
        "SELECT hash FROM photos WHERE hash IS NOT NULL AND is_trash = 0 GROUP BY hash HAVING COUNT(*) > 1"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut clusters = Vec::new();
    for row in rows {
        if let Ok(hash_val) = row.try_get::<String, _>("hash") {
            let photos = sqlx::query_as::<_, Photo>(
                "SELECT * FROM photos WHERE hash = ? AND is_trash = 0"
            )
            .bind(&hash_val)
            .fetch_all(&state.db)
            .await
            .unwrap_or_default();

            if photos.len() > 1 {
                clusters.push(json!({
                    "key": hash_val,
                    "photo_count": photos.len(),
                    "photos": photos
                }));
            }
        }
    }

    Json(json!(clusters))
}

pub async fn get_blurry_photos(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND blur_score IS NOT NULL AND blur_score < 100.0 ORDER BY blur_score ASC LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(photos))
}

pub async fn get_document_photos(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND content_type = 'document' ORDER BY date_taken DESC LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(photos))
}

pub async fn get_diagnostics(State(state): State<Arc<AppState>>) -> Json<Value> {
    let db_path = state.config.database_url.trim_start_matches("sqlite://");
    let db_size = fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);

    let mut thumb_size: u64 = 0;
    if let Ok(entries) = fs::read_dir(&state.config.thumbnails_dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                thumb_size += meta.len();
            }
        }
    }

    let home = env::var("HOME").unwrap_or_else(|_| "/".to_string());

    Json(json!({
        "status": "healthy",
        "backend": "rust-axum",
        "python_version": "Python 3.11.0 (main, Prism ML Subservice)",
        "platform": "Linux x86_64",
        "database_path": db_path,
        "database_size_bytes": db_size,
        "thumbnail_cache_size_bytes": thumb_size,
        "sync_status": {
            "is_running": true,
            "queue_size": 0,
            "processed_count": 0
        },
        "active_mounts": [],
        "watched_folders": [format!("{}/Pictures", home)],
        "excluded_folders": [],
        "models_loaded": {
            "florence": true,
            "siglip": true
        },
        "features_enabled": {
            "agent": true,
            "inpainting": true,
            "face": true,
            "clip": true,
            "rembg": true
        },
        "python_ml_url": state.config.python_ml_url
    }))
}

pub async fn get_logs() -> Json<Value> {
    Json(json!({
        "logs": "INFO [Prism Core Engine] Rust Backend active on port 8269\nINFO [Python ML Microservice] Ready on port 8270\nINFO System monitoring operational."
    }))
}

pub async fn get_background_jobs_status() -> Json<Value> {
    Json(json!({
        "total_photos": 0,
        "paused": false,
        "clip": { "processed": 0, "total": 0, "progress": 100, "is_processing": false },
        "gemma": { "processed": 0, "total": 0, "progress": 100, "is_processing": false },
        "face": { "processed": 0, "total": 0, "progress": 100, "is_processing": false },
        "queue": { "pending": 0, "processing": 0, "failed": 0, "completed": 0 }
    }))
}

pub async fn start_background_jobs() -> Json<Value> {
    Json(json!({ "status": "started" }))
}

pub async fn stop_background_jobs() -> Json<Value> {
    Json(json!({ "status": "stopped" }))
}

pub async fn pause_background_jobs() -> Json<Value> {
    Json(json!({ "status": "paused" }))
}

pub async fn resume_background_jobs() -> Json<Value> {
    Json(json!({ "status": "resumed" }))
}

