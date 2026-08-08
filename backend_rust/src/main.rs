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
use crate::services::llm_client::LlmClient;
use crate::services::llm_server::LlmServer;
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

    recover_interrupted_operations(&config);

    let db_pool = init_db(&config.database_url).await?;
    let llm_server = LlmServer::new(config.models_dir.clone(), config.gpu_mode.clone());
    let ml_client = MlClient::new(LlmClient::new(llm_server.clone()));
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

    axum::serve(listener, app)
        .with_graceful_shutdown(async move {
            let _ = tokio::signal::ctrl_c().await;
            info!("Shutting down; stopping llama-server if running");
            llm_server.stop().await;
        })
        .await?;

    Ok(())
}

fn scan_and_recover(dir: &std::path::Path) {
    if !dir.exists() || !dir.is_dir() {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                scan_and_recover(&path);
            } else if path.is_file() {
                let file_name_str = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if file_name_str.ends_with(".prism_backup") {
                    let path_str = path.to_string_lossy();
                    if let Some(restored_str) = path_str.strip_suffix(".prism_backup") {
                        let restored_path = std::path::PathBuf::from(restored_str);
                        if let Err(e) = std::fs::rename(&path, &restored_path) {
                            tracing::warn!("Failed to restore backup file {:?} to {:?}: {}", path, restored_path, e);
                        } else {
                            info!("Restored interrupted operation backup: {:?} -> {:?}", path, restored_path);
                        }

                        // Remove associated backup lock files if present
                        let lock_candidates = [
                            path.with_extension("lock"),
                            std::path::PathBuf::from(format!("{}.lock", path.display())),
                            std::path::PathBuf::from(format!("{}.lock", restored_str)),
                        ];
                        for lock_path in &lock_candidates {
                            if lock_path.exists() {
                                if let Err(e) = std::fs::remove_file(lock_path) {
                                    tracing::warn!("Failed to remove backup lock file {:?}: {}", lock_path, e);
                                } else {
                                    info!("Removed backup lock file: {:?}", lock_path);
                                }
                            }
                        }
                    }
                } else if file_name_str.ends_with(".prism_backup.lock") {
                    if let Err(e) = std::fs::remove_file(&path) {
                        tracing::warn!("Failed to remove leftover lock file {:?}: {}", path, e);
                    } else {
                        info!("Removed leftover backup lock file: {:?}", path);
                    }
                }
            }
        }
    }
}

pub fn recover_interrupted_operations(config: &Config) {
    info!("Scanning for interrupted operations and backup files...");
    scan_and_recover(std::path::Path::new(&config.upload_dir));
    scan_and_recover(std::path::Path::new(&config.thumbnails_dir));
}

