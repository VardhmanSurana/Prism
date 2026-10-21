//! Full open library metadata export endpoint for data portability.

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
};
use chrono::Utc;
use serde_json::{json, Value};
use sqlx::Row;
use std::io::{Cursor, Write};
use std::sync::Arc;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use crate::AppState;

/// POST /api/v1/utilities/export-metadata
/// Queries all albums, photo records, face assignments, and adjustments,
/// producing a zip archive containing prism_library_manifest.json.
pub async fn export_metadata(
    State(state): State<Arc<AppState>>,
) -> Result<Response, (StatusCode, String)> {
    // 1. Query Photos
    let photos_rows = sqlx::query(
        r#"
        SELECT id, uuid, filename, path, width, height, aspect_ratio,
               hash, phash, caption, city, state, country, latitude, longitude,
               date_taken, is_favorite, is_trash, mime_type, file_type,
               ai_summary, auto_tags, adjustments_json, blur_score, file_size,
               exif_make, exif_model, duration, fps
        FROM photos
        WHERE is_trash = 0 AND is_locked = 0
        ORDER BY id ASC
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to query photos: {}", e)))?;

    let photos: Vec<Value> = photos_rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id"),
            "uuid": r.get::<Option<String>, _>("uuid"),
            "filename": r.get::<String, _>("filename"),
            "path": r.get::<String, _>("path"),
            "width": r.get::<i64, _>("width"),
            "height": r.get::<i64, _>("height"),
            "aspect_ratio": r.get::<f64, _>("aspect_ratio"),
            "hash": r.get::<Option<String>, _>("hash"),
            "phash": r.get::<Option<String>, _>("phash"),
            "caption": r.get::<Option<String>, _>("caption"),
            "city": r.get::<Option<String>, _>("city"),
            "state": r.get::<Option<String>, _>("state"),
            "country": r.get::<Option<String>, _>("country"),
            "latitude": r.get::<Option<f64>, _>("latitude"),
            "longitude": r.get::<Option<f64>, _>("longitude"),
            "date_taken": r.get::<Option<chrono::DateTime<Utc>>, _>("date_taken").map(|d| d.to_rfc3339()),
            "is_favorite": r.get::<bool, _>("is_favorite"),
            "mime_type": r.get::<String, _>("mime_type"),
            "file_type": r.get::<String, _>("file_type"),
            "ai_summary": r.get::<Option<String>, _>("ai_summary"),
            "auto_tags": r.get::<Option<String>, _>("auto_tags"),
            "adjustments": r.get::<Option<String>, _>("adjustments_json").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            "blur_score": r.get::<Option<f64>, _>("blur_score"),
            "file_size": r.get::<Option<i64>, _>("file_size"),
            "exif_make": r.get::<Option<String>, _>("exif_make"),
            "exif_model": r.get::<Option<String>, _>("exif_model"),
        })
    }).collect();

    // 2. Query Albums
    let albums_rows = sqlx::query(
        "SELECT id, uuid, title, description, cover_photo_id, is_smart, smart_rules, created_at FROM albums ORDER BY id ASC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let albums: Vec<Value> = albums_rows.into_iter().map(|r| {
        json!({
            "id": r.get::<i64, _>("id"),
            "uuid": r.get::<Option<String>, _>("uuid"),
            "title": r.get::<String, _>("title"),
            "description": r.get::<Option<String>, _>("description"),
            "cover_photo_id": r.get::<Option<i64>, _>("cover_photo_id"),
            "is_smart": r.get::<bool, _>("is_smart"),
            "smart_rules": r.get::<Option<String>, _>("smart_rules").and_then(|s| serde_json::from_str::<Value>(&s).ok()),
            "created_at": r.get::<Option<chrono::DateTime<Utc>>, _>("created_at").map(|d| d.to_rfc3339()),
        })
    }).collect();

    // 3. Query Photo-Album mappings
    let pa_rows = sqlx::query("SELECT photo_id, album_id FROM photo_albums")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let photo_albums: Vec<Value> = pa_rows.into_iter().map(|r| {
        json!({
            "photo_id": r.get::<i64, _>("photo_id"),
            "album_id": r.get::<i64, _>("album_id"),
        })
    }).collect();

    // 4. Query Faces & People
    let face_rows = sqlx::query(
        r#"
        SELECT f.id, f.photo_id, f.person_id, p.name as person_name, f.x, f.y, f.w, f.h
        FROM faces f
        LEFT JOIN people p ON p.id = f.person_id
        ORDER BY f.id ASC
        "#
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let faces: Vec<Value> = face_rows.into_iter().map(|r| {
        json!({
            "face_id": r.get::<i64, _>("id"),
            "photo_id": r.get::<i64, _>("photo_id"),
            "person_id": r.get::<Option<i64>, _>("person_id"),
            "person_name": r.get::<Option<String>, _>("person_name"),
            "bbox": {
                "x": r.get::<Option<f64>, _>("x"),
                "y": r.get::<Option<f64>, _>("y"),
                "w": r.get::<Option<f64>, _>("w"),
                "h": r.get::<Option<f64>, _>("h")
            }
        })
    }).collect();

    // 5. Build Complete Manifest
    let manifest = json!({
        "manifest_version": "1.0.0",
        "app": "Prism Photo Manager",
        "exported_at": Utc::now().to_rfc3339(),
        "stats": {
            "total_photos": photos.len(),
            "total_albums": albums.len(),
            "total_faces": faces.len(),
        },
        "photos": photos,
        "albums": albums,
        "photo_albums": photo_albums,
        "faces": faces,
    });

    let manifest_bytes = serde_json::to_vec_pretty(&manifest)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to serialize manifest: {}", e)))?;

    // 6. Create ZIP archive in memory
    let mut buffer = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buffer);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        zip.start_file("prism_library_manifest.json", options)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to add file to ZIP: {}", e)))?;

        zip.write_all(&manifest_bytes)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write ZIP content: {}", e)))?;

        zip.finish()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to finalize ZIP archive: {}", e)))?;
    }

    let zip_data = buffer.into_inner();
    let filename = format!("prism_library_manifest_{}.zip", Utc::now().format("%Y%m%d_%H%M%S"));

    let headers = [
        (header::CONTENT_TYPE, "application/zip"),
        (
            header::CONTENT_DISPOSITION,
            &format!("attachment; filename=\"{}\"", filename),
        ),
    ];

    Ok((headers, zip_data).into_response())
}
