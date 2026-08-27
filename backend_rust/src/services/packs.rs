use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tracing::{error, info, warn};

use crate::services::model_manager::{ModelDefinition, ModelFileDef};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackInputDef {
    #[serde(default = "default_input_name")]
    pub name: String,
    #[serde(default = "default_input_size")]
    pub size: [u32; 2], // [width, height]
    #[serde(default = "default_layout")]
    pub layout: String, // "NCHW" | "NHWC"
    #[serde(default = "default_mean")]
    pub mean: [f32; 3], // [R, G, B]
    #[serde(default = "default_std")]
    pub std: [f32; 3],  // [R, G, B]
}

fn default_input_name() -> String { "input.1".to_string() }
fn default_input_size() -> [u32; 2] { [1024, 1024] }
fn default_layout() -> String { "NCHW".to_string() }
fn default_mean() -> [f32; 3] { [0.485, 0.456, 0.406] }
fn default_std() -> [f32; 3] { [0.229, 0.224, 0.225] }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackOutputDef {
    #[serde(default = "default_postprocess")]
    pub postprocess: String, // "sigmoid" | "clamp" | "none"
    #[serde(default)]
    pub threshold: Option<f32>,
    #[serde(default)]
    pub output_index: Option<usize>,
    #[serde(default)]
    pub output_name: Option<String>,
}

fn default_postprocess() -> String { "sigmoid".to_string() }
fn default_license() -> String { "Apache-2.0".to_string() }

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackModelDef {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub file: String,
    #[serde(default)]
    pub input: PackInputDef,
    #[serde(default)]
    pub output: PackOutputDef,
    #[serde(default)]
    pub download: Option<PackDownloadDef>,
    #[serde(default = "default_license")]
    pub license: String,
    #[serde(default)]
    pub gated: bool,
    #[serde(default)]
    pub ack_required: bool,
}

impl Default for PackInputDef {
    fn default() -> Self {
        Self {
            name: default_input_name(),
            size: default_input_size(),
            layout: default_layout(),
            mean: default_mean(),
            std: default_std(),
        }
    }
}

impl Default for PackOutputDef {
    fn default() -> Self {
        Self {
            postprocess: default_postprocess(),
            threshold: None,
            output_index: Some(0),
            output_name: None,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackDownloadDef {
    pub url: String,
    #[serde(default)]
    pub sha256: Option<String>,
    pub size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackManifest {
    pub id: String,
    pub version: String,
    pub name: String,
    pub capability: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default = "default_license")]
    pub license: String,
    pub models: Vec<PackModelDef>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackModelStatus {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_installed: bool,
    pub is_verified: bool,
    pub file_path: String,
    pub disk_size_bytes: u64,
    pub expected_size_bytes: u64,
    pub license: String,
    pub gated: bool,
    pub ack_required: bool,
    pub license_acknowledged: bool,
    pub download_url: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackInfoResponse {
    pub id: String,
    pub version: String,
    pub name: String,
    pub capability: String,
    pub description: Option<String>,
    pub license: String,
    pub models: Vec<PackModelStatus>,
}

pub struct PackManager {
    packs_dir: PathBuf,
    models_dir: PathBuf,
    packs: Arc<RwLock<Vec<PackManifest>>>,
    acknowledged_licenses: Arc<RwLock<HashSet<String>>>,
}

impl PackManager {
    pub fn new(packs_dir: PathBuf, models_dir: PathBuf) -> Self {
        let manager = Self {
            packs_dir,
            models_dir,
            packs: Arc::new(RwLock::new(Vec::new())),
            acknowledged_licenses: Arc::new(RwLock::new(HashSet::new())),
        };

        manager.ensure_seed_packs();
        manager
    }

    pub fn ensure_seed_packs(&self) {
        if let Err(e) = std::fs::create_dir_all(&self.packs_dir) {
            error!("[PackManager] Failed to create packs directory {:?}: {}", self.packs_dir, e);
            return;
        }

        let bg_removal_pack_dir = self.packs_dir.join("background-removal");
        let manifest_file = bg_removal_pack_dir.join("pack.json");

        if !manifest_file.exists() {
            if let Err(e) = std::fs::create_dir_all(&bg_removal_pack_dir) {
                error!("[PackManager] Failed to create seed pack directory {:?}: {}", bg_removal_pack_dir, e);
                return;
            }

            let seed_manifest = Self::default_bg_removal_manifest();
            match serde_json::to_string_pretty(&seed_manifest) {
                Ok(json_str) => {
                    if let Err(e) = std::fs::write(&manifest_file, json_str) {
                        error!("[PackManager] Failed to write seed pack.json: {}", e);
                    } else {
                        info!("[PackManager] Initialized default seed pack at {:?}", manifest_file);
                    }
                }
                Err(e) => error!("[PackManager] Failed to serialize seed manifest: {}", e),
            }
        } else if let Ok(content) = std::fs::read_to_string(&manifest_file) {
            if let Ok(mut manifest) = serde_json::from_str::<PackManifest>(&content) {
                let default_manifest = Self::default_bg_removal_manifest();
                let mut updated = false;
                for def_model in default_manifest.models {
                    if !manifest.models.iter().any(|m| m.id == def_model.id) {
                        manifest.models.push(def_model);
                        updated = true;
                    }
                }
                if updated {
                    if let Ok(json_str) = serde_json::to_string_pretty(&manifest) {
                        let _ = std::fs::write(&manifest_file, json_str);
                        info!("[PackManager] Updated seed pack manifest with missing models at {:?}", manifest_file);
                    }
                }
            }
        }
    }

    pub fn default_bg_removal_manifest() -> PackManifest {
        PackManifest {
            id: "background-removal".to_string(),
            version: "1.0.0".to_string(),
            name: "Background Removal Studio".to_string(),
            capability: "image.matting".to_string(),
            description: Some("High-precision AI background removal, subject extraction, and alpha matting capability pack.".to_string()),
            author: Some("Prism AI Team".to_string()),
            license: "mixed-per-model".to_string(),
            models: vec![
                PackModelDef {
                    id: "isnet-general-use".to_string(),
                    name: "ISNet (High Quality Universal)".to_string(),
                    description: Some("Highly accurate 1024px dichotomic segmentation model for universal portrait & object cutout.".to_string()),
                    file: "isnet_general_use.onnx".to_string(),
                    input: PackInputDef {
                        name: "input_image".to_string(),
                        size: [1024, 1024],
                        layout: "NCHW".to_string(),
                        mean: [0.485, 0.456, 0.406],
                        std: [0.229, 0.224, 0.225],
                    },
                    output: PackOutputDef {
                        postprocess: "sigmoid".to_string(),
                        threshold: None,
                        output_index: Some(0),
                        output_name: None,
                    },
                    download: Some(PackDownloadDef {
                        url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx".to_string(),
                        sha256: None,
                        size_bytes: 178_648_008,
                    }),
                    license: "Apache-2.0".to_string(),
                    gated: false,
                    ack_required: false,
                },
                PackModelDef {
                    id: "birefnet".to_string(),
                    name: "BiRefNet (Bilateral Reference High-Res)".to_string(),
                    description: Some("State-of-the-art bilateral reference model with extreme edge and hair detail resolution.".to_string()),
                    file: "birefnet.onnx".to_string(),
                    input: PackInputDef {
                        name: "input_image".to_string(),
                        size: [1024, 1024],
                        layout: "NCHW".to_string(),
                        mean: [0.485, 0.456, 0.406],
                        std: [0.229, 0.224, 0.225],
                    },
                    output: PackOutputDef {
                        postprocess: "sigmoid".to_string(),
                        threshold: None,
                        output_index: Some(0),
                        output_name: None,
                    },
                    download: Some(PackDownloadDef {
                        url: "https://huggingface.co/onnx-community/BiRefNet-ONNX/resolve/main/onnx/model.onnx".to_string(),
                        sha256: None,
                        size_bytes: 450_000_000,
                    }),
                    license: "MIT".to_string(),
                    gated: false,
                    ack_required: false,
                },
                PackModelDef {
                    id: "rmbg-1.4".to_string(),
                    name: "RMBG-1.4 (BRIA Studio Matting)".to_string(),
                    description: Some("Commercial-grade image matting by BRIA AI. Gated under non-commercial creative license.".to_string()),
                    file: "rmbg_1_4.onnx".to_string(),
                    input: PackInputDef {
                        name: "input.1".to_string(),
                        size: [1024, 1024],
                        layout: "NCHW".to_string(),
                        mean: [0.5, 0.5, 0.5],
                        std: [1.0, 1.0, 1.0],
                    },
                    output: PackOutputDef {
                        postprocess: "sigmoid".to_string(),
                        threshold: None,
                        output_index: Some(0),
                        output_name: None,
                    },
                    download: Some(PackDownloadDef {
                        url: "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx".to_string(),
                        sha256: None,
                        size_bytes: 176_000_000,
                    }),
                    license: "Non-Commercial (BRIA)".to_string(),
                    gated: true,
                    ack_required: true,
                },
            ],
        }
    }

    pub async fn refresh(&self) {
        let mut loaded = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&self.packs_dir) {
            for entry in entries.flatten() {
                let pack_dir = entry.path();
                if pack_dir.is_dir() {
                    let manifest_path = pack_dir.join("pack.json");
                    if manifest_path.exists() {
                        match std::fs::read_to_string(&manifest_path) {
                            Ok(content) => match serde_json::from_str::<PackManifest>(&content) {
                                Ok(manifest) => {
                                    info!("[PackManager] Loaded pack '{}' v{}", manifest.id, manifest.version);
                                    loaded.push(manifest);
                                }
                                Err(e) => warn!("[PackManager] Invalid manifest in {:?}: {}", manifest_path, e),
                            },
                            Err(e) => warn!("[PackManager] Could not read {:?}: {}", manifest_path, e),
                        }
                    }
                }
            }
        }

        if loaded.is_empty() {
            loaded.push(Self::default_bg_removal_manifest());
        }

        *self.packs.write().unwrap() = loaded;
    }

    pub async fn get_packs_info(&self) -> Vec<PackInfoResponse> {
        let packs = self.packs.read().unwrap();
        let acks = self.acknowledged_licenses.read().unwrap();
        let mut responses = Vec::new();

        for pack in packs.iter() {
            let pack_dir = self.packs_dir.join(&pack.id);
            let mut model_statuses = Vec::new();

            for m in &pack.models {
                let model_path = pack_dir.join(&m.file);
                let plugin_path1 = std::path::Path::new("plugins").join(&pack.id).join("models").join(&m.file);
                let plugin_path2 = std::path::Path::new("plugins").join(&pack.id).join(&m.file);
                let alt_path = self.models_dir.join("matting").join(&m.file);
                let alt_path2 = self.models_dir.join("packs").join(&pack.id).join(&m.file);

                let effective_path = if model_path.exists() {
                    model_path
                } else if plugin_path1.exists() {
                    plugin_path1
                } else if plugin_path2.exists() {
                    plugin_path2
                } else if alt_path.exists() {
                    alt_path
                } else if alt_path2.exists() {
                    alt_path2
                } else {
                    model_path
                };

                let exists = effective_path.exists();
                let disk_size = if exists {
                    std::fs::metadata(&effective_path).map(|m| m.len()).unwrap_or(0)
                } else {
                    0
                };

                let expected_size = m.download.as_ref().map(|d| d.size_bytes).unwrap_or(0);
                let is_installed = exists && disk_size > 0;
                let is_acknowledged = !m.ack_required || acks.contains(&m.id);

                model_statuses.push(PackModelStatus {
                    id: m.id.clone(),
                    name: m.name.clone(),
                    description: m.description.clone(),
                    is_installed,
                    is_verified: is_installed && (expected_size == 0 || (disk_size as i64 - expected_size as i64).abs() < 50_000_000),
                    file_path: effective_path.to_string_lossy().to_string(),
                    disk_size_bytes: disk_size,
                    expected_size_bytes: expected_size,
                    license: m.license.clone(),
                    gated: m.gated,
                    ack_required: m.ack_required,
                    license_acknowledged: is_acknowledged,
                    download_url: m.download.as_ref().map(|d| d.url.clone()),
                    sha256: m.download.as_ref().and_then(|d| d.sha256.clone()),
                });
            }

            responses.push(PackInfoResponse {
                id: pack.id.clone(),
                version: pack.version.clone(),
                name: pack.name.clone(),
                capability: pack.capability.clone(),
                description: pack.description.clone(),
                license: pack.license.clone(),
                models: model_statuses,
            });
        }

        responses
    }

    pub async fn to_model_definitions(&self) -> Vec<ModelDefinition> {
        let packs = self.packs.read().unwrap();
        let mut defs = Vec::new();

        for pack in packs.iter() {
            let pack_id = &pack.id;
            for m in &pack.models {
                if let Some(ref dl) = m.download {
                    defs.push(ModelDefinition {
                        id: m.id.clone(),
                        name: m.name.clone(),
                        category: format!("Capability Pack: {}", pack.name),
                        description: m.description.clone().unwrap_or_else(|| format!("{} model weights", m.name)),
                        total_size_bytes: dl.size_bytes,
                        desktop_only: false,
                        license: Some(m.license.clone()),
                        gated: m.gated,
                        ack_required: m.ack_required,
                        files: vec![
                            ModelFileDef {
                                url: dl.url.clone(),
                                rel_path: format!("packs/{}/{}", pack_id, m.file),
                                expected_size_bytes: dl.size_bytes,
                                sha256: dl.sha256.clone(),
                            }
                        ],
                    });
                }
            }
        }

        defs
    }

    pub fn get_model_def(&self, model_id: &str) -> Option<(PackManifest, PackModelDef, PathBuf)> {
        let packs = self.packs.read().unwrap();
        for pack in packs.iter() {
            for m in &pack.models {
                if m.id == model_id {
                    let pack_dir = self.packs_dir.join(&pack.id);
                    let primary_path = pack_dir.join(&m.file);
                    let plugin_path1 = std::path::Path::new("plugins").join(&pack.id).join("models").join(&m.file);
                    let plugin_path2 = std::path::Path::new("plugins").join(&pack.id).join(&m.file);
                    let alt_path = self.models_dir.join("matting").join(&m.file);
                    let alt_path2 = self.models_dir.join("packs").join(&pack.id).join(&m.file);

                    let effective_path = if primary_path.exists() {
                        primary_path
                    } else if plugin_path1.exists() {
                        plugin_path1
                    } else if plugin_path2.exists() {
                        plugin_path2
                    } else if alt_path.exists() {
                        alt_path
                    } else if alt_path2.exists() {
                        alt_path2
                    } else {
                        primary_path
                    };

                    return Some((pack.clone(), m.clone(), effective_path));
                }
            }
        }
        None
    }

    pub fn acknowledge_license(&self, model_id: &str) {
        self.acknowledged_licenses.write().unwrap().insert(model_id.to_string());
    }

    pub async fn verify_model_file(&self, model_id: &str) -> Result<(bool, String), String> {
        let (_, model_def, path) = self.get_model_def(model_id)
            .ok_or_else(|| format!("Model '{}' not found in any capability pack", model_id))?;

        if !path.exists() {
            return Ok((false, format!("Model file does not exist at {:?}", path)));
        }

        let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
        if meta.len() == 0 {
            return Ok((false, "Model file is empty (0 bytes)".to_string()));
        }

        if let Some(ref dl) = model_def.download {
            if let Some(ref expected_hash) = dl.sha256 {
                info!("[PackManager] Computing SHA256 for {:?}...", path);
                let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
                let mut hasher = Sha256::new();
                std::io::copy(&mut file, &mut hasher).map_err(|e| e.to_string())?;
                let hash_bytes = hasher.finalize();
                let computed_hash = format!("{:x}", hash_bytes);

                if computed_hash.eq_ignore_ascii_case(expected_hash) {
                    return Ok((true, format!("Verified valid (SHA256: {})", computed_hash)));
                } else {
                    return Ok((false, format!("Checksum mismatch. Expected: {}, Got: {}", expected_hash, computed_hash)));
                }
            }
        }

        Ok((true, format!("File present ({} MB)", meta.len() / (1024 * 1024))))
    }
}
