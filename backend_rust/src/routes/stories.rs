/// Story recap endpoints — LLM-generated summaries for events and photo clusters.
///
/// TODO: Implement real story generation via local LLM. Currently returns stubs.
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct StoryRequest {
    pub event_id: Option<i64>,
    pub photo_ids: Option<Vec<i64>>,
    #[serde(default)]
    pub title: String,
}

/// POST /api/v1/stories/generate — Generate a local LLM story recap for an event or photo cluster.
pub async fn generate_story(
    Json(payload): Json<StoryRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real story generation via local LLM (Gemma)
    // Should use only metadata (tags, names, locations, dates) — never images
    if payload.event_id.is_none() && payload.photo_ids.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Provide either event_id or photo_ids".to_string()));
    }

    let source = if payload.event_id.is_some() { "event" } else { "cluster" };
    let photo_count = payload.photo_ids.as_ref().map(|v| v.len()).unwrap_or(0);

    Ok(Json(json!({
        "story": "Story generation not yet implemented in Rust backend. This is a TODO stub.",
        "source": source,
        "event_id": payload.event_id,
        "photo_count": photo_count
    })))
}

/// GET /api/v1/stories/event/:event_id — Get the story for an event.
pub async fn get_event_story(
    Path(event_id): Path<i64>,
) -> Json<Value> {
    // TODO: Implement real event story retrieval/generation
    Json(json!({
        "story": "Story generation not yet implemented in Rust backend. This is a TODO stub.",
        "source": "stub",
        "event_id": event_id
        }))
}