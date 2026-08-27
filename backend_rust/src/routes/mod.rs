pub mod agent;
pub mod albums;
pub mod explore;
pub mod google_import;
pub mod lan_sync;
pub mod nle;
pub mod people;
pub mod photos;
pub mod photos_ai;
pub mod privacy;
pub mod settings;
pub mod shares;
pub mod stories;
pub mod system;
pub mod telemetry_api;
pub mod utilities;
pub mod video;
pub mod auth;
pub mod admin;
pub mod models;

use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, put},
    Json,
    Router,
};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use http_body_util::BodyExt;
use bytes::Bytes;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use crate::AppState;

/// Sample 1 in every N API requests for telemetry logging.
/// Configurable at runtime via settings API. Requests with errors (4xx/5xx) are ALWAYS logged.
/// A value of 1 means log every request; 0 means log nothing (errors still logged).
static TELEM_SAMPLE_RATE: AtomicU64 = AtomicU64::new(10);
static TELEM_COUNTER: AtomicU64 = AtomicU64::new(0);
static TELEM_ENABLED: AtomicBool = AtomicBool::new(true);
static TELEM_RESPONSE_LOGGING: AtomicBool = AtomicBool::new(false);

/// Whether telemetry collection is enabled globally.
/// When disabled, non-error events are suppressed and API request sampling
/// is paused (errors 4xx/5xx are still recorded).
pub fn get_telemetry_enabled() -> bool {
    TELEM_ENABLED.load(Ordering::Relaxed)
}

/// Enable or disable telemetry collection at runtime.
pub fn set_telemetry_enabled(enabled: bool) {
    TELEM_ENABLED.store(enabled, Ordering::Relaxed);
    // Reset counter so re-enabling starts sampling fresh
    TELEM_COUNTER.store(0, Ordering::Relaxed);
}

/// Whether to capture response body summaries in telemetry metadata.
pub fn get_telemetry_response_logging() -> bool {
    TELEM_RESPONSE_LOGGING.load(Ordering::Relaxed)
}

/// set_telemetry_response_logging - Updates set telemetry response logging.
pub fn set_telemetry_response_logging(enabled: bool) {
    TELEM_RESPONSE_LOGGING.store(enabled, Ordering::Relaxed);
}

/// Get the current telemetry sample rate (1-in-N requests logged).
pub fn get_telemetry_sample_rate() -> u64 {
    TELEM_SAMPLE_RATE.load(Ordering::Relaxed)
}

/// Set the telemetry sample rate. A value of 1 logs every request;
/// 0 disables non-error logging entirely.
pub fn set_telemetry_sample_rate(rate: u64) {
    TELEM_SAMPLE_RATE.store(rate, Ordering::Relaxed);
    // Reset counter so the next request starts fresh sampling
    TELEM_COUNTER.store(0, Ordering::Relaxed);
}

/// Extract a safe response summary from the body bytes without logging full payloads.
/// For JSON responses: extracts item count for arrays, status/error for objects.
fn extract_response_summary(body_bytes: &[u8], content_type: &str) -> Option<String> {
    if !content_type.contains("application/json") {
        return None;
    }
    // Cap at 4KB to avoid parsing huge payloads
    if body_bytes.len() > 4096 {
        return Some(format!("{{\"truncated\":true,\"size_bytes\":{}}}", body_bytes.len()));
    }
    let parsed: serde_json::Value = serde_json::from_slice(body_bytes).ok()?;
    match &parsed {
        serde_json::Value::Array(arr) => {
            Some(format!("{{\"count\":{}}}", arr.len()))
        }
        serde_json::Value::Object(obj) => {
            // Extract useful fields without logging the full object
            let mut summary = serde_json::Map::new();
            if let Some(v) = obj.get("status") { summary.insert("status".into(), v.clone()); }
            if let Some(v) = obj.get("message") { summary.insert("message".into(), v.clone()); }
            if let Some(v) = obj.get("error") { summary.insert("error".into(), v.clone()); }
            if let Some(v) = obj.get("count") { summary.insert("count".into(), v.clone()); }
            if let Some(v) = obj.get("total_events") { summary.insert("total_events".into(), v.clone()); }
            if let Some(v) = obj.get("id") { summary.insert("id".into(), v.clone()); }
            if let Some(v) = obj.get("enabled") { summary.insert("enabled".into(), v.clone()); }
            if summary.is_empty() {
                Some("{}".to_string())
            } else {
                Some(serde_json::Value::Object(summary).to_string())
            }
        }
        _ => None,
    }
}

/// telemetry_tracking_layer - Performs telemetry tracking layer.
async fn telemetry_tracking_layer(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();
    let response_logging = TELEM_RESPONSE_LOGGING.load(Ordering::Relaxed);

    // Skip self-referential and high-frequency polling routes to avoid log noise
    let is_internal_poll = path.starts_with("/api/v1/telemetry/")
        || path == "/api/v1/utilities/background-jobs/status"
        || path == "/api/v1/settings/events";
    if is_internal_poll {
        return next.run(req).await;
    }

    let response = next.run(req).await;

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let status_code = response.status().as_u16();
    let is_error = status_code >= 400;
    let status_str = if is_error { "error" } else { "ok" };

    // Sampling: always log errors, otherwise log 1 in TELEM_SAMPLE_RATE requests.
    // When telemetry is globally disabled, only errors are logged.
    let sample_rate = TELEM_SAMPLE_RATE.load(Ordering::Relaxed);
    let telemetry_enabled = TELEM_ENABLED.load(Ordering::Relaxed);
    let should_log = is_error || (telemetry_enabled && sample_rate > 0 && {
        let count = TELEM_COUNTER.fetch_add(1, Ordering::Relaxed);
        count % sample_rate == 0
    });

    if !should_log {
        return response;
    }

    // Optionally capture response body summary (only for non-GET requests)
    // Important: telemetry is best-effort and must never break the actual response.
    let (response, summary) = if response_logging && method != "GET" {
        // Check content-type BEFORE consuming the body to avoid unnecessary consumption
        let ct = response.headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();
        
        if !ct.contains("json") {
            // Not JSON — skip body capture, return original response unchanged
            (response, None)
        } else {
            // JSON detected — consume body for summary extraction
            let (parts, body) = response.into_parts();
            match body.collect().await {
                Ok(collected) => {
                    let bytes: Bytes = collected.to_bytes();
                    let summary = extract_response_summary(&bytes, &ct);
                    let rebuilt = axum::body::Body::from(bytes);
                    (Response::from_parts(parts, rebuilt), summary)
                }
                Err(_) => {
                    // Body read failed — return response with empty body.
                    // This is a rare edge case in local apps; telemetry is best-effort
                    // and must never break the actual API response for the client.
                    (Response::from_parts(parts, axum::body::Body::from("")), None)
                }
            }
        }
    } else {
        (response, None)
    };

    // Build metadata
    let mut meta = serde_json::json!({
        "method": method.to_string(),
        "path": path,
        "status": status_code
    });
    if let Some(ref s) = summary {
        if let Ok(obj) = serde_json::from_str::<serde_json::Value>(s) {
            meta["response_summary"] = obj;
        } else {
            meta["response_summary"] = serde_json::Value::String(s.clone());
        }
    }

    // Fire-and-forget telemetry write (non-blocking via tokio::spawn)
    tokio::spawn(async move {
        let _ = state.telemetry.log_event(
            "backend",
            None,
            "api_request",
            Some(&path),
            Some(&method.to_string()),
            Some(&meta.to_string()),
            Some(status_str),
            Some(duration_ms),
        ).await;
    });

    response
}

/// Verify API key from `X-API-Key` header if configured in settings or environment.
/// Passes through when API key protection is disabled or no key is set.
async fn api_key_auth_layer(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path();
    // Exclude security settings get/post and swagger/health from blocking
    if path == "/health" || path.starts_with("/swagger") || path.starts_with("/api-docs") || path == "/api/v1/settings/security" {
        return next.run(req).await;
    }

    // Check dynamic DB settings first
    let db_enabled: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_enabled'")
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    let (is_enabled, expected_key) = match db_enabled.as_deref() {
        Some("true") => {
            let key: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_value'")
                .fetch_optional(&state.db)
                .await
                .unwrap_or(None);
            (true, key.or_else(|| state.config.api_key.clone()))
        }
        Some("false") => (false, None),
        _ => {
            let config_key = state.config.api_key.clone();
            (config_key.is_some(), config_key)
        }
    };

    if !is_enabled {
        return next.run(req).await;
    }

    let Some(expected) = expected_key else {
        return next.run(req).await;
    };

    let supplied = req
        .headers()
        .get("x-api-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if supplied != expected {
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Invalid or missing API key"})),
        )
            .into_response();
    }
    next.run(req).await
}

// ponytail: per-IP sliding-window rate limiter keyed by path. In-memory,
// resets on restart — sufficient for a local-first app. If multi-process
// or distributed blocking matters, move to a shared store.
struct RateLimiter {
    buckets: Mutex<HashMap<String, VecDeque<Instant>>>,
}

impl RateLimiter {
    /// check - Performs check.
    fn check(&self, key: &str, max_requests: usize, window: Duration) -> bool {
        let mut buckets = self.buckets.lock().unwrap();
        let now = Instant::now();
        let entry = buckets.entry(key.to_string()).or_default();
        while entry.front().is_some_and(|t| now.duration_since(*t) > window) {
            entry.pop_front();
        }
        if entry.len() >= max_requests {
            return false;
        }
        entry.push_back(now);
        true
    }
}

static RATE_LIMITER: OnceLock<RateLimiter> = OnceLock::new();

/// Sliding-window rate limit (20 req/min) per client IP + path for expensive
/// endpoints. Mirrors Python's `rate_limit` on video/subtitle routes.
async fn rate_limit_layer(
    req: Request,
    next: Next,
) -> Response {
    let path = req.uri().path().to_string();
    let is_limited = path.starts_with("/api/v1/video/")
        || path.starts_with("/api/v1/photos/inpaint/process");
    if is_limited {
        let ip = req
            .headers()
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string());
        let key = format!("{}:{}", ip, path);
        let limiter = RATE_LIMITER.get_or_init(|| RateLimiter {
            buckets: Mutex::new(HashMap::new()),
        });
        if !limiter.check(&key, 20, Duration::from_secs(60)) {
            return (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({"error": "Rate limit exceeded"})),
            )
                .into_response();
        }
    }
    next.run(req).await
}

#[derive(OpenApi)]
#[openapi(
    components(schemas(
        crate::models::HealthStatus,
        crate::models::PhotoStatsResponse,
        crate::models::Photo,
        crate::models::Album,
        crate::models::Person,
        crate::models::ResourceShare,
        crate::routes::shares::CreateShareRequest,
        crate::routes::shares::CreateShareResponse,
        crate::routes::shares::SharedResourceResponse,
    )),
    tags(
        (name = "system", description = "System & Health endpoints"),
        (name = "photos", description = "Photo management endpoints"),
        (name = "albums", description = "Album management endpoints"),
        (name = "people", description = "People & Face recognition endpoints"),
        (name = "shares", description = "Resource-based sharing endpoints")
    )
)]
pub struct ApiDoc;

/// create_router - Handles create router.
pub fn create_router(state: Arc<AppState>) -> Router {
    // CORS: use ALLOWED_ORIGINS env var (comma-separated) for production,
    // or fall back to the default dev origins.
    let cors = match std::env::var("ALLOWED_ORIGINS") {
        Ok(val) if val == "*" => CorsLayer::very_permissive(),
        Ok(val) => {
            let origins: Vec<header::HeaderValue> = val
                .split(',')
                .filter_map(|s| s.trim().parse().ok())
                .collect();
            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods(Any)
                .allow_headers(Any)
        }
        Err(_) => CorsLayer::new()
            .allow_origin([
                "tauri://localhost".parse::<header::HeaderValue>().unwrap(),
                "http://tauri.localhost".parse::<header::HeaderValue>().unwrap(),
                "http://localhost:3005".parse::<header::HeaderValue>().unwrap(),
                "http://127.0.0.1:3005".parse::<header::HeaderValue>().unwrap(),
            ])
            .allow_methods(Any)
            .allow_headers(Any),
    };

    let api_routes = Router::new()
        .route("/photos/stats", get(system::get_photo_stats))
        .route("/photos/upload", post(photos::upload_photo))
        .route("/photos/upload/", post(photos::upload_photo))
        .route("/photos/upload-blob", post(photos::upload_blob))
        .route("/photos/inpaint/unload", post(photos::unload_inpaint))
        .route("/photos/expand-directory", post(photos::expand_directory))
        .route("/sample-images/:filename", get(photos::serve_sample_image))
        .route("/photos/bulk-adjustments", post(photos::bulk_update_adjustments))
        .route("/photos", get(photos::list_photos))
        .route("/photos/", get(photos::list_photos))
        .route("/photos/:id", get(photos::get_photo))
        .route("/photos/:id/metadata", get(photos::get_photo_metadata))
        .route("/photos/:id/file", get(photos::get_photo_file))
        .route("/photos/:id/thumbnail", get(photos::get_photo_thumbnail))
                .route("/photos/:id/faces", get(people::get_photo_faces))
        .route("/photos/:id/favorite", post(photos::toggle_favorite))
        .route("/photos/:id/trash", post(photos::toggle_trash))
        .route("/photos/:id/restore", post(photos::restore_photo))
        .route("/photos/:id/location", axum::routing::put(photos::update_photo_location))
        .route("/photos/:id/adjustments", axum::routing::put(photos::update_photo_adjustments))
        .route("/photos/:id/tag-face", post(photos::tag_photo_face))
        .route("/photos/:id/ocr", post(photos_ai::trigger_ocr))
        .route("/photos/inpaint/process", post(photos_ai::process_inpaint))
        .route("/photos/:id/summary", get(photos_ai::get_summary))
        .route("/photos/:id/summary/generate", post(photos_ai::generate_summary))
        .route("/photos/:id/xmp", post(photos_ai::xmp_operation))
        .route("/photos/:id/lock", post(photos_ai::toggle_lock))
        .route("/photos/:id/unlock", post(photos_ai::unlock_photo))
        .route("/photos/:id/export-preset", post(photos_ai::export_photo_preset))
        .route("/photos/:id/metadata", put(photos_ai::update_photo_metadata))
        .route("/photos/semantic-masks/:photo_id", get(photos_ai::get_semantic_masks))
        .route("/photos/background-mask/:photo_id", get(photos_ai::get_background_mask))
        .route("/photos/portrait-masks/:photo_id", get(photos_ai::get_portrait_masks))
        .route("/photos/auto-enhance/:photo_id", post(photos_ai::get_auto_enhance))
        .route("/photos/xmp/export", post(photos_ai::xmp_export))
        .route("/photos/xmp/import", post(photos_ai::xmp_import))
        .route("/photos/xmp/upload-import", post(photos_ai::xmp_upload_import))
        .route("/photos/xmp/check/:photo_id", get(photos_ai::xmp_check))
        .route("/photos/export", post(photos_ai::export_photos))
        .route("/photos/directory", post(photos_ai::list_directory))
        .route("/albums/memories/highlights", get(albums::get_memories_highlights))
        .route("/albums/smart", get(albums::list_smart_albums))
        .route("/albums/smart/photos", get(albums::get_smart_album_photos_by_id))
        .route("/albums/smart/reclassify", post(albums::reclassify_all_photos))
        .route("/albums/smart/:smart_type/photos", get(albums::get_smart_album_photos))
        .route("/albums", get(albums::list_albums).post(albums::create_album))
        .route("/albums/", get(albums::list_albums).post(albums::create_album))
        .route("/albums/:id", delete(albums::delete_album))
        .route("/albums/:id/photos", get(albums::get_album_photos))
        .route("/albums/:id/rename", post(albums::rename_album))
        .route("/albums/:id/add-photos", post(albums::add_photos_to_album))
        .route("/albums/:id/remove-photos", post(albums::remove_photos_from_album))
        .route("/albums/:id/set-cover", post(albums::set_album_cover))
        .route("/people", get(people::list_people))
        .route("/people/", get(people::list_people))
        .route("/people/:id/photos", get(people::get_person_photos))
        .route("/people/:id/name", put(people::rename_person).post(people::rename_person))
        .route("/people/:id/pending-faces", get(people::get_pending_faces))
        .route("/people/pending-faces/:pending_id/feedback", post(people::submit_pending_face_feedback))
        .route("/people/scan/:photo_id", post(people::scan_photo_faces))
        .route("/explore", get(explore::explore_photos))
        .route("/explore/", get(explore::explore_photos))
        .route("/explore/insights", get(explore::explore_insights))
        .route("/explore/themes", get(explore::explore_themes))
        .route("/explore/on-this-day", get(explore::explore_on_this_day))
        .route("/explore/rediscover-prompts", get(explore::explore_rediscover_prompts))
        .route("/explore/timeline", get(explore::explore_timeline))
        .route("/explore/seasons", get(explore::explore_seasons))
        .route("/explore/activity", get(explore::explore_activity))
        .route("/explore/highlights", get(explore::explore_highlights))
        .route("/explore/highlights/generate", post(explore::generate_highlight_project))
        .route("/nle/projects", get(nle::list_projects).post(nle::create_project))
        .route("/nle/projects/", get(nle::list_projects).post(nle::create_project))
        .route("/nle/projects/:id", get(nle::get_project).put(nle::update_project).delete(nle::delete_project))
        .route("/nle/clips/proxy", post(nle::generate_proxy_video))
        .route("/nle/clips/analyze", post(nle::analyze_video_clip))
        .route("/nle/clips/thumbnail-strip", post(nle::thumbnail_strip))
        .route("/nle/clips/waveform", post(nle::get_waveform))
        .route("/nle/preview/render", post(nle::render_preview))
        .route("/nle/preview/frame", post(nle::preview_frame))
        .route("/nle/preview/segment", post(nle::preview_segment))
        .route("/nle/export", post(nle::export_project))
        .route("/nle/export/xml", post(nle::export_xml))
        .route("/nle/export/:job_id", get(nle::get_export_status))
        .route("/nle/export/:job_id/download", get(nle::download_export))
        .route("/nle/stream", get(nle::stream_video))
        .route("/transcode", get(nle::stream_video))
        .route("/hls/playlist", get(nle::stream_video))

        .route("/privacy/status", get(privacy::get_privacy_status))
        .route("/privacy/feature/:feature_id", get(privacy::get_privacy_feature_detail))
        .route("/settings", get(settings::get_settings))
        .route("/settings/", get(settings::get_settings))
        .route("/settings/general", get(settings::get_general_settings).post(settings::save_general_settings))
        .route("/settings/map-style", get(settings::get_map_style).post(settings::save_map_style))
        .route("/settings/events", get(settings::sse_events))
        .route("/settings/folders", get(settings::get_folders_settings).post(settings::save_folders_settings))
        .route("/settings/reset-library", post(settings::reset_library))
        .route("/settings/clear-cache", post(settings::clear_cache))
        .route("/settings/vacuum", post(settings::vacuum_db))
        .route("/settings/purge-folder", post(settings::purge_folder))
        .route("/settings/locked-folder/status", get(settings::get_locked_folder_status))
        .route("/settings/locked-folder/setup", post(settings::setup_locked_folder))
        .route("/settings/locked-folder/verify", post(settings::verify_locked_folder))
        .route("/settings/locked-folder/lock-session", post(settings::lock_session))
        .route("/settings/sync", get(settings::get_sync_settings).post(settings::save_sync_settings))
        .route("/settings/trigger-face-sync", post(settings::trigger_face_sync))
        .route("/settings/telemetry", get(settings::get_telemetry_settings).post(settings::save_telemetry_settings))
        .route("/settings/security", get(settings::get_security_settings).post(settings::save_security_settings))
        .route("/settings/security/generate", post(settings::generate_api_key))
        .route("/settings/webhooks", get(settings::list_webhooks).post(settings::create_webhook))
        .route("/settings/webhooks/:id", delete(settings::delete_webhook))
        .route("/settings/webhooks/test", post(settings::test_webhooks))
        .route("/utilities/duplicates", get(utilities::get_duplicates))
        .route("/utilities/blurry", get(utilities::get_blurry_photos))
        .route("/utilities/documents", get(utilities::get_document_photos))
        .route("/utilities/diagnostics", get(utilities::get_diagnostics))
        .route("/utilities/logs", get(utilities::get_logs))
        .route("/utilities/browser-locations", get(utilities::get_browser_locations))
        .route("/utilities/list-dir", post(utilities::list_directory_contents))
        .route("/utilities/external-locations", get(utilities::list_external_locations_api).post(utilities::create_external_location))
        .route("/utilities/external-locations/:loc_id", patch(utilities::update_external_location).delete(utilities::delete_external_location))
        .route("/utilities/visual-duplicates", get(utilities::get_visual_duplicates))
        .route("/utilities/backup/export", post(utilities::export_backup))
        .route("/utilities/backup/restore", post(utilities::restore_backup))
        .route("/utilities/google-import", post(google_import::google_takeout_import))
        .route("/utilities/batch-rename", post(utilities::batch_rename_files))
        .route("/utilities/open-in-os-explorer", post(utilities::open_in_os_explorer))
        .route("/utilities/search/fused", get(utilities::fused_search))
        .route("/utilities/purge-trash", post(utilities::purge_trash))
        .route("/utilities/background-jobs/status", get(utilities::get_background_jobs_status))
        .route("/utilities/background-jobs/start", post(utilities::start_background_jobs))
        .route("/utilities/background-jobs/stop", post(utilities::stop_background_jobs))
        .route("/utilities/background-jobs/pause", post(utilities::pause_background_jobs))
        .route("/utilities/background-jobs/resume", post(utilities::resume_background_jobs))
        .route("/utilities/system-state", get(utilities::get_system_state))
        .route("/telemetry/summary", get(telemetry_api::get_telemetry_summary))
        .route("/telemetry/events", get(telemetry_api::get_telemetry_events).delete(telemetry_api::clear_telemetry_events))
        .route("/telemetry/stream", get(telemetry_api::telemetry_sse_stream))
        .route("/telemetry/log", post(telemetry_api::log_frontend_event))
        .route("/telemetry/log-batch", post(telemetry_api::log_frontend_event_batch))
        .route("/lan/discover", get(lan_sync::discover_peers))
        .route("/lan/peers/:peer_id/pair", post(lan_sync::pair_with_peer))
        .route("/lan/pair/request", post(lan_sync::handle_pair_request))
        .route("/lan/peers/:peer_id/sync", post(lan_sync::initiate_sync))
        .route("/lan/sync/status", get(lan_sync::sync_status))
        .route("/lan/peers/:peer_id/import", post(lan_sync::import_from_peer))
        .route("/lan/manifest", get(lan_sync::get_manifest))
        .route("/lan/photos/:photo_id/metadata", get(lan_sync::get_photo_metadata))
        .route("/lan/photos/:photo_id/file", get(lan_sync::get_photo_file))
        .route("/stories/generate", post(stories::generate_story))
        .route("/stories/event/:event_id", get(stories::get_event_story))
        .route("/video/export", post(video::start_export))
        .route("/video/export/:job_id", get(video::get_export_status))
        .route("/video/export/:job_id/download", get(video::download_export))
        .route("/video/subtitles/generate", post(video::generate_subtitles))
        .route("/agent/sessions", get(agent::list_sessions).post(agent::create_session))
        .route("/agent/sessions/", get(agent::list_sessions).post(agent::create_session))
        .route("/agent/sessions/:id", get(agent::get_session).patch(agent::rename_session).delete(agent::delete_session))
        .route("/agent/upload_image", post(agent::upload_image))
        .route("/agent/preload", post(agent::preload_model))
        .route("/agent/chat", post(agent::chat))
        .route("/agent/uploads/:filename", get(agent::serve_agent_upload))
        .route("/shares", post(shares::create_share))
        .route("/shares/", post(shares::create_share))
        .route("/shares/:token", get(shares::get_shared_resource).delete(shares::revoke_share))
        .route("/shares/:token/download", get(shares::download_shared_file))
        .nest("/models", models::routes())
        .merge(auth::create_auth_routes())
        .layer(middleware::from_fn_with_state(state.clone(), api_key_auth_layer));

    let mut router = Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/health", get(system::health_check))
        .route("/local", get(photos::serve_local_file))
        .route("/transcode", get(nle::stream_video))
        .route("/hls/playlist", get(nle::stream_video))
        .nest_service("/thumbnails", tower_http::services::ServeDir::new(&state.config.thumbnails_dir))
        .nest("/api/v1", api_routes)
        .nest("/admin", admin::create_admin_routes());

    let static_dir = std::env::var("WEB_STATIC_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("./frontend/dist"));

    if static_dir.exists() && static_dir.is_dir() {
        let index_file = static_dir.join("index.html");
        let serve_dir = tower_http::services::ServeDir::new(&static_dir)
            .not_found_service(tower_http::services::ServeFile::new(index_file));
        router = router.fallback_service(serve_dir);
    } else {
        router = router.route("/", get(system::root));
    }

    router
        .layer(axum::extract::DefaultBodyLimit::max(1024 * 1024 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::Extension(state.clone()))
        .layer(middleware::from_fn(rate_limit_layer))
        .layer(middleware::from_fn_with_state(state.clone(), telemetry_tracking_layer))
        .with_state(state)
}
