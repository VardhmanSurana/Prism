use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_packs))
        .route("/refresh", post(refresh_packs))
        .route("/verify/:id", post(verify_pack_model))
        .route("/acknowledge-license", post(acknowledge_license))
}

pub async fn list_packs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let packs = state.pack_manager.get_packs_info().await;
    Ok(Json(json!({ "packs": packs })))
}

pub async fn refresh_packs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    state.pack_manager.refresh().await;
    let pack_models = state.pack_manager.to_model_definitions().await;
    // Update model definitions in model manager if available
    let packs = state.pack_manager.get_packs_info().await;
    Ok(Json(json!({
        "status": "refreshed",
        "pack_count": packs.len(),
        "packs": packs,
        "models_registered": pack_models.len()
    })))
}

pub async fn verify_pack_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match state.pack_manager.verify_model_file(&id).await {
        Ok((is_valid, message)) => Ok(Json(json!({
            "model_id": id,
            "is_valid": is_valid,
            "message": message
        }))),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

#[derive(Deserialize)]
pub struct AcknowledgeLicenseRequest {
    pub model_id: String,
    pub acknowledged: bool,
}

pub async fn acknowledge_license(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AcknowledgeLicenseRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.acknowledged {
        state.pack_manager.acknowledge_license(&payload.model_id).await;
        
        // Also persist acknowledgment in SQLite settings table so it survives restarts
        let key = format!("pack_ack_{}", payload.model_id);
        let _ = sqlx::query("INSERT INTO settings (key, value) VALUES (?, 'true') ON CONFLICT(key) DO UPDATE SET value = 'true'")
            .bind(&key)
            .execute(&state.db)
            .await;

        Ok(Json(json!({
            "status": "acknowledged",
            "model_id": payload.model_id
        })))
    } else {
        Ok(Json(json!({
            "status": "not_acknowledged",
            "model_id": payload.model_id
        })))
    }
}

