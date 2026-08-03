use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;
use super::find_photo_by_id_or_uuid;

pub async fn toggle_favorite(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    let new_fav = !photo.is_favorite;

    sqlx::query("UPDATE photos SET is_favorite = ? WHERE id = ?")
        .bind(new_fav)
        .bind(photo.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "id": photo.id, "uuid": photo.uuid, "is_favorite": new_fav })))
}

pub async fn toggle_trash(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    let new_trash = !photo.is_trash;

    sqlx::query("UPDATE photos SET is_trash = ? WHERE id = ?")
        .bind(new_trash)
        .bind(photo.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "id": photo.id, "uuid": photo.uuid, "is_trash": new_trash })))
}

pub async fn restore_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;

    sqlx::query("UPDATE photos SET is_trash = 0 WHERE id = ?")
        .bind(photo.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "id": photo.id, "uuid": photo.uuid, "is_trash": false })))
}

#[derive(Deserialize)]
pub struct LocationUpdateRequest {
    pub latitude: f64,
    pub longitude: f64,
}

pub async fn update_photo_location(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<LocationUpdateRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    sqlx::query("UPDATE photos SET latitude = ?, longitude = ? WHERE id = ?")
        .bind(payload.latitude)
        .bind(payload.longitude)
        .bind(photo.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "id": photo.id,
        "latitude": payload.latitude,
        "longitude": payload.longitude
    })))
}

#[derive(Deserialize)]
pub struct AdjustmentsUpdateRequest {
    pub adjustments: Value,
}

pub async fn update_photo_adjustments(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<AdjustmentsUpdateRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    let adj_str = payload.adjustments.to_string();

    sqlx::query("UPDATE photos SET adjustments_json = ? WHERE id = ?")
        .bind(&adj_str)
        .bind(photo.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "photo_id": photo.id })))
}

#[derive(Deserialize)]
pub struct BulkAdjustmentsRequest {
    pub photo_ids: Vec<Value>,
    pub adjustments: Value,
}

pub async fn bulk_update_adjustments(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BulkAdjustmentsRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let adj_str = payload.adjustments.to_string();
    let mut updated_count = 0;

    for item in payload.photo_ids {
        if let Some(n) = item.as_i64() {
            if sqlx::query("UPDATE photos SET adjustments_json = ? WHERE id = ?")
                .bind(&adj_str)
                .bind(n)
                .execute(&state.db)
                .await
                .is_ok()
            {
                updated_count += 1;
            }
        }
    }

    Ok(Json(json!({ "status": "success", "updated_count": updated_count })))
}

#[derive(Deserialize)]
pub struct TagFaceRequest {
    pub person_name: String,
    pub face_box: Option<String>,
    pub person_id: Option<i64>,
}

pub async fn tag_photo_face(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<TagFaceRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;

    let name = payload.person_name.trim().to_string();
    let pid = if let Some(p_id) = payload.person_id {
        p_id
    } else {
        let existing_id: Option<i64> = sqlx::query_scalar("SELECT id FROM people WHERE name = ?")
            .bind(&name)
            .fetch_optional(&state.db)
            .await
            .unwrap_or_default();

        if let Some(eid) = existing_id {
            eid
        } else {
            let new_person_uuid = uuid::Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO people (uuid, name, photo_count) VALUES (?, ?, 1)")
                .bind(&new_person_uuid)
                .bind(&name)
                .execute(&state.db)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
                .last_insert_rowid()
        }
    };

    let fbox = payload.face_box.unwrap_or_else(|| r#"{"x":0.25,"y":0.25,"w":0.5,"h":0.5}"#.to_string());

    sqlx::query("INSERT OR REPLACE INTO photo_people (photo_id, person_id, confidence, face_box_json) VALUES (?, ?, 1.0, ?)")
        .bind(photo.id)
        .bind(pid)
        .bind(&fbox)
        .execute(&state.db)
        .await
        .ok();

    Ok(Json(json!({
        "status": "success",
        "person_id": pid,
        "person_name": name,
        "face_box": fbox
    })))
}
