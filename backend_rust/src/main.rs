mod config;
mod db;
mod models;
mod routes;
mod services;

use std::net::SocketAddr;
use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::Config;
use crate::db::init_db;
use crate::services::ml_client::MlClient;
use crate::services::telemetry::TelemetryService;
use crate::services::worker::{WorkerState, JobScheduler, AnalyzerRegistry, spawn_worker_loop};

pub struct AppState {
    pub config: Config,
    pub db: db::DbPool,
    pub ml_client: MlClient,
    pub telemetry: TelemetryService,
    pub worker: Arc<WorkerState>,
    pub scheduler: Arc<JobScheduler>,
    pub registry: Arc<AnalyzerRegistry>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "prism_backend_rust=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    info!("Starting Prism Rust Backend on {}:{}", config.host, config.port);

    // Ensure required working directories exist (uploads, thumbnails) so the
    // server can start cleanly on a fresh checkout.
    std::fs::create_dir_all(&config.upload_dir).ok();
    std::fs::create_dir_all(&config.thumbnails_dir).ok();

    let db_pool = init_db(&config.database_url).await?;
    let ml_client = MlClient::new(config.python_ml_url.clone());
    let telemetry = TelemetryService::new(db_pool.clone());
    let registry = Arc::new(AnalyzerRegistry::new());
    let analyzer_names = registry.names();
    let worker = WorkerState::new(&analyzer_names);
    let scheduler = JobScheduler::new(config.upload_dir.clone());

    telemetry.log_event("system", None, "startup", Some("main"), Some("server_start"), None, Some("ok"), None).await.ok();

    // Restore telemetry settings from DB (survive restarts)
    {
        use crate::routes::{set_telemetry_enabled, set_telemetry_sample_rate, set_telemetry_response_logging};
        if let Ok(Some(val)) = sqlx::query_scalar::<_, String>(
            "SELECT value FROM settings WHERE key = 'telemetry_enabled'"
        ).fetch_optional(&db_pool).await {
            set_telemetry_enabled(val == "true");
        }
        if let Ok(Some(val)) = sqlx::query_scalar::<_, String>(
            "SELECT value FROM settings WHERE key = 'telemetry_sample_rate'"
        ).fetch_optional(&db_pool).await {
            if let Ok(rate) = val.parse::<u64>() {
                set_telemetry_sample_rate(rate.min(1000));
            }
        }
        if let Ok(Some(val)) = sqlx::query_scalar::<_, String>(
            "SELECT value FROM settings WHERE key = 'telemetry_response_logging'"
        ).fetch_optional(&db_pool).await {
            set_telemetry_response_logging(val == "true");
        }
    }

    // Spawn the scheduler-driven AI worker loop
    spawn_worker_loop(
        Arc::clone(&worker),
        ml_client.clone(),
        db_pool.clone(),
        Arc::clone(&scheduler),
        Arc::clone(&registry),
    );

    let state = Arc::new(AppState {
        config: config.clone(),
        db: db_pool,
        ml_client,
        telemetry,
        worker,
        scheduler,
        registry,
    });

    let app = routes::create_router(state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Prism Rust Backend listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
