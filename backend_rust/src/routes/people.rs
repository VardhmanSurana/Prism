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
    let start_time = std::time::Instant::now();
    let people = sqlx::query_as::<_, Person>("SELECT * FROM people ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let duration_ms = start_time.elapsed().as_secs_f64() * 1000.0;
    let meta = json!({
        "model_name": "CenterFace + DBSCAN",
        "people_count": people.len()
    }).to_string();

    let _ = state.telemetry.log_event(
        "backend",
        None,
        "face_clustering",
        Some("people"),
        Some("list"),
        Some(&meta),
        Some("ok"),
        Some(duration_ms),
    ).await;

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

    // Run in-process face engine (SCRFD + ArcFace)
    let faces = crate::services::face_engine::scan_faces(&photo_path)
        .await
        .map_err(|e| (StatusCode::BAD_GATEWAY, e))?;

    Ok(Json(json!({
        "photo_id": photo_id,
        "faces_detected": faces.len(),
        "status": "success",
        "faces": faces
    })))
}

// ── Pending face feedback (Python-only, TODO stub) ─────────────────────────

#[derive(serde::Deserialize)]
pub struct FeedbackRequest {
    pub decision: String, // "same" | "different"
}

/// POST /api/v1/people/pending-faces/:pending_id/feedback — Submit user feedback on a pending face assignment.
pub async fn submit_pending_face_feedback(
    State(state): State<Arc<AppState>>,
    Path(pending_id): Path<i64>,
    Json(payload): Json<FeedbackRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.decision != "same" && payload.decision != "different" {
        return Err((StatusCode::BAD_REQUEST, "Invalid decision. Must be 'same' or 'different'".to_string()));
    }

    // Get the pending face assignment
    let pending: (i64, i64, String) = sqlx::query_as(
        "SELECT id, photo_id, face_embedding FROM pending_faces WHERE id = ?"
    )
    .bind(pending_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .ok_or((StatusCode::NOT_FOUND, "Pending face not found".to_string()))?;

    let (_id, photo_id, _embedding_json) = pending;

    if payload.decision == "same" {
        // Get the person_id from the pending face
        let person_id: Option<i64> = sqlx::query_scalar(
            "SELECT person_id FROM pending_faces WHERE id = ?"
        )
        .bind(pending_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if let Some(pid) = person_id {
            // Create PhotoPerson mapping
            sqlx::query(
                "INSERT OR IGNORE INTO photo_persons (photo_id, person_id, confidence) VALUES (?, ?, 0.9)"
            )
            .bind(photo_id)
            .bind(pid)
            .execute(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    } else {
        // Create a new person from this face
        let result = sqlx::query(
            "INSERT INTO persons (name) VALUES ('New Person')"
        )
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        let new_person_id = result.last_insert_rowid();

        // Link photo to new person
        sqlx::query(
            "INSERT OR IGNORE INTO photo_persons (photo_id, person_id, confidence) VALUES (?, ?, 0.9)"
        )
        .bind(photo_id)
        .bind(new_person_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Delete the pending face
    sqlx::query("DELETE FROM pending_faces WHERE id = ?")
        .bind(pending_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "resolved_id": pending_id,
        "action": payload.decision,
    })))
}
