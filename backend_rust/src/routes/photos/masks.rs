use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;
use super::find_photo_by_id_or_uuid;

pub async fn get_semantic_masks(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let _photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    Ok(Json(json!({ "regions": [] })))
}

pub async fn get_background_mask(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    let p_key = photo.uuid.as_deref().unwrap_or(&photo.id.to_string()).to_string();
    Ok(Json(json!({ "mask_url": format!("/api/v1/photos/{}/thumbnail", p_key) })))
}

pub async fn get_portrait_masks(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let _photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    Ok(Json(json!({ "faces": [] })))
}

pub async fn get_auto_enhance(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let _photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    Ok(Json(json!({
        "brightness": 0,
        "exposure": 0,
        "contrast": 0,
        "highlights": 0,
        "shadows": 0,
        "saturation": 0,
        "vibrance": 0,
        "temperature": 0,
        "whites": 0,
        "blacks": 0
    })))
}
