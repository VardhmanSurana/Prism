use axum::{extract::State, response::Json};
use serde_json::{json, Value};

use std::sync::Arc;

use crate::models::{HealthStatus, PhotoStatsResponse};
use crate::AppState;
use crate::services::{hardware, inference_slot};

/// GET /api/v1/system/hardware
///
/// Reports the machine's AI capabilities (GPU/VRAM/RAM/backend) plus current
/// inference-slot occupancy so plugins can gate features that don't fit
/// (e.g. heavyweight generative models on a 4 GB VRAM laptop).
pub async fn get_hardware_profile(State(state): State<Arc<AppState>>) -> Json<Value> {
    let gpu_mode = state.config.gpu_mode.clone();
    let profile = tokio::task::spawn_blocking(move || hardware::detect(&gpu_mode))
        .await
        .unwrap_or_else(|_| hardware::detect("cpu"));

    Json(json!({
        "profile": profile,
        "inference_slot": inference_slot::status().await,
    }))
}


pub async fn root() -> Json<Value> {
    Json(json!({
        "name": "Prism Rust Backend API",
        "version": "0.1.0",
        "status": "online"
    }))
}

pub async fn health_check(State(state): State<Arc<AppState>>) -> Json<HealthStatus> {
    let db_ok = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();

    Json(HealthStatus {
        status: if db_ok { "ok" } else { "degraded" }.to_string(),
        service: "prism-backend-rust".to_string(),
        version: "0.1.0-rust".to_string(),
        database: if db_ok { "connected" } else { "disconnected" }.to_string(),
    })
}

pub async fn get_photo_stats(State(state): State<Arc<AppState>>) -> Json<PhotoStatsResponse> {
    let total_photos: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND file_type = 'image'")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let total_videos: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND file_type = 'video'")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let favorites_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_favorite = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let trash_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_trash = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let locked_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos WHERE is_locked = 1")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let storage_used_bytes: i64 = sqlx::query_scalar("SELECT COALESCE(SUM(file_size), 0) FROM photos WHERE is_trash = 0")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    Json(PhotoStatsResponse {
        total_photos,
        total_videos,
        favorites_count,
        trash_count,
        locked_count,
        storage_used_bytes,
    })
}
