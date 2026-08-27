use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use std::process::Command;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct VideoProject {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub cover_photo_id: Option<i64>,
    pub width: i32,
    pub height: i32,
    pub fps: i32,
    pub project_json: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub fps: Option<i32>,
    pub project_json: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub project_json: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub fps: Option<i32>,
}

/// find_project_by_id_or_uuid - Performs find project by id or uuid.
pub async fn find_project_by_id_or_uuid(
    db: &sqlx::SqlitePool,
    id_or_uuid: &str,
) -> Result<VideoProject, (StatusCode, String)> {
    if let Ok(id) = id_or_uuid.parse::<i64>() {
        if let Ok(Some(proj)) = sqlx::query_as::<_, VideoProject>("SELECT * FROM video_projects WHERE id = ?")
            .bind(id)
            .fetch_optional(db)
            .await
        {
            return Ok(proj);
        }
    }

    if let Ok(Some(proj)) = sqlx::query_as::<_, VideoProject>("SELECT * FROM video_projects WHERE uuid = ?")
        .bind(id_or_uuid)
        .fetch_optional(db)
        .await
    {
        return Ok(proj);
    }

    Err((StatusCode::NOT_FOUND, "Project not found".to_string()))
}

/// list_projects - Retrieves list projects.
pub async fn list_projects(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<VideoProject>>, (StatusCode, String)> {
    let projects = sqlx::query_as::<_, VideoProject>(
        "SELECT * FROM video_projects ORDER BY updated_at DESC, id DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(projects))
}

/// create_project - Handles create project.
pub async fn create_project(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateProjectRequest>,
) -> Result<Json<VideoProject>, (StatusCode, String)> {
    let name = payload.name.unwrap_or_else(|| "Untitled Edit".to_string());
    let width = payload.width.unwrap_or(1920);
    let height = payload.height.unwrap_or(1080);
    let fps = payload.fps.unwrap_or(30);
    let now = Utc::now();
    let new_uuid = Uuid::new_v4().to_string();

    let id = sqlx::query(
        r#"
        INSERT INTO video_projects (uuid, name, cover_photo_id, width, height, fps, project_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&new_uuid)
    .bind(&name)
    .bind(payload.cover_photo_id)
    .bind(width)
    .bind(height)
    .bind(fps)
    .bind(&payload.project_json)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .last_insert_rowid();

    let project = sqlx::query_as::<_, VideoProject>("SELECT * FROM video_projects WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(project))
}

/// get_project - Retrieves get project.
pub async fn get_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let project = find_project_by_id_or_uuid(&state.db, &id).await?;

    let parsed_json: Option<Value> = project.project_json.as_deref().and_then(|s| serde_json::from_str(s).ok());

    Ok(Json(json!({
        "id": project.id,
        "uuid": project.uuid,
        "name": project.name,
        "width": project.width,
        "height": project.height,
        "fps": project.fps,
        "cover_photo_id": project.cover_photo_id,
        "project_json": parsed_json,
        "created_at": project.created_at,
        "updated_at": project.updated_at
    })))
}

/// update_project - Updates update project.
pub async fn update_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateProjectRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let now = Utc::now();

    let mut project = find_project_by_id_or_uuid(&state.db, &id).await?;

    if let Some(name) = payload.name {
        project.name = name;
    }
    if let Some(w) = payload.width {
        project.width = w;
    }
    if let Some(h) = payload.height {
        project.height = h;
    }
    if let Some(fps) = payload.fps {
        project.fps = fps;
    }
    if let Some(pj) = payload.project_json {
        project.project_json = Some(pj);
    }
    project.updated_at = Some(now);

    sqlx::query(
        r#"
        UPDATE video_projects
        SET name = ?, width = ?, height = ?, fps = ?, project_json = ?, updated_at = ?
        WHERE id = ?
        "#
    )
    .bind(&project.name)
    .bind(project.width)
    .bind(project.height)
    .bind(project.fps)
    .bind(&project.project_json)
    .bind(&now)
    .bind(project.id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "id": project.id,
        "uuid": project.uuid,
        "updated_at": now
    })))
}

/// delete_project - Deletes delete project.
pub async fn delete_project(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let project = find_project_by_id_or_uuid(&state.db, &id).await?;

    sqlx::query("DELETE FROM video_projects WHERE id = ?")
        .bind(project.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "id": project.id,
        "uuid": project.uuid
    })))
}

#[derive(Deserialize)]
pub struct GenerateProxyRequest {
    pub source_path: String,
    pub target_height: Option<i32>,
}

/// is_ffmpeg_installed - Performs is ffmpeg installed.
pub fn is_ffmpeg_installed() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// generate_proxy_video - Performs generate proxy video.
pub async fn generate_proxy_video(
    Json(payload): Json<GenerateProxyRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if !is_ffmpeg_installed() {
        return Ok(json!({
            "status": "skipped",
            "message": "FFmpeg binary not detected on host system. Using native original video source.",
            "ffmpeg_available": false
        }).into());
    }

    let height = payload.target_height.unwrap_or(720);
    let source_path = std::path::Path::new(&payload.source_path);

    if !source_path.exists() {
        return Err((StatusCode::NOT_FOUND, "Source video file not found".to_string()));
    }

    let stem = source_path.file_stem().and_then(|s| s.to_str()).unwrap_or("proxy");
    let proxy_filename = format!("{}_proxy_{}p.webm", stem, height);
    let proxy_dir = std::env::temp_dir().join("prism_proxies");

    if let Err(e) = std::fs::create_dir_all(&proxy_dir) {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create proxy directory: {}", e)));
    }

    let proxy_path = proxy_dir.join(proxy_filename);
    let proxy_path_str = proxy_path.to_string_lossy().to_string();

    if proxy_path.exists() {
        return Ok(Json(json!({
            "status": "ready",
            "proxy_path": proxy_path_str,
            "ffmpeg_available": true
        })));
    }

    let status = std::process::Command::new("ffmpeg")
        .arg("-i")
        .arg(&payload.source_path)
        .arg("-vf")
        .arg(format!("scale=-2:{}", height))
        .arg("-c:v")
        .arg("libvpx-vp9")
        .arg("-b:v")
        .arg("1M")
        .arg("-c:a")
        .arg("libopus")
        .arg("-y")
        .arg(&proxy_path_str)
        .status();

    match status {
        Ok(s) if s.success() => Ok(Json(json!({
            "status": "created",
            "proxy_path": proxy_path_str,
            "ffmpeg_available": true
        }))),
        _ => Err((StatusCode::INTERNAL_SERVER_ERROR, "FFmpeg proxy transcoding failed".to_string())),
    }
}

#[derive(Deserialize)]
pub struct AnalyzeClipRequest {
    pub photo_id: Option<Value>,
    pub source_path: Option<String>,
}

/// analyze_video_clip - Performs analyze video clip.
pub async fn analyze_video_clip(
    Json(payload): Json<AnalyzeClipRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo_id = payload.photo_id.unwrap_or(json!(0));
    let source_path = payload.source_path.unwrap_or_default();

    Ok(Json(json!({
        "clip_id": photo_id,
        "source_path": source_path,
        "duration": 5.0,
        "fps": 30
    })))
}

// ---------------------------------------------------------------------------
// Video streaming endpoint — serves media files for the preview player.
// Resolves relative paths (e.g. "uploads/...") relative to the working dir.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct StreamQuery {
    pub path: String,
}

/// stream_video - Performs stream video.
pub async fn stream_video(
    axum::extract::Query(query): axum::extract::Query<StreamQuery>,
) -> Result<axum::response::Response, (StatusCode, String)> {
    use axum::http::header;
    use std::path::PathBuf;
    use tokio::fs::File;
    use tokio_util::io::ReaderStream;

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let path_str = query.path.trim();

    let mut file_path = if std::path::Path::new(path_str).is_absolute() {
        PathBuf::from(path_str)
    } else {
        cwd.join(path_str)
    };

    if !file_path.exists() {
        let alt1 = cwd.join("uploads").join(path_str);
        if alt1.exists() {
            file_path = alt1;
        } else {
            let filename_only = std::path::Path::new(path_str)
                .file_name()
                .map(|f| f.to_string_lossy().to_string())
                .unwrap_or_default();
            let alt2 = cwd.join("uploads").join(&filename_only);
            if alt2.exists() {
                file_path = alt2;
            } else {
                return Err((StatusCode::NOT_FOUND, format!("File not found: {}", query.path)));
            }
        }
    }

    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let file_size = metadata.len();
    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let file = File::open(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stream = ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    Ok(axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, OPTIONS")
        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "*")
        .body(body)
        .unwrap())
}

// ---------------------------------------------------------------------------
// Thumbnail strip — returns empty array (real generation needs FFmpeg).
// ClipElement.tsx silently ignores an empty thumbnails array.
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ThumbnailStripRequest {
    pub source_path: Option<String>,
    pub num_thumbnails: Option<u32>,
    pub speed: Option<f64>,
    pub in_point: Option<f64>,
    pub out_point: Option<f64>,
}

/// thumbnail_strip - Performs thumbnail strip.
pub async fn thumbnail_strip(
    Json(payload): Json<ThumbnailStripRequest>,
) -> axum::response::Json<Value> {
    // ponytail: generate thumbnails at 1s intervals for video strips
    let path = payload.source_path.clone().unwrap_or_default();
    let in_point = payload.in_point.unwrap_or(0.0);
    let out_point = payload.out_point.unwrap_or(60.0);
    let count = payload.num_thumbnails.unwrap_or(12);
    let interval = if count > 0 {
        (out_point - in_point) / count as f64
    } else {
        1.0
    };

    let mut thumbnails = Vec::new();
    let mut t = in_point;
    while t < out_point && thumbnails.len() < 50 {
        let out = std::env::temp_dir().join(format!("thumb_{}_{}.jpg", Uuid::new_v4(), thumbnails.len()));
        let ts = format!("{:.3}", t);
        let _ = Command::new("ffmpeg")
            .args(["-y", "-ss", &ts, "-i", &path, "-frames:v", "1", "-q:v", "8", "-vf", "scale=160:-1", out.to_str().unwrap_or_default()])
            .output();
        if out.exists() {
            thumbnails.push(json!({ "timestamp": t, "path": out.to_string_lossy() }));
        }
        t += interval;
    }

    Json(json!({ "thumbnails": thumbnails }))
}


// ── NLE endpoints (Python-only, TODO stubs) ────────────────────────────────

#[derive(serde::Deserialize)]
#[allow(dead_code)]
pub struct WaveformRequest {
    pub source_path: String,
    #[serde(default)]
    pub photo_id: Option<i64>,
}

/// POST /api/v1/nle/clips/waveform — Extract audio waveform peaks for visualization.
pub async fn get_waveform(
    Json(payload): Json<WaveformRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let output = Command::new("ffmpeg")
        .args([
            "-i", &payload.source_path,
            "-ac", "1", "-ar", "44100",
            "-f", "f32le", "-",
        ])
        .output()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg not found: {}", e)))?;

    if !output.status.success() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "FFmpeg audio extraction failed".to_string()));
    }

    let bytes = &output.stdout;
    let samples: Vec<f32> = bytes.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect();

    // Downsample to 200 peaks
    let num_peaks = 200;
    let chunk_size = (samples.len() / num_peaks).max(1);
    let peaks: Vec<f32> = samples.chunks(chunk_size)
        .map(|chunk| chunk.iter().map(|s| s.abs()).fold(0.0f32, f32::max))
        .take(num_peaks)
        .collect();

    let max_peak = peaks.iter().cloned().fold(0.0f32, f32::max).max(0.001);
    let normalized: Vec<f32> = peaks.iter().map(|p| p / max_peak).collect();

    Ok(Json(json!({ "peaks": normalized })))
}

/// POST /api/v1/nle/preview/render — Preview rendering.
pub async fn render_preview(
    State(_state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let source = payload.get("source").and_then(|v| v.as_str()).unwrap_or("");
    let time = payload.get("time").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let width = payload.get("width").and_then(|v| v.as_u64()).unwrap_or(640) as u32;

    let output_path = std::env::temp_dir().join(format!("prism_preview_{}.jpg", Uuid::new_v4()));
    let ts = format!("{:.3}", time);

    let output = Command::new("ffmpeg")
        .args([
            "-y", "-ss", &ts, "-i", source,
            "-frames:v", "1", "-q:v", "5",
            "-vf", &format!("scale={}:-1", width),
            output_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg not found: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg failed: {}", stderr)));
    }

    Ok(Json(json!({
        "status": "success",
        "preview_path": output_path.to_string_lossy(),
    })))
}

/// POST /api/v1/nle/export — NLE project export via FFmpeg.
pub async fn export_project(
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let project_json = payload.get("project_json").and_then(|v| v.as_str()).unwrap_or("{}");
    let project: Value = serde_json::from_str(project_json).unwrap_or(json!({}));

    let tracks = project.get("tracks").and_then(|v| v.as_array()).cloned().unwrap_or_default();
    let mut inputs = Vec::new();
    let mut filter_parts = Vec::new();

    for track in tracks.iter() {
        let clips = track.get("clips").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        for clip in clips.iter() {
            if let Some(path) = clip.get("path").and_then(|v| v.as_str()) {
                inputs.push(path.to_string());
                let idx = inputs.len() - 1;
                filter_parts.push(format!("[{}:v]trim=start={}:duration={},setpts=PTS-STARTPTS[v{}]", idx, 0, 4, idx));
            }
        }
    }

    if inputs.is_empty() {
        return Ok(Json(json!({ "status": "error", "message": "No clips to export" })));
    }

    let output_path = std::env::temp_dir().join(format!("prism_export_{}.mp4", Uuid::new_v4()));
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y");
    for input in &inputs {
        cmd.args(["-i", input]);
    }

    let filter = if filter_parts.len() == 1 {
        filter_parts.join(";")
    } else {
        format!("{};{}",
            filter_parts.join(";"),
            (0..filter_parts.len()).map(|i| format!("[v{}]", i)).collect::<Vec<_>>().join("") + "concat=n=" + &filter_parts.len().to_string() + ":v=1:a=0[outv]"
        )
    };

    cmd.args(["-filter_complex", &filter, "-map", "[outv]"]);
    cmd.args(["-c:v", "libx264", "-preset", "fast", "-crf", "23"]);
    cmd.arg(output_path.to_str().unwrap_or_default());

    let output = cmd.output()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg not found: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg export failed: {}", stderr)));
    }

    Ok(Json(json!({
        "status": "success",
        "output_path": output_path.to_string_lossy(),
    })))
}

// ── New stubs for Python-parity endpoints ──────────────────────────────────

#[derive(Deserialize)]
pub struct PreviewFrameRequest {
    pub video_path: String,
    pub timestamp: f64,
    #[serde(default = "default_width")]
    pub width: u32,
}

/// default_width - Performs default width.
fn default_width() -> u32 { 640 }

/// POST /api/v1/nle/preview/frame — Render a single preview frame via FFmpeg.
pub async fn preview_frame(
    Json(payload): Json<PreviewFrameRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let output_path = std::env::temp_dir().join(format!("prism_frame_{}.jpg", Uuid::new_v4()));
    let ts = format!("{:.3}", payload.timestamp);

    let output = Command::new("ffmpeg")
        .args([
            "-y", "-ss", &ts, "-i", &payload.video_path,
            "-frames:v", "1", "-q:v", "5",
            "-vf", &format!("scale={}:-1", payload.width),
            output_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg not found: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg failed: {}", stderr)));
    }

    Ok(Json(json!({
        "status": "success",
        "frame_path": output_path.to_string_lossy(),
        "timestamp": payload.timestamp,
    })))
}

#[derive(Deserialize)]
pub struct PreviewSegmentRequest {
    pub video_path: String,
    pub start_time: f64,
    pub end_time: f64,
    #[serde(default = "default_width")]
    pub width: u32,
}

/// POST /api/v1/nle/preview/segment — Render a preview segment via FFmpeg.
pub async fn preview_segment(
    Json(payload): Json<PreviewSegmentRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let output_path = std::env::temp_dir().join(format!("prism_segment_{}.mp4", Uuid::new_v4()));
    let duration = payload.end_time - payload.start_time;
    let start = format!("{:.3}", payload.start_time);
    let dur = format!("{:.3}", duration);

    let output = Command::new("ffmpeg")
        .args([
            "-y", "-ss", &start, "-i", &payload.video_path,
            "-t", &dur,
            "-vf", &format!("scale={}:-1", payload.width),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an",
            output_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg not found: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("FFmpeg failed: {}", stderr)));
    }

    Ok(Json(json!({
        "status": "success",
        "segment_path": output_path.to_string_lossy(),
        "start_time": payload.start_time,
        "end_time": payload.end_time,
    })))
}

#[derive(Deserialize)]
pub struct ExportXmlRequest {
    pub project_name: String,
    pub tracks: Vec<Value>,
}

/// POST /api/v1/nle/export/xml — Generate MLT XML for Kdenlive.
pub async fn export_xml(
    Json(payload): Json<ExportXmlRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut mlt = String::from(
        r#"<?xml version="1.0" encoding="utf-8"?>
<mlt LC_NUMERIC="C" version="7.0.0" title="Prism Export">
  <profile description="HD 1080p" width="1920" height="1080" progressive="1" sample_aspect_num="1" sample_aspect_den="1" display_aspect_num="16" display_aspect_den="9" frame_rate_num="30" frame_rate_den="1"/>
  <playlist id="maintrack">"#
    );

    for track in &payload.tracks {
        if let Some(path) = track.get("path").and_then(|v| v.as_str()) {
            let producer_id = Uuid::new_v4();
            mlt.push_str(&format!(
                r#"
    <producer id="{}">
      <property name="resource">{}</property>
    </producer>"#,
                producer_id, path
            ));
        }
    }

    mlt.push_str(
        r#"
  </playlist>
</mlt>"#
    );

    let output_path = std::env::temp_dir().join(format!("prism_{}.mlt", Uuid::new_v4()));
    std::fs::write(&output_path, &mlt)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "xml_path": output_path.to_string_lossy(),
        "project_name": payload.project_name,
    })))
}

/// GET /api/v1/nle/export/:job_id — Get NLE export job status.
pub async fn get_export_status(
    Path(job_id): Path<String>,
) -> Json<Value> {
    // ponytail: export jobs are tracked via filesystem, not DB
    let job_dir = std::env::temp_dir().join(format!("prism_export_{}", job_id));
    if job_dir.exists() {
        let output_file = job_dir.join("output.mp4");
        if output_file.exists() {
            let size = std::fs::metadata(&output_file).map(|m| m.len()).unwrap_or(0);
            Json(json!({ "job_id": job_id, "status": "completed", "output_path": output_file.to_string_lossy(), "size": size }))
        } else {
            Json(json!({ "job_id": job_id, "status": "processing" }))
        }
    } else {
        Json(json!({ "job_id": job_id, "status": "not_found" }))
    }
}

/// GET /api/v1/nle/export/:job_id/download — Download NLE export result.
pub async fn download_export(
    Path(job_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let output_file = std::env::temp_dir().join(format!("prism_export_{}/output.mp4", job_id));
    if !output_file.exists() {
        return Err((StatusCode::NOT_FOUND, "Export not found".to_string()));
    }
    Ok(Json(json!({
        "status": "success",
        "download_path": output_file.to_string_lossy(),
        "job_id": job_id,
    })))
}
