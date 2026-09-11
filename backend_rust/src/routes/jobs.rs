use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

/// routes - Durable jobs API router.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_jobs))
        .route("/pause", post(pause_jobs))
        .route("/resume", post(resume_jobs))
        .route("/prune", delete(prune_jobs))
        .route("/:id/cancel", post(cancel_job))
        .route("/:id/retry", post(retry_job))
}

#[derive(Deserialize)]
pub struct JobQueryParams {
    pub status: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize, Deserialize, sqlx::FromRow)]
pub struct JobRow {
    pub id: i64,
    pub photo_id: Option<i64>,
    pub job_type: String,
    pub title: Option<String>,
    pub status: String,
    pub current_stage: Option<String>,
    pub stage_progress: Option<String>,
    pub progress_pct: Option<f64>,
    pub total_items: Option<i64>,
    pub processed_items: Option<i64>,
    pub metadata_json: Option<String>,
    pub attempt_count: Option<i64>,
    pub last_error: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    // Joined photo fields
    pub photo_filename: Option<String>,
}

/// list_jobs - Returns paginated background jobs with counts and status.
pub async fn list_jobs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<JobQueryParams>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);
    let offset = params.offset.unwrap_or(0).max(0);

    let rows: Vec<JobRow> = match &params.status {
        Some(status_filter) => {
            sqlx::query_as::<_, JobRow>(
                r#"
                SELECT
                    j.id, j.photo_id, j.job_type, j.title, j.status,
                    j.current_stage, j.stage_progress, j.progress_pct,
                    j.total_items, j.processed_items, j.metadata_json,
                    j.attempt_count, j.last_error,
                    j.created_at, j.updated_at,
                    p.filename AS photo_filename
                FROM background_jobs j
                LEFT JOIN photos p ON p.id = j.photo_id
                WHERE j.status = ?
                ORDER BY j.id DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(status_filter)
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        None => {
            sqlx::query_as::<_, JobRow>(
                r#"
                SELECT
                    j.id, j.photo_id, j.job_type, j.title, j.status,
                    j.current_stage, j.stage_progress, j.progress_pct,
                    j.total_items, j.processed_items, j.metadata_json,
                    j.attempt_count, j.last_error,
                    j.created_at, j.updated_at,
                    p.filename AS photo_filename
                FROM background_jobs j
                LEFT JOIN photos p ON p.id = j.photo_id
                ORDER BY
                    CASE
                        WHEN j.status = 'processing' THEN 1
                        WHEN j.status = 'pending' THEN 2
                        WHEN j.status = 'failed' THEN 3
                        ELSE 4
                    END,
                    j.id DESC
                LIMIT ? OFFSET ?
                "#,
            )
            .bind(limit)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to query jobs: {}", e)))?;

    // Status counts
    let counts_rows = sqlx::query(
        "SELECT status, COUNT(*) as cnt FROM background_jobs GROUP BY status"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut counts = json!({
        "pending": 0,
        "processing": 0,
        "completed": 0,
        "failed": 0,
        "cancelled": 0
    });

    for r in &counts_rows {
        use sqlx::Row;
        let st: String = r.get("status");
        let cnt: i64 = r.get("cnt");
        if let Some(slot) = counts.get_mut(&st) {
            *slot = json!(cnt);
        }
    }

    let worker_snapshot = state.worker.status_snapshot();

    // Map job rows into friendly structure
    let formatted_jobs: Vec<Value> = rows.into_iter().map(|job| {
        let display_title = match job.title {
            Some(ref t) if !t.is_empty() => t.clone(),
            _ => match job.job_type.as_str() {
                "sequential_analysis" => match job.photo_filename {
                    Some(ref name) => format!("Analyze Photo ({})", name),
                    None => format!("Analyze Photo #{}", job.photo_id.unwrap_or(0)),
                },
                "model_download" => "Neural Model Download".to_string(),
                "thumbnail_backfill" => "Thumbnail Generation".to_string(),
                "video_export" => "Video Rendering".to_string(),
                "lan_push" => "LAN Peer Push".to_string(),
                other => other.replace('_', " "),
            }
        };

        let pct = job.progress_pct.unwrap_or_else(|| {
            match job.status.as_str() {
                "completed" => 100.0,
                "processing" => 50.0,
                _ => 0.0,
            }
        });

        json!({
            "id": job.id,
            "photo_id": job.photo_id,
            "photo_filename": job.photo_filename,
            "job_type": job.job_type,
            "title": display_title,
            "status": job.status,
            "current_stage": job.current_stage,
            "stage_progress": job.stage_progress,
            "progress_pct": pct,
            "total_items": job.total_items.unwrap_or(1),
            "processed_items": job.processed_items.unwrap_or(0),
            "metadata": job.metadata_json.and_then(|m| serde_json::from_str::<Value>(&m).ok()),
            "attempt_count": job.attempt_count.unwrap_or(0),
            "last_error": job.last_error,
            "created_at": job.created_at,
            "updated_at": job.updated_at
        })
    }).collect();

    Ok(Json(json!({
        "jobs": formatted_jobs,
        "counts": counts,
        "is_worker_paused": worker_snapshot.paused,
        "is_worker_processing": worker_snapshot.is_processing
    })))
}

/// cancel_job - Cancels a pending or processing job.
pub async fn cancel_job(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let job: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT job_type, metadata_json FROM background_jobs WHERE id = ?"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (job_type, metadata_json) = match job {
        Some(j) => j,
        None => return Err((StatusCode::NOT_FOUND, format!("Job {} not found", id))),
    };

    if job_type == "model_download" {
        if let Some(meta_str) = metadata_json {
            if let Ok(v) = serde_json::from_str::<Value>(&meta_str) {
                if let Some(model_id) = v.get("model_id").and_then(|s| s.as_str()) {
                    let _ = state.model_manager.cancel_download(model_id).await;
                }
            }
        }
    }

    sqlx::query(
        "UPDATE background_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to cancel job: {}", e)))?;

    Ok(Json(json!({
        "success": true,
        "job_id": id,
        "status": "cancelled"
    })))
}

/// retry_job - Resets a failed or cancelled job back to pending.
pub async fn retry_job(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let affected = sqlx::query(
        "UPDATE background_jobs SET status = 'pending', attempt_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to retry job: {}", e)))?
    .rows_affected();

    if affected == 0 {
        return Err((StatusCode::NOT_FOUND, format!("Job {} not found", id)));
    }

    Ok(Json(json!({
        "success": true,
        "job_id": id,
        "status": "pending"
    })))
}

/// prune_jobs - Deletes completed and cancelled jobs.
pub async fn prune_jobs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let deleted = sqlx::query(
        "DELETE FROM background_jobs WHERE status IN ('completed', 'cancelled')"
    )
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to prune jobs: {}", e)))?
    .rows_affected();

    Ok(Json(json!({
        "success": true,
        "pruned_count": deleted
    })))
}

/// pause_jobs - Pauses worker processing.
pub async fn pause_jobs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(true, Ordering::Relaxed);
    Ok(Json(json!({ "success": true, "paused": true })))
}

/// resume_jobs - Resumes worker processing.
pub async fn resume_jobs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    use std::sync::atomic::Ordering;
    state.worker.paused.store(false, Ordering::Relaxed);
    state.worker.notify.notify_one();
    Ok(Json(json!({ "success": true, "paused": false })))
}
