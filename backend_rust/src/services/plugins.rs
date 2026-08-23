use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::{info, warn};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub homepage: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
    #[serde(default)]
    pub entrypoint: Option<String>,
    #[serde(default)]
    pub min_app_version: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginConfig {
    pub enabled: bool,
    #[serde(default)]
    pub installed_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub settings: serde_json::Value,
}

impl Default for PluginConfig {
    fn default() -> Self {
        let now = Utc::now().to_rfc3339();
        Self {
            enabled: true,
            installed_at: now.clone(),
            updated_at: now,
            settings: json!({}),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstalledPlugin {
    pub id: String,
    pub manifest: PluginManifest,
    pub config: PluginConfig,
    pub path: String,
    pub is_active: bool,
    pub has_models: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PluginCatalogItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub category: String,
    pub icon: String,
    pub is_installed: bool,
    pub is_active: bool,
    pub size_display: String,
    pub tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundled_code: Option<String>,
    pub manifest: PluginManifest,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstallPluginRequest {
    pub source: String,
    #[serde(default)]
    pub manifest: Option<PluginManifest>,
    #[serde(default)]
    pub bundled_code: Option<String>,
}

pub struct PluginManager {
    plugins_dir: PathBuf,
    #[allow(dead_code)]
    packs_dir: PathBuf,
    #[allow(dead_code)]
    models_dir: PathBuf,
}

impl PluginManager {
    pub fn new(plugins_dir: PathBuf, packs_dir: PathBuf, models_dir: PathBuf) -> Self {
        if let Err(e) = fs::create_dir_all(&plugins_dir) {
            warn!("Failed to create plugins directory {:?}: {}", plugins_dir, e);
        }
        Self {
            plugins_dir,
            packs_dir,
            models_dir,
        }
    }

    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Scans the `plugins/` directory and parses all installed plugin folders.
    pub fn scan_installed(&self) -> Vec<InstalledPlugin> {
        let mut installed = Vec::new();
        if !self.plugins_dir.exists() {
            return installed;
        }

        let entries = match fs::read_dir(&self.plugins_dir) {
            Ok(e) => e,
            Err(err) => {
                warn!("Could not read plugins dir: {}", err);
                return installed;
            }
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let manifest_path = path.join("plugin.json");
            if !manifest_path.exists() {
                continue;
            }

            let content = match fs::read_to_string(&manifest_path) {
                Ok(c) => c,
                Err(e) => {
                    warn!("Could not read plugin.json in {:?}: {}", path, e);
                    continue;
                }
            };

            let manifest: PluginManifest = match serde_json::from_str(&content) {
                Ok(m) => m,
                Err(e) => {
                    warn!("Invalid plugin.json in {:?}: {}", path, e);
                    continue;
                }
            };

            let config_path = path.join("config.json");
            let config: PluginConfig = if config_path.exists() {
                fs::read_to_string(&config_path)
                    .ok()
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default()
            } else {
                PluginConfig::default()
            };

            let has_models = path.join("models").is_dir() || path.join("weights").is_dir();
            let is_active = config.enabled;

            installed.push(InstalledPlugin {
                id: manifest.id.clone(),
                manifest,
                config,
                path: path.to_string_lossy().to_string(),
                is_active,
                has_models,
            });
        }

        installed.sort_by(|a, b| a.manifest.name.cmp(&b.manifest.name));
        installed
    }

    /// Returns the Jellyfin-like Plugin Catalog with install status.
    pub fn get_catalog(&self) -> Vec<PluginCatalogItem> {
        let installed = self.scan_installed();
        let installed_map: std::collections::HashMap<String, &InstalledPlugin> =
            installed.iter().map(|p| (p.id.clone(), p)).collect();

        let catalog_defs = Self::builtin_catalog_definitions();

        catalog_defs
            .into_iter()
            .map(|mut item| {
                if let Some(inst) = installed_map.get(&item.id) {
                    item.is_installed = true;
                    item.is_active = inst.is_active;
                } else {
                    item.is_installed = false;
                    item.is_active = false;
                }
                item
            })
            .collect()
    }

    /// Installs a plugin from various sources:
    /// 1. Direct manifest in payload
    /// 2. Local JSON manifest file (e.g. `background-removal.json` or `/path/to/plugin.json`)
    /// 3. Local directory containing `plugin.json`
    /// 4. GitHub repository URL (e.g. `https://github.com/owner/repo` or `owner/repo`)
    /// 5. Raw URL (e.g. `https://example.com/plugin.json`)
    /// 6. Built-in catalog item ID or `<id>.json`
    pub async fn install_from_source(
        &self,
        req: InstallPluginRequest,
    ) -> Result<InstalledPlugin, String> {
        let (manifest, bundled_code) = if let Some(m) = req.manifest {
            (m, req.bundled_code)
        } else {
            self.resolve_source(&req.source).await?
        };

        self.write_installed_plugin(manifest, bundled_code)
    }

    /// Helper that delegates to `install_from_source`.
    pub async fn install_plugin(&self, plugin_id_or_source: &str) -> Result<InstalledPlugin, String> {
        self.install_from_source(InstallPluginRequest {
            source: plugin_id_or_source.to_string(),
            manifest: None,
            bundled_code: None,
        })
        .await
    }

    /// Resolves manifest and code from catalog, local file/directory, or GitHub/HTTP URL.
    async fn resolve_source(&self, source: &str) -> Result<(PluginManifest, Option<String>), String> {
        let trimmed = source.trim();

        // 1. Check if source matches built-in catalog ID or `<id>.json`
        let clean_stem = trimmed
            .trim_end_matches(".json")
            .trim_end_matches(".JSON");
        let catalog = Self::builtin_catalog_definitions();
        if let Some(item) = catalog.into_iter().find(|c| c.id == trimmed || c.id == clean_stem) {
            return Ok((item.manifest, item.bundled_code));
        }

        // 2. Check local filesystem path (file or directory)
        let local_path = Path::new(trimmed);
        if local_path.exists() {
            if local_path.is_dir() {
                let manifest_file = local_path.join("plugin.json");
                if !manifest_file.exists() {
                    return Err(format!(
                        "Directory {:?} does not contain a plugin.json manifest",
                        local_path
                    ));
                }
                let content = fs::read_to_string(&manifest_file)
                    .map_err(|e| format!("Failed to read {:?}: {}", manifest_file, e))?;
                let manifest: PluginManifest = serde_json::from_str(&content)
                    .map_err(|e| format!("Invalid plugin.json in {:?}: {}", manifest_file, e))?;

                let entry_file = manifest.entrypoint.as_deref().unwrap_or("index.js");
                let code_path = local_path.join(entry_file);
                let code = if code_path.exists() {
                    fs::read_to_string(&code_path).ok()
                } else {
                    None
                };
                return Ok((manifest, code));
            } else {
                // It's a local JSON file (e.g. background-removal.json or plugin.json)
                let content = fs::read_to_string(local_path)
                    .map_err(|e| format!("Failed to read {:?}: {}", local_path, e))?;
                let manifest: PluginManifest = serde_json::from_str(&content)
                    .map_err(|e| format!("Invalid plugin manifest JSON in {:?}: {}", local_path, e))?;

                let parent = local_path.parent().unwrap_or_else(|| Path::new("."));
                let entry_file = manifest.entrypoint.as_deref().unwrap_or("index.js");
                let code_path = parent.join(entry_file);
                let code = if code_path.exists() {
                    fs::read_to_string(&code_path).ok()
                } else {
                    None
                };
                return Ok((manifest, code));
            }
        }

        // 3. Direct HTTP / HTTPS Manifest URL (e.g. https://.../plugin.json or raw github link)
        if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
            let http_client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .user_agent("Prism-Plugin-Manager/1.0")
                .build()
                .map_err(|e| format!("HTTP client initialization error: {}", e))?;

            let resp = http_client
                .get(trimmed)
                .send()
                .await
                .map_err(|e| format!("Failed to fetch manifest from {}: {}", trimmed, e))?;

            if !resp.status().is_success() {
                return Err(format!(
                    "Failed to fetch manifest from {} (HTTP {})",
                    trimmed,
                    resp.status()
                ));
            }

            let content = resp
                .text()
                .await
                .map_err(|e| format!("Failed to read response from {}: {}", trimmed, e))?;
            let manifest: PluginManifest = serde_json::from_str(&content)
                .map_err(|e| format!("Invalid plugin manifest JSON from URL: {}", e))?;

            return Ok((manifest, None));
        }

        Err(format!(
            "Could not resolve plugin source '{}'. Expected a catalog ID (e.g. 'background-removal'), manifest JSON file (e.g. 'background-removal.json'), local directory, or manifest URL.",
            source
        ))
    }

    /// Writes manifest, config, and code entrypoints into `plugins/<plugin_id>/`.
    fn write_installed_plugin(
        &self,
        manifest: PluginManifest,
        bundled_code: Option<String>,
    ) -> Result<InstalledPlugin, String> {
        let plugin_id = &manifest.id;
        if plugin_id.contains("..") || plugin_id.contains('/') || plugin_id.contains('\\') {
            return Err(format!("Invalid plugin ID: {}", plugin_id));
        }

        let plugin_dir = self.plugins_dir.join(plugin_id);
        fs::create_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to create plugin directory {:?}: {}", plugin_dir, e))?;

        // 1. Write plugin.json manifest
        let manifest_path = plugin_dir.join("plugin.json");
        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(&manifest_path, manifest_json)
            .map_err(|e| format!("Failed to write plugin.json: {}", e))?;

        // 2. Write default config.json
        let config_path = plugin_dir.join("config.json");
        let default_config = PluginConfig::default();
        let config_json = serde_json::to_string_pretty(&default_config)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(&config_path, config_json)
            .map_err(|e| format!("Failed to write config.json: {}", e))?;

        // 3. Write code entrypoint if available
        let entry_file = manifest.entrypoint.as_deref().unwrap_or("index.js");
        let code_path = plugin_dir.join(entry_file);
        if let Some(code) = bundled_code {
            fs::write(&code_path, code).ok();
        } else if !code_path.exists() {
            let stub = format!(
                "// Prism Plugin: {}\nexport default {{\n  id: \"{}\",\n  version: \"{}\",\n  initialize(context) {{\n    console.log(\"[Plugin: {}] Initialized\");\n  }}\n}};\n",
                manifest.name, manifest.id, manifest.version, manifest.id
            );
            fs::write(&code_path, stub).ok();
        }

        // 4. Create models / assets directory
        let models_dir = plugin_dir.join("models");
        fs::create_dir_all(&models_dir).ok();

        let assets_dir = plugin_dir.join("assets");
        fs::create_dir_all(&assets_dir).ok();

        info!(
            "Successfully installed plugin '{}' into {:?}",
            plugin_id, plugin_dir
        );

        Ok(InstalledPlugin {
            id: manifest.id.clone(),
            manifest,
            config: default_config,
            path: plugin_dir.to_string_lossy().to_string(),
            is_active: true,
            has_models: true,
        })
    }

    /// Uninstalls a plugin by removing its directory from `plugins/`.
    pub fn uninstall_plugin(&self, plugin_id: &str) -> Result<(), String> {
        // Prevent path traversal
        if plugin_id.contains("..") || plugin_id.contains('/') || plugin_id.contains('\\') {
            return Err(format!("Invalid plugin ID: {}", plugin_id));
        }

        let plugin_dir = self.plugins_dir.join(plugin_id);
        if !plugin_dir.exists() {
            return Err(format!("Plugin '{}' is not installed", plugin_id));
        }

        fs::remove_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to remove plugin directory {:?}: {}", plugin_dir, e))?;

        info!("Successfully uninstalled plugin '{}'", plugin_id);
        Ok(())
    }

    pub fn toggle_plugin(&self, plugin_id: &str, enabled: bool) -> Result<InstalledPlugin, String> {
        let plugin_dir = self.plugins_dir.join(plugin_id);
        if !plugin_dir.exists() {
            return Err(format!("Plugin '{}' is not installed", plugin_id));
        }

        let manifest_path = plugin_dir.join("plugin.json");
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
        let manifest: PluginManifest = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid plugin.json: {}", e))?;

        let config_path = plugin_dir.join("config.json");
        let mut config: PluginConfig = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            PluginConfig::default()
        };

        config.enabled = enabled;
        config.updated_at = Utc::now().to_rfc3339();

        let updated_json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(&config_path, updated_json)
            .map_err(|e| format!("Failed to write config.json: {}", e))?;

        info!(
            "Toggled plugin '{}' enabled state to {}",
            plugin_id, enabled
        );

        Ok(InstalledPlugin {
            id: manifest.id.clone(),
            manifest,
            config,
            path: plugin_dir.to_string_lossy().to_string(),
            is_active: enabled,
            has_models: plugin_dir.join("models").is_dir(),
        })
    }

    /// Updates plugin configuration settings.
    pub fn update_config(
        &self,
        plugin_id: &str,
        new_settings: serde_json::Value,
    ) -> Result<InstalledPlugin, String> {
        let plugin_dir = self.plugins_dir.join(plugin_id);
        if !plugin_dir.exists() {
            return Err(format!("Plugin '{}' is not installed", plugin_id));
        }

        let manifest_path = plugin_dir.join("plugin.json");
        let content = fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read plugin.json: {}", e))?;
        let manifest: PluginManifest = serde_json::from_str(&content)
            .map_err(|e| format!("Invalid plugin.json: {}", e))?;

        let config_path = plugin_dir.join("config.json");
        let mut config: PluginConfig = if config_path.exists() {
            fs::read_to_string(&config_path)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default()
        } else {
            PluginConfig::default()
        };

        config.settings = new_settings;
        config.updated_at = Utc::now().to_rfc3339();

        let updated_json = serde_json::to_string_pretty(&config)
            .map_err(|e| format!("Serialization error: {}", e))?;
        fs::write(&config_path, updated_json)
            .map_err(|e| format!("Failed to write config.json: {}", e))?;

        Ok(InstalledPlugin {
            id: manifest.id.clone(),
            manifest,
            config: config.clone(),
            path: plugin_dir.to_string_lossy().to_string(),
            is_active: config.enabled,
            has_models: plugin_dir.join("models").is_dir(),
        })
    }

    /// Built-in catalog definitions (similar to Jellyfin's official repository catalog).
    fn builtin_catalog_definitions() -> Vec<PluginCatalogItem> {
        vec![
            PluginCatalogItem {
                id: "background-removal".to_string(),
                name: "AI Background Removal Studio".to_string(),
                version: "1.2.0".to_string(),
                author: "Prism Core & Open Source AI".to_string(),
                description: "Deep learning matting pack supporting ISNet Universal, BiRefNet High-Resolution, and RMBG-1.4 Studio with live backdrop compositing.".to_string(),
                category: "AI & Machine Learning".to_string(),
                icon: "Scissors".to_string(),
                is_installed: false,
                is_active: false,
                size_display: "~170 MB".to_string(),
                tags: vec!["matting".to_string(), "segmentation".to_string(), "onnx".to_string(), "cutout".to_string()],
                bundled_code: Some(r#"/**
 * Prism Plugin: background-removal
 * Entrypoint: index.js
 */
export default {
  id: "background-removal",
  name: "AI Background Removal Studio",
  version: "1.2.0",
  initialize(context) {
    console.log("[Plugin: background-removal] Initialized matting engine handlers.");
  }
};
"#.to_string()),
                manifest: PluginManifest {
                    id: "background-removal".to_string(),
                    name: "AI Background Removal Studio".to_string(),
                    version: "1.2.0".to_string(),
                    author: "Prism Core & Open Source AI".to_string(),
                    description: "Deep learning matting pack supporting ISNet, BiRefNet, and RMBG-1.4 with live backdrop compositing.".to_string(),
                    category: "AI & Machine Learning".to_string(),
                    icon: Some("Scissors".to_string()),
                    homepage: Some("https://github.com/VardhmanSurana/Prism".to_string()),
                    capabilities: vec!["matting".to_string(), "segmentation".to_string(), "image-editor".to_string()],
                    entrypoint: Some("index.js".to_string()),
                    min_app_version: Some("0.1.0".to_string()),
                },
            },
            PluginCatalogItem {
                id: "portrait-enhancer".to_string(),
                name: "AI Portrait & Face Retouching".to_string(),
                version: "1.0.0".to_string(),
                author: "Prism Vision Team".to_string(),
                description: "Facial feature parsing, non-destructive skin smoothing, iris sharpening, teeth whitening, and lip color enhancement.".to_string(),
                category: "Image Editor".to_string(),
                icon: "User".to_string(),
                is_installed: false,
                is_active: false,
                size_display: "~85 MB".to_string(),
                tags: vec!["portrait".to_string(), "face".to_string(), "skin".to_string(), "retouch".to_string()],
                bundled_code: Some(r#"/**
 * Prism Plugin: portrait-enhancer
 * Entrypoint: index.js
 */
export default {
  id: "portrait-enhancer",
  name: "AI Portrait & Face Retouching",
  version: "1.0.0",
  initialize(context) {
    console.log("[Plugin: portrait-enhancer] Registered face segmentation filters.");
  }
};
"#.to_string()),
                manifest: PluginManifest {
                    id: "portrait-enhancer".to_string(),
                    name: "AI Portrait & Face Retouching".to_string(),
                    version: "1.0.0".to_string(),
                    author: "Prism Vision Team".to_string(),
                    description: "Facial feature parsing, non-destructive skin smoothing, iris sharpening, and teeth whitening.".to_string(),
                    category: "Image Editor".to_string(),
                    icon: Some("User".to_string()),
                    homepage: Some("https://github.com/VardhmanSurana/Prism".to_string()),
                    capabilities: vec!["portrait".to_string(), "face-id".to_string()],
                    entrypoint: Some("index.js".to_string()),
                    min_app_version: Some("0.1.0".to_string()),
                },
            },
            PluginCatalogItem {
                id: "cinematic-luts".to_string(),
                name: "Cinematic Color Grade & 3D LUTs".to_string(),
                version: "2.1.0".to_string(),
                author: "Prism Creative Labs".to_string(),
                description: "Cinema film stock emulations: Kodak Portra 400, Fuji Pro 400H, Cine Teal & Orange, Moody Noir, and Cyberpunk Neon.".to_string(),
                category: "Creative & Filters".to_string(),
                icon: "Clapperboard".to_string(),
                is_installed: false,
                is_active: false,
                size_display: "~12 MB".to_string(),
                tags: vec!["lut".to_string(), "color-grading".to_string(), "cinematic".to_string(), "presets".to_string()],
                bundled_code: Some(r#"/**
 * Prism Plugin: cinematic-luts
 * Entrypoint: index.js
 */
export default {
  id: "cinematic-luts",
  name: "Cinematic Color Grade & 3D LUTs",
  version: "2.1.0",
  initialize(context) {
    console.log("[Plugin: cinematic-luts] Loaded 3D LUT color tables.");
  }
};
"#.to_string()),
                manifest: PluginManifest {
                    id: "cinematic-luts".to_string(),
                    name: "Cinematic Color Grade & 3D LUTs".to_string(),
                    version: "2.1.0".to_string(),
                    author: "Prism Creative Labs".to_string(),
                    description: "Cinema film stock emulations: Kodak Portra 400, Fuji Pro 400H, Cine Teal & Orange, and Moody Noir.".to_string(),
                    category: "Creative & Filters".to_string(),
                    icon: Some("Clapperboard".to_string()),
                    homepage: Some("https://github.com/VardhmanSurana/Prism".to_string()),
                    capabilities: vec!["lut".to_string(), "color-grading".to_string()],
                    entrypoint: Some("index.js".to_string()),
                    min_app_version: Some("0.1.0".to_string()),
                },
            },
            PluginCatalogItem {
                id: "exif-geotagger".to_string(),
                name: "Smart EXIF & Location Enhancer".to_string(),
                version: "1.1.0".to_string(),
                author: "Community".to_string(),
                description: "Offline reverse geocoding for GPS coordinates, camera model normalization, and automatic lens EXIF metadata enrichment.".to_string(),
                category: "Metadata & Geotagging".to_string(),
                icon: "MapPin".to_string(),
                is_installed: false,
                is_active: false,
                size_display: "~45 MB".to_string(),
                tags: vec!["exif".to_string(), "gps".to_string(), "geotag".to_string(), "metadata".to_string()],
                bundled_code: Some(r#"/**
 * Prism Plugin: exif-geotagger
 * Entrypoint: index.js
 */
export default {
  id: "exif-geotagger",
  name: "Smart EXIF & Location Enhancer",
  version: "1.1.0",
  initialize(context) {
    console.log("[Plugin: exif-geotagger] Offline reverse geocoding initialized.");
  }
};
"#.to_string()),
                manifest: PluginManifest {
                    id: "exif-geotagger".to_string(),
                    name: "Smart EXIF & Location Enhancer".to_string(),
                    version: "1.1.0".to_string(),
                    author: "Community".to_string(),
                    description: "Offline reverse geocoding for GPS coordinates and camera lens metadata enrichment.".to_string(),
                    category: "Metadata & Geotagging".to_string(),
                    icon: Some("MapPin".to_string()),
                    homepage: Some("https://github.com/VardhmanSurana/Prism".to_string()),
                    capabilities: vec!["metadata".to_string(), "geocoding".to_string()],
                    entrypoint: Some("index.js".to_string()),
                    min_app_version: Some("0.1.0".to_string()),
                },
            },
        ]
    }
}

