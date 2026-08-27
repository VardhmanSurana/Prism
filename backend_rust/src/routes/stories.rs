/// Story recap endpoints — LLM-generated summaries for events and photo clusters.
///
/// TODO: Implement real story generation via local LLM. Currently returns stubs.
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::AppState;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct StoryRequest {
    pub event_id: Option<i64>,
    pub photo_ids: Option<Vec<i64>>,
    #[serde(default)]
    pub title: String,
}

/// generate_story - Performs generate story.
pub async fn generate_story(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StoryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.event_id.is_none() && payload.photo_ids.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Provide either event_id or photo_ids".to_string()));
    }

    let mut ids = payload.photo_ids.clone().unwrap_or_default();
    
    if let Some(eid) = payload.event_id {
        // Fetch photos for event
        let q = "SELECT photo_id FROM event_photos WHERE event_id = ?";
        let event_photo_ids: Vec<i64> = sqlx::query_scalar(q)
            .bind(eid)
            .fetch_all(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        ids.extend(event_photo_ids);
    }
    
    if ids.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No photos found".to_string()));
    }

    let source = if payload.event_id.is_some() { "event" } else { "cluster" };
    let photo_count = ids.len();

    let context = crate::services::stories::build_event_context(&state.db, &ids, &payload.title)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let story = crate::services::stories::generate_story_for_context(&context, &state.ml_client.llm)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    if let Some(eid) = payload.event_id {
        sqlx::query("UPDATE events SET summary = ? WHERE id = ?")
            .bind(&story)
            .bind(eid)
            .execute(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    Ok(Json(json!({
        "story": story,
        "source": source,
        "event_id": payload.event_id,
        "photo_count": photo_count
    })))
}

/// get_event_story - Retrieves get event story.
pub async fn get_event_story(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let summary: Option<String> = sqlx::query_scalar("SELECT summary FROM events WHERE id = ?")
        .bind(event_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .flatten();
        
    if let Some(story) = summary {
        Ok(Json(json!({
            "story": story,
            "source": "event",
            "event_id": event_id
        })))
    } else {
        Err((StatusCode::NOT_FOUND, "Story not found".to_string()))
    }
}