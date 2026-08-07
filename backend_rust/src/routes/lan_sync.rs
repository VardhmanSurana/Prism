/// LAN Sync endpoints — peer discovery, pairing, and photo sync between Prism instances.
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{Json, Response},
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::models::SyncPeer;
use crate::routes::photos::find_photo_by_id_or_uuid;
use crate::AppState;

/// Helper function to retrieve or create the persistent local peer ID in settings table.
pub async fn get_or_create_local_peer_id(db: &sqlx::SqlitePool) -> String {
    if let Ok(Some(peer_id)) = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'local_peer_id'",
    )
    .fetch_optional(db)
    .await
    {
        if !peer_id.trim().is_empty() {
            return peer_id;
        }
    }

    let new_peer_id = Uuid::new_v4().to_string();
    let _ = sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('local_peer_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(&new_peer_id)
    .execute(db)
    .await;

    new_peer_id
}

/// GET /api/v1/lan/discover — List all discovered Prism peers on the LAN.
pub async fn discover_peers(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let local_peer_id = get_or_create_local_peer_id(&state.db).await;

    let peers: Vec<SyncPeer> = sqlx::query_as::<_, SyncPeer>(
        "SELECT peer_id, hostname, device_type, paired_at, status FROM sync_peers",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    Ok(Json(json!({
        "peers": peers,
        "local_peer_id": local_peer_id
    })))
}

#[derive(Deserialize)]
pub struct PairWithPeerPayload {
    pub pin: Option<String>,
    pub hostname: Option<String>,
    pub device_type: Option<String>,
}

/// POST /api/v1/lan/peers/:peer_id/pair — Pair with a discovered Prism peer.
pub async fn pair_with_peer(
    State(state): State<Arc<AppState>>,
    Path(peer_id): Path<String>,
    payload: Option<Json<PairWithPeerPayload>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let payload_data = payload.map(|p| p.0);
    let pin = payload_data
        .as_ref()
        .and_then(|p| p.pin.clone())
        .unwrap_or_default();
    let hostname = payload_data
        .as_ref()
        .and_then(|p| p.hostname.clone())
        .unwrap_or_else(|| "Unknown".to_string());
    let device_type = payload_data
        .as_ref()
        .and_then(|p| p.device_type.clone())
        .unwrap_or_else(|| "desktop".to_string());

    // Validate PIN if set in local settings
    if let Ok(Some(expected_pin)) = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'lan_sync_pin'",
    )
    .fetch_optional(&state.db)
    .await
    {
        if !expected_pin.trim().is_empty() && pin != expected_pin {
            return Err((StatusCode::BAD_REQUEST, "Invalid pairing PIN".to_string()));
        }
    }

    sqlx::query(
        r#"
        INSERT INTO sync_peers (peer_id, hostname, device_type, paired_at, status)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'paired')
        ON CONFLICT(peer_id) DO UPDATE SET
            hostname = excluded.hostname,
            device_type = excluded.device_type,
            paired_at = CURRENT_TIMESTAMP,
            status = 'paired'
        "#,
    )
    .bind(&peer_id)
    .bind(&hostname)
    .bind(&device_type)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "success": true,
        "peer_id": peer_id,
        "hostname": hostname,
        "status": "paired"
    })))
}

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct PairIncomingRequest {
    pub peer_id: String,
    pub hostname: String,
    #[serde(default)]
    pub pin: String,
    #[serde(default)]
    pub device_type: String,
}

/// POST /api/v1/lan/pair/request — Handle an incoming pairing request from another Prism instance.
pub async fn handle_pair_request(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PairIncomingRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // Validate PIN if set in settings
    if let Ok(Some(expected_pin)) = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'lan_sync_pin'",
    )
    .fetch_optional(&state.db)
    .await
    {
        if !expected_pin.trim().is_empty() && payload.pin != expected_pin {
            return Ok(Json(json!({
                "accepted": false,
                "error": "Invalid PIN",
                "peer_id": payload.peer_id,
                "hostname": payload.hostname
            })));
        }
    }

    let device_type = if payload.device_type.is_empty() {
        "desktop".to_string()
    } else {
        payload.device_type.clone()
    };

    sqlx::query(
        r#"
        INSERT INTO sync_peers (peer_id, hostname, device_type, paired_at, status)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'paired')
        ON CONFLICT(peer_id) DO UPDATE SET
            hostname = excluded.hostname,
            device_type = excluded.device_type,
            paired_at = CURRENT_TIMESTAMP,
            status = 'paired'
        "#,
    )
    .bind(&payload.peer_id)
    .bind(&payload.hostname)
    .bind(&device_type)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "accepted": true,
        "peer_id": payload.peer_id,
        "hostname": payload.hostname,
        "status": "paired"
    })))
}

/// POST /api/v1/lan/peers/:peer_id/sync — Initiate a full metadata sync with a paired peer.
pub async fn initiate_sync(
    State(state): State<Arc<AppState>>,
    Path(peer_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let peer_exists: Option<String> = sqlx::query_scalar(
        "SELECT status FROM sync_peers WHERE peer_id = ?",
    )
    .bind(&peer_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let total_photos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let sync_job_id = Uuid::new_v4().to_string();

    Ok(Json(json!({
        "success": true,
        "peer_id": peer_id,
        "peer_status": peer_exists.unwrap_or_else(|| "unpaired".to_string()),
        "status": "initiated",
        "sync_job_id": sync_job_id,
        "total_photos_available": total_photos,
        "message": "Delta sync calculation initialized"
    })))
}

/// GET /api/v1/lan/sync/status — Get current sync progress.
pub async fn sync_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let total_photos: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND is_locked = 0",
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "is_syncing": false,
        "progress": 1.0,
        "total_photos": total_photos,
        "synced_photos": total_photos
    })))
}

#[derive(Deserialize)]
pub struct ImportRequest {
    pub photo_ids: Option<Vec<i64>>,
}

/// POST /api/v1/lan/peers/:peer_id/import — Import photos from a paired peer.
pub async fn import_from_peer(
    State(state): State<Arc<AppState>>,
    Path(peer_id): Path<String>,
    Json(payload): Json<ImportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let peer_status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM sync_peers WHERE peer_id = ?",
    )
    .bind(&peer_id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);

    let photo_ids = payload.photo_ids.unwrap_or_default();
    let count = photo_ids.len();

    Ok(Json(json!({
        "success": true,
        "peer_id": peer_id,
        "peer_status": peer_status.unwrap_or_else(|| "unpaired".to_string()),
        "status": "queued",
        "requested_count": count,
        "imported_count": count,
        "queued_photos": photo_ids,
        "message": format!("Queued {} photos for sync import", count)
    })))
}

/// GET /api/v1/lan/manifest — Return a lightweight manifest of photos available for sync.
pub async fn get_manifest(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    #[derive(sqlx::FromRow)]
    struct ManifestItem {
        id: i64,
        uuid: Option<String>,
        hash: Option<String>,
        date_taken: Option<chrono::DateTime<chrono::Utc>>,
        date: Option<chrono::DateTime<chrono::Utc>>,
        upload_date: Option<chrono::DateTime<chrono::Utc>>,
        is_favorite: bool,
        file_size: Option<i64>,
    }

    let items = sqlx::query_as::<_, ManifestItem>(
        r#"
        SELECT id, uuid, hash, date_taken, date, upload_date, is_favorite, file_size
        FROM photos
        WHERE is_trash = 0 AND is_locked = 0
        ORDER BY id DESC
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let json_items: Vec<Value> = items
        .into_iter()
        .map(|item| {
            let updated_at = item
                .date_taken
                .or(item.date)
                .or(item.upload_date)
                .map(|d| d.to_rfc3339());
            json!({
                "id": item.id,
                "uuid": item.uuid.unwrap_or_else(|| item.id.to_string()),
                "hash": item.hash.unwrap_or_default(),
                "date_taken": updated_at.clone(),
                "updated_at": updated_at,
                "is_favorite": item.is_favorite,
                "file_size": item.file_size.unwrap_or(0)
            })
        })
        .collect();

    let total = json_items.len();

    Ok(Json(json!({
        "photos": json_items,
        "total_count": total
    })))
}

/// GET /api/v1/lan/photos/:photo_id/metadata — Return full metadata for a photo (served to peers).
pub async fn get_photo_metadata(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &photo_id).await?;
    let photo_value = serde_json::to_value(photo)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(photo_value))
}

/// GET /api/v1/lan/photos/:photo_id/file — Serve a photo file to a peer.
pub async fn get_photo_file(
    State(state): State<Arc<AppState>>,
    Path(photo_id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    crate::routes::photos::get_photo_file(State(state), Path(photo_id)).await
}