use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{error, info};

use crate::services::plugins::{InstallPluginRequest, InstalledPlugin, PluginCatalogItem};
use crate::AppState;

pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_plugins))
        .route("/catalog", get(get_catalog))
        .route("/install", post(install_plugin_generic))
        .route("/install/:id", post(install_plugin))
        .route("/uninstall/:id", post(uninstall_plugin))
        .route("/toggle/:id", post(toggle_plugin))
        .route("/config/:id", post(update_plugin_config))
}

#[derive(Serialize)]
pub struct PluginListResponse {
    pub plugins: Vec<InstalledPlugin>,
    pub plugins_dir: String,
    pub total: usize,
}

#[derive(Serialize)]
pub struct PluginCatalogResponse {
    pub catalog: Vec<PluginCatalogItem>,
    pub total: usize,
}

#[derive(Deserialize)]
pub struct TogglePluginRequest {
    pub enabled: bool,
}

#[derive(Deserialize)]
pub struct UpdatePluginConfigRequest {
    pub settings: serde_json::Value,
}

/// GET /api/v1/plugins
/// Lists all installed plugins discovered from the `plugins/` directory.
pub async fn list_plugins(
    State(state): State<Arc<AppState>>,
) -> Json<PluginListResponse> {
    let installed = state.plugin_manager.scan_installed();
    let dir = state.plugin_manager.plugins_dir().to_string_lossy().to_string();
    let total = installed.len();
    Json(PluginListResponse {
        plugins: installed,
        plugins_dir: dir,
        total,
    })
}

/// GET /api/v1/plugins/catalog
/// Returns the browsable plugin catalog with real-time installed/active status.
pub async fn get_catalog(
    State(state): State<Arc<AppState>>,
) -> Json<PluginCatalogResponse> {
    let catalog = state.plugin_manager.get_catalog();
    let total = catalog.len();
    Json(PluginCatalogResponse {
        catalog,
        total,
    })
}

/// POST /api/v1/plugins/install
/// Installs a plugin from source (catalog ID, manifest JSON file, local directory, or GitHub URL).
pub async fn install_plugin_generic(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<InstallPluginRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Request to install plugin from source: '{}'", payload.source);
    match state.plugin_manager.install_from_source(payload).await {
        Ok(installed) => {
            if installed.id == "background-removal" {
                state.pack_manager.refresh().await;
            }
            Ok(Json(json!({
                "status": "success",
                "message": format!("Plugin '{}' successfully installed into plugins/{}", installed.id, installed.id),
                "plugin": installed
            })))
        }
        Err(err) => {
            error!("Failed to install plugin: {}", err);
            Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "error": format!("Failed to install plugin: {}", err)
                })),
            ))
        }
    }
}

/// POST /api/v1/plugins/install/:id
/// Installs a plugin into the `plugins/<id>/` folder with manifest, config, and code.
pub async fn install_plugin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Request to install plugin '{}' into plugins/ directory", id);
    match state.plugin_manager.install_plugin(&id).await {
        Ok(installed) => {
            // If background-removal plugin was installed, refresh packs
            if installed.id == "background-removal" {
                state.pack_manager.refresh().await;
            }
            Ok(Json(json!({
                "status": "success",
                "message": format!("Plugin '{}' successfully installed into plugins/{}", installed.id, installed.id),
                "plugin": installed
            })))
        }
        Err(err) => {
            error!("Failed to install plugin '{}': {}", id, err);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({
                    "status": "error",
                    "error": format!("Failed to install plugin '{}': {}", id, err)
                })),
            ))
        }
    }
}

/// POST /api/v1/plugins/uninstall/:id
/// Uninstalls a plugin and removes its directory from `plugins/`.
pub async fn uninstall_plugin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    info!("Request to uninstall plugin '{}' from plugins/ directory", id);
    match state.plugin_manager.uninstall_plugin(&id) {
        Ok(()) => {
            if id == "background-removal" {
                state.pack_manager.refresh().await;
            }
            Ok(Json(json!({
                "status": "success",
                "message": format!("Plugin '{}' successfully uninstalled", id)
            })))
        }
        Err(err) => {
            error!("Failed to uninstall plugin '{}': {}", id, err);
            Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "error": format!("Failed to uninstall plugin '{}': {}", id, err)
                })),
            ))
        }
    }
}

/// POST /api/v1/plugins/toggle/:id
/// Enables or disables a plugin.
pub async fn toggle_plugin(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<TogglePluginRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match state.plugin_manager.toggle_plugin(&id, payload.enabled) {
        Ok(plugin) => Ok(Json(json!({
            "status": "success",
            "plugin": plugin
        }))),
        Err(err) => {
            error!("Failed to toggle plugin '{}': {}", id, err);
            Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "error": format!("Failed to toggle plugin: {}", err)
                })),
            ))
        }
    }
}

/// POST /api/v1/plugins/config/:id
/// Updates plugin custom configuration settings.
pub async fn update_plugin_config(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdatePluginConfigRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    match state.plugin_manager.update_config(&id, payload.settings) {
        Ok(plugin) => Ok(Json(json!({
            "status": "success",
            "plugin": plugin
        }))),
        Err(err) => {
            error!("Failed to update config for plugin '{}': {}", id, err);
            Err((
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "status": "error",
                    "error": format!("Failed to update config: {}", err)
                })),
            ))
        }
    }
}
