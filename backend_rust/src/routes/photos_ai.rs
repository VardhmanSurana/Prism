use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::services::{auto_enhance, inpaint, segmentation};

pub async fn trigger_ocr(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    match state.ml_client.get_ocr_text(&photo.path).await {
        Ok(resp) => Ok(Json(json!({ "photo_id": photo.id, "ocr_text": resp.text, "status": resp.status }))),
        Err(e) => {
            warn!("OCR ML call failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "ocr_text": null, "error": e })))
        }
    }
}

#[derive(Deserialize)]
pub struct InpaintRequest {
    pub photo_id: Option<i64>,
    pub image_data: Option<String>,
    pub mask_data: String,
    #[serde(default = "default_operation")]
    pub operation: String,
    #[serde(default = "default_model")]
    pub model: String,
    pub prompt: Option<String>,
    #[serde(default = "default_guidance")]
    pub guidance_scale: f64,
    #[serde(default = "default_steps")]
    pub num_inference_steps: i32,
    pub expand_pixels: Option<i32>,
}

fn default_operation() -> String { "remove".to_string() }
fn default_model() -> String { "lama".to_string() }
fn default_guidance() -> f64 { 7.5 }
fn default_steps() -> i32 { 50 }

pub async fn process_inpaint(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InpaintRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo_path = if let Some(pid) = payload.photo_id {
        let photo = sqlx::query_as::<_, crate::models::Photo>("SELECT * FROM photos WHERE id = ?")
            .bind(pid).fetch_optional(&state.db).await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        photo.map(|p| p.path)
    } else { None };

    let path = photo_path.ok_or((StatusCode::BAD_REQUEST, "photo_id required".to_string()))?;

    let engine = inpaint::InpaintEngine::get();
    match engine.process_inpaint(
        &path,
        &payload.mask_data,
        &payload.operation,
        payload.prompt.as_deref(),
        payload.guidance_scale,
        payload.num_inference_steps,
    ) {
        Ok(val) => Ok(Json(val)),
        Err(e) => {
            warn!("Inpaint failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

pub async fn get_summary(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    let message = if photo.ai_summary.is_none() { Some("No summary found".to_string()) } else { None };
    Ok(Json(json!({ "photo_id": photo.id, "summary": photo.ai_summary, "message": message })))
}

pub async fn generate_summary(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    match state.ml_client.get_vision_caption(&photo.path).await {
        Ok(resp) => {
            let summary = resp.summary.or(resp.caption).unwrap_or_default();
            sqlx::query("UPDATE photos SET ai_summary = ? WHERE id = ?")
                .bind(&summary).bind(photo.id).execute(&state.db).await.ok();
            Ok(Json(json!({ "photo_id": photo.id, "summary": summary })))
        }
        Err(e) => {
            warn!("Vision ML call failed for summary: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "summary": null, "error": e })))
        }
    }
}

#[derive(Deserialize)]
pub struct XmpRequest {
    #[serde(default)]
    pub action: Option<String>,
}

pub async fn xmp_operation(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<XmpRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    let xmp_path = format!("{}.xmp", photo.path);
    match payload.action.as_deref() {
        Some("export") => {
            let desc = photo.ai_summary.as_deref().unwrap_or("");
            let xmp = format!(
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n<rdf:Description rdf:about=\"\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n  <dc:description>{}</dc:description>\n</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>", desc
            );
            std::fs::write(&xmp_path, &xmp).ok();
            Ok(Json(json!({ "photo_id": photo.id, "status": "exported", "xmp_path": xmp_path })))
        }
        Some("import") => {
            let exists = std::path::Path::new(&xmp_path).exists();
            Ok(Json(json!({ "photo_id": photo.id, "status": if exists { "imported" } else { "no_xmp" }, "xmp_path": xmp_path })))
        }
        _ => Ok(Json(json!({ "photo_id": photo.id, "status": "todo", "action": payload.action }))),
    }
}

#[derive(Deserialize)]
pub struct LockRequest {
    #[serde(default)]
    pub lock: bool,
    #[serde(default)]
    pub passcode: Option<String>,
}

pub async fn toggle_lock(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<LockRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    sqlx::query("UPDATE photos SET is_locked = ? WHERE id = ?")
        .bind(payload.lock).bind(photo.id)
        .execute(&state.db).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(json!({ "photo_id": photo.id, "is_locked": payload.lock })))
}

#[derive(Deserialize)]
pub struct ExportPhotosRequest {
    pub photo_ids: Vec<Value>,
}

pub async fn export_photos(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ExportPhotosRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut paths = Vec::new();
    for item in &payload.photo_ids {
        if let Some(n) = item.as_i64() {
            if let Ok(Some(photo)) = sqlx::query_as::<_, crate::models::Photo>("SELECT * FROM photos WHERE id = ?")
                .bind(n).fetch_optional(&state.db).await {
                if std::path::Path::new(&photo.path).exists() {
                    paths.push(photo.path);
                }
            }
        }
    }
    Ok(Json(json!({ "status": "ready", "photo_count": paths.len(), "paths": paths })))
}

#[derive(Deserialize)]
pub struct DirectoryRequest {
    pub path: String,
    #[serde(default)]
    pub show_hidden: bool,
}

pub async fn list_directory(
    Json(payload): Json<DirectoryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let dir = std::path::Path::new(&payload.path);
    if !dir.is_dir() {
        return Ok(Json(json!({ "path": payload.path, "folders": [], "files": [], "error": "Not a directory" })));
    }
    let mut folders = Vec::new();
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !payload.show_hidden && name.starts_with('.') { continue; }
            let metadata = entry.metadata().ok();
            if let Some(ref meta) = metadata {
                if meta.is_dir() {
                    folders.push(json!({ "name": name, "path": entry.path().to_string_lossy() }));
                } else {
                    files.push(json!({ "name": name, "path": entry.path().to_string_lossy(), "size": meta.len() }));
                }
            }
        }
    }
    Ok(Json(json!({ "path": payload.path, "folders": folders, "files": files })))
}

// -- New implementations for Python-parity endpoints --

#[derive(Deserialize)]
pub struct UpdateMetadataRequest {
    pub date_taken: Option<String>,
    pub caption: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub exif_make: Option<String>,
    pub exif_model: Option<String>,
    pub exif_focal_length: Option<f64>,
    pub exif_iso: Option<i32>,
}

pub async fn update_photo_metadata(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateMetadataRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    let mut sets = Vec::new();
    if payload.date_taken.is_some() { sets.push("date_taken = ?"); }
    if payload.caption.is_some() { sets.push("caption = ?"); }
    if payload.city.is_some() { sets.push("city = ?"); }
    if payload.state.is_some() { sets.push("state = ?"); }
    if payload.country.is_some() { sets.push("country = ?"); }
    if payload.exif_make.is_some() { sets.push("exif_make = ?"); }
    if payload.exif_model.is_some() { sets.push("exif_model = ?"); }
    if payload.exif_focal_length.is_some() { sets.push("exif_focal_length = ?"); }
    if payload.exif_iso.is_some() { sets.push("exif_iso = ?"); }
    if sets.is_empty() {
        return Ok(Json(json!({ "photo_id": photo.id, "message": "No fields to update" })));
    }
    let sql = format!("UPDATE photos SET {} WHERE id = ?", sets.join(", "));
    let mut query = sqlx::query(&sql);
    if let Some(ref v) = payload.date_taken { query = query.bind(v); }
    if let Some(ref v) = payload.caption { query = query.bind(v); }
    if let Some(ref v) = payload.city { query = query.bind(v); }
    if let Some(ref v) = payload.state { query = query.bind(v); }
    if let Some(ref v) = payload.country { query = query.bind(v); }
    if let Some(ref v) = payload.exif_make { query = query.bind(v); }
    if let Some(ref v) = payload.exif_model { query = query.bind(v); }
    if let Some(ref v) = payload.exif_focal_length { query = query.bind(v); }
    if let Some(ref v) = payload.exif_iso { query = query.bind(v); }
    query = query.bind(photo.id);
    query.execute(&state.db).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(json!({ "photo_id": photo.id, "status": "success", "updated_fields": sets.len() })))
}

pub async fn get_semantic_masks(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let masks_dir = state.config.thumbnails_dir.join("masks");
    let engine = segmentation::SegmentationEngine::get();
    match engine.get_semantic_masks(&photo.path, photo.id, &masks_dir) {
        Ok(resp) => Ok(Json(serde_json::to_value(resp).unwrap_or_default())),
        Err(e) => {
            warn!("Semantic masks failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "regions": [], "error": e })))
        }
    }
}

pub async fn get_background_mask(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let masks_dir = state.config.thumbnails_dir.join("masks");

    // Return cached mask if it already exists
    let cached_filename = format!("mask_{}_background.png", photo.id);
    let cached_path = masks_dir.join(&cached_filename);
    if cached_path.exists() {
        return Ok(Json(json!({ "mask_url": format!("/thumbnails/masks/{}", cached_filename) })));
    }

    let engine = segmentation::SegmentationEngine::get();
    match engine.get_background_mask(&photo.path, photo.id, &masks_dir) {
        Ok(resp) => Ok(Json(serde_json::to_value(resp).unwrap_or_default())),
        Err(e) => {
            warn!("Background mask failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "mask_url": null, "error": e })))
        }
    }
}

pub async fn get_portrait_masks(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let masks_dir = state.config.thumbnails_dir.join("masks");
    let engine = segmentation::SegmentationEngine::get();
    match engine.get_portrait_masks(&photo.path, photo.id, &masks_dir) {
        Ok(resp) => Ok(Json(serde_json::to_value(resp).unwrap_or_default())),
        Err(e) => {
            warn!("Portrait masks failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "faces": [], "error": e })))
        }
    }
}

pub async fn get_auto_enhance(
    State(_state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&_state.db, &photo_id).await?;
    match image::open(&photo.path) {
        Ok(img) => {
            let params = auto_enhance::calculate_auto_enhance(&img);
            Ok(Json(serde_json::to_value(params).unwrap_or_default()))
        }
        Err(e) => {
            warn!("Auto-enhance image load failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "error": e.to_string() })))
        }
    }
}

pub async fn unlock_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    if !photo.is_locked {
        return Ok(Json(json!({ "photo_id": photo.id, "status": "already_unlocked" })));
    }
    sqlx::query("UPDATE photos SET is_locked = 0 WHERE id = ?")
        .bind(photo.id).execute(&state.db).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(json!({ "photo_id": photo.id, "status": "success", "is_locked": false })))
}

#[derive(Deserialize)]
pub struct ExportPresetRequest {
    #[serde(default)]
    pub preset: String,
}

pub async fn export_photo_preset(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<ExportPresetRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    let presets = json!({
        "instagram_4_5": { "width": 1080, "height": 1350 },
        "instagram_1_1": { "width": 1080, "height": 1080 },
        "story_9_16": { "width": 1080, "height": 1920 },
        "web_1080p": { "width": 1920, "height": 1080 },
        "full_res": { "width": photo.width, "height": photo.height },
    });
    let dims = presets.get(&payload.preset).cloned()
        .unwrap_or(json!({ "width": photo.width, "height": photo.height }));
    Ok(Json(json!({
        "photo_id": photo.id,
        "status": "success",
        "preset": payload.preset,
        "source": photo.path,
        "target_dimensions": dims,
    })))
}

// -- XMP sub-endpoints --

#[derive(Deserialize)]
pub struct XmpExportRequest {
    pub photo_ids: Option<Vec<Value>>,
}

pub async fn xmp_export(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<XmpExportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let ids = payload.photo_ids.unwrap_or_default();
    let mut exported = 0;
    for item in &ids {
        if let Some(n) = item.as_i64() {
            if let Ok(Some(photo)) = sqlx::query_as::<_, crate::models::Photo>("SELECT * FROM photos WHERE id = ?")
                .bind(n).fetch_optional(&state.db).await {
                let xmp_path = format!("{}.xmp", photo.path);
                let desc = photo.ai_summary.as_deref().unwrap_or("");
                let xmp = format!(
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<x:xmpmeta xmlns:x=\"adobe:ns:meta/\">\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">\n<rdf:Description rdf:about=\"\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n  <dc:description>{}</dc:description>\n</rdf:Description>\n</rdf:RDF>\n</x:xmpmeta>", desc
                );
                if std::fs::write(&xmp_path, &xmp).is_ok() { exported += 1; }
            }
        }
    }
    Ok(Json(json!({ "status": "success", "exported": exported })))
}

#[derive(Deserialize)]
pub struct XmpImportRequest {
    pub directory: Option<String>,
}

pub async fn xmp_import(
    Json(payload): Json<XmpImportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let dir = payload.directory.unwrap_or_else(|| ".".to_string());
    let mut imported = 0;
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().and_then(|e| e.to_str()) == Some("xmp") {
                imported += 1;
            }
        }
    }
    Ok(Json(json!({ "status": "success", "imported": imported, "directory": dir })))
}

#[derive(Deserialize)]
pub struct XmpUploadImportRequest {
    pub photo_id: Option<String>,
}

pub async fn xmp_upload_import(
    Json(_payload): Json<XmpUploadImportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({ "status": "success", "message": "XMP upload-import received" })))
}

pub async fn xmp_check(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let xmp_path = format!("{}.xmp", photo.path);
    let exists = std::path::Path::new(&xmp_path).exists();
    Ok(Json(json!({ "photo_id": photo.id, "has_xmp": exists })))
}

#[derive(Deserialize)]
pub struct InterrogateRequest {
    pub photo_path: String,
    pub prompt: Option<String>,
}

pub async fn interrogate(
    State(state): State<Arc<AppState>>,
    axum::extract::Json(req): axum::extract::Json<InterrogateRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let result = crate::services::interrogate::run_interrogate(
        &req.photo_path,
        req.prompt.as_deref(),
        &state.ml_client.llm,
    ).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(serde_json::to_value(result).unwrap()))
}
