mod config;
mod db;
mod models;
mod routes;
mod services;
#[cfg(test)]
mod tests;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

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
use crate::services::model_manager::ModelManager;
use crate::services::packs::PackManager;
use crate::services::lan_beacon::LanBeaconService;
use crate::services::plugins::PluginManager;
use crate::services::vector_index;
use crate::services::worker::{WorkerState, JobScheduler, AnalyzerRegistry, spawn_worker_loop};

pub struct AppState {
    pub config: Config,
    pub db: db::DbPool,
    /// Auto-generated master key for the encrypted settings vault (AES-256-GCM).
    pub vault_key: parking_lot::RwLock<[u8; 32]>,
    pub ml_client: MlClient,
    pub telemetry: TelemetryService,
    pub worker: Arc<WorkerState>,
    pub scheduler: Arc<JobScheduler>,
    pub registry: Arc<AnalyzerRegistry>,
    pub model_manager: Arc<ModelManager>,
    pub pack_manager: Arc<PackManager>,
    pub plugin_manager: Arc<PluginManager>,
    pub lan_beacon: Arc<LanBeaconService>,
}

#[tokio::main]
/// main - Entry point for the Prism backend server.
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "prism_backend_rust=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let mut config = Config::from_env();
    info!("Starting Prism Rust Backend on {}:{}", config.host, config.port);

    // Ensure required working directories exist (uploads, thumbnails, map_cache) so the
    // server can start cleanly on a fresh checkout.
    std::fs::create_dir_all(&config.upload_dir).ok();
    std::fs::create_dir_all(&config.thumbnails_dir).ok();
    std::fs::create_dir_all(&config.map_cache_dir).ok();

    recover_interrupted_operations(&config);

    let db_pool = init_db(&config.database_url).await?;

    // ── Vault + DB-backed advanced config (no .env required) ────────────────
    // The secrets master key is auto-generated on first startup next to the
    // database. Advanced config stored by the UI (AdvancedSettings) overrides
    // built-in defaults; PORT/HOST remain bootstrap-only.
    let db_dir = std::path::Path::new(&config.database_url.trim_start_matches("sqlite://"))
        .parent()
        .map(std::path::Path::to_path_buf)
        .unwrap_or_default();
    let vault_key = match services::secrets::load_or_create_master_key(&db_dir) {
        Ok(key) => key,
        Err(e) => {
            info!("Vault key init warning: {e} — falling back to in-memory key");
            let mut key = [0u8; 32];
            use aes_gcm::aead::rand_core::RngCore;
            aes_gcm::aead::OsRng.fill_bytes(&mut key);
            key
        }
    };
    let advanced = services::app_config::load(&db_pool).await;
    services::app_config::apply_overrides(&advanced, &mut config);

    // Migrate any legacy plaintext api_key_value into the encrypted vault
    if let Ok(Some(legacy_key)) = sqlx::query_scalar::<_, String>(
        "SELECT value FROM settings WHERE key = 'api_key_value'"
    )
    .fetch_optional(&db_pool)
    .await
    {
        if !legacy_key.trim().is_empty() {
            let _ = services::secrets::set_secret(&db_pool, &vault_key, "api_key", legacy_key.trim()).await;
            info!("Migrated legacy plaintext API key to AES-256-GCM encrypted vault");
        }
        let _ = sqlx::query("DELETE FROM settings WHERE key = 'api_key_value'")
            .execute(&db_pool)
            .await;
    }

    // Ensure an API key always exists — auto-generate cryptographically if none exists
    let existing_vault_key = services::secrets::get_secret(&db_pool, &vault_key, "api_key").await;
    match (config.api_key.as_ref(), existing_vault_key) {
        (Some(env_key), None) => {
            let _ = services::secrets::set_secret(&db_pool, &vault_key, "api_key", env_key).await;
        }
        (None, Some(vault_k)) => {
            config.api_key = Some(vault_k);
        }
        (None, None) => {
            let auto_key = services::secrets::generate_secure_api_key();
            let _ = services::secrets::set_secret(&db_pool, &vault_key, "api_key", &auto_key).await;
            config.api_key = Some(auto_key);
            info!("Auto-generated new secure API key and encrypted in AES-256-GCM vault");
        }
        (Some(_), Some(_)) => {}
    }

    // Re-create directories if the DB config moved them.
    std::fs::create_dir_all(&config.upload_dir).ok();
    std::fs::create_dir_all(&config.thumbnails_dir).ok();
    std::fs::create_dir_all(&config.models_dir).ok();
    std::fs::create_dir_all(&config.plugins_dir).ok();
    std::fs::create_dir_all(&config.map_cache_dir).ok();

    // Initialize HNSW vector index for fast semantic search
    let vector_index_instance = vector_index::init_global(db_pool.clone(), config.models_dir.clone());
    vector_index_instance.init().await;

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

    let mut model_manager_instance = ModelManager::new(config.models_dir.clone());
    let pack_manager = Arc::new(PackManager::new(config.packs_dir.clone(), config.models_dir.clone()));
    pack_manager.refresh().await;
    let pack_models = pack_manager.to_model_definitions().await;
    model_manager_instance.register_dynamic(pack_models);

    // Restore persisted license acknowledgments
    if let Ok(rows) = sqlx::query_as::<_, (String, String)>(
        "SELECT key, value FROM settings WHERE key LIKE 'pack_ack_%' AND value = 'true'"
    )
    .fetch_all(&db_pool)
    .await {
        for (key, _) in rows {
            if let Some(model_id) = key.strip_prefix("pack_ack_") {
                pack_manager.acknowledge_license(model_id);
                model_manager_instance.acknowledge_license(model_id).await;
            }
        }
    }

    let model_manager = Arc::new(model_manager_instance);

    let plugin_manager = Arc::new(PluginManager::new(
        config.plugins_dir.clone(),
        config.packs_dir.clone(),
        config.models_dir.clone(),
    ));

    let local_peer_id = routes::lan_sync::get_or_create_local_peer_id(&db_pool).await;
    let lan_beacon = Arc::new(LanBeaconService::new(local_peer_id, config.port));
    lan_beacon.start();

    let state = Arc::new(AppState {
        config: config.clone(),
        db: db_pool,
        vault_key: parking_lot::RwLock::new(vault_key),
        ml_client,
        telemetry,
        worker,
        scheduler,
        registry,
        model_manager,
        pack_manager,
        plugin_manager,
        lan_beacon,
    });

    // Spawn the watch-folder indexer: startup + periodic scan of watched
    // folders and live FS-event imports (notify crate).
    crate::services::watcher::spawn_watcher(Arc::clone(&state));

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

/// scan_and_recover - Scans and recover.
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

/// recover_interrupted_operations - Recovers interrupted operations.
pub fn recover_interrupted_operations(config: &Config) {
    info!("Scanning for interrupted operations and backup files...");
    scan_and_recover(std::path::Path::new(&config.upload_dir));
    scan_and_recover(std::path::Path::new(&config.thumbnails_dir));
}

