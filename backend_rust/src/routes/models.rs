use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

/// routes - Performs routes.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_models))
        .route("/progress", get(get_all_progress))
        .route("/download/:id", post(download_model))
        .route("/cancel/:id", post(cancel_download))
        .route("/:id", delete(delete_model))
}

/// list_models - Retrieves list models.
pub async fn list_models(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let models = state.model_manager.list_models().await;
    Ok(Json(json!({ "models": models })))
}

/// get_all_progress - Retrieves get all progress.
pub async fn get_all_progress(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let progress = state.model_manager.get_all_progress().await;
    Ok(Json(json!({ "progress": progress })))
}

/// download_model - Performs download model.
pub async fn download_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match state.model_manager.start_download(&id).await {
        Ok(()) => Ok(Json(json!({
            "status": "started",
            "model_id": id,
            "message": format!("Background download started for model {}", id)
        }))),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

/// cancel_download - Performs cancel download.
pub async fn cancel_download(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match state.model_manager.cancel_download(&id).await {
        Ok(()) => Ok(Json(json!({
            "status": "paused",
            "model_id": id,
            "message": format!("Download cancelled/paused for model {}", id)
        }))),
        Err(e) => Err((StatusCode::BAD_REQUEST, e)),
    }
}

/// delete_model - Deletes delete model.
pub async fn delete_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    match state.model_manager.delete_model(&id).await {
        Ok(()) => Ok(Json(json!({
            "status": "deleted",
            "model_id": id,
            "message": format!("Model {} deleted from disk", id)
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}
