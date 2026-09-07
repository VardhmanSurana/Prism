pub mod listing;
pub mod metadata;
pub mod purge;
pub mod upload;

pub use listing::*;
pub use metadata::*;
pub use purge::*;
pub use upload::*;

use axum::http::StatusCode;
use chrono::Utc;
use crate::models::Photo;

/// find_photo_by_id_or_uuid - Performs find photo by id or uuid.
pub async fn find_photo_by_id_or_uuid(
    db: &sqlx::SqlitePool,
    identifier: &str,
) -> Result<Photo, (StatusCode, String)> {
    let mut photo_opt = None;
    if let Ok(id_num) = identifier.parse::<i64>() {
        photo_opt = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ? OR uuid = ?")
            .bind(id_num)
            .bind(identifier)
            .fetch_optional(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    if photo_opt.is_none() {
        photo_opt = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE uuid = ?")
            .bind(identifier)
            .fetch_optional(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    let mut photo = photo_opt.ok_or((StatusCode::NOT_FOUND, "Photo not found".to_string()))?;

    let photo_key = photo.uuid.as_deref().unwrap_or(&photo.id.to_string()).to_string();
    if photo.url.is_none() || photo.url.as_deref().unwrap_or("").is_empty() {
        photo.url = Some(format!("/api/v1/photos/{}/thumbnail", photo_key));
    }
    if photo.date_taken.is_none() {
        photo.date_taken = photo.upload_date.or(Some(Utc::now()));
    }
    if photo.date.is_none() {
        photo.date = photo.date_taken;
    }

    if photo.file_size.is_none() || photo.file_size == Some(0) {
        if let Some(real_path) = resolve_photo_path(&photo.path) {
            if let Ok(meta) = std::fs::metadata(&real_path) {
                let size = meta.len() as i64;
                photo.file_size = Some(size);
                let pid = photo.id;
                let db_clone = db.clone();
                tokio::spawn(async move {
                    let _ = sqlx::query("UPDATE photos SET file_size = ? WHERE id = ?")
                        .bind(size)
                        .bind(pid)
                        .execute(&db_clone)
                        .await;
                });
            }
        }
    }

    Ok(photo)
}
