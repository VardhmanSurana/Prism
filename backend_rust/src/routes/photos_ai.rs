use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::services::{auto_enhance, denoise, depth, enhance, florence2, inpaint, segmentation};

pub async fn trigger_ocr(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;
    match state.ml_client.get_ocr_text(&photo.path).await {
        Ok(resp) => {
            if let Some(ref text) = resp.text {
                let _ = sqlx::query("UPDATE photos SET ocr_text = ? WHERE id = ?")
                    .bind(text)
                    .bind(photo.id)
                    .execute(&state.db)
                    .await;
            }
            Ok(Json(json!({ "photo_id": photo.id, "ocr_text": resp.text, "status": resp.status })))
        }
        Err(e) => {
            warn!("OCR ML call failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "ocr_text": null, "error": e })))
        }
    }
}

/// POST /photos/:id/ocr-bboxes — Extract text + bounding boxes via PP-OCRv4.
/// Returns cached results if available; otherwise runs on-demand inference.
pub async fn trigger_ocr_bboxes(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id).await?;

    // Check for cached bboxes in DB
    let cached_bboxes: Option<String> = sqlx::query_scalar(
        "SELECT ocr_bboxes FROM photos WHERE id = ?"
    )
    .bind(photo.id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if let Some(ref bboxes_json) = cached_bboxes {
        if !bboxes_json.is_empty() {
            // Return cached result
            let ocr_text: String = sqlx::query_scalar(
                "SELECT COALESCE(ocr_text, '') FROM photos WHERE id = ?"
            )
            .bind(photo.id)
            .fetch_one(&state.db)
            .await
            .unwrap_or_default();

            let lines: Vec<crate::services::ocr_engine::OcrBbox> =
                serde_json::from_str(bboxes_json).unwrap_or_default();

            return Ok(Json(json!({
                "photo_id": photo.id,
                "ocr_text": ocr_text,
                "lines": lines,
                "cached": true,
                "status": "success"
            })));
        }
    }

    // Not cached — run on-demand inference
    if !crate::services::ocr_engine::is_available() {
        return Ok(Json(json!({
            "photo_id": photo.id,
            "ocr_text": null,
            "lines": [],
            "cached": false,
            "status": "error",
            "error": "PP-OCRv4 models not downloaded. Download them from Model Manager."
        })));
    }

    let path = photo.path.clone();
    let _slot = crate::services::inference_slot::acquire("ocr-bboxes").await;
    let result = tokio::task::spawn_blocking(move || {
        crate::services::ocr_engine::recognize(&path)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("OCR task panicked: {}", e)))?;

    match result {
        Ok(ocr_result) => {
            let bboxes_json = serde_json::to_string(&ocr_result.lines).unwrap_or_default();

            // Cache in DB
            let _ = sqlx::query(
                "UPDATE photos SET ocr_text = ?, ocr_bboxes = ? WHERE id = ?"
            )
            .bind(&ocr_result.full_text)
            .bind(&bboxes_json)
            .bind(photo.id)
            .execute(&state.db)
            .await;

            Ok(Json(json!({
                "photo_id": photo.id,
                "ocr_text": ocr_result.full_text,
                "lines": ocr_result.lines,
                "cached": false,
                "status": "success"
            })))
        }
        Err(e) => {
            warn!("OCR bbox extraction failed: {}", e);
            Ok(Json(json!({
                "photo_id": photo.id,
                "ocr_text": null,
                "lines": [],
                "cached": false,
                "status": "error",
                "error": e
            })))
        }
    }
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct InpaintRequest {
    pub photo_id: Option<Value>,
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

#[allow(dead_code)]
fn default_operation() -> String { "remove".to_string() }
#[allow(dead_code)]
fn default_model() -> String { "lama".to_string() }
#[allow(dead_code)]
fn default_guidance() -> f64 { 7.5 }
#[allow(dead_code)]
fn default_steps() -> i32 { 50 }

pub async fn process_inpaint(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InpaintRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let source_path_or_data = if let Some(ref img_data) = payload.image_data {
        if !img_data.is_empty() {
            img_data.clone()
        } else if let Some(ref pid) = payload.photo_id {
            let id_str = photo_id_to_string(&Some(pid.clone()))?;
            let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;
            photo.path
        } else {
            return Err((StatusCode::BAD_REQUEST, "photo_id or image_data required".to_string()));
        }
    } else if let Some(ref pid) = payload.photo_id {
        let id_str = photo_id_to_string(&Some(pid.clone()))?;
        let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;
        photo.path
    } else {
        return Err((StatusCode::BAD_REQUEST, "photo_id or image_data required".to_string()));
    };

    let engine = inpaint::InpaintEngine::get();
    match engine
        .process_inpaint_async(
            &source_path_or_data,
            &payload.mask_data,
            &payload.operation,
            payload.prompt.as_deref(),
            payload.guidance_scale,
            payload.num_inference_steps,
        )
        .await
    {
        Ok(val) => Ok(Json(val)),
        Err(e) => {
            warn!("Inpaint failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- Depth effects (Depth Anything V2 small) --

fn default_depth_mode() -> String { "map".to_string() }
fn default_strength_px() -> f32 { 6.0 }
fn default_focus() -> f32 { 0.5 }

/// Accept numeric id or uuid string from the client.
fn photo_id_to_string(v: &Option<Value>) -> Result<String, (StatusCode, String)> {
    match v {
        Some(Value::Number(n)) => Ok(n.to_string()),
        Some(Value::String(s)) => Ok(s.clone()),
        _ => Err((StatusCode::BAD_REQUEST, "photo_id required".to_string())),
    }
}

#[derive(Deserialize)]
pub struct DepthRequest {
    pub photo_id: Option<Value>,
    #[serde(default = "default_depth_mode")]
    pub mode: String, // "map" | "bokeh"
    #[serde(default = "default_strength_px")]
    pub strength_px: f32,
    #[serde(default = "default_focus")]
    pub focus: f32,
}

fn invalidate_photo_thumbnails(thumbnails_dir: &std::path::Path, photo_id: i64) {
    if let Ok(entries) = std::fs::read_dir(thumbnails_dir) {
        let prefix = format!("{}_thumb", photo_id);
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with(&prefix) {
                    std::fs::remove_file(entry.path()).ok();
                }
            }
        }
    }
}

pub async fn process_depth(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DepthRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    match depth::DepthEngine::get()
        .process_async(&photo.path, &payload.mode, payload.strength_px, payload.focus)
        .await
    {
        Ok(val) => {
            if payload.mode == "bokeh" {
                invalidate_photo_thumbnails(&state.config.thumbnails_dir, photo.id);
                let new_hash = chrono::Utc::now().timestamp_millis().to_string();
                let _ = sqlx::query("UPDATE photos SET hash = ? WHERE id = ?")
                    .bind(&new_hash)
                    .bind(photo.id)
                    .execute(&state.db)
                    .await;
            }
            Ok(Json(val))
        }
        Err(e) => {
            warn!("Depth processing failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- AI Enhancement (Real-ESRGAN upscale + GFPGAN face restore) --

#[derive(Deserialize)]
pub struct UpscaleRequest {
    pub photo_id: Option<Value>,
    #[serde(default = "default_scale")]
    pub scale: i32,
}

fn default_scale() -> i32 { 2 }

pub async fn upscale_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpscaleRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    match enhance::UpscaleEngine::get().upscale_async(&photo.path, payload.scale).await {
        Ok(val) => {
            invalidate_photo_thumbnails(&state.config.thumbnails_dir, photo.id);
            let new_hash = chrono::Utc::now().timestamp_millis().to_string();
            // Dimensions changed — keep the DB in sync.
            let _ = sqlx::query("UPDATE photos SET width = ?, height = ?, hash = ? WHERE id = ?")
                .bind(val["width"].as_i64().unwrap_or(photo.width as i64))
                .bind(val["height"].as_i64().unwrap_or(photo.height as i64))
                .bind(&new_hash)
                .bind(photo.id)
                .execute(&state.db).await;
            Ok(Json(val))
        }
        Err(e) => {
            warn!("Upscale failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

#[derive(Deserialize)]
pub struct FaceRestoreRequest {
    pub photo_id: Option<Value>,
    #[serde(default = "default_restore_strength")]
    pub strength: f32,
}

fn default_restore_strength() -> f32 { 1.0 }

pub async fn face_restore_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<FaceRestoreRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    // Detect faces with the existing SCRFD engine, then restore each crop.
    let faces = crate::services::face_engine::scan_faces(&photo.path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Face detection failed: {}", e)))?;
    let boxes: Vec<[i64; 4]> = faces
        .iter()
        .filter_map(|f| serde_json::from_str::<[i64; 4]>(&f.box_json).ok())
        .collect();

    match enhance::FaceRestoreEngine::get()
        .restore_async(&photo.path, boxes, payload.strength)
        .await
    {
        Ok(val) => {
            invalidate_photo_thumbnails(&state.config.thumbnails_dir, photo.id);
            let new_hash = chrono::Utc::now().timestamp_millis().to_string();
            let _ = sqlx::query("UPDATE photos SET hash = ? WHERE id = ?")
                .bind(&new_hash)
                .bind(photo.id)
                .execute(&state.db)
                .await;
            Ok(Json(val))
        }
        Err(e) => {
            warn!("Face restore failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- SCUNet blind denoise --

#[derive(Deserialize)]
pub struct DenoiseRequest {
    pub photo_id: Option<Value>,
}

pub async fn denoise_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DenoiseRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    match denoise::DenoiseEngine::get().denoise_async(&photo.path).await {
        Ok(val) => {
            invalidate_photo_thumbnails(&state.config.thumbnails_dir, photo.id);
            let new_hash = chrono::Utc::now().timestamp_millis().to_string();
            let _ = sqlx::query("UPDATE photos SET hash = ? WHERE id = ?")
                .bind(&new_hash)
                .bind(photo.id)
                .execute(&state.db)
                .await;
            Ok(Json(val))
        }
        Err(e) => {
            warn!("Denoise failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- Florence-2 image captioning --

#[derive(Deserialize)]
pub struct CaptionRequest {
    pub photo_id: Option<Value>,
    #[serde(default = "default_caption_task")]
    pub task: String,
}

fn default_caption_task() -> String { "caption".to_string() }

/// POST /photos/caption — Florence-2 image captioning.
/// Returns a text caption for the given photo using the Florence-2 model.
pub async fn caption_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CaptionRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    let task = florence2::Florence2Task::from_str(&payload.task);
    match florence2::Florence2Engine::get()
        .caption_async(&photo.path, task)
        .await
    {
        Ok(val) => {
            // Store caption in DB if non-empty
            if let Some(caption) = val.get("caption").and_then(|c| c.as_str()) {
                if !caption.is_empty() {
                    let _ = sqlx::query("UPDATE photos SET ai_summary = COALESCE(ai_summary, ?) WHERE id = ?")
                        .bind(caption)
                        .bind(photo.id)
                        .execute(&state.db)
                        .await;
                }
            }
            Ok(Json(val))
        }
        Err(e) => {
            warn!("Caption failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- Florence-2 object detection / phrase grounding --

#[derive(Deserialize)]
pub struct DetectRequest {
    pub photo_id: Option<Value>,
    #[serde(default = "default_caption_task")]
    pub task: String,
    /// For phrase grounding: the caption text to locate phrases in.
    pub input_text: Option<String>,
}

/// POST /photos/detect — Florence-2 object detection or phrase grounding.
/// Returns structured bounding boxes + labels.
pub async fn detect_photo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DetectRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    let task = florence2::Florence2Task::from_str(&payload.task);
    match florence2::Florence2Engine::get()
        .detect_async(&photo.path, task, payload.input_text)
        .await
    {
        Ok(val) => Ok(Json(val)),
        Err(e) => {
            warn!("Detect failed: {}", e);
            Ok(Json(json!({ "success": false, "error": e })))
        }
    }
}

// -- SAM interactive click-to-select --

#[derive(Deserialize)]
pub struct SamPoint {
    pub x: f32,
    pub y: f32,
    /// true = include region (left click), false = exclude (right click).
    #[serde(default = "default_positive")]
    pub positive: bool,
}

fn default_positive() -> bool { true }

#[derive(Deserialize)]
pub struct SamSelectRequest {
    pub photo_id: Option<Value>,
    pub points: Vec<SamPoint>,
}

/// POST /photos/sam/select — point-prompted MobileSAM. Returns a PNG mask
/// (data URI) at the photo's original resolution, ready to feed the Magic
/// Eraser mask pipeline or overlay directly.
pub async fn sam_select(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<SamSelectRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let id_str = photo_id_to_string(&payload.photo_id)?;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &id_str).await?;

    let points: Vec<(f32, f32)> = payload.points.iter().map(|p| (p.x, p.y)).collect();
    let positive: Vec<bool> = payload.points.iter().map(|p| p.positive).collect();

    let _slot = crate::services::inference_slot::acquire("sam-select").await;
    let path = photo.path.clone();
    let result = tokio::task::spawn_blocking(move || {
        let engine = crate::services::sam::get_sam()?;
        engine.segment_points(&path, &points, &positive)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("SAM task panicked: {}", e)))?;

    match result {
        Ok(png) => {
            use base64::Engine as _;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&png);
            Ok(Json(json!({
                "success": true,
                "mask_data": format!("data:image/png;base64,{}", b64),
                "width": photo.width,
                "height": photo.height,
            })))
        }
        Err(e) => {
            warn!("SAM select failed: {}", e);
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
#[allow(dead_code)]
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
    let _slot = crate::services::inference_slot::acquire("semantic-segmentation").await;
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

#[derive(Deserialize)]
pub struct BackgroundMaskQuery {
    pub model: Option<String>,
}

pub async fn get_background_mask(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
    Query(params): Query<BackgroundMaskQuery>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let _slot = crate::services::inference_slot::acquire("background-segmentation").await;
    let photo = crate::routes::photos::find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let masks_dir = state.config.thumbnails_dir.join("masks");
    let model_id_str = params.model.as_deref();

    let engine = segmentation::SegmentationEngine::get();
    match engine.get_background_mask(&photo.path, photo.id, &masks_dir, model_id_str, Some(&state.pack_manager)) {
        Ok(resp) => Ok(Json(serde_json::to_value(resp).unwrap_or_default())),
        Err(e) => {
            warn!("Background mask failed: {}", e);
            if e.contains("not installed") || e.contains("not found") {
                return Err((StatusCode::CONFLICT, e));
            }
            Ok(Json(json!({ "photo_id": photo.id, "mask_url": null, "error": e })))
        }
    }
}

pub async fn get_portrait_masks(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let _slot = crate::services::inference_slot::acquire("portrait-segmentation").await;
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
    let img_res = match std::fs::read(&photo.path) {
        Ok(bytes) => image::load_from_memory(&bytes).map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    };
    match img_res {
        Ok(img) => {
            let params = auto_enhance::calculate_auto_enhance(&img);
            Ok(Json(serde_json::to_value(params).unwrap_or_default()))
        }
        Err(e) => {
            warn!("Auto-enhance image load failed: {}", e);
            Ok(Json(json!({ "photo_id": photo.id, "error": e })))
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
#[allow(dead_code)]
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
