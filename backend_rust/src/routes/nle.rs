use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
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

pub fn is_ffmpeg_installed() -> bool {
    std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

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

pub async fn thumbnail_strip(
    Json(_payload): Json<ThumbnailStripRequest>,
) -> axum::response::Json<Value> {
    // TODO: generate actual thumbnails with FFmpeg when available
    Json(json!({ "thumbnails": [] }))
}
