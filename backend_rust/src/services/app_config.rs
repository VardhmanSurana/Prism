//! Advanced application configuration, persisted in the SQLite `settings`
//! table (no .env file required). Secrets are stored encrypted via the
//! [`crate::services::secrets`] vault. Values set here override built-in
//! defaults at startup; PORT/HOST remain bootstrap-only (needed before the
//! database exists).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

const CONFIG_KEY: &str = "advanced_config";

/// Non-secret advanced configuration, stored as JSON.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AdvancedConfig {
    /// Directory watcher / storage locations (paths) — take effect on restart.
    #[serde(default)]
    pub upload_dir: Option<String>,
    #[serde(default)]
    pub thumbnails_dir: Option<String>,
    #[serde(default)]
    pub models_dir: Option<String>,
    #[serde(default)]
    pub plugins_dir: Option<String>,
    #[serde(default)]
    pub map_cache_dir: Option<String>,
    /// Hardware & compute acceleration (auto / cuda / cpu / vulkan / rocm / sycl).
    #[serde(default)]
    pub gpu_mode: Option<String>,
    /// Auto-update behaviour for the desktop/mobile shells.
    #[serde(default = "default_true")]
    pub updater_enabled: bool,
    /// How often (minutes) the shell checks for updates.
    #[serde(default = "default_check_interval")]
    pub updater_check_interval_minutes: u32,
    /// Override for the Android sideload update manifest URL (optional).
    #[serde(default)]
    pub updater_android_manifest_url: Option<String>,
    /// Allow in-app checks to hit a custom desktop updater endpoint manifest (informational/advanced).
    #[serde(default)]
    pub updater_desktop_manifest_url: Option<String>,
    /// Thumbnail quality: "fast" (60%/256px), "balanced" (85%/400px), "quality" (95%/800px).
    #[serde(default = "default_thumb_quality")]
    pub thumb_quality: String,
}

fn default_true() -> bool {
    true
}

fn default_check_interval() -> u32 {
    720 // 12 hours
}

fn default_thumb_quality() -> String {
    "balanced".to_string()
}

impl Default for AdvancedConfig {
    fn default() -> Self {
        Self {
            upload_dir: None,
            thumbnails_dir: None,
            models_dir: None,
            plugins_dir: None,
            map_cache_dir: None,
            gpu_mode: None,
            updater_enabled: true,
            updater_check_interval_minutes: 720,
            updater_android_manifest_url: None,
            updater_desktop_manifest_url: None,
            thumb_quality: "balanced".to_string(),
        }
    }
}

/// Load the advanced config from the DB, returning defaults when absent.
pub async fn load(db: &SqlitePool) -> AdvancedConfig {
    let stored: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(CONFIG_KEY)
        .fetch_optional(db)
        .await
        .ok()
        .flatten();
    stored
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

/// Persist the advanced config (non-secret fields).
pub async fn save(db: &SqlitePool, config: &AdvancedConfig) -> Result<(), String> {
    let json =
        serde_json::to_string(config).map_err(|e| format!("config serialize failed: {e}"))?;
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(CONFIG_KEY)
    .bind(json)
    .execute(db)
    .await
    .map_err(|e| format!("config write failed: {e}"))?;
    Ok(())
}

/// Apply stored config overrides to the boot config. Call after `init_db`
/// and before services are constructed.
pub fn apply_overrides(loaded: &AdvancedConfig, config: &mut crate::config::Config) {
    if let Some(dir) = loaded.upload_dir.as_ref() {
        config.upload_dir = std::path::PathBuf::from(dir);
    }
    if let Some(dir) = loaded.thumbnails_dir.as_ref() {
        config.thumbnails_dir = std::path::PathBuf::from(dir);
    }
    if let Some(dir) = loaded.models_dir.as_ref() {
        config.models_dir = std::path::PathBuf::from(dir);
        config.packs_dir = config.models_dir.join("packs");
    }
    if let Some(dir) = loaded.plugins_dir.as_ref() {
        config.plugins_dir = std::path::PathBuf::from(dir);
    }
    if let Some(dir) = loaded.map_cache_dir.as_ref() {
        config.map_cache_dir = std::path::PathBuf::from(dir);
    }
    if let Some(gpu) = loaded.gpu_mode.as_ref() {
        if !gpu.trim().is_empty() {
            config.gpu_mode = gpu.trim().to_lowercase();
        }
    }
    if !loaded.thumb_quality.trim().is_empty() {
        let q = loaded.thumb_quality.trim().to_lowercase();
        if ["fast", "balanced", "quality"].contains(&q.as_str()) {
            config.thumb_quality = q;
        }
    }
}
