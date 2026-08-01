use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::models::{Person, Photo};
use crate::AppState;

pub async fn find_person_by_id_or_uuid(
    db: &sqlx::SqlitePool,
    id_or_uuid: &str,
) -> Result<Person, (StatusCode, String)> {
    if let Ok(id) = id_or_uuid.parse::<i64>() {
        if let Ok(Some(person)) = sqlx::query_as::<_, Person>("SELECT * FROM people WHERE id = ?")
            .bind(id)
            .fetch_optional(db)
            .await
        {
            return Ok(person);
        }
    }

    if let Ok(Some(person)) = sqlx::query_as::<_, Person>("SELECT * FROM people WHERE uuid = ?")
        .bind(id_or_uuid)
        .fetch_optional(db)
        .await
    {
        return Ok(person);
    }

    Err((StatusCode::NOT_FOUND, "Person not found".to_string()))
}

pub async fn list_people(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Person>>, (StatusCode, String)> {
    let people = sqlx::query_as::<_, Person>("SELECT * FROM people ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(people))
}

pub async fn get_person_photos(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let person = find_person_by_id_or_uuid(&state.db, &id).await?;

    let photos = sqlx::query_as::<_, Photo>(
        r#"
        SELECT p.* FROM photos p
        JOIN photo_people pp ON p.id = pp.photo_id
        WHERE pp.person_id = ? AND p.is_trash = 0
        ORDER BY p.date DESC, p.id DESC
        "#
    )
    .bind(person.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(json!({
        "person": person,
        "photos": photos
    })))
}

#[derive(Deserialize)]
pub struct RenamePersonRequest {
    pub name: String,
}

pub async fn rename_person(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<RenamePersonRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let person = find_person_by_id_or_uuid(&state.db, &id).await?;
    let new_name = payload.name.trim().to_string();

    sqlx::query("UPDATE people SET name = ? WHERE id = ?")
        .bind(&new_name)
        .bind(person.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "person_id": person.id,
        "uuid": person.uuid,
        "name": new_name
    })))
}

pub async fn get_pending_faces(
    State(_state): State<Arc<AppState>>,
    Path(_id): Path<String>,
) -> Result<Json<Vec<Value>>, (StatusCode, String)> {
    Ok(Json(vec![]))
}

pub async fn get_photo_faces(
    State(_state): State<Arc<AppState>>,
    Path(photo_id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({
        "photo_id": photo_id,
        "faces": []
    })))
}

pub async fn scan_photo_faces(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo_path: String = sqlx::query_scalar("SELECT path FROM photos WHERE id = ?")
        .bind(photo_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((StatusCode::NOT_FOUND, "Photo not found".to_string()))?;

    // Call Python ML service via ML client
    let scan_res = state
        .ml_client
        .scan_faces(&photo_path)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(json!({
        "photo_id": photo_id,
        "faces_detected": scan_res.faces.len(),
        "status": "success",
        "faces": scan_res.faces
    })))
}
