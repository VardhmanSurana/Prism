pub mod agent;
pub mod albums;
pub mod explore;
pub mod nle;
pub mod people;
pub mod photos;
pub mod privacy;
pub mod settings;
pub mod system;
pub mod telemetry_api;
pub mod utilities;

use axum::{
    extract::{Request, State},
    middleware::{self, Next},
    response::Response,
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
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

async fn telemetry_tracking_layer(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let start = std::time::Instant::now();
    let method = req.method().clone();
    let uri = req.uri().clone();
    let path = uri.path().to_string();

    let response = next.run(req).await;

    let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
    let status_code = response.status().as_u16();
    let is_error = status_code >= 400;
    let status_str = if is_error { "error" } else { "ok" };

    // Sampling: always log errors, otherwise log 1 in TELEM_SAMPLE_RATE requests
    let sample_rate = TELEM_SAMPLE_RATE.load(Ordering::Relaxed);
    let should_log = is_error || (sample_rate > 0 && {
        let count = TELEM_COUNTER.fetch_add(1, Ordering::Relaxed);
        count % sample_rate == 0
    });

    if !should_log {
        return response;
    }

    // Fire-and-forget telemetry write (non-blocking via tokio::spawn)
    let meta = serde_json::json!({
        "method": method.to_string(),
        "path": path,
        "status": status_code
    });
    tokio::spawn(async move {
        let _ = state.telemetry.log_event(
            "backend",
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

#[derive(OpenApi)]
#[openapi(
    components(schemas(
        crate::models::HealthStatus,
        crate::models::PhotoStatsResponse,
        crate::models::Photo,
        crate::models::Album,
        crate::models::Person,
    )),
    tags(
        (name = "system", description = "System & Health endpoints"),
        (name = "photos", description = "Photo management endpoints"),
        (name = "albums", description = "Album management endpoints"),
        (name = "people", description = "People & Face recognition endpoints")
    )
)]
pub struct ApiDoc;

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
        .route("/photos/:id/location", axum::routing::put(photos::update_photo_location))
        .route("/photos/:id/adjustments", axum::routing::put(photos::update_photo_adjustments))
        .route("/photos/:id/tag-face", post(photos::tag_photo_face))
        .route("/albums/memories/highlights", get(albums::get_memories_highlights))
        .route("/albums/smart", get(albums::list_smart_albums))
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
        .route("/people/scan/:photo_id", post(people::scan_photo_faces))
        .route("/explore", get(explore::explore_photos))
        .route("/explore/", get(explore::explore_photos))
        .route("/explore/insights", get(explore::explore_insights))
        .route("/explore/themes", get(explore::explore_themes))
        .route("/explore/on-this-day", get(explore::explore_on_this_day))
        .route("/explore/rediscover-prompts", get(explore::explore_rediscover_prompts))
        .route("/nle/projects", get(nle::list_projects).post(nle::create_project))
        .route("/nle/projects/", get(nle::list_projects).post(nle::create_project))
        .route("/nle/projects/:id", get(nle::get_project).put(nle::update_project).delete(nle::delete_project))
        .route("/nle/clips/proxy", post(nle::generate_proxy_video))
        .route("/nle/clips/analyze", post(nle::analyze_video_clip))
        .route("/nle/clips/thumbnail-strip", post(nle::thumbnail_strip))
        .route("/nle/stream", get(nle::stream_video))
        .route("/agent/chat", post(agent::chat_with_agent))
        .route("/agent/preload", post(agent::preload_agent).get(agent::preload_agent))
        .route("/agent/sessions", get(agent::list_sessions).post(agent::create_session))
        .route("/agent/sessions/", get(agent::list_sessions).post(agent::create_session))
        .route("/agent/sessions/:id", get(agent::get_session).patch(agent::update_session).delete(agent::delete_session))
        .route("/privacy/status", get(privacy::get_privacy_status))
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
        .route("/settings/sync", get(settings::get_sync_settings).post(settings::save_sync_settings))
        .route("/settings/telemetry", get(settings::get_telemetry_settings).post(settings::save_telemetry_settings))
        .route("/utilities/duplicates", get(utilities::get_duplicates))
        .route("/utilities/blurry", get(utilities::get_blurry_photos))
        .route("/utilities/documents", get(utilities::get_document_photos))
        .route("/utilities/diagnostics", get(utilities::get_diagnostics))
        .route("/utilities/logs", get(utilities::get_logs))
        .route("/utilities/browser-locations", get(utilities::get_browser_locations))
        .route("/utilities/list-dir", post(utilities::list_directory_contents))
        .route("/utilities/external-locations", get(utilities::list_external_locations_api))
        .route("/utilities/background-jobs/status", get(utilities::get_background_jobs_status))
        .route("/utilities/background-jobs/start", post(utilities::start_background_jobs))
        .route("/utilities/background-jobs/stop", post(utilities::stop_background_jobs))
        .route("/utilities/background-jobs/pause", post(utilities::pause_background_jobs))
        .route("/utilities/background-jobs/resume", post(utilities::resume_background_jobs))
        .route("/telemetry/summary", get(telemetry_api::get_telemetry_summary))
        .route("/telemetry/events", get(telemetry_api::get_telemetry_events))
        .route("/telemetry/stream", get(telemetry_api::telemetry_sse_stream))
        .route("/telemetry/log", post(telemetry_api::log_frontend_event))
        .route("/telemetry/log-batch", post(telemetry_api::log_frontend_event_batch));


    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .route("/", get(system::root))
        .route("/health", get(system::health_check))
        .route("/local", get(photos::serve_local_file))
        .nest("/api/v1", api_routes)
        .layer(axum::extract::DefaultBodyLimit::max(1024 * 1024 * 1024))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .layer(axum::Extension(state.clone()))
        .layer(middleware::from_fn_with_state(state.clone(), telemetry_tracking_layer))
        .with_state(state)
}
