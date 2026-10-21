/// Google Takeout ZIP import — extracts photos with EXIF metadata from Google Takeout archives.
use axum::{extract::State, http::StatusCode, response::Json};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::AppState;

/// POST /api/v1/utilities/google-import — Upload and parse a Google Takeout ZIP.
///
/// Accepts a multipart file upload, extracts photos (JPG/PNG/MP4/MOV),
/// reads associated JSON metadata sidecar files, and inserts them into
/// the library database. Returns a manifest of imported files.
pub async fn google_takeout_import(
    State(state): State<Arc<AppState>>,
    multipart: axum::extract::Multipart,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut photos: Vec<Value> = Vec::new();
    let mut errors: Vec<String> = Vec::new();
    let mut file_count: u32 = 0;
    let mut metadata_map: HashMap<String, Value> = HashMap::new();

    // Phase 1: Collect all uploaded parts
    let mut parts: Vec<(String, Vec<u8>)> = Vec::new();

    let mut multipart = multipart;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, format!("Multipart error: {}", e)))?
    {
        let name = field
            .file_name()
            .unwrap_or("unknown")
            .to_string();

        let data = field
            .bytes()
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, format!("Read error: {}", e)))?;

        parts.push((name, data.to_vec()));
    }

    // Phase 2: Separate metadata JSONs from media files
    for (filename, data) in &parts {
        if filename.ends_with(".json") {
            if let Ok(json_str) = std::str::from_utf8(data) {
                if let Ok(val) = serde_json::from_str::<Value>(json_str) {
                    // Google Takeout metadata files are named like "photo.jpg.json"
                    let key = filename.strip_suffix(".json").unwrap_or(filename);
                    metadata_map.insert(key.to_string(), val);
                }
            }
        }
    }

    // Phase 3: Process media files
    let uploads_dir = std::path::Path::new(&state.config.upload_dir);
    let _ = std::fs::create_dir_all(uploads_dir);

    for (filename, data) in &parts {
        let lower = filename.to_lowercase();

        let is_image = lower.ends_with(".jpg")
            || lower.ends_with(".jpeg")
            || lower.ends_with(".png")
            || lower.ends_with(".webp")
            || lower.ends_with(".gif")
            || lower.ends_with(".heic")
            || lower.ends_with(".dng");

        let is_video = lower.ends_with(".mp4")
            || lower.ends_with(".mov")
            || lower.ends_with(".m4v");

        if !is_image && !is_video {
            continue;
        }

        file_count += 1;

        // Write file to uploads directory
        let dest = uploads_dir.join(filename);
        if let Err(e) = std::fs::write(&dest, data) {
            errors.push(format!("Failed to write {}: {}", filename, e));
            continue;
        }

        // Extract metadata from Google's sidecar JSON
        let metadata = metadata_map.get(filename.as_str());
        let (date_taken, latitude, longitude, caption) = parse_google_metadata(metadata);

        // Compute file hash
        use sha2::{Digest, Sha256};
        let hash = format!("{:x}", Sha256::digest(data));

        // Insert into database
        let path_str = dest.to_string_lossy().to_string();
        let photo_type = if is_image { "image" } else { "video" };
        let file_size = data.len() as i64;

        let result = sqlx::query(
            r#"INSERT INTO photos (
                uuid, path, filename, date_taken, date, upload_date,
                latitude, longitude, caption, hash, file_size,
                file_type, mime_type, is_trash, is_locked, is_favorite
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)"#,
        )
        .bind(chrono::Utc::now().to_rfc3339()) // uuid
        .bind(&path_str)
        .bind(filename)
        .bind(&date_taken)
        .bind(&date_taken)
        .bind(chrono::Utc::now().to_rfc3339())
        .bind(latitude)
        .bind(longitude)
        .bind(&caption)
        .bind(&hash)
        .bind(file_size)
        .bind(photo_type)
        .bind(guess_mime(&lower))
        .execute(&state.db)
        .await;

        match result {
            Ok(res) => {
                let photo_id = res.last_insert_rowid();
                photos.push(json!({
                    "id": photo_id,
                    "filename": filename,
                    "path": path_str,
                    "date_taken": date_taken,
                    "hash": hash,
                    "size_bytes": file_size,
                }));
            }
            Err(e) => {
                errors.push(format!("DB insert failed for {}: {}", filename, e));
            }
        }
    }

    // Trigger background indexing for new photos
    state.worker.notify.notify_one();

    Ok(Json(json!({
        "status": "success",
        "total_files": file_count,
        "imported": photos.len(),
        "errors": errors.len(),
        "photos": photos,
        "error_details": if errors.is_empty() { None } else { Some(errors) },
    })))
}

/// Parse Google Takeout metadata JSON sidecar.
fn parse_google_metadata(
    meta: Option<&Value>,
) -> (Option<String>, Option<f64>, Option<f64>, Option<String>) {
    let Some(meta) = meta else {
        return (None, None, None, None);
    };

    // Google Takeout uses "photoTakenTime", "geoData", and "description"
    let date_taken = meta
        .get("photoTakenTime")
        .and_then(|t| t.get("timestamp"))
        .and_then(|v| v.as_str())
        .and_then(|ts| ts.parse::<i64>().ok())
        .map(|epoch| {
            chrono::DateTime::from_timestamp(epoch, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        });

    let geo = meta.get("geoData");
    let latitude = geo
        .and_then(|g| g.get("latitude"))
        .and_then(|v| v.as_f64())
        .filter(|&lat| lat != 0.0);
    let longitude = geo
        .and_then(|g| g.get("longitude"))
        .and_then(|v| v.as_f64())
        .filter(|&lng| lng != 0.0);

    let caption = meta
        .get("description")
        .and_then(|d| d.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    (date_taken, latitude, longitude, caption)
}

/// Guess MIME type from file extension.
fn guess_mime(lower: &str) -> &str {
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".heic") {
        "image/heic"
    } else if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".m4v") {
        "video/x-m4v"
    } else {
        "application/octet-stream"
    }
}
