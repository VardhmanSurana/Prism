use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentChatRequest {
    pub message: String,
    pub session_id: Option<String>,
    pub image_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentUploadResponse {
    pub image_path: String,
    pub image_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AgentSession {
    pub id: i64,
    pub uuid: String,
    pub title: String,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AgentMessageRow {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub photos_json: Option<String>,
    pub plan_json: Option<String>,
    pub tools_json: Option<String>,
    pub attached_image_json: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: Option<i64>,
    pub uuid: Option<String>,
    pub role: String,
    pub content: String,
    pub photos: Option<Vec<Photo>>,
    pub plan: Option<serde_json::Value>,
    pub tools: Option<Vec<serde_json::Value>>,
    pub total_candidates: Option<i64>,
    pub attached_image: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Photo {
    pub id: i64,
    pub uuid: Option<String>,
    pub filename: String,
    pub path: String,
    pub url: Option<String>,
    pub width: i64,
    pub height: i64,
    pub aspect_ratio: f64,
    pub hash: Option<String>,
    pub phash: Option<String>,
    pub caption: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location: Option<String>,
    pub date: Option<DateTime<Utc>>,
    pub date_taken: Option<DateTime<Utc>>,
    pub upload_date: Option<DateTime<Utc>>,
    pub is_favorite: bool,
    pub is_locked: bool,
    pub is_trash: bool,
    pub mime_type: String,
    pub file_type: String,
    pub device_id: Option<String>,
    pub is_external: bool,
    pub ai_summary: Option<String>,
    pub auto_tags: Option<String>,
    pub embedding: Option<String>,
    pub ocr_text: Option<String>,
    pub adjustments_json: Option<String>,
    pub blur_score: Option<f64>,
    pub file_size: Option<i64>,
    pub content_type: String,
    pub exif_make: Option<String>,
    pub exif_model: Option<String>,
    pub exif_focal_length: Option<f64>,
    pub exif_iso: Option<i64>,
    pub duration: Option<f64>,
    pub fps: Option<f64>,
    pub codec: Option<String>,
    pub audio_codec: Option<String>,
    pub rotation: Option<i64>,
    pub video_faces_scanned: bool,
    pub animated_url: Option<String>,
    pub event_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Album {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub r#type: String,
    pub is_smart: bool,
    pub smart_type: Option<String>,
    pub cover_url: Option<String>,
    pub photo_count: i64,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Event {
    pub id: i64,
    pub title: String,
    pub event_type: String,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub location: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Person {
    pub id: i64,
    pub uuid: Option<String>,
    pub name: String,
    pub cover_face_thumbnail: Option<String>,
    pub face_embedding: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HealthStatus {
    pub status: String,
    pub service: String,
    pub version: String,
    pub database: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PhotoStatsResponse {
    pub total_photos: i64,
    pub total_videos: i64,
    pub favorites_count: i64,
    pub trash_count: i64,
    pub locked_count: i64,
    pub storage_used_bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
pub struct SyncPeer {
    pub peer_id: String,
    pub hostname: Option<String>,
    pub device_type: Option<String>,
    pub paired_at: Option<DateTime<Utc>>,
    pub status: Option<String>,
}
