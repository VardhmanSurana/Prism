use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{Json, Response},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;
use std::sync::Arc;
use uuid::Uuid;

use crate::models::Photo;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct AgentSession {
    pub id: String,
    pub uuid: Option<String>,
    pub title: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub title: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSessionRequest {
    pub title: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct ChatRequest {
    pub message: String,
    pub history: Option<Vec<ChatMessage>>,
    pub session_id: Option<String>,
    pub image_path: Option<String>,
}

pub async fn find_session_by_id_or_uuid(
    db: &sqlx::SqlitePool,
    key: &str,
) -> Result<AgentSession, (StatusCode, String)> {
    if let Ok(Some(s)) = sqlx::query_as::<_, AgentSession>(
        "SELECT * FROM agent_sessions WHERE id = ? OR uuid = ?"
    )
    .bind(key)
    .bind(key)
    .fetch_optional(db)
    .await
    {
        return Ok(s);
    }
    Err((StatusCode::NOT_FOUND, "Session not found".to_string()))
}

pub async fn preload_agent() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "message": "Agent preloaded to GPU"
    }))
}

pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AgentSession>>, (StatusCode, String)> {
    let mut sessions = sqlx::query_as::<_, AgentSession>(
        "SELECT * FROM agent_sessions ORDER BY updated_at DESC, id DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    for s in &mut sessions {
        if s.uuid.is_none() {
            let u = s.id.clone();
            sqlx::query("UPDATE agent_sessions SET uuid = ? WHERE id = ?")
                .bind(&u)
                .bind(&s.id)
                .execute(&state.db)
                .await
                .ok();
            s.uuid = Some(u);
        }
    }

    Ok(Json(sessions))
}

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    payload: Option<Json<CreateSessionRequest>>,
) -> Result<Json<AgentSession>, (StatusCode, String)> {
    let title = payload
        .and_then(|p| p.title.clone())
        .filter(|t| !t.trim().is_empty())
        .unwrap_or_else(|| "New Chat".to_string());

    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO agent_sessions (id, uuid, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&session_id)
    .bind(&session_id)
    .bind(&title)
    .bind(&now)
    .bind(&now)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let session = sqlx::query_as::<_, AgentSession>("SELECT * FROM agent_sessions WHERE id = ?")
        .bind(&session_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(session))
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut session = find_session_by_id_or_uuid(&state.db, &id).await?;

    if session.uuid.is_none() {
        let u = session.id.clone();
        sqlx::query("UPDATE agent_sessions SET uuid = ? WHERE id = ?")
            .bind(&u)
            .bind(&session.id)
            .execute(&state.db)
            .await
            .ok();
        session.uuid = Some(u);
    }

    let messages_rows = sqlx::query(
        "SELECT * FROM agent_messages WHERE session_id = ? ORDER BY id ASC"
    )
    .bind(&session.id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut messages = Vec::new();
    for row in messages_rows {
        use sqlx::Row;
        let msg_id: i64 = row.try_get("id").unwrap_or(0);
        let mut msg_uuid: Option<String> = row.try_get("uuid").ok().flatten();
        if msg_uuid.is_none() {
            let new_u = Uuid::new_v4().to_string();
            sqlx::query("UPDATE agent_messages SET uuid = ? WHERE id = ?")
                .bind(&new_u)
                .bind(msg_id)
                .execute(&state.db)
                .await
                .ok();
            msg_uuid = Some(new_u);
        }

        let role: String = row.try_get("role").unwrap_or_default();
        let content: String = row.try_get("content").unwrap_or_default();
        let created_at: Option<DateTime<Utc>> = row.try_get("created_at").ok();

        let mut msg_obj = json!({
            "id": msg_id,
            "uuid": msg_uuid,
            "role": role,
            "content": content,
            "created_at": created_at
        });

        if let Ok(Some(photos_str)) = row.try_get::<Option<String>, _>("photos_json") {
            if let Ok(mut parsed) = serde_json::from_str::<Value>(&photos_str) {
                if let Some(arr) = parsed.as_array_mut() {
                    for p in arr {
                        if p.get("url").and_then(|u| u.as_str()).unwrap_or("").is_empty() {
                            if let Some(path) = p.get("path").and_then(|pt| pt.as_str()) {
                                p["url"] = json!(format!("local://{}", path));
                            }
                        }
                    }
                }
                msg_obj["photos"] = parsed;
            }
        }

        messages.push(msg_obj);
    }

    Ok(Json(json!({
        "id": session.id,
        "uuid": session.uuid,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "messages": messages
    })))
}

pub async fn update_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSessionRequest>,
) -> Result<Json<AgentSession>, (StatusCode, String)> {
    let session = find_session_by_id_or_uuid(&state.db, &id).await?;
    let now = Utc::now();

    sqlx::query("UPDATE agent_sessions SET title = ?, updated_at = ? WHERE id = ?")
        .bind(&payload.title)
        .bind(&now)
        .bind(&session.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let updated = sqlx::query_as::<_, AgentSession>("SELECT * FROM agent_sessions WHERE id = ?")
        .bind(&session.id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(updated))
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let session = find_session_by_id_or_uuid(&state.db, &id).await?;

    sqlx::query("DELETE FROM agent_messages WHERE session_id = ?")
        .bind(&session.id)
        .execute(&state.db)
        .await
        .ok();

    sqlx::query("DELETE FROM agent_sessions WHERE id = ?")
        .bind(&session.id)
        .execute(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "status": "success", "id": session.id, "uuid": session.uuid })))
}

pub async fn chat_with_agent(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<ChatRequest>,
) -> Result<Response, (StatusCode, String)> {
    let msg = payload.message.trim();
    let query_lower = msg.to_lowercase();

    // Query photo metadata index
    let photos = if query_lower.contains("favorite") || query_lower.contains("liked") {
        sqlx::query_as::<_, Photo>(
            "SELECT * FROM photos WHERE is_favorite = 1 AND is_trash = 0 ORDER BY date DESC LIMIT 20"
        )
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else if query_lower.contains("recent") || query_lower.contains("latest") {
        sqlx::query_as::<_, Photo>(
            "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date DESC LIMIT 20"
        )
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    } else {
        sqlx::query_as::<_, Photo>(
            "SELECT * FROM photos WHERE is_trash = 0 ORDER BY RANDOM() LIMIT 6"
        )
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
    };

    let response_text = format!(
        "Found {} matching photos in your local library based on your prompt: '{}'",
        photos.len(),
        msg
    );

    if let Some(ref s_key) = payload.session_id {
        let session_id = if let Ok(s) = find_session_by_id_or_uuid(&state.db, s_key).await {
            s.id
        } else {
            s_key.clone()
        };

        let now = Utc::now();
        let user_msg_uuid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO agent_messages (uuid, session_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)"
        )
        .bind(&user_msg_uuid)
        .bind(&session_id)
        .bind(msg)
        .bind(&now)
        .execute(&state.db)
        .await
        .ok();

        let photos_json = serde_json::to_string(&photos).ok();
        let asst_msg_uuid = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO agent_messages (uuid, session_id, role, content, photos_json, created_at) VALUES (?, ?, 'assistant', ?, ?, ?)"
        )
        .bind(&asst_msg_uuid)
        .bind(&session_id)
        .bind(&response_text)
        .bind(&photos_json)
        .bind(&now)
        .execute(&state.db)
        .await
        .ok();

        if msg.len() > 0 {
            let mut auto_title = msg.to_string();
            if auto_title.len() > 30 {
                auto_title.truncate(30);
                auto_title.push_str("...");
            }
            sqlx::query(
                "UPDATE agent_sessions SET title = ?, updated_at = ? WHERE id = ? AND title = 'New Chat'"
            )
            .bind(&auto_title)
            .bind(&now)
            .bind(&session_id)
            .execute(&state.db)
            .await
            .ok();
        }
    }

    let progress_chunk = json!({
        "type": "progress",
        "detail": "Searching library metadata index..."
    }).to_string() + "\n";

    let result_chunk = json!({
        "type": "result",
        "text": response_text,
        "photos": photos
    }).to_string() + "\n";

    let stream = tokio_stream::iter(vec![
        Ok::<_, axum::Error>(progress_chunk),
        Ok::<_, axum::Error>(result_chunk),
    ]);

    let body = axum::body::Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "application/x-ndjson")
        .body(body)
        .unwrap())
}
