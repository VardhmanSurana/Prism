use axum::extract::State;
use std::sync::Arc;
/// Video export and subtitle endpoints.
///
/// TODO: Implement real video export via FFmpeg and subtitle generation via Whisper.
/// Currently all endpoints return stubs.
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ExportClip {
    pub source_path: String,
    pub start_time: f64,
    pub duration: f64,
    #[serde(default)]
    pub trim_start: f64,
    #[serde(default)]
    pub trim_end: f64,
    #[serde(default)]
    pub speed: f64,
    #[serde(default)]
    pub effects: Vec<Value>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ExportTrack {
    pub r#type: String,
    pub clips: Vec<ExportClip>,
    #[serde(default)]
    pub text_overlays: Vec<Value>,
    #[serde(default)]
    pub volume: f64,
    #[serde(default)]
    pub muted: bool,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ExportRequest {
    pub tracks: Vec<ExportTrack>,
    #[serde(default = "default_resolution")]
    pub resolution: (i32, i32),
    #[serde(default = "default_fps")]
    pub fps: i32,
    #[serde(default = "default_format")]
    pub format: String,
}

#[allow(dead_code)]
fn default_resolution() -> (i32, i32) { (1920, 1080) }
#[allow(dead_code)]
fn default_fps() -> i32 { 30 }
#[allow(dead_code)]
fn default_format() -> String { "mp4".to_string() }

/// POST /api/v1/video/export — Start FFmpeg video export job.
pub async fn start_export(
    Json(_payload): Json<ExportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real FFmpeg video export with job tracking
    Ok(Json(json!({
        "job_id": "todo-stub",
        "status": "processing",
        "message": "Video export not yet implemented in Rust backend"
    })))
}

/// GET /api/v1/video/export/:job_id — Check export progress.
pub async fn get_export_status(
    Path(job_id): Path<String>,
) -> Json<Value> {
    // TODO: Implement real export status tracking
    Json(json!({
        "job_id": job_id,
        "status": "not_found",
        "message": "Video export not yet implemented in Rust backend"
    }))
}

/// GET /api/v1/video/export/:job_id/download — Download exported video.
pub async fn download_export(
    Path(job_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real export download
    Err((StatusCode::NOT_IMPLEMENTED, format!("Video export not yet implemented in Rust backend (job_id: {})", job_id)))
}

#[derive(Deserialize)]
pub struct SubtitleRequest {
    pub photo_id: i64,
}

/// POST /api/v1/video/subtitles/generate — Whisper-based subtitle generation.
pub async fn generate_subtitles(
    State(state): State<Arc<crate::AppState>>,
    Json(payload): Json<SubtitleRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let video_path: Option<String> = sqlx::query_scalar("SELECT path FROM photos WHERE id = ?")
        .bind(payload.photo_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .flatten();

    let path = video_path.ok_or_else(|| (StatusCode::NOT_FOUND, "Video not found".to_string()))?;

    let subtitles = crate::services::subtitle_gen::generate_subtitles(&path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(Json(json!({
        "subtitles": subtitles,
    })))
}