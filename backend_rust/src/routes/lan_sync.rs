/// LAN Sync endpoints — peer discovery, pairing, and photo sync between Prism instances.
///
/// TODO: Implement real LAN peer discovery and sync. Currently all endpoints return stubs.
use axum::{
    extract::Path,
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

/// GET /api/v1/lan/discover — List all discovered Prism peers on the LAN.
pub async fn discover_peers() -> Json<Value> {
    // TODO: Implement real peer discovery via UDP broadcast/multicast
    Json(json!({
        "peers": [],
        "local_peer_id": ""
    }))
}

/// POST /api/v1/lan/peers/:peer_id/pair — Pair with a discovered Prism peer.
pub async fn pair_with_peer(
    Path(peer_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real pairing handshake with PIN support
    Ok(Json(json!({
        "success": false,
        "error": "LAN sync not yet implemented in Rust backend",
        "peer_id": peer_id
    })))
}

#[derive(Deserialize)]
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
    Json(payload): Json<PairIncomingRequest>,
) -> Json<Value> {
    // TODO: Implement incoming pair request handling
    Json(json!({
        "accepted": false,
        "peer_id": payload.peer_id,
        "hostname": payload.hostname
    }))
}

/// POST /api/v1/lan/peers/:peer_id/sync — Initiate a full metadata sync with a paired peer.
pub async fn initiate_sync(
    Path(peer_id): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real metadata sync
    Ok(Json(json!({
        "success": false,
        "error": "LAN sync not yet implemented in Rust backend",
        "peer_id": peer_id
    })))
}

/// GET /api/v1/lan/sync/status — Get current sync progress.
pub async fn sync_status() -> Json<Value> {
    // TODO: Implement real sync status tracking
    Json(json!({
        "is_syncing": false,
        "progress": 0,
        "total_photos": 0,
        "synced_photos": 0
    }))
}

#[derive(Deserialize)]
pub struct ImportRequest {
    pub photo_ids: Option<Vec<i64>>,
}

/// POST /api/v1/lan/peers/:peer_id/import — Import photos from a paired peer.
pub async fn import_from_peer(
    Path(peer_id): Path<String>,
    Json(payload): Json<ImportRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real photo import from peer
    Ok(Json(json!({
        "success": false,
        "error": "LAN sync not yet implemented in Rust backend",
        "peer_id": peer_id,
        "requested_count": payload.photo_ids.map(|v| v.len()).unwrap_or(0)
    })))
}

/// GET /api/v1/lan/manifest — Return a lightweight manifest of photos available for sync.
pub async fn get_manifest() -> Json<Value> {
    // TODO: Implement real manifest generation
    Json(json!({
        "photos": [],
        "total_count": 0
    }))
}

/// GET /api/v1/lan/photos/:photo_id/metadata — Return full metadata for a photo (served to peers).
pub async fn get_photo_metadata(
    Path(photo_id): Path<i64>,
) -> Json<Value> {
    // TODO: Implement real metadata serving to peers
    Json(json!({
        "photo_id": photo_id,
        "error": "LAN sync not yet implemented in Rust backend"
    }))
}

/// GET /api/v1/lan/photos/:photo_id/file — Serve a photo file to a peer.
pub async fn get_photo_file(
    Path(photo_id): Path<i64>,
) -> Result<Json<Value>, (StatusCode, String)> {
    // TODO: Implement real file serving to peers
        Err((StatusCode::NOT_IMPLEMENTED, "LAN sync not yet implemented in Rust backend".to_string()))
}