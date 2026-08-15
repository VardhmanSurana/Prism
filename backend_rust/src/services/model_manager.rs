use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use tokio::sync::{Mutex, RwLock};
use tracing::{error, info};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelFileDef {
    pub url: String,
    pub rel_path: String,
    pub expected_size_bytes: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub total_size_bytes: u64,
    pub desktop_only: bool,
    pub files: Vec<ModelFileDef>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelProgress {
    pub model_id: String,
    pub status: String, // "not_downloaded" | "downloading" | "completed" | "error" | "paused"
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub download_speed_bps: f64,
    pub progress_percent: f32,
    pub elapsed_seconds: u64,
    pub eta_seconds: Option<u64>,
    pub error_message: Option<String>,
    pub updated_at_ms: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ModelInfoResponse {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub total_size_bytes: u64,
    pub desktop_only: bool,
    pub is_downloaded: bool,
    pub disk_size_bytes: u64,
    pub progress: Option<ModelProgress>,
}

pub struct ModelManager {
    models_dir: PathBuf,
    models: Vec<ModelDefinition>,
    active_progress: Arc<RwLock<HashMap<String, ModelProgress>>>,
    abort_handles: Arc<Mutex<HashMap<String, tokio::task::AbortHandle>>>,
}

impl ModelManager {
    pub fn new(models_dir: PathBuf) -> Self {
        let models = Self::default_model_registry();
        Self {
            models_dir,
            models,
            active_progress: Arc::new(RwLock::new(HashMap::new())),
            abort_handles: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn default_model_registry() -> Vec<ModelDefinition> {
        vec![
            ModelDefinition {
                id: "siglip2".to_string(),
                name: "SigLIP 2 Vision & Text".to_string(),
                category: "Vision & Natural Language Search".to_string(),
                description: "Deep semantic search model enabling free-form natural language queries for photos.".to_string(),
                total_size_bytes: 452_000_000,
                desktop_only: false,
                files: vec![
                    ModelFileDef {
                        url: "https://huggingface.co/google/siglip2-base-patch16-224/resolve/main/onnx/model.onnx".to_string(),
                        rel_path: "llm/siglip2_image.onnx".to_string(),
                        expected_size_bytes: 350_000_000,
                    },
                    ModelFileDef {
                        url: "https://huggingface.co/google/siglip2-base-patch16-224/resolve/main/onnx/text_model.onnx".to_string(),
                        rel_path: "llm/siglip2_text.onnx".to_string(),
                        expected_size_bytes: 100_000_000,
                    },
                    ModelFileDef {
                        url: "https://huggingface.co/google/siglip2-base-patch16-224/resolve/main/tokenizer.json".to_string(),
                        rel_path: "llm/tokenizer.json".to_string(),
                        expected_size_bytes: 2_000_000,
                    },
                ],
            },
            ModelDefinition {
                id: "face_id".to_string(),
                name: "Face Recognition & Clustering".to_string(),
                category: "People & Biometrics".to_string(),
                description: "SCRFD detector + ArcFace embedding model for automatic face grouping and people tagging.".to_string(),
                total_size_bytes: 200_000_000,
                desktop_only: false,
                files: vec![
                    ModelFileDef {
                        url: "https://huggingface.co/deepinsight/insightface/resolve/main/models/buffalo_l/scrfd_500m_kps.onnx".to_string(),
                        rel_path: "face/scrfd_500m_kps.onnx".to_string(),
                        expected_size_bytes: 15_000_000,
                    },
                    ModelFileDef {
                        url: "https://huggingface.co/deepinsight/insightface/resolve/main/models/buffalo_l/w600k_mbf.onnx".to_string(),
                        rel_path: "face/w600k_mbf.onnx".to_string(),
                        expected_size_bytes: 185_000_000,
                    },
                ],
            },
            ModelDefinition {
                id: "yolo_objects".to_string(),
                name: "YOLOv8 Object Detection".to_string(),
                category: "Object & Scene Tags".to_string(),
                description: "Classifies and locates 80+ categories of objects, pets, vehicles, and scenes.".to_string(),
                total_size_bytes: 25_000_000,
                desktop_only: false,
                files: vec![
                    ModelFileDef {
                        url: "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.onnx".to_string(),
                        rel_path: "objects/yolov8n.onnx".to_string(),
                        expected_size_bytes: 25_000_000,
                    },
                ],
            },
            ModelDefinition {
                id: "mobile_sam".to_string(),
                name: "Segment Anything (MobileSAM)".to_string(),
                category: "Smart Cutout & Segmentation".to_string(),
                description: "Ultra-fast interactive foreground extraction and precise mask segmentation.".to_string(),
                total_size_bytes: 40_000_000,
                desktop_only: false,
                files: vec![
                    ModelFileDef {
                        url: "https://github.com/ChaoningZhang/MobileSAM/raw/master/weights/mobile_sam.onnx".to_string(),
                        rel_path: "sam/mobile_sam.onnx".to_string(),
                        expected_size_bytes: 40_000_000,
                    },
                ],
            },
            ModelDefinition {
                id: "rapid_ocr".to_string(),
                name: "RapidOCR / PP-OCRv4 (Text Extraction)".to_string(),
                category: "Document & Receipt OCR".to_string(),
                description: "Lightweight neural text detection & recognition for receipts, documents, and signs.".to_string(),
                total_size_bytes: 14_000_000,
                desktop_only: false,
                files: vec![
                    ModelFileDef {
                        url: "https://github.com/RapidAI/RapidOCR/releases/download/v1.1.0/ch_PP-OCRv4_det_infer.onnx".to_string(),
                        rel_path: "ocr/ch_PP-OCRv4_det_infer.onnx".to_string(),
                        expected_size_bytes: 4_500_000,
                    },
                    ModelFileDef {
                        url: "https://github.com/RapidAI/RapidOCR/releases/download/v1.1.0/ch_PP-OCRv4_rec_infer.onnx".to_string(),
                        rel_path: "ocr/ch_PP-OCRv4_rec_infer.onnx".to_string(),
                        expected_size_bytes: 9_500_000,
                    },
                ],
            },
        ]
    }

    pub fn check_model_on_disk(&self, model: &ModelDefinition) -> (bool, u64) {
        let mut all_exist = true;
        let mut total_disk_size = 0u64;

        for file_def in &model.files {
            let path = self.models_dir.join(&file_def.rel_path);
            if path.exists() {
                if let Ok(meta) = std::fs::metadata(&path) {
                    total_disk_size += meta.len();
                } else {
                    all_exist = false;
                }
            } else {
                all_exist = false;
            }
        }

        (all_exist && !model.files.is_empty(), total_disk_size)
    }

    pub async fn list_models(&self) -> Vec<ModelInfoResponse> {
        let progress_guard = self.active_progress.read().await;
        let mut responses = Vec::new();

        for model in &self.models {
            let (is_downloaded, disk_size) = self.check_model_on_disk(model);
            let progress = progress_guard.get(&model.id).cloned();

            responses.push(ModelInfoResponse {
                id: model.id.clone(),
                name: model.name.clone(),
                category: model.category.clone(),
                description: model.description.clone(),
                total_size_bytes: model.total_size_bytes,
                desktop_only: model.desktop_only,
                is_downloaded,
                disk_size_bytes: disk_size,
                progress,
            });
        }

        responses
    }

    pub async fn get_all_progress(&self) -> HashMap<String, ModelProgress> {
        self.active_progress.read().await.clone()
    }

    pub async fn start_download(&self, model_id: &str) -> Result<(), String> {
        let model = self
            .models
            .iter()
            .find(|m| m.id == model_id)
            .cloned()
            .ok_or_else(|| format!("Model '{}' not found", model_id))?;

        // Check if already downloading
        {
            let guard = self.active_progress.read().await;
            if let Some(p) = guard.get(model_id) {
                if p.status == "downloading" {
                    return Ok(());
                }
            }
        }

        let models_dir = self.models_dir.clone();
        let active_progress = self.active_progress.clone();
        let abort_handles = self.abort_handles.clone();
        let model_id_owned = model_id.to_string();

        let initial_progress = ModelProgress {
            model_id: model_id.to_string(),
            status: "downloading".to_string(),
            bytes_downloaded: 0,
            total_bytes: model.total_size_bytes,
            download_speed_bps: 0.0,
            progress_percent: 0.0,
            elapsed_seconds: 0,
            eta_seconds: None,
            error_message: None,
            updated_at_ms: std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        };

        self.active_progress
            .write()
            .await
            .insert(model_id.to_string(), initial_progress);

        let task = tokio::spawn(async move {
            info!("[ModelManager] Starting download for model: {}", model.id);
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(3600))
                .build()
                .unwrap_or_default();

            let start_time = Instant::now();
            let mut total_downloaded_across_files = 0u64;
            let mut last_sample_time = Instant::now();
            let mut last_sample_bytes = 0u64;

            for file_def in &model.files {
                let target_path = models_dir.join(&file_def.rel_path);
                if let Some(parent) = target_path.parent() {
                    if let Err(e) = tokio::fs::create_dir_all(parent).await {
                        error!("[ModelManager] Failed to create dir {:?}: {}", parent, e);
                        Self::set_error(&active_progress, &model.id, &format!("Failed to create directories: {}", e)).await;
                        return;
                    }
                }

                let part_path = target_path.with_extension(format!("{}.part", target_path.extension().unwrap_or_default().to_string_lossy()));

                let mut response = match client.get(&file_def.url).send().await {
                    Ok(resp) if resp.status().is_success() => resp,
                    Ok(resp) => {
                        let err_msg = format!("HTTP error {} downloading {}", resp.status(), file_def.rel_path);
                        error!("[ModelManager] {}", err_msg);
                        Self::set_error(&active_progress, &model.id, &err_msg).await;
                        return;
                    }
                    Err(e) => {
                        let err_msg = format!("Network error: {}", e);
                        error!("[ModelManager] {}", err_msg);
                        Self::set_error(&active_progress, &model.id, &err_msg).await;
                        return;
                    }
                };

                let mut file = match tokio::fs::File::create(&part_path).await {
                    Ok(f) => f,
                    Err(e) => {
                        let err_msg = format!("Failed to create output file: {}", e);
                        error!("[ModelManager] {}", err_msg);
                        Self::set_error(&active_progress, &model.id, &err_msg).await;
                        return;
                    }
                };

                use tokio::io::AsyncWriteExt;

                loop {
                    match response.chunk().await {
                        Ok(Some(chunk)) => {
                            if let Err(e) = file.write_all(&chunk).await {
                                let err_msg = format!("Write error: {}", e);
                                error!("[ModelManager] {}", err_msg);
                                Self::set_error(&active_progress, &model.id, &err_msg).await;
                                return;
                            }

                            total_downloaded_across_files += chunk.len() as u64;

                            // Calculate live telemetry metrics every 200ms
                            let now = Instant::now();
                            let sample_elapsed = now.duration_since(last_sample_time).as_secs_f64();

                            if sample_elapsed >= 0.2 {
                                let bytes_delta = total_downloaded_across_files.saturating_sub(last_sample_bytes);
                                let speed_bps = (bytes_delta as f64) / sample_elapsed.max(0.001);
                                let elapsed_sec = start_time.elapsed().as_secs();

                                let remaining_bytes = model.total_size_bytes.saturating_sub(total_downloaded_across_files);
                                let eta_sec = if speed_bps > 1000.0 {
                                    Some((remaining_bytes as f64 / speed_bps).ceil() as u64)
                                } else {
                                    None
                                };

                                let pct = ((total_downloaded_across_files as f64 / model.total_size_bytes as f64) * 100.0).min(99.9) as f32;

                                {
                                    let mut guard = active_progress.write().await;
                                    if let Some(p) = guard.get_mut(&model.id) {
                                        p.bytes_downloaded = total_downloaded_across_files;
                                        p.download_speed_bps = speed_bps;
                                        p.progress_percent = pct;
                                        p.elapsed_seconds = elapsed_sec;
                                        p.eta_seconds = eta_sec;
                                        p.updated_at_ms = std::time::SystemTime::now()
                                            .duration_since(UNIX_EPOCH)
                                            .unwrap_or_default()
                                            .as_millis() as u64;
                                    }
                                }

                                last_sample_time = now;
                                last_sample_bytes = total_downloaded_across_files;
                            }
                        }
                        Ok(None) => {
                            break;
                        }
                        Err(e) => {
                            let err_msg = format!("Stream error during download: {}", e);
                            error!("[ModelManager] {}", err_msg);
                            Self::set_error(&active_progress, &model.id, &err_msg).await;
                            return;
                        }
                    }
                }

                file.flush().await.ok();
                drop(file);

                // Rename part file to final target file
                if let Err(e) = tokio::fs::rename(&part_path, &target_path).await {
                    let err_msg = format!("Failed to finalize model file {:?}: {}", target_path, e);
                    error!("[ModelManager] {}", err_msg);
                    Self::set_error(&active_progress, &model.id, &err_msg).await;
                    return;
                }
            }

            info!("[ModelManager] Model {} download complete!", model.id);
            {
                let mut guard = active_progress.write().await;
                if let Some(p) = guard.get_mut(&model.id) {
                    p.status = "completed".to_string();
                    p.bytes_downloaded = model.total_size_bytes;
                    p.progress_percent = 100.0;
                    p.download_speed_bps = 0.0;
                    p.eta_seconds = Some(0);
                    p.elapsed_seconds = start_time.elapsed().as_secs();
                    p.updated_at_ms = std::time::SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;
                }
            }

            abort_handles.lock().await.remove(&model.id);
        });

        self.abort_handles
            .lock()
            .await
            .insert(model_id_owned, task.abort_handle());

        Ok(())
    }

    async fn set_error(progress_map: &Arc<RwLock<HashMap<String, ModelProgress>>>, model_id: &str, error: &str) {
        let mut guard = progress_map.write().await;
        if let Some(p) = guard.get_mut(model_id) {
            p.status = "error".to_string();
            p.error_message = Some(error.to_string());
            p.download_speed_bps = 0.0;
            p.eta_seconds = None;
            p.updated_at_ms = std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64;
        }
    }

    pub async fn cancel_download(&self, model_id: &str) -> Result<(), String> {
        if let Some(handle) = self.abort_handles.lock().await.remove(model_id) {
            handle.abort();
        }

        let mut guard = self.active_progress.write().await;
        if let Some(p) = guard.get_mut(model_id) {
            p.status = "paused".to_string();
            p.download_speed_bps = 0.0;
            p.eta_seconds = None;
        }

        Ok(())
    }

    pub async fn delete_model(&self, model_id: &str) -> Result<(), String> {
        self.cancel_download(model_id).await.ok();

        let model = self
            .models
            .iter()
            .find(|m| m.id == model_id)
            .ok_or_else(|| format!("Model '{}' not found", model_id))?;

        for file_def in &model.files {
            let target_path = self.models_dir.join(&file_def.rel_path);
            let part_path = target_path.with_extension(format!("{}.part", target_path.extension().unwrap_or_default().to_string_lossy()));

            if target_path.exists() {
                std::fs::remove_file(&target_path).map_err(|e| format!("Failed to delete {:?}: {}", target_path, e))?;
            }
            if part_path.exists() {
                std::fs::remove_file(&part_path).ok();
            }
        }

        self.active_progress.write().await.remove(model_id);
        info!("[ModelManager] Model {} deleted successfully", model_id);
        Ok(())
    }
}
