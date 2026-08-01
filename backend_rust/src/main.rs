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

pub struct AppState {
    pub config: Config,
    pub db: db::DbPool,
    pub ml_client: MlClient,
    pub telemetry: TelemetryService,
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

    let db_pool = init_db(&config.database_url).await?;
    let ml_client = MlClient::new(config.python_ml_url.clone());
    let telemetry = TelemetryService::new(db_pool.clone());

    telemetry.log_event("system", "startup", Some("main"), Some("server_start"), None, Some("ok"), None).await.ok();

    let state = Arc::new(AppState {
        config: config.clone(),
        db: db_pool,
        ml_client,
        telemetry,
    });

    let app = routes::create_router(state);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    info!("Prism Rust Backend listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
