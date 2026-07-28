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

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ThumbnailStripRequest {
    pub source_path: String,
    pub num_thumbnails: Option<usize>,
    pub width: Option<u32>,
    pub speed: Option<f64>,
    pub in_point: Option<f64>,
    pub out_point: Option<f64>,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct WaveformRequest {
    pub source_path: String,
}

#[derive(Deserialize)]
pub struct AnalyzeClipRequest {
    pub source_path: String,
    pub photo_id: Option<i64>,
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
    let mut projects = sqlx::query_as::<_, VideoProject>(
        "SELECT * FROM video_projects ORDER BY updated_at DESC, id DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for p in &mut projects {
        if p.uuid.is_none() {
            let u = Uuid::new_v4().to_string();
            sqlx::query("UPDATE video_projects SET uuid = ? WHERE id = ?")
                .bind(&u)
                .bind(p.id)
                .execute(&state.db)
                .await
                .ok();
            p.uuid = Some(u);
        }
    }

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
    let mut project = find_project_by_id_or_uuid(&state.db, &id).await?;

    if project.uuid.is_none() {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE video_projects SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(project.id)
            .execute(&state.db)
            .await
            .ok();
        project.uuid = Some(u);
    }

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

    if project.uuid.is_none() {
        let u = Uuid::new_v4().to_string();
        sqlx::query("UPDATE video_projects SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(project.id)
            .execute(&state.db)
            .await
            .ok();
        project.uuid = Some(u);
    }

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

pub async fn analyze_clip(
    Json(payload): Json<AnalyzeClipRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({
        "source_path": payload.source_path,
        "photo_id": payload.photo_id,
        "duration": 10.0,
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "has_audio": true,
        "audio_channels": 2,
        "sample_rate": 48000
    })))
}

pub async fn get_waveform(
    Json(payload): Json<WaveformRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({
        "source_path": payload.source_path,
        "peaks": [0.1, 0.4, 0.8, 0.5, 0.9, 0.3, 0.2, 0.6, 0.7, 0.4]
    })))
}

pub async fn get_thumbnail_strip(
    Json(payload): Json<ThumbnailStripRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({
        "source_path": payload.source_path,
        "thumbnails": []
    })))
}
