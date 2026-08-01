use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::Json,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::Photo;
use crate::services::exif::extract_exif;
use crate::services::thumbnail::get_image_info;
use crate::AppState;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct UploadJsonPayload {
    pub file_path: Option<String>,
    pub path: Option<String>,
    pub resize_width: Option<u32>,
}

#[derive(Deserialize)]
pub struct ExpandDirectoryRequest {
    pub file_path: String,
}

pub async fn upload_photo(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<Photo>, (StatusCode, String)> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let target_path: PathBuf;

    if content_type.contains("application/json") {
        let payload: UploadJsonPayload = serde_json::from_slice(&body)
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Invalid JSON payload: {}", e)))?;

        let raw_path = payload
            .file_path
            .or(payload.path)
            .ok_or((StatusCode::BAD_REQUEST, "Missing file_path in payload".to_string()))?;

        target_path = PathBuf::from(raw_path);
        if !target_path.exists() {
            return Err((StatusCode::NOT_FOUND, format!("File not found: {:?}", target_path)));
        }
    } else {
        let filename = format!("upload_{}.jpg", chrono::Utc::now().timestamp_millis());
        fs::create_dir_all(&state.config.upload_dir).ok();
        target_path = state.config.upload_dir.join(&filename);
        fs::write(&target_path, body).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    let filename = target_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "photo.jpg".to_string());

    let abs_path_str = target_path.to_string_lossy().to_string();

    if let Ok(Some(mut existing)) = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE path = ?")
        .bind(&abs_path_str)
        .fetch_optional(&state.db)
        .await
    {
        if existing.uuid.is_none() {
            let u = Uuid::new_v4().to_string();
            sqlx::query("UPDATE photos SET uuid = ? WHERE id = ?").bind(&u).bind(existing.id).execute(&state.db).await.ok();
            existing.uuid = Some(u);
        }
        let p_key = existing.uuid.as_deref().unwrap_or(&existing.id.to_string()).to_string();
        existing.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
        if existing.date_taken.is_none() {
            existing.date_taken = Some(Utc::now());
        }
        return Ok(Json(existing));
    }

    let img_info = get_image_info(&target_path).unwrap_or_else(|_| crate::services::thumbnail::ImageInfo {
        width: 1920,
        height: 1080,
        aspect_ratio: 1.77,
    });
    let exif = extract_exif(&target_path);
    let now_str = Utc::now().to_rfc3339();
    let new_uuid = Uuid::new_v4().to_string();

    let id = sqlx::query(
        r#"
        INSERT INTO photos (uuid, filename, path, width, height, aspect_ratio, exif_make, exif_model, exif_iso, exif_focal_length, date_taken, date, upload_date, file_type, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'image/jpeg')
        "#
    )
    .bind(&new_uuid)
    .bind(&filename)
    .bind(&abs_path_str)
    .bind(img_info.width as i32)
    .bind(img_info.height as i32)
    .bind(img_info.aspect_ratio)
    .bind(&exif.make)
    .bind(&exif.model)
    .bind(&exif.iso)
    .bind(&exif.focal_length)
    .bind(&now_str)
    .bind(&now_str)
    .bind(&now_str)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .last_insert_rowid();

    let mut photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let p_key = photo.uuid.as_deref().unwrap_or(&photo.id.to_string()).to_string();
    photo.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));

    if photo.date_taken.is_none() {
        photo.date_taken = Some(Utc::now());
    }
    if photo.date.is_none() {
        photo.date = photo.date_taken;
    }

    Ok(Json(photo))
}

pub async fn upload_blob(
    State(state): State<Arc<AppState>>,
    mut multipart: axum::extract::Multipart,
) -> Result<Json<Photo>, (StatusCode, String)> {
    let mut file_bytes: Option<Bytes> = None;
    let mut original_path: Option<String> = None;
    let mut is_save_as = false;
    let mut save_as_path: Option<String> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" {
            file_bytes = field.bytes().await.ok();
        } else if name == "original_path" {
            original_path = field.text().await.ok();
        } else if name == "is_save_as" {
            let txt = field.text().await.unwrap_or_default();
            is_save_as = txt == "true";
        } else if name == "save_as_path" {
            save_as_path = field.text().await.ok();
        }
    }

    let bytes = file_bytes.ok_or((StatusCode::BAD_REQUEST, "Missing file".to_string()))?;
    let orig = original_path.ok_or((StatusCode::BAD_REQUEST, "Missing original_path".to_string()))?;

    let target_path_str = if is_save_as {
        if let Some(sp) = save_as_path {
            sp
        } else {
            let path_buf = PathBuf::from(&orig);
            let parent = path_buf.parent().unwrap_or_else(|| std::path::Path::new("."));
            let file_stem = path_buf.file_stem().and_then(|s| s.to_str()).unwrap_or("edited");
            let ext = path_buf.extension().and_then(|s| s.to_str()).unwrap_or("jpg");
            parent.join(format!("{}_edited_{}.{}", file_stem, Utc::now().timestamp(), ext)).to_string_lossy().to_string()
        }
    } else {
        orig.clone()
    };

    let target_path = PathBuf::from(&target_path_str);
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).ok();
    }

    fs::write(&target_path, bytes).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let filename = target_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "edited.jpg".to_string());
    let abs_path_str = target_path.to_string_lossy().to_string();

    let img_info = get_image_info(&target_path).unwrap_or_else(|_| crate::services::thumbnail::ImageInfo {
        width: 1920,
        height: 1080,
        aspect_ratio: 1.77,
    });
    let exif = extract_exif(&target_path);
    let now_str = Utc::now().to_rfc3339();

    let new_uuid = Uuid::new_v4().to_string();

    if let Ok(Some(mut existing)) = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE path = ?")
        .bind(&abs_path_str)
        .fetch_optional(&state.db)
        .await
    {
        // Remove old cached thumbnails so they regenerate with the newly edited image
        if let Ok(entries) = fs::read_dir(&state.config.thumbnails_dir) {
            let prefix = format!("{}_thumb", existing.id);
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    if name.starts_with(&prefix) {
                        fs::remove_file(entry.path()).ok();
                    }
                }
            }
        }

        let new_hash = Utc::now().timestamp_millis().to_string();
        sqlx::query("UPDATE photos SET width = ?, height = ?, aspect_ratio = ?, hash = ? WHERE id = ?")
            .bind(img_info.width as i32)
            .bind(img_info.height as i32)
            .bind(img_info.aspect_ratio)
            .bind(&new_hash)
            .bind(existing.id)
            .execute(&state.db)
            .await
            .ok();

        existing.width = img_info.width as i32;
        existing.height = img_info.height as i32;
        existing.aspect_ratio = img_info.aspect_ratio;
        existing.hash = Some(new_hash.clone());

        let p_key = existing.uuid.as_deref().unwrap_or(&existing.id.to_string()).to_string();
        existing.url = Some(format!("/api/v1/photos/{}/thumbnail?h={}", p_key, new_hash));
        return Ok(Json(existing));
    }

    let id = sqlx::query(
        r#"
        INSERT INTO photos (uuid, filename, path, width, height, aspect_ratio, exif_make, exif_model, exif_iso, exif_focal_length, date_taken, date, upload_date, file_type, mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', 'image/jpeg')
        "#
    )
    .bind(&new_uuid)
    .bind(&filename)
    .bind(&abs_path_str)
    .bind(img_info.width as i32)
    .bind(img_info.height as i32)
    .bind(img_info.aspect_ratio)
    .bind(&exif.make)
    .bind(&exif.model)
    .bind(&exif.iso)
    .bind(&exif.focal_length)
    .bind(&now_str)
    .bind(&now_str)
    .bind(&now_str)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .last_insert_rowid();

    let mut photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let p_key = photo.uuid.as_deref().unwrap_or(&photo.id.to_string()).to_string();
    photo.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));

    Ok(Json(photo))
}

pub async fn expand_directory(
    Json(payload): Json<ExpandDirectoryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let folder_path = PathBuf::from(&payload.file_path);
    if !folder_path.exists() {
        return Err((StatusCode::NOT_FOUND, "Path not found on disk".to_string()));
    }
    if !folder_path.is_dir() {
        return Err((StatusCode::BAD_REQUEST, "Path is not a directory".to_string()));
    }

    let mut media_files = Vec::new();

    fn walk_dir(dir: &PathBuf, files: &mut Vec<String>) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk_dir(&path, files);
                } else if path.is_file() {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                    if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "heic" | "heif" | "mp4" | "mov" | "avi" | "mkv" | "webm") {
                        files.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    walk_dir(&folder_path, &mut media_files);

    Ok(Json(json!({
        "files": media_files
    })))
}

pub async fn unload_inpaint() -> Json<Value> {
    Json(json!({ "status": "unloaded" }))
}
