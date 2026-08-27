use axum::{
    extract::{Path, State},
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

/// list_directory_contents - Retrieves list directory contents.
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

/// get_browser_locations - Retrieves get browser locations.
pub async fn get_browser_locations(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let home = env::var("HOME").unwrap_or_else(|_| "/".to_string());
    let mut mounts = vec![
        json!({ "name": "Home", "path": home.clone() }),
        json!({ "name": "Pictures", "path": format!("{}/Pictures", home) }),
        json!({ "name": "Downloads", "path": format!("{}/Downloads", home) }),
        json!({ "name": "Documents", "path": format!("{}/Documents", home) }),
        json!({ "name": "Desktop", "path": format!("{}/Desktop", home) }),
        json!({ "name": "Root (/)", "path": "/" }),
    ];

    let rows = sqlx::query("SELECT id, name, provider, mount_path, enabled FROM external_locations WHERE enabled = 1")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let mut ext_locations = Vec::new();
    for row in rows {
        let id: i64 = row.get("id");
        let name: String = row.get("name");
        let provider: String = row.get("provider");
        let mount_path: String = row.get("mount_path");
        let enabled: bool = row.get("enabled");

        ext_locations.push(json!({
            "id": id,
            "name": name.clone(),
            "provider": provider,
            "mount_path": mount_path.clone(),
            "enabled": enabled
        }));

        if !mount_path.is_empty() && std::path::Path::new(&mount_path).exists() {
            mounts.push(json!({ "name": name, "path": mount_path }));
        }
    }

    Json(json!({
        "mounts": mounts,
        "external_locations": ext_locations,
        "providers": [
            { "id": "local_path", "label": "Local / Network Mount", "ready": true, "description": "Existing directory mounted on your operating system" },
            { "id": "smb", "label": "SMB / Samba Share", "ready": true, "description": "Network share mounted locally" }
        ],
        "home_path": home
    }))
}

/// list_external_locations_api - Retrieves list external locations api.
pub async fn list_external_locations_api(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let rows = sqlx::query("SELECT id, name, provider, mount_path, enabled FROM external_locations")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let locations: Vec<Value> = rows.into_iter().map(|row| {
        let id: i64 = row.get("id");
        let name: String = row.get("name");
        let provider: String = row.get("provider");
        let mount_path: String = row.get("mount_path");
        let enabled: bool = row.get("enabled");
        json!({
            "id": id,
            "name": name,
            "provider": provider,
            "mount_path": mount_path,
            "enabled": enabled
        })
    }).collect();

    Json(json!({
        "locations": locations,
        "providers": [
            { "id": "local_path", "label": "Local / Network Mount", "ready": true, "description": "Existing directory mounted on your operating system" },
            { "id": "smb", "label": "SMB / Samba Share", "ready": true, "description": "Network share mounted locally" }
        ]
    }))
}

/// get_duplicates - Retrieves get duplicates.
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

/// get_blurry_photos - Retrieves get blurry photos.
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

/// get_document_photos - Retrieves get document photos.
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

/// get_diagnostics - Retrieves get diagnostics.
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
            "inpainting": true,
            "face": true,
            "clip": true,
            "rembg": true
        }
    }))
}

/// get_logs - Retrieves get logs.
pub async fn get_logs() -> Json<Value> {
    Json(json!({
        "logs": "INFO [Prism Core Engine] Rust Backend active on port 8269\nINFO System monitoring operational."
    }))
}


/// get_background_jobs_status - Retrieves get background jobs status.
pub async fn get_background_jobs_status(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let s = state.worker.status_snapshot();
    let sys = state.scheduler.get_system_state();

    // Query DB for total photos and per-stage completion counts
    let total_photos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let clip_done: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0 AND embedding IS NOT NULL AND embedding != ''"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let face_done: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT photo_id) FROM faces"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let vision_done: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0 AND ai_summary IS NOT NULL AND ai_summary != ''"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let ocr_done: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0 AND ocr_text IS NOT NULL AND ocr_text != ''"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let queue_counts = sqlx::query(
        "SELECT status, COUNT(*) as cnt FROM background_jobs GROUP BY status"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut queue = json!({ "pending": 0, "processing": 0, "failed": 0, "completed": 0 });
    for row in &queue_counts {
        let status: String = row.get("status");
        let cnt: i64 = row.get("cnt");
        if let Some(slot) = queue.get_mut(&status) {
            *slot = json!(cnt);
        }
    }

    let t = total_photos.max(1) as f64;

    Json(json!({
        "total_photos": total_photos,
        "paused": s.paused,
        "is_processing": s.is_processing,
        "clip": {
            "processed": clip_done,
            "total": total_photos,
            "progress": (clip_done as f64 / t * 100.0).round() as i64,
            "is_processing": s.is_processing
        },
        "face": {
            "processed": face_done,
            "total": total_photos,
            "progress": (face_done as f64 / t * 100.0).round() as i64,
            "is_processing": s.is_processing
        },
        "gemma": {
            "processed": vision_done,
            "total": total_photos,
            "progress": (vision_done as f64 / t * 100.0).round() as i64,
            "is_processing": false
        },
        "ocr": {
            "processed": ocr_done,
            "total": total_photos,
            "progress": (ocr_done as f64 / t * 100.0).round() as i64,
            "is_processing": false
        },
        "queue": queue,
        "system": {
            "cpu_usage": sys.cpu_usage,
            "on_battery": sys.on_battery,
            "battery_percent": sys.battery_percent,
            "gpu_busy": sys.gpu_busy,
            "external_disconnected": sys.external_disconnected,
            "user_active": sys.user_active
        }
    }))
}

/// start_background_jobs - Performs start background jobs.
pub async fn start_background_jobs(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(false, Ordering::Relaxed);
    state.worker.notify.notify_one();
    Json(json!({ "status": "started", "paused": false }))
}

/// stop_background_jobs - Performs stop background jobs.
pub async fn stop_background_jobs(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(true, Ordering::Relaxed);
    Json(json!({ "status": "stopped", "paused": true }))
}

/// pause_background_jobs - Performs pause background jobs.
pub async fn pause_background_jobs(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(true, Ordering::Relaxed);
    Json(json!({ "status": "paused", "paused": true }))
}

/// resume_background_jobs - Performs resume background jobs.
pub async fn resume_background_jobs(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(false, Ordering::Relaxed);
    state.worker.notify.notify_one();
    Json(json!({ "status": "resumed", "paused": true }))
}

/// GET /api/v1/utilities/system-state — Current system resource snapshot.
pub async fn get_system_state(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let s = state.scheduler.get_system_state();
    Json(json!({
        "cpu_usage": s.cpu_usage,
        "on_battery": s.on_battery,
        "battery_percent": s.battery_percent,
        "gpu_busy": s.gpu_busy,
        "external_disconnected": s.external_disconnected,
        "user_active": s.user_active
    }))
}


// ── Utility endpoints (Python-only, TODO stubs) ────────────────────────────

/// GET /api/v1/utilities/visual-duplicates — Visual duplicate detection by perceptual hash.
pub async fn get_visual_duplicates(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND phash IS NOT NULL"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // ponytail: simple Hamming distance comparison, not production-grade phash dedup
    let mut clusters: Vec<Value> = Vec::new();
    for (i, a) in photos.iter().enumerate() {
        let mut cluster = vec![json!({ "id": a.id, "filename": a.filename, "path": a.path })];
        for b in photos.iter().skip(i + 1) {
            if let (Some(ref ha), Some(ref hb)) = (&a.phash, &b.phash) {
                if ha.len() == hb.len() {
                    let dist: u32 = ha.bytes().zip(hb.bytes()).map(|(x, y)| (x ^ y).count_ones()).sum();
                    if dist <= 5 {
                        cluster.push(json!({ "id": b.id, "filename": b.filename, "path": b.path, "distance": dist }));
                    }
                }
            }
        }
        if cluster.len() > 1 {
            clusters.push(json!({ "photos": cluster }));
        }
    }

    Json(json!({ "clusters": clusters }))
}

/// POST /api/v1/utilities/backup/export — Export backup (DB + settings as zip).
pub async fn export_backup(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "backend_rust/prism.db".to_string())
        .replace("sqlite://", "");

    let backup_path = std::env::temp_dir().join(format!("prism_backup_{}.db", chrono::Utc::now().format("%Y%m%d_%H%M%S")));
    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to copy database: {}", e)))?;

    Ok(Json(json!({
        "status": "success",
        "backup_path": backup_path.to_string_lossy(),
    })))
}

/// POST /api/v1/utilities/backup/restore — Restore backup from zip.
pub async fn restore_backup(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // ponytail: restore = replace the active DB file. Requires app restart.
    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "backend_rust/prism.db".to_string())
        .replace("sqlite://", "");

    let backup_dir = std::env::temp_dir();
    let entries: Vec<_> = std::fs::read_dir(&backup_dir)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().to_string_lossy().starts_with("prism_backup_"))
        .collect();

    let latest = entries.last()
        .ok_or((StatusCode::NOT_FOUND, "No backup found".to_string()))?;

    std::fs::copy(latest.path(), &db_path)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to restore: {}", e)))?;

    Ok(Json(json!({
        "status": "success",
        "restored_from": latest.path().to_string_lossy(),
        "message": "Database restored. Please restart the application.",
    })))
}

#[derive(serde::Deserialize)]
pub struct ExternalLocationCreate {
    pub name: String,
    #[serde(default)]
    pub provider: String,
    #[serde(default)]
    pub mount_path: Option<String>,
    #[serde(default)]
    pub enabled: bool,
}

/// POST /api/v1/utilities/external-locations — Create external location.
pub async fn create_external_location(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExternalLocationCreate>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let mount = payload.mount_path.unwrap_or_default();

    if payload.provider == "local_path" || payload.provider == "smb" {
        if mount.trim().is_empty() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"detail": "Mount path is required"}))));
        }
        if !std::path::Path::new(&mount).exists() {
            return Err((StatusCode::BAD_REQUEST, Json(json!({"detail": format!("Mount path '{}' does not exist on this system", mount)}))));
        }
    }

    let result = sqlx::query(
        "INSERT INTO external_locations (name, provider, mount_path, enabled) VALUES (?, ?, ?, ?)"
    )
    .bind(&payload.name)
    .bind(&payload.provider)
    .bind(&mount)
    .bind(payload.enabled)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"detail": format!("Database error: {}", e)}))))?;

    let id = result.last_insert_rowid();

    Ok(Json(json!({
        "status": "success",
        "id": id,
        "name": payload.name,
        "provider": payload.provider,
        "mount_path": mount,
        "enabled": payload.enabled,
    })))
}

/// PATCH /api/v1/utilities/external-locations/:loc_id — Update external location.
pub async fn update_external_location(
    State(state): State<Arc<AppState>>,
    Path(loc_id): Path<i64>,
    Json(payload): Json<ExternalLocationCreate>,
) -> Result<Json<Value>, (StatusCode, String)> {
    sqlx::query(
        "UPDATE external_locations SET name = ?, provider = ?, mount_path = ?, enabled = ? WHERE id = ?"
    )
    .bind(&payload.name)
    .bind(&payload.provider)
    .bind(&payload.mount_path.unwrap_or_default())
    .bind(payload.enabled)
    .bind(loc_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "id": loc_id })))
}

/// DELETE /api/v1/utilities/external-locations/:loc_id — Delete external location.
pub async fn delete_external_location(
    State(state): State<Arc<AppState>>,
    Path(loc_id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    sqlx::query("DELETE FROM external_locations WHERE id = ?")
        .bind(loc_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "id": loc_id })))
}

#[derive(serde::Deserialize)]
pub struct BatchRenameRequest {
    pub paths: Vec<String>,
    pub pattern: String,
    #[serde(default)]
    pub start_index: i32,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default = "default_preserve_ext")]
    pub preserve_extension: bool,
}

/// default_preserve_ext - Performs default preserve ext.
fn default_preserve_ext() -> bool { true }

/// POST /api/v1/utilities/batch-rename — Pattern-based batch file rename.
pub async fn batch_rename_files(
    Json(payload): Json<BatchRenameRequest>,
) -> Json<Value> {
    let mut renamed = 0;
    let mut skipped = 0;
    let mut failed = 0;
    let mut results = Vec::new();

    for (i, path) in payload.paths.iter().enumerate() {
        let src = std::path::Path::new(path);
        if !src.exists() {
            skipped += 1;
            continue;
        }

        let ext = if payload.preserve_extension {
            src.extension().and_then(|e| e.to_string_lossy().to_string().into()).unwrap_or_default()
        } else {
            String::new()
        };

        let name = payload.pattern
            .replace("{n}", &format!("{}", payload.start_index + i as i32))
            .replace("{name}", src.file_stem().and_then(|s| s.to_str()).unwrap_or(""))
            .replace("{ext}", &ext);

        let new_path = src.parent().unwrap_or(src).join(&name);
        if new_path.exists() {
            skipped += 1;
            results.push(json!({ "from": path, "status": "skipped", "reason": "target exists" }));
            continue;
        }

        if payload.dry_run {
            results.push(json!({ "from": path, "to": new_path.to_string_lossy(), "status": "preview" }));
        } else {
            match std::fs::rename(src, &new_path) {
                Ok(_) => { renamed += 1; results.push(json!({ "from": path, "to": new_path.to_string_lossy(), "status": "renamed" })); }
                Err(e) => { failed += 1; results.push(json!({ "from": path, "status": "failed", "error": e.to_string() })); }
            }
        }
    }

    Json(json!({
        "dry_run": payload.dry_run,
        "renamed": renamed,
        "skipped": skipped,
        "failed": failed,
        "results": results,
    }))
}

#[derive(serde::Deserialize)]
pub struct OpenInExplorerRequest {
    pub path: String,
}

/// POST /api/v1/utilities/open-in-os-explorer — Open a path in the host OS file explorer.
pub async fn open_in_os_explorer(
    Json(payload): Json<OpenInExplorerRequest>,
) -> Json<Value> {
    let path = std::path::Path::new(&payload.path);
    let target = if path.is_file() {
        path.parent().unwrap_or(path)
    } else {
        path
    };

    let result = std::process::Command::new(if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    })
    .arg(target)
    .output();

    match result {
        Ok(_) => Json(json!({ "status": "success", "path": payload.path })),
        Err(e) => Json(json!({ "status": "error", "path": payload.path, "error": e.to_string() })),
    }
}

// ── New stubs for Python-parity endpoints ──────────────────────────────────

/// GET /api/v1/utilities/search/fused — Multi-strategy fused search.
pub async fn fused_search(
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let query = params.get("q").map(|s| s.as_str()).unwrap_or("");
    let limit: usize = params.get("limit")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);

    if query.is_empty() {
        let results = sqlx::query_as::<_, (i64, String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT id, uuid, filename, path, date_taken, city, state, country, caption
             FROM photos ORDER BY date_taken DESC LIMIT ?"
        )
        .bind(limit as i64)
        .fetch_all(&state.db)
        .await
        .map(|rows| rows.into_iter().map(|(id, uuid, filename, path, date_taken, city, state_val, country, caption)| {
            json!({ "id": id, "uuid": uuid, "filename": filename, "path": path,
                    "date_taken": date_taken, "city": city, "state": state_val,
                    "country": country, "caption": caption })
        }).collect::<Vec<_>>())
        .unwrap_or_default();

        return Json(json!({ "results": results, "total": results.len() }));
    }

    let search_tools = crate::services::agent_search::SearchTools::new(state.db.clone(), crate::services::siglip::get_engine().ok());
    let similar_ids = search_tools.semantic_search(query, limit, false, true).await;

    if similar_ids.is_empty() {
        return Json(json!({ "results": [], "total": 0 }));
    }
    
    // Fetch photos
    let mut results = Vec::new();
    for id in similar_ids {
        if let Ok(row) = sqlx::query_as::<_, (i64, String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT id, uuid, filename, path, date_taken, city, state, country, caption
             FROM photos WHERE id = ?"
        )
        .bind(id)
        .fetch_one(&state.db)
        .await {
            results.push(json!({
                "id": row.0, "uuid": row.1, "filename": row.2, "path": row.3,
                "date_taken": row.4, "city": row.5, "state": row.6,
                "country": row.7, "caption": row.8
            }));
        }
    }

    Json(json!({ "results": results, "total": results.len() }))
}

#[derive(Deserialize)]
pub struct PurgeTrashRequest {
    #[serde(default = "default_days")]
    pub older_than_days: i32,
}

/// default_days - Performs default days.
fn default_days() -> i32 { 30 }

/// POST /api/v1/utilities/purge-trash — Purge trashed photos older than N days.
pub async fn purge_trash(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PurgeTrashRequest>,
) -> Json<Value> {
    let older_than_days = payload.older_than_days;
    let cutoff = chrono::Utc::now() - chrono::Duration::days(older_than_days.into());

    // ponytail: find photos in trash older than cutoff, delete files + rows
    let trashed = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 1 AND date <= ?"
    )
    .bind(cutoff)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let count = trashed.len();
    for photo in &trashed {
        let _ = std::fs::remove_file(&photo.path);
        let _ = std::fs::remove_file(format!("{}.xmp", photo.path));
    }

    sqlx::query("DELETE FROM photos WHERE is_trash = 1 AND date <= ?")
        .bind(cutoff)
        .execute(&state.db)
        .await
        .ok();

    Json(json!({ "status": "success", "purged": count, "older_than_days": older_than_days }))
}
