use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Json, Response},
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::models::{Album, Photo, ResourceShare};
use crate::routes::albums::find_album_by_id_or_uuid;
use crate::routes::photos::{find_photo_by_id_or_uuid, resolve_photo_path};
use crate::AppState;

// ponytail: Lean DTO for creating resource-based share links.
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateShareRequest {
    pub resource_type: String,
    pub resource_id: String,
    pub expires_in_secs: Option<i64>,
    pub max_downloads: Option<i64>,
    pub hide_exif: Option<bool>,
    pub hide_gps: Option<bool>,
    pub download_original: Option<bool>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CreateShareResponse {
    pub share_token: String,
    pub share_url: String,
    pub share: ResourceShare,
}

#[derive(Debug, Deserialize)]
pub struct ShareAccessQuery {
    pub password: Option<String>,
    pub photo_id: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SharedResourceResponse {
    pub share: ResourceShare,
    pub resource_type: String,
    pub photo: Option<Photo>,
    pub album: Option<Album>,
    pub album_photos: Option<Vec<Photo>>,
}

// ponytail: Simple SHA-256 password hashing for shared resources to avoid heavy crypto crates.
fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ponytail: Helper function validating expiration timestamp, download quotas, and optional password access.
fn validate_share(share: &ResourceShare, password: Option<&str>) -> Result<(), (StatusCode, String)> {
    if let Some(exp) = share.expires_at {
        if Utc::now() > exp {
            return Err((StatusCode::GONE, "Share link has expired".to_string()));
        }
    }

    if let Some(max_dl) = share.max_downloads {
        if share.download_count >= max_dl {
            return Err((StatusCode::GONE, "Maximum download limit reached".to_string()));
        }
    }

    if let Some(expected_hash) = &share.password_hash {
        let provided = password.unwrap_or("");
        if hash_password(provided) != *expected_hash {
            return Err((
                StatusCode::UNAUTHORIZED,
                "Password required or invalid".to_string(),
            ));
        }
    }

    Ok(())
}

fn mask_exif(photo: &mut Photo) {
    photo.exif_make = None;
    photo.exif_model = None;
    photo.exif_focal_length = None;
    photo.exif_iso = None;
}

fn mask_gps(photo: &mut Photo) {
    photo.latitude = None;
    photo.longitude = None;
    photo.location = None;
    photo.city = None;
    photo.state = None;
    photo.country = None;
}

/// POST /api/v1/shares - Create a new resource share token with optional expiry, max downloads, and privacy controls.
pub async fn create_share(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateShareRequest>,
) -> Result<Json<CreateShareResponse>, (StatusCode, String)> {
    let share_token = Uuid::new_v4().to_string();
    let expires_at = payload
        .expires_in_secs
        .map(|secs| Utc::now() + chrono::Duration::seconds(secs));
    let password_hash = payload
        .password
        .as_ref()
        .filter(|p| !p.trim().is_empty())
        .map(|p| hash_password(p));

    let hide_exif = payload.hide_exif.unwrap_or(false);
    let hide_gps = payload.hide_gps.unwrap_or(false);
    let download_original = payload.download_original.unwrap_or(true);

    sqlx::query(
        r#"
        INSERT INTO shares (
            share_token, resource_type, resource_id, password_hash, expires_at,
            max_downloads, download_count, hide_exif, hide_gps, download_original
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
        "#,
    )
    .bind(&share_token)
    .bind(&payload.resource_type)
    .bind(&payload.resource_id)
    .bind(&password_hash)
    .bind(expires_at)
    .bind(payload.max_downloads)
    .bind(hide_exif)
    .bind(hide_gps)
    .bind(download_original)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let share = sqlx::query_as::<_, ResourceShare>("SELECT * FROM shares WHERE share_token = ?")
        .bind(&share_token)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let share_url = format!("/api/v1/shares/{}", share_token);

    Ok(Json(CreateShareResponse {
        share_token,
        share_url,
        share,
    }))
}

/// GET /api/v1/shares/:token - Get metadata for shared photo or album, masking privacy fields as requested.
pub async fn get_shared_resource(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Query(query): Query<ShareAccessQuery>,
) -> Result<Json<SharedResourceResponse>, (StatusCode, String)> {
    let share = sqlx::query_as::<_, ResourceShare>("SELECT * FROM shares WHERE share_token = ?")
        .bind(&token)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Share not found".to_string()))?;

    validate_share(&share, query.password.as_deref())?;

    match share.resource_type.as_str() {
        "photo" => {
            let mut photo = find_photo_by_id_or_uuid(&state.db, &share.resource_id).await?;
            if share.hide_exif {
                mask_exif(&mut photo);
            }
            if share.hide_gps {
                mask_gps(&mut photo);
            }

            Ok(Json(SharedResourceResponse {
                share,
                resource_type: "photo".to_string(),
                photo: Some(photo),
                album: None,
                album_photos: None,
            }))
        }
        "album" => {
            let album = find_album_by_id_or_uuid(&state.db, &share.resource_id).await?;
            let mut photos = sqlx::query_as::<_, Photo>(
                "SELECT p.* FROM photos p JOIN photo_albums pa ON p.id = pa.photo_id WHERE pa.album_id = ? AND p.is_trash = 0 AND p.is_locked = 0 ORDER BY p.date_taken DESC",
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
                if share.hide_exif {
                    mask_exif(p);
                }
                if share.hide_gps {
                    mask_gps(p);
                }
            }

            Ok(Json(SharedResourceResponse {
                share,
                resource_type: "album".to_string(),
                photo: None,
                album: Some(album),
                album_photos: Some(photos),
            }))
        }
        other => Err((
            StatusCode::BAD_REQUEST,
            format!("Unsupported resource type: {}", other),
        )),
    }
}

/// GET /api/v1/shares/:token/download - Increment download count and serve original or sanitized WebP image file.
pub async fn download_shared_file(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
    Query(query): Query<ShareAccessQuery>,
) -> Result<Response, (StatusCode, String)> {
    let share = sqlx::query_as::<_, ResourceShare>("SELECT * FROM shares WHERE share_token = ?")
        .bind(&token)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Share not found".to_string()))?;

    validate_share(&share, query.password.as_deref())?;

    // Determine target photo
    let photo = match share.resource_type.as_str() {
        "photo" => find_photo_by_id_or_uuid(&state.db, &share.resource_id).await?,
        "album" => {
            let pid = query
                .photo_id
                .as_deref()
                .ok_or((StatusCode::BAD_REQUEST, "photo_id query param required for album share downloads".to_string()))?;
            find_photo_by_id_or_uuid(&state.db, pid).await?
        }
        other => return Err((StatusCode::BAD_REQUEST, format!("Unsupported resource type: {}", other))),
    };

    let file_path = resolve_photo_path(&photo.path)
        .ok_or((StatusCode::NOT_FOUND, "Source file missing".to_string()))?;

    // Increment download count in database
    sqlx::query("UPDATE shares SET download_count = download_count + 1 WHERE id = ?")
        .bind(share.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if share.download_original && !share.hide_exif {
        // ponytail: Serve original raw file stream directly when original download is enabled and EXIF is retained.
        let mime = mime_guess::from_path(&file_path)
            .first_or_octet_stream()
            .to_string();

        let file = File::open(&file_path)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let stream = ReaderStream::new(file);
        let body = axum::body::Body::from_stream(stream);

        Ok(Response::builder()
            .header(header::CONTENT_TYPE, mime)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(body)
            .unwrap())
    } else {
        // ponytail: Re-encode to WebP format in memory to produce a stripped, privacy-sanitized image payload.
        let (bytes, mime) = tokio::task::spawn_blocking(move || {
            let img = image::open(&file_path).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to load image for sanitization: {}", e),
                )
            })?;
            let mut buffer = std::io::Cursor::new(Vec::new());
            img.write_to(&mut buffer, image::ImageFormat::WebP).map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to encode WebP: {}", e),
                )
            })?;
            Ok::<_, (StatusCode, String)>((buffer.into_inner(), "image/webp"))
        })
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))??;

        Ok(Response::builder()
            .header(header::CONTENT_TYPE, mime)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(axum::body::Body::from(bytes))
            .unwrap())
    }
}

/// DELETE /api/v1/shares/:token - Revoke an active share link by token.
pub async fn revoke_share(
    State(state): State<Arc<AppState>>,
    Path(token): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let result = sqlx::query("DELETE FROM shares WHERE share_token = ?")
        .bind(&token)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Share token not found".to_string()));
    }

    Ok(Json(json!({
        "status": "success",
        "message": "Share revoked successfully",
        "share_token": token
    })))
}
