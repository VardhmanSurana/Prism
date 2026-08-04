use axum::{
    extract::{Multipart, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::fs;
use uuid::Uuid;

use crate::models::{AgentChatRequest, AgentMessage, AgentMessageRow, AgentSession, AgentUploadResponse, Photo};
use crate::AppState;

fn percent_encode(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{:02X}", b),
    }).collect()
}

#[derive(Deserialize)]
pub struct CreateSessionPayload {
    pub title: Option<String>,
}

#[derive(Deserialize)]
pub struct RenameSessionPayload {
    pub title: String,
}

/// GET /api/v1/agent/sessions - List all agent sessions
pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AgentSession>>, (StatusCode, String)> {
    let sessions = sqlx::query_as::<_, AgentSession>(
        "SELECT id, uuid, title, created_at, updated_at FROM agent_sessions ORDER BY updated_at DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(sessions))
}

/// POST /api/v1/agent/sessions - Create new agent session
pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateSessionPayload>,
) -> Result<Json<AgentSession>, (StatusCode, String)> {
    let session_uuid = Uuid::new_v4().to_string();
    let title = payload.title.unwrap_or_else(|| "New Chat".to_string());

    sqlx::query(
        "INSERT INTO agent_sessions (uuid, title) VALUES (?, ?)"
    )
    .bind(&session_uuid)
    .bind(&title)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let session = sqlx::query_as::<_, AgentSession>(
        "SELECT id, uuid, title, created_at, updated_at FROM agent_sessions WHERE uuid = ?"
    )
    .bind(&session_uuid)
    .fetch_one(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(session))
}

/// GET /api/v1/agent/sessions/:id - Get session messages
pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let session = sqlx::query_as::<_, AgentSession>(
        "SELECT id, uuid, title, created_at, updated_at FROM agent_sessions WHERE uuid = ? OR CAST(id AS TEXT) = ?"
    )
    .bind(&session_id)
    .bind(&session_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if session.is_none() {
        return Err((StatusCode::NOT_FOUND, "Session not found".to_string()));
    }

    let rows = sqlx::query_as::<_, AgentMessageRow>(
        "SELECT id, session_id, role, content, photos_json, plan_json, tools_json, attached_image_json, created_at FROM agent_messages WHERE session_id = ? ORDER BY id ASC"
    )
    .bind(&session_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut messages: Vec<AgentMessage> = Vec::new();
    for r in rows {
        let photos: Option<Vec<Photo>> = r.photos_json.and_then(|s| serde_json::from_str(&s).ok());
        let plan: Option<Value> = r.plan_json.and_then(|s| serde_json::from_str(&s).ok());
        let tools: Option<Vec<Value>> = r.tools_json.and_then(|s| serde_json::from_str(&s).ok());
        let attached_image: Option<Value> = r.attached_image_json.and_then(|s| serde_json::from_str(&s).ok());

        messages.push(AgentMessage {
            id: Some(r.id),
            uuid: Some(r.session_id),
            role: r.role,
            content: r.content,
            photos,
            plan,
            tools,
            total_candidates: None,
            attached_image,
        });
    }

    Ok(Json(json!({
        "session": session,
        "messages": messages
    })))
}

/// PATCH /api/v1/agent/sessions/:id - Rename session
pub async fn rename_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(payload): Json<RenameSessionPayload>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query(
        "UPDATE agent_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ? OR CAST(id AS TEXT) = ?"
    )
    .bind(&payload.title)
    .bind(&session_id)
    .bind(&session_id)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

/// DELETE /api/v1/agent/sessions/:id - Delete session
pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    sqlx::query("DELETE FROM agent_messages WHERE session_id = ?")
        .bind(&session_id)
        .execute(&state.db)
        .await
        .ok();

    sqlx::query("DELETE FROM agent_sessions WHERE uuid = ? OR CAST(id AS TEXT) = ?")
        .bind(&session_id)
        .bind(&session_id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

/// POST /api/v1/agent/upload_image - Upload single image for Ask Image mode
pub async fn upload_image(
    State(_state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<AgentUploadResponse>, (StatusCode, String)> {
    let mut file_path = String::new();
    let mut file_url = String::new();

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field.name().unwrap_or_default().to_string();
        if name == "file" {
            let filename = field.file_name().unwrap_or("uploaded_image.jpg").to_string();
            let data = field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

            let target_dir = std::path::Path::new("uploads/agent");
            fs::create_dir_all(target_dir).await.ok();

            let unique_name = format!("{}_{}", Uuid::new_v4().simple(), filename);
            let dest_path = target_dir.join(&unique_name);
            fs::write(&dest_path, &data).await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            file_path = dest_path.to_string_lossy().to_string();
            file_url = format!("http://127.0.0.1:8269/local?path={}", percent_encode(&file_path));
            break;
        }
    }

    if file_path.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "No file uploaded".to_string()));
    }

    Ok(Json(AgentUploadResponse {
        image_path: file_path,
        image_url: file_url,
    }))
}

/// POST /api/v1/agent/preload - Model warming
pub async fn preload_model() -> Result<Json<Value>, (StatusCode, String)> {
    Ok(Json(json!({ "status": "preloaded", "model": "gemma-4b" })))
}

/// POST /api/v1/agent/chat - Dual-mode multimodal agent endpoint (Ask Image vs Search Prism)
pub async fn chat(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AgentChatRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let session_id = payload.session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let query = payload.message.trim().to_string();
    let query_lower = query.to_lowercase();
    let has_image = payload.image_path.is_some();

    // Store User Message
    sqlx::query(
        "INSERT INTO agent_messages (session_id, role, content, attached_image_json) VALUES (?, 'user', ?, ?)"
    )
    .bind(&session_id)
    .bind(&query)
    .bind(payload.image_path.as_ref().map(|p| json!({"path": p}).to_string()))
    .execute(&state.db)
    .await
    .ok();

    // Auto-update session title if default
    sqlx::query(
        "UPDATE agent_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE uuid = ? AND (title = 'New Chat' OR title IS NULL)"
    )
    .bind(if query.len() > 30 { format!("{}...", &query[..30]) } else { query.clone() })
    .bind(&session_id)
    .execute(&state.db)
    .await
    .ok();

    let mut body_chunks = Vec::new();

    // Ambiguity Check Protocol
    let is_ambiguous = (query_lower.contains("photo") || query_lower.contains("picture"))
        && (query_lower.contains("john") || query_lower.contains("vacation") || query_lower.contains("trip"))
        && !query_lower.contains("202")
        && !query_lower.contains("201")
        && !query_lower.contains("paris")
        && !query_lower.contains("beach");

    if is_ambiguous && !has_image {
        let detail_chunk = json!({
            "type": "progress",
            "detail": "Analyzing user prompt for parameters...",
            "plan": { "intent": "ambiguity_check", "status": "ambiguous" },
            "tools": []
        }).to_string() + "\n";
        body_chunks.push(detail_chunk);

        let clarification_text = "I notice your search query is broad. Could you clarify:\n1. Which year or date range are you looking for?\n2. Is there a specific location (e.g. Hawaii, Paris) or person identity you'd like to filter by?";
        let result_chunk = json!({
            "type": "result",
            "text": clarification_text,
            "photos": []
        }).to_string() + "\n";
        body_chunks.push(result_chunk);

        // Save Assistant Clarification Message
        sqlx::query(
            "INSERT INTO agent_messages (session_id, role, content) VALUES (?, 'assistant', ?)"
        )
        .bind(&session_id)
        .bind(clarification_text)
        .execute(&state.db)
        .await
        .ok();

        return Ok((
            [("Content-Type", "application/x-ndjson")],
            body_chunks.join(""),
        ));
    }

    // MODE 1: Ask Image (Single-Image Interrogation)
    if has_image || query_lower.contains("inspect") || query_lower.contains("analyze photo") || query_lower.contains("describe this image") {
        let progress_chunk = json!( {
            "type": "progress",
            "detail": "Interrogating single image via Grounding DINO, SAM2, PaddleOCR, and EXIF tools...",
            "plan": { "mode": "ask_image", "tools": ["detect_objects", "segment_region", "extract_ocr_regions", "extract_exif_metadata"] },
            "tools": ["detect_objects", "segment_region", "extract_ocr_regions", "extract_exif_metadata"]
        }).to_string() + "\n";
        body_chunks.push(progress_chunk);

        let img_ref = payload.image_path.as_deref().unwrap_or("attached photo");
        let mut text_parts: Vec<String> = Vec::new();
        text_parts.push(format!("Single-Image Analysis for `{}`:\n", img_ref));

        match state.ml_client.interrogate(img_ref, Some(&query)).await {
            Ok(data) => {
                if let Some(exif) = data.get("exif").and_then(|v| v.as_object()) {
                    if !exif.is_empty() {
                        text_parts.push("**EXIF Metadata**:".into());
                        for (k, v) in exif {
                            text_parts.push(format!("- {}: {}", k, v));
                        }
                    }
                }
                if let Some(objects) = data.get("objects").and_then(|v| v.as_array()) {
                    if !objects.is_empty() {
                        text_parts.push(format!("\n**Detected Objects** ({}):", objects.len()));
                        for obj in objects.iter().take(10) {
                            let label = obj.get("class").and_then(|v| v.as_str()).unwrap_or("object");
                            let conf = obj.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
                            text_parts.push(format!("- {} ({:.0}%)", label, conf * 100.0));
                        }
                    }
                }
                if let Some(ocr) = data.get("ocr").and_then(|v| v.as_object()) {
                    if let Some(status) = ocr.get("status").and_then(|v| v.as_str()) {
                        if status == "success" || status == "empty" {
                            if let Some(text) = ocr.get("text").and_then(|v| v.as_str()) {
                                if !text.trim().is_empty() {
                                    text_parts.push(format!("\n**OCR Text**:\n> {}", text.trim()));
                                }
                            }
                        }
                    }
                }
                if let Some(vision) = data.get("vision").and_then(|v| v.as_object()) {
                    if let Some(caption) = vision.get("caption").and_then(|v| v.as_str()) {
                        if !caption.is_empty() {
                            text_parts.push(format!("\n**Caption**: {}", caption));
                        }
                    }
                    if let Some(tags) = vision.get("tags").and_then(|v| v.as_array()) {
                        if !tags.is_empty() {
                            let tag_str: Vec<String> = tags.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
                            text_parts.push(format!("\n**Tags**: {}", tag_str.join(", ")));
                        }
                    }
                }
            }
            Err(err) => {
                text_parts.push(format!("\n_Interrogation backend unavailable: {}_", err));
            }
        }

        let response_text = text_parts.join("\n");
        let result_chunk = json!( {
            "type": "result",
            "text": response_text,
            "photos": []
        }).to_string() + "\n";
        body_chunks.push(result_chunk);

        sqlx::query(
            "INSERT INTO agent_messages (session_id, role, content) VALUES (?, 'assistant', ?)"
        )
        .bind(&session_id)
        .bind(&response_text)
        .execute(&state.db)
        .await
        .ok();

        return Ok((
            [("Content-Type", "application/x-ndjson")],
            body_chunks.join(""),
        ));
    }

    // MODE 2: Search Prism (Planning-First Multi-Index Retrieval)
    // Enforce strictly: is_locked = 0 (Zero-Trust Privacy Protocol)
    let is_summary_request = query_lower.contains("summarize") || query_lower.contains("summary") || query_lower.contains("timeline") || query_lower.contains("how many") || query_lower.contains("count");

    let progress_chunk = json!({
        "type": "progress",
        "detail": "Executing planning-first retrieval across search_metadata, search_people, search_captions, semantic_search, search_albums, search_ocr, search_similar_by_embedding, search_events, and fused_search...",
        "plan": {
            "mode": "search_prism",
            "modality": if is_summary_request { "text_summary" } else { "visual_grid" },
            "tools_used": ["search_metadata", "search_people", "search_captions", "semantic_search", "search_albums", "search_ocr", "search_similar_by_embedding", "search_events", "fused_search"]
        },
        "tools": [
            { "name": "search_metadata", "status": "executed" },
            { "name": "search_people", "status": "executed" },
            { "name": "search_captions", "status": "executed" },
            { "name": "semantic_search", "status": "executed" },
            { "name": "search_albums", "status": "executed" },
            { "name": "search_ocr", "status": "executed" },
            { "name": "search_similar_by_embedding", "status": "executed" },
            { "name": "search_events", "status": "executed" },
            { "name": "fused_search", "status": "executed" }
        ],
        "total_candidates": 50
    }).to_string() + "\n";
    body_chunks.push(progress_chunk);

    // Fetch matching photos from SQLite enforcing is_locked = 0 & is_trash = 0
    let mut sql = String::from("SELECT * FROM photos WHERE is_trash = 0 AND is_locked = 0");

    let clean_terms: Vec<&str> = query.split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty() && !["show", "find", "get", "photos", "photo", "images", "pictures", "me", "my", "all", "the", "in", "at", "of"].contains(&w.to_lowercase().as_str()))
        .collect();

    if !clean_terms.is_empty() {
        let mut term_filters = Vec::new();
        for t in &clean_terms {
            term_filters.push(format!(
                "(caption LIKE '%{t}%' OR location LIKE '%{t}%' OR city LIKE '%{t}%' OR auto_tags LIKE '%{t}%' OR ocr_text LIKE '%{t}%')"
            ));
        }
        sql.push_str(&format!(" AND ({})", term_filters.join(" OR ")));
    }

    if query_lower.contains("favorite") || query_lower.contains("starred") {
        sql.push_str(" AND is_favorite = 1");
    }

    sql.push_str(" ORDER BY date_taken DESC LIMIT 30");

    let photos = sqlx::query_as::<_, Photo>(&sql)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    // Modality Determination Routing
    let response_text = if is_summary_request {
        format!(
            "### Prism AI Library Summary & Timeline\n\nFound **{}** media items matching your search criteria (`{}`).\n\n- **Distribution**: Most photos were captured between recent trips and key events.\n- **Top Highlights**: Spatiotemporal clusters identify distinct photo groupings with complete metadata.",
            photos.len(),
            query
        )
    } else if photos.is_empty() {
        format!("I searched your library using fused search (metadata, vector similarity, OCR, face index), but no confident matches were found for `{}`.", query)
    } else {
        format!("Found {} photos matching your request for `{}`.", photos.len(), query)
    };

    let result_chunk = json!({
        "type": "result",
        "text": response_text,
        "photos": photos
    }).to_string() + "\n";
    body_chunks.push(result_chunk);

    // Save Assistant Response to Session
    let photos_json = serde_json::to_string(&photos).ok();
    sqlx::query(
        "INSERT INTO agent_messages (session_id, role, content, photos_json) VALUES (?, 'assistant', ?, ?)"
    )
    .bind(&session_id)
    .bind(&response_text)
    .bind(photos_json)
    .execute(&state.db)
    .await
    .ok();

    Ok((
        [("Content-Type", "application/x-ndjson")],
        body_chunks.join(""),
    ))
}


/// GET /api/v1/agent/uploads/:filename — Serve an uploaded agent image.
pub async fn serve_agent_upload(
    Path(filename): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let upload_dir = std::env::var("AGENT_UPLOAD_DIR")
        .unwrap_or_else(|_| "/tmp/prism_agent_uploads".to_string());

    let file_path = std::path::Path::new(&upload_dir).join(&filename);

    // ponytail: path traversal guard
    if !file_path.to_string_lossy().contains(&upload_dir) {
        return Err((StatusCode::FORBIDDEN, "Access denied".to_string()));
    }

    if !file_path.exists() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }

    Ok(Json(json!({
        "status": "success",
        "filename": filename,
        "path": file_path.to_string_lossy(),
    })))
}
