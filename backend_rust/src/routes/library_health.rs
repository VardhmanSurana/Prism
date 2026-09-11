use axum::{extract::State, http::StatusCode, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::models::LibraryBackup;
use crate::routes::utilities::dir_size_recursive;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct StorageBreakdown {
    pub originals_bytes: i64,
    pub thumbnails_bytes: u64,
    pub models_bytes: u64,
    pub proxies_bytes: u64,
    pub database_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MissingPhotoInfo {
    pub id: i64,
    pub filename: String,
    pub path: String,
    pub missing_since: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatusResponse {
    pub storage: StorageBreakdown,
    pub missing_count: i64,
    pub broken_paths_count: i64,
    pub broken_samples: Vec<MissingPhotoInfo>,
    pub last_backup: Option<LibraryBackup>,
    pub integrity_status: String,
    pub is_healthy: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanMissingResponse {
    pub status: String,
    pub scanned_total: usize,
    pub missing_count: usize,
    pub restored_count: usize,
    pub missing_photos: Vec<MissingPhotoInfo>,
}

#[derive(Debug, Deserialize)]
pub struct RelinkRequest {
    pub old_prefix: String,
    pub new_prefix: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RelinkResponse {
    pub status: String,
    pub matched_count: usize,
    pub relinked_count: usize,
    pub failed_count: usize,
}

/// GET /api/v1/library/health/status
/// Returns storage allocation, missing media count, SQLite database integrity, and last backup.
pub async fn get_health_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthStatusResponse>, (StatusCode, String)> {
    let db_path_str = state.config.database_url.trim_start_matches("sqlite://");
    let db_path = Path::new(db_path_str);
    let db_size = fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    let wal_size = fs::metadata(format!("{}-wal", db_path_str)).map(|m| m.len()).unwrap_or(0);
    let shm_size = fs::metadata(format!("{}-shm", db_path_str)).map(|m| m.len()).unwrap_or(0);
    let database_bytes = db_size + wal_size + shm_size;

    let thumbnails_bytes = dir_size_recursive(&state.config.thumbnails_dir);
    let models_bytes = dir_size_recursive(&state.config.models_dir);

    let mut proxies_bytes = 0u64;
    let proxy_dir_1 = state.config.upload_dir.join("proxies");
    if proxy_dir_1.exists() {
        proxies_bytes += dir_size_recursive(&proxy_dir_1);
    }
    let proxy_dir_2 = PathBuf::from("prism_proxies");
    if proxy_dir_2.exists() {
        proxies_bytes += dir_size_recursive(&proxy_dir_2);
    }

    let originals_bytes: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE is_trash = 0"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let total_bytes = database_bytes
        + thumbnails_bytes
        + models_bytes
        + proxies_bytes
        + (originals_bytes.max(0) as u64);

    let storage = StorageBreakdown {
        originals_bytes,
        thumbnails_bytes,
        models_bytes,
        proxies_bytes,
        database_bytes,
        total_bytes,
    };

    let missing_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND missing_since IS NOT NULL"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let broken_paths_count = missing_count;

    let broken_samples: Vec<MissingPhotoInfo> = sqlx::query_as::<_, (i64, String, String, Option<chrono::DateTime<chrono::Utc>>)>(
        "SELECT id, filename, path, missing_since FROM photos WHERE is_trash = 0 AND missing_since IS NOT NULL LIMIT 50"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(id, filename, path, missing_since)| MissingPhotoInfo {
        id,
        filename,
        path,
        missing_since,
    })
    .collect();

    let last_backup = sqlx::query_as::<_, LibraryBackup>(
        "SELECT id, filename, path, size_bytes, integrity_status, created_at FROM library_backups ORDER BY id DESC LIMIT 1"
    )
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let integrity_status: String = sqlx::query_scalar("PRAGMA quick_check;")
        .fetch_one(&state.db)
        .await
        .unwrap_or_else(|_| "error".to_string());

    let is_healthy = integrity_status == "ok" && missing_count == 0;

    Ok(Json(HealthStatusResponse {
        storage,
        missing_count,
        broken_paths_count,
        broken_samples,
        last_backup,
        integrity_status,
        is_healthy,
    }))
}

/// POST /api/v1/library/health/scan-missing
/// Verifies all active photos on disk. Updates missing_since and last_verified timestamps.
pub async fn scan_missing(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ScanMissingResponse>, (StatusCode, String)> {
    let rows: Vec<(i64, String, Option<chrono::DateTime<chrono::Utc>>)> = sqlx::query_as(
        "SELECT id, path, missing_since FROM photos WHERE is_trash = 0"
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let scanned_total = rows.len();
    let mut missing_count = 0;
    let mut restored_count = 0;

    let mut tx = state.db.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for (id, path, missing_since) in rows {
        let exists = Path::new(&path).exists();
        if !exists {
            missing_count += 1;
            if missing_since.is_none() {
                let _ = sqlx::query(
                    "UPDATE photos SET missing_since = CURRENT_TIMESTAMP, last_verified = CURRENT_TIMESTAMP WHERE id = ?"
                )
                .bind(id)
                .execute(&mut *tx)
                .await;
            } else {
                let _ = sqlx::query(
                    "UPDATE photos SET last_verified = CURRENT_TIMESTAMP WHERE id = ?"
                )
                .bind(id)
                .execute(&mut *tx)
                .await;
            }
        } else if missing_since.is_some() {
            restored_count += 1;
            let _ = sqlx::query(
                "UPDATE photos SET missing_since = NULL, last_verified = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(id)
            .execute(&mut *tx)
            .await;
        } else {
            let _ = sqlx::query(
                "UPDATE photos SET last_verified = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(id)
            .execute(&mut *tx)
            .await;
        }
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let missing_photos = sqlx::query_as::<_, (i64, String, String, Option<chrono::DateTime<chrono::Utc>>)>(
        "SELECT id, filename, path, missing_since FROM photos WHERE is_trash = 0 AND missing_since IS NOT NULL ORDER BY id DESC LIMIT 100"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(|(id, filename, path, missing_since)| MissingPhotoInfo {
        id,
        filename,
        path,
        missing_since,
    })
    .collect();

    Ok(Json(ScanMissingResponse {
        status: "success".to_string(),
        scanned_total,
        missing_count,
        restored_count,
        missing_photos,
    }))
}

/// POST /api/v1/library/health/relink
/// Relinks paths with an old prefix to a new prefix if the new path exists on disk.
pub async fn relink_paths(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RelinkRequest>,
) -> Result<Json<RelinkResponse>, (StatusCode, String)> {
    if payload.old_prefix.trim().is_empty() || payload.new_prefix.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "old_prefix and new_prefix cannot be empty".to_string()));
    }

    let pattern = format!("{}%", payload.old_prefix);
    let candidate_rows: Vec<(i64, String)> = sqlx::query_as(
        "SELECT id, path FROM photos WHERE is_trash = 0 AND path LIKE ?"
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let matched_count = candidate_rows.len();
    let mut relinked_count = 0;
    let mut failed_count = 0;

    let mut tx = state.db.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for (id, path) in candidate_rows {
        let new_path = path.replacen(&payload.old_prefix, &payload.new_prefix, 1);
        if Path::new(&new_path).exists() {
            let res = sqlx::query(
                "UPDATE photos SET path = ?, missing_since = NULL, last_verified = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(&new_path)
            .bind(id)
            .execute(&mut *tx)
            .await;
            if res.is_ok() {
                relinked_count += 1;
            } else {
                failed_count += 1;
            }
        } else {
            failed_count += 1;
        }
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(RelinkResponse {
        status: "success".to_string(),
        matched_count,
        relinked_count,
        failed_count,
    }))
}

/// POST /api/v1/library/health/verify-checksums
/// Runs full PRAGMA integrity_check on the database.
pub async fn verify_checksums(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let integrity_result: String = sqlx::query_scalar("PRAGMA integrity_check;")
        .fetch_one(&state.db)
        .await
        .unwrap_or_else(|_| "error".to_string());

    let quick_check: String = sqlx::query_scalar("PRAGMA quick_check;")
        .fetch_one(&state.db)
        .await
        .unwrap_or_else(|_| "error".to_string());

    Ok(Json(json!({
        "status": "success",
        "integrity_result": integrity_result,
        "quick_check": quick_check,
        "is_healthy": integrity_result == "ok" && quick_check == "ok",
    })))
}
