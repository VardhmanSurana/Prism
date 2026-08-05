use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::{Album, Photo};
use crate::AppState;

#[derive(Deserialize)]
pub struct CreateAlbumRequest {
    pub name: String,
    pub r#type: Option<String>,
}

#[derive(Deserialize)]
pub struct RenameAlbumRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct AlbumPhotosRequest {
    pub photo_ids: Vec<Value>,
}

#[derive(Deserialize)]
pub struct SetCoverRequest {
    pub photo_id: Value,
}

pub async fn find_album_by_id_or_uuid(
    db: &sqlx::SqlitePool,
    identifier: &str,
) -> Result<Album, (StatusCode, String)> {
    let mut album_opt = None;
    if let Ok(id_num) = identifier.parse::<i64>() {
        album_opt = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ? OR uuid = ?")
            .bind(id_num)
            .bind(identifier)
            .fetch_optional(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }
    if album_opt.is_none() {
        album_opt = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE uuid = ?")
            .bind(identifier)
            .fetch_optional(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    album_opt.ok_or((StatusCode::NOT_FOUND, "Album not found".to_string()))
}

pub async fn list_albums(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Album>>, (StatusCode, String)> {
    let albums = sqlx::query_as::<_, Album>("SELECT * FROM albums ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(albums))
}

pub async fn list_smart_albums(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Album>>, (StatusCode, String)> {
    let albums = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE is_smart = 1 ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(albums))
}

pub async fn get_album_photos(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;

    let mut photos = sqlx::query_as::<_, Photo>(
        "SELECT p.* FROM photos p JOIN photo_albums pa ON p.id = pa.photo_id WHERE pa.album_id = ? AND p.is_trash = 0 ORDER BY p.date_taken DESC"
    )
    .bind(album.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for p in &mut photos {
        let p_key = p.uuid.as_deref().unwrap_or(&p.id.to_string()).to_string();
        if p.url.is_none() || p.url.as_deref().unwrap_or("").is_empty() {
            p.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
        }
    }

    Ok(Json(photos))
}

pub async fn get_memories_highlights(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Value>>, (StatusCode, String)> {
    let mut photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date_taken DESC LIMIT 20"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for p in &mut photos {
        let p_key = p.uuid.as_deref().unwrap_or(&p.id.to_string()).to_string();
        if p.url.is_none() || p.url.as_deref().unwrap_or("").is_empty() {
            p.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
        }
    }

    let mut highlights = Vec::new();
    if !photos.is_empty() {
        let cover_key = photos[0].uuid.as_deref().unwrap_or(&photos[0].id.to_string()).to_string();
        highlights.push(json!({
            "id": "otd_2025",
            "title": "On This Day",
            "subtitle": format!("{} photos from past moments", photos.len()),
            "type": "on_this_day",
            "photo_count": photos.len(),
            "cover_url": format!("/api/v1/photos/{}/thumbnail", cover_key),
            "photos": photos
        }));
    }

    Ok(Json(highlights))
}

pub async fn create_album(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateAlbumRequest>,
) -> Result<Json<Album>, (StatusCode, String)> {
    let album_type = payload.r#type.unwrap_or_else(|| "custom".to_string());
    let new_uuid = Uuid::new_v4().to_string();

    let id = sqlx::query(
        "INSERT INTO albums (uuid, name, type, is_smart, photo_count) VALUES (?, ?, ?, 0, 0)"
    )
    .bind(&new_uuid)
    .bind(&payload.name)
    .bind(&album_type)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .last_insert_rowid();

    let album = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(album))
}

pub async fn rename_album(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<RenameAlbumRequest>,
) -> Result<Json<Album>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;
    sqlx::query("UPDATE albums SET name = ? WHERE id = ?")
        .bind(&payload.name)
        .bind(album.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn add_photos_to_album(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<AlbumPhotosRequest>,
) -> Result<Json<Album>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;

    for item in payload.photo_ids {
        let pid_opt = if let Some(n) = item.as_i64() {
            Some(n)
        } else if let Some(s) = item.as_str() {
            if let Ok(photo) = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, s).await {
                Some(photo.id)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(pid) = pid_opt {
            sqlx::query("INSERT OR IGNORE INTO photo_albums (photo_id, album_id) VALUES (?, ?)")
                .bind(pid)
                .bind(album.id)
                .execute(&state.db)
                .await
                .ok();
        }
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photo_albums WHERE album_id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    sqlx::query("UPDATE albums SET photo_count = ? WHERE id = ?")
        .bind(count as i32)
        .bind(album.id)
        .execute(&state.db)
        .await
        .ok();

    let updated = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn remove_photos_from_album(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<AlbumPhotosRequest>,
) -> Result<Json<Album>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;

    for item in payload.photo_ids {
        let pid_opt = if let Some(n) = item.as_i64() {
            Some(n)
        } else if let Some(s) = item.as_str() {
            if let Ok(photo) = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, s).await {
                Some(photo.id)
            } else {
                None
            }
        } else {
            None
        };

        if let Some(pid) = pid_opt {
            sqlx::query("DELETE FROM photo_albums WHERE album_id = ? AND photo_id = ?")
                .bind(album.id)
                .bind(pid)
                .execute(&state.db)
                .await
                .ok();
        }
    }

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photo_albums WHERE album_id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    sqlx::query("UPDATE albums SET photo_count = ? WHERE id = ?")
        .bind(count as i32)
        .bind(album.id)
        .execute(&state.db)
        .await
        .ok();

    let updated = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn set_album_cover(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<SetCoverRequest>,
) -> Result<Json<Album>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;

    let photo_key = if let Some(n) = payload.photo_id.as_i64() {
        n.to_string()
    } else if let Some(s) = payload.photo_id.as_str() {
        s.to_string()
    } else {
        return Err((StatusCode::BAD_REQUEST, "Invalid photo_id".to_string()));
    };

    let cover_url = format!("/api/v1/photos/{}/thumbnail", photo_key);

    sqlx::query("UPDATE albums SET cover_url = ? WHERE id = ?")
        .bind(&cover_url)
        .bind(album.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, Album>("SELECT * FROM albums WHERE id = ?")
        .bind(album.id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn delete_album(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let album = find_album_by_id_or_uuid(&state.db, &id).await?;

    sqlx::query("DELETE FROM photo_albums WHERE album_id = ?")
        .bind(album.id)
        .execute(&state.db)
        .await
        .ok();

    sqlx::query("DELETE FROM albums WHERE id = ?")
        .bind(album.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "id": album.id, "uuid": album.uuid, "status": "deleted" })))
}

// ── Smart album photo retrieval (Python-only, TODO stubs) ──────────────────

/// GET /api/v1/albums/smart/photos — Get photos in a smart album by album_id query param.
pub async fn get_smart_album_photos_by_id(
    State(state): State<Arc<AppState>>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Json<Value> {
    let album_id = params.get("album_id").and_then(|s| s.parse::<i64>().ok()).unwrap_or(0);
    let limit: i64 = params.get("limit").and_then(|s| s.parse().ok()).unwrap_or(100);
    let offset: i64 = params.get("offset").and_then(|s| s.parse().ok()).unwrap_or(0);

    let photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT p.* FROM photos p
         JOIN photo_albums pa ON pa.photo_id = pa.album_id
         WHERE pa.album_id = ? AND p.is_trash = 0
         ORDER BY p.date_taken DESC NULLS LAST
         LIMIT ? OFFSET ?"
    )
    .bind(album_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({
        "photos": photos.iter().map(|p| json!({
            "id": p.id, "filename": p.filename, "path": p.path,
            "date_taken": p.date_taken, "width": p.width, "height": p.height,
        })).collect::<Vec<_>>(),
        "total": photos.len(),
        "offset": offset,
        "limit": limit,
        "album_id": album_id,
    }))
}

/// GET /api/v1/albums/smart/:smart_type/photos — Get photos in a fixed smart album.
pub async fn get_smart_album_photos(
    State(state): State<Arc<AppState>>,
    Path(smart_type): Path<String>,
) -> Json<Value> {
    let limit: i64 = 100;
    let filter = match smart_type.as_str() {
        "favorites" => "is_favorite = 1",
        "videos" => "mime_type LIKE 'video/%'",
        "recent" => "1=1 ORDER BY upload_date DESC",
        "panoramas" => "aspect_ratio > 2.5",
        "selfies" => "1=1",
        _ => "1=1",
    };

    let photos = sqlx::query_as::<_, crate::models::Photo>(
        &format!(
            "SELECT * FROM photos WHERE is_trash = 0 AND {} ORDER BY date_taken DESC NULLS LAST LIMIT ?",
            filter
        )
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Json(json!({
        "photos": photos.iter().map(|p| json!({
            "id": p.id, "filename": p.filename, "path": p.path,
            "date_taken": p.date_taken, "width": p.width, "height": p.height,
        })).collect::<Vec<_>>(),
        "total": photos.len(),
        "smart_type": smart_type,
    }))
}

/// POST /api/v1/albums/smart/reclassify — Re-run content classification on all photos.
pub async fn reclassify_all_photos(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_trash = 0")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    // ponytail: reclassification calls ML service for each photo without auto_tags
    let photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND (auto_tags IS NULL OR auto_tags = '')"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut updated = 0;
    for photo in &photos {
        if let Ok(resp) = state.ml_client.get_vision_caption(&photo.path).await {
            if let Some(_tags) = resp.tags.first() {
                let tags_json = serde_json::to_string(&resp.tags).unwrap_or_default();
                sqlx::query("UPDATE photos SET auto_tags = ? WHERE id = ?")
                    .bind(&tags_json)
                    .bind(photo.id)
                    .execute(&state.db)
                    .await
                    .ok();
                updated += 1;
            }
        }
    }

    Json(json!({
        "status": "success",
        "total": total,
        "updated": updated,
    }))
}
