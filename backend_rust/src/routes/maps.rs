use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::{Path as StdPath, PathBuf};
use std::sync::{Arc, LazyLock};
use tokio::sync::RwLock;
use tracing::{debug, info};

use crate::AppState;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct CacheProgress {
    pub is_downloading: bool,
    pub total: usize,
    pub completed: usize,
    pub failed: usize,
    pub provider: String,
    pub message: String,
}

static CACHE_PROGRESS: LazyLock<Arc<RwLock<CacheProgress>>> =
    LazyLock::new(|| Arc::new(RwLock::new(CacheProgress::default())));

/// Helper: converts lat/lon coordinates to Slippy Map tile (x, y) at a given zoom level.
pub fn lat_lon_to_tile(lat: f64, lon: f64, zoom: u32) -> (u32, u32) {
    let n = 2.0_f64.powi(zoom as i32);
    let x = (((lon + 180.0) / 360.0) * n).clamp(0.0, n - 1.0) as u32;
    let lat_rad = lat.clamp(-85.05112878, 85.05112878).to_radians();
    let y = (((1.0 - lat_rad.tan().asinh() / std::f64::consts::PI) / 2.0) * n).clamp(0.0, n - 1.0)
        as u32;
    (x, y)
}

fn get_upstream_url(provider: &str, z: u32, x: u32, y: u32) -> Option<String> {
    match provider {
        "osm" => Some(format!("https://tile.openstreetmap.org/{z}/{x}/{y}.png")),
        "satellite" => Some(format!(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        )),
        "topo" => Some(format!("https://tile.opentopomap.org/{z}/{x}/{y}.png")),
        "cycle" => Some(format!(
            "https://tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
        )),
        _ => None,
    }
}

/// GET /api/v1/maps/tiles/:provider/:z/:x/:y
/// Serves a map tile from local disk cache if available; otherwise proxies from upstream,
/// persists it to disk for offline use, and returns the image.
pub async fn get_tile(
    State(state): State<Arc<AppState>>,
    Path((provider, z_str, x_str, y_str)): Path<(String, String, String, String)>,
) -> Response {
    let z: u32 = match z_str.parse() {
        Ok(v) if v <= 19 => v,
        _ => return StatusCode::BAD_REQUEST.into_response(),
    };
    let x: u32 = match x_str.parse() {
        Ok(v) => v,
        _ => return StatusCode::BAD_REQUEST.into_response(),
    };
    let clean_y = y_str.trim_end_matches(".png");
    let y: u32 = match clean_y.parse() {
        Ok(v) => v,
        _ => return StatusCode::BAD_REQUEST.into_response(),
    };

    let upstream_url = match get_upstream_url(&provider, z, x, y) {
        Some(url) => url,
        None => return StatusCode::BAD_REQUEST.into_response(),
    };

    let tile_path = state
        .config
        .map_cache_dir
        .join(&provider)
        .join(z.to_string())
        .join(x.to_string())
        .join(format!("{y}.png"));

    // 1. Check disk cache
    if tile_path.is_file() {
        if let Ok(bytes) = tokio::fs::read(&tile_path).await {
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/png"));
            headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=2592000, immutable"),
            );
            return (StatusCode::OK, headers, bytes).into_response();
        }
    }

    // 2. Not in disk cache: fetch from upstream
    let client = reqwest::Client::builder()
        .user_agent("Prism-Desktop/1.0 (local-first photo library)")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .unwrap_or_default();

    match client.get(&upstream_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            let bytes = match resp.bytes().await {
                Ok(b) => b,
                Err(_) => return StatusCode::BAD_GATEWAY.into_response(),
            };

            // Save to disk asynchronously
            let write_path = tile_path.clone();
            let write_bytes = bytes.clone();
            tokio::spawn(async move {
                if let Some(parent) = write_path.parent() {
                    tokio::fs::create_dir_all(parent).await.ok();
                }
                tokio::fs::write(&write_path, &write_bytes).await.ok();
            });

            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/png"));
            headers.insert(
                header::CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=2592000, immutable"),
            );
            (StatusCode::OK, headers, bytes).into_response()
        }
        Ok(resp) => (resp.status(), "Upstream tile error").into_response(),
        Err(e) => {
            debug!("Map tile fetch failed (offline or network error): {}", e);
            StatusCode::GATEWAY_TIMEOUT.into_response()
        }
    }
}

fn calculate_dir_stats(dir: &StdPath) -> (usize, u64) {
    let mut count = 0;
    let mut size = 0;
    if !dir.exists() {
        return (0, 0);
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let (sub_count, sub_size) = calculate_dir_stats(&path);
                count += sub_count;
                size += sub_size;
            } else if path.is_file() {
                count += 1;
                if let Ok(meta) = entry.metadata() {
                    size += meta.len();
                }
            }
        }
    }
    (count, size)
}

/// GET /api/v1/maps/cache/stats
/// Returns the number of cached tiles and total disk space used.
pub async fn get_cache_stats(State(state): State<Arc<AppState>>) -> Json<Value> {
    let cache_dir = state.config.map_cache_dir.clone();
    let (tile_count, size_bytes) =
        tokio::task::spawn_blocking(move || calculate_dir_stats(&cache_dir))
            .await
            .unwrap_or((0, 0));

    let size_mb = (size_bytes as f64) / (1024.0 * 1024.0);

    Json(json!({
        "tile_count": tile_count,
        "size_bytes": size_bytes,
        "size_human": format!("{:.1} MB", size_mb)
    }))
}

/// GET /api/v1/maps/cache/progress
/// Returns progress of an active offline tile download job.
pub async fn get_cache_progress() -> Json<CacheProgress> {
    let prog = CACHE_PROGRESS.read().await;
    Json(prog.clone())
}

/// POST /api/v1/maps/cache/clear
/// Deletes all cached map tiles from disk.
pub async fn clear_cache(State(state): State<Arc<AppState>>) -> Result<Json<Value>, StatusCode> {
    let cache_dir = state.config.map_cache_dir.clone();
    tokio::task::spawn_blocking(move || {
        if cache_dir.exists() {
            let _ = std::fs::remove_dir_all(&cache_dir);
            let _ = std::fs::create_dir_all(&cache_dir);
        }
    })
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "status": "cleared" })))
}

fn spawn_tile_download_task(
    uncached: Vec<(u32, u32, u32)>,
    provider: String,
    cache_dir: PathBuf,
    label: &'static str,
) {
    let total = uncached.len();
    tokio::spawn(async move {
        {
            let mut prog = CACHE_PROGRESS.write().await;
            prog.is_downloading = true;
            prog.total = total;
            prog.completed = 0;
            prog.failed = 0;
            prog.provider = provider.clone();
            prog.message = format!("Downloading {total} {label} tiles...");
        }

        let client = reqwest::Client::builder()
            .user_agent("Prism-Desktop/1.0 (local-first photo library)")
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default();

        let semaphore = Arc::new(tokio::sync::Semaphore::new(4));

        for (z, x, y) in uncached {
            let permit = match semaphore.clone().acquire_owned().await {
                Ok(p) => p,
                Err(_) => break,
            };

            let client = client.clone();
            let provider = provider.clone();
            let cache_dir = cache_dir.clone();

            tokio::spawn(async move {
                let _permit = permit;
                let url = get_upstream_url(&provider, z, x, y);
                let mut success = false;
                if let Some(upstream_url) = url {
                    if let Ok(resp) = client.get(&upstream_url).send().await {
                        if resp.status().is_success() {
                            if let Ok(bytes) = resp.bytes().await {
                                let write_path = cache_dir
                                    .join(&provider)
                                    .join(z.to_string())
                                    .join(x.to_string())
                                    .join(format!("{y}.png"));
                                if let Some(parent) = write_path.parent() {
                                    tokio::fs::create_dir_all(parent).await.ok();
                                }
                                if tokio::fs::write(&write_path, &bytes).await.is_ok() {
                                    success = true;
                                }
                            }
                        }
                    }
                }

                let mut prog = CACHE_PROGRESS.write().await;
                if success {
                    prog.completed += 1;
                } else {
                    prog.failed += 1;
                }
                prog.message = format!(
                    "Downloading {label}: {} / {} completed",
                    prog.completed, prog.total
                );
            });

            tokio::time::sleep(std::time::Duration::from_millis(30)).await;
        }

        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        {
            let mut prog = CACHE_PROGRESS.write().await;
            prog.is_downloading = false;
            prog.message = format!(
                "Offline map download complete! ({} downloaded, {} failed)",
                prog.completed, prog.failed
            );
        }
        info!("Offline map cache download finished");
    });
}

#[derive(Deserialize)]
pub struct CachePhotosRequest {
    pub provider: Option<String>,
    pub min_zoom: Option<u32>,
    pub max_zoom: Option<u32>,
}

/// POST /api/v1/maps/cache/photos
/// Pre-downloads and stores tiles for all photos that have GPS coordinates.
pub async fn cache_photos(
    State(state): State<Arc<AppState>>,
    payload: Option<Json<CachePhotosRequest>>,
) -> Result<Json<Value>, StatusCode> {
    {
        let prog = CACHE_PROGRESS.read().await;
        if prog.is_downloading {
            return Ok(Json(json!({
                "status": "already_running",
                "message": "A map download job is already in progress."
            })));
        }
    }

    let (provider, min_zoom, max_zoom) = match payload {
        Some(Json(p)) => (
            p.provider.unwrap_or_else(|| "osm".to_string()),
            p.min_zoom.unwrap_or(2).clamp(1, 15),
            p.max_zoom.unwrap_or(12).clamp(2, 16),
        ),
        None => ("osm".to_string(), 2, 12),
    };

    // Query distinct latitude & longitude from photos
    let rows: Vec<(f64, f64)> = sqlx::query_as::<_, (f64, f64)>(
        "SELECT DISTINCT latitude, longitude FROM photos WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_trash = 0"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    if rows.is_empty() {
        return Ok(Json(json!({
            "status": "empty",
            "message": "No geotagged photos found to download maps for."
        })));
    }

    let mut tiles_to_download: HashSet<(u32, u32, u32)> = HashSet::new();

    // 1. Always include global low zoom levels (0 to 3) for smooth navigation
    for z in 0..=3 {
        let max_coord = 1u32 << z;
        for x in 0..max_coord {
            for y in 0..max_coord {
                tiles_to_download.insert((z, x, y));
            }
        }
    }

    // 2. Add tiles around each photo from min_zoom to max_zoom
    for (lat, lon) in rows {
        for z in min_zoom..=max_zoom {
            let (cx, cy) = lat_lon_to_tile(lat, lon, z);
            // Include surrounding 3x3 block at higher zooms for context
            let radius: i32 = if z >= 10 { 1 } else { 0 };
            for dx in -radius..=radius {
                for dy in -radius..=radius {
                    let nx = (cx as i32 + dx).clamp(0, (1 << z) - 1) as u32;
                    let ny = (cy as i32 + dy).clamp(0, (1 << z) - 1) as u32;
                    tiles_to_download.insert((z, nx, ny));
                }
            }
        }
    }

    // Filter out tiles that already exist on disk
    let cache_dir = state.config.map_cache_dir.clone();
    let mut uncached: Vec<(u32, u32, u32)> = Vec::new();
    for (z, x, y) in tiles_to_download {
        let path = cache_dir
            .join(&provider)
            .join(z.to_string())
            .join(x.to_string())
            .join(format!("{y}.png"));
        if !path.is_file() {
            uncached.push((z, x, y));
        }
    }

    let total = uncached.len();
    if total == 0 {
        return Ok(Json(json!({
            "status": "complete",
            "total_tiles": 0,
            "message": "All tiles for photo locations are already cached offline."
        })));
    }

    spawn_tile_download_task(uncached, provider, cache_dir, "photo locations");

    Ok(Json(json!({
        "status": "started",
        "total_queued": total,
        "message": format!("Started caching {total} tiles for photo locations.")
    })))
}

#[derive(Deserialize)]
pub struct CacheAreaRequest {
    pub min_lat: f64,
    pub max_lat: f64,
    pub min_lng: f64,
    pub max_lng: f64,
    pub min_zoom: Option<u32>,
    pub max_zoom: Option<u32>,
    pub provider: Option<String>,
}

/// POST /api/v1/maps/cache/area
/// Pre-downloads map tiles for a specified bounding box.
pub async fn cache_area(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CacheAreaRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    {
        let prog = CACHE_PROGRESS.read().await;
        if prog.is_downloading {
            return Ok(Json(json!({
                "status": "already_running",
                "message": "A map download job is already in progress."
            })));
        }
    }

    let provider = payload.provider.unwrap_or_else(|| "osm".to_string());
    let min_zoom = payload.min_zoom.unwrap_or(3).clamp(1, 15);
    let max_zoom = payload.max_zoom.unwrap_or(12).clamp(1, 15);

    if min_zoom > max_zoom {
        return Err((
            StatusCode::BAD_REQUEST,
            "min_zoom cannot be greater than max_zoom".to_string(),
        ));
    }

    let mut tiles_to_download: HashSet<(u32, u32, u32)> = HashSet::new();

    for z in min_zoom..=max_zoom {
        let (x1, y1) = lat_lon_to_tile(payload.max_lat, payload.min_lng, z);
        let (x2, y2) = lat_lon_to_tile(payload.min_lat, payload.max_lng, z);
        let min_x = x1.min(x2);
        let max_x = x1.max(x2);
        let min_y = y1.min(y2);
        let max_y = y1.max(y2);

        for x in min_x..=max_x {
            for y in min_y..=max_y {
                tiles_to_download.insert((z, x, y));
                if tiles_to_download.len() > 2500 {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        "Selected area contains too many tiles (> 2,500). Please select a smaller area or lower maximum zoom level.".to_string(),
                    ));
                }
            }
        }
    }

    let cache_dir = state.config.map_cache_dir.clone();
    let mut uncached = Vec::new();
    for (z, x, y) in tiles_to_download {
        let path = cache_dir
            .join(&provider)
            .join(z.to_string())
            .join(x.to_string())
            .join(format!("{y}.png"));
        if !path.is_file() {
            uncached.push((z, x, y));
        }
    }

    let total = uncached.len();
    if total == 0 {
        return Ok(Json(json!({
            "status": "complete",
            "message": "All tiles for this area are already cached offline."
        })));
    }

    spawn_tile_download_task(uncached, provider, cache_dir, "area");

    Ok(Json(json!({
        "status": "started",
        "total_queued": total,
        "message": format!("Started downloading {total} tiles for area.")
    })))
}
