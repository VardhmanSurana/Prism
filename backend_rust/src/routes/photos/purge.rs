use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::path::Path as FsPath;
use std::sync::Arc;

use crate::AppState;

/// Removes every piece of app-side data tied to a photo:
/// - `photos` row
/// - `photo_albums` / `photo_people` / `faces` / `background_jobs` entries
/// - dangling `cover_photo_id` references on events / video projects
/// - derived thumbnail files on disk (`{id}_thumb*.jpg`)
///
/// The actual media file at `photos.path` is NEVER touched.
pub async fn purge_photo_app_data(
    db: &SqlitePool,
    thumbnails_dir: &FsPath,
    photo_id: i64,
) -> Result<(), String> {
    let mut tx = db.begin().await.map_err(|e| e.to_string())?;

    // Relational data — the schema has no FK cascades on these tables, so
    // every row must be deleted explicitly.
    sqlx::query("DELETE FROM photo_albums WHERE photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM photo_people WHERE photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM faces WHERE photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM background_jobs WHERE photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // Clear dangling references.
    sqlx::query("UPDATE events SET cover_photo_id = NULL WHERE cover_photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query("UPDATE video_projects SET cover_photo_id = NULL WHERE cover_photo_id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    // The main row, last.
    sqlx::query("DELETE FROM photos WHERE id = ?")
        .bind(photo_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    // Derived files on disk (media file + .xmp sidecar are NEVER touched):
    // - thumbnails: all size variants share the `{id}_thumb` prefix
    // - segmentation masks: `mask_{id}_background[_model].png` under masks dir
    let dir = thumbnails_dir.to_path_buf();
    let thumb_prefix = format!("{}_thumb", photo_id);
    let mask_prefix = format!("mask_{}_", photo_id);
    let _ = tokio::task::spawn_blocking(move || {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name = name.to_string_lossy();
                if name.starts_with(&thumb_prefix) || name.starts_with(&mask_prefix) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
        // Masks live in `<thumbnails_dir>/masks/`
        let masks_dir = dir.join("masks");
        if let Ok(entries) = std::fs::read_dir(&masks_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name();
                if name.to_string_lossy().starts_with(&mask_prefix) {
                    let _ = std::fs::remove_file(entry.path());
                }
            }
        }
    })
    .await;

    Ok(())
}

/// DELETE /api/v1/photos/:uuid/purge — permanently removes ALL app-side data
/// for a photo. Lookup is by UUID only (no legacy numeric-id fallback).
pub async fn purge_photo(
    State(state): State<Arc<AppState>>,
    Path(uuid): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = sqlx::query_as::<_, crate::models::Photo>("SELECT * FROM photos WHERE uuid = ?")
        .bind(&uuid)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((
            StatusCode::NOT_FOUND,
            format!("Photo with uuid '{}' not found", uuid),
        ))?;

    purge_photo_app_data(&state.db, &state.config.thumbnails_dir, photo.id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(json!({ "status": "success", "purged_uuid": photo.uuid })))
}