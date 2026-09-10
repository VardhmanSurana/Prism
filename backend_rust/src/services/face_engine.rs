use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

use face_id::detector::{DetectedFace as FaceIdDetectedFace, ScrfdDetector};
use face_id::embedder::ArcFaceEmbedder;
use face_id::face_align::norm_crop;
use image::DynamicImage;
use rayon::prelude::*;
use tracing::info;

use super::ml_client::DetectedFace;
use super::onnx_helper;

/// FaceEngine holding SCRFD detector and ArcFace embedder.
/// Gender and age estimation is completely omitted to save memory and compute.
pub struct FaceEngine {
    detector: Mutex<ScrfdDetector>,
    embedder: Mutex<ArcFaceEmbedder>,
}

impl FaceEngine {
    /// Performs detection and 512-d embedding extraction without gender/age estimation.
    pub fn analyze(&self, img: &DynamicImage) -> Result<Vec<(FaceIdDetectedFace, Vec<f32>)>, String> {
        let rgb_img = img.to_rgb8();

        // 1. Detect faces and landmarks
        let detections = self
            .detector
            .lock()
            .map_err(|_| "SCRFD detector mutex poisoned".to_string())?
            .detect(img)
            .map_err(|e| format!("Face detection failed: {}", e))?;

        if detections.is_empty() {
            return Ok(Vec::new());
        }

        // 2. Parallel landmark alignment via norm_crop (Umeyama 5-point similarity transform)
        let (width, height) = (rgb_img.width() as f32, rgb_img.height() as f32);
        let valid_and_crops: Vec<(FaceIdDetectedFace, image::RgbImage)> = detections
            .into_par_iter()
            .filter_map(|det| {
                let landmarks = det.landmarks.as_ref()?;
                if landmarks.len() != 5 {
                    return None;
                }
                let lms_array: [(f32, f32); 5] = [
                    (landmarks[0].0 * width, landmarks[0].1 * height),
                    (landmarks[1].0 * width, landmarks[1].1 * height),
                    (landmarks[2].0 * width, landmarks[2].1 * height),
                    (landmarks[3].0 * width, landmarks[3].1 * height),
                    (landmarks[4].0 * width, landmarks[4].1 * height),
                ];
                let crop = norm_crop(&rgb_img, &lms_array, 112);
                Some((det, crop))
            })
            .collect();

        if valid_and_crops.is_empty() {
            return Ok(Vec::new());
        }

        let (valid_detections, embed_crops): (Vec<_>, Vec<_>) = valid_and_crops.into_iter().unzip();

        // 3. Batch compute 512-d L2-normalized embeddings via ArcFace
        let embeddings = self
            .embedder
            .lock()
            .map_err(|_| "ArcFace embedder mutex poisoned".to_string())?
            .compute_embeddings_batch(&embed_crops)
            .map_err(|e| format!("Face embedding failed: {}", e))?;

        if embeddings.len() != valid_detections.len() {
            return Err(format!(
                "Embedding count mismatch: expected {}, got {}",
                valid_detections.len(),
                embeddings.len()
            ));
        }

        Ok(valid_detections.into_iter().zip(embeddings).collect())
    }
}

/// Lazily-initialized in-process face engine (SCRFD + ArcFace via ONNX Runtime).
static ENGINE: OnceLock<Mutex<Option<Arc<FaceEngine>>>> = OnceLock::new();

fn engine_cache() -> &'static Mutex<Option<Arc<FaceEngine>>> {
    ENGINE.get_or_init(|| Mutex::new(None))
}

/// Helper to search for local model path with fallback variants.
fn find_model_path(relative: &str) -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("MODELS_DIR") {
        let p = Path::new(&dir).join(relative);
        if p.exists() {
            return Some(p);
        }
    }
    let candidates = [
        format!("models/{}", relative),
        format!("../models/{}", relative),
    ];
    for c in &candidates {
        let p = PathBuf::from(c);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Build or load SCRFD detector from local file or HuggingFace.
async fn load_detector(model_path: Option<&Path>) -> Result<ScrfdDetector, String> {
    if let Some(path) = model_path {
        info!("[FaceEngine] Loading local SCRFD detector from: {}", path.display());
        if onnx_helper::is_cuda_usable() {
            let ep = [ort::ep::CUDA::default().build()];
            match ScrfdDetector::builder(path)
                .with_execution_providers(&ep)
                .build()
            {
                Ok(detector) => {
                    info!("[FaceEngine] SCRFD detector loaded with CUDA GPU acceleration from {}", path.display());
                    return Ok(detector);
                }
                Err(e) => {
                    info!("[FaceEngine] SCRFD detector CUDA initialization failed ({}), falling back to CPU", e);
                }
            }
        }
        return ScrfdDetector::builder(path)
            .build()
            .map(|det| {
                info!("[FaceEngine] SCRFD detector loaded on CPU from {}", path.display());
                det
            })
            .map_err(|e| format!("Failed to load local SCRFD detector from {}: {}", path.display(), e));
    }

    info!("[FaceEngine] Local SCRFD detector not found, downloading/loading from HuggingFace...");
    if onnx_helper::is_cuda_usable() {
        let ep = [ort::ep::CUDA::default().build()];
        match ScrfdDetector::from_hf()
            .with_execution_providers(&ep)
            .build()
            .await
        {
            Ok(detector) => {
                info!("[FaceEngine] SCRFD detector loaded with CUDA GPU acceleration from HuggingFace");
                return Ok(detector);
            }
            Err(e) => {
                info!("[FaceEngine] SCRFD detector CUDA initialization failed ({}), falling back to CPU", e);
            }
        }
    }

    ScrfdDetector::from_hf()
        .build()
        .await
        .map(|det| {
            info!("[FaceEngine] SCRFD detector loaded on CPU from HuggingFace");
            det
        })
        .map_err(|e| format!("Failed to load SCRFD detector from HuggingFace: {}", e))
}

/// Build or load ArcFace embedder from local file or HuggingFace.
async fn load_embedder(model_path: Option<&Path>) -> Result<ArcFaceEmbedder, String> {
    if let Some(path) = model_path {
        info!("[FaceEngine] Loading local ArcFace embedder from: {}", path.display());
        if onnx_helper::is_cuda_usable() {
            let ep = [ort::ep::CUDA::default().build()];
            match ArcFaceEmbedder::builder(path)
                .with_execution_providers(&ep)
                .build()
            {
                Ok(embedder) => {
                    info!("[FaceEngine] ArcFace embedder loaded with CUDA GPU acceleration from {}", path.display());
                    return Ok(embedder);
                }
                Err(e) => {
                    info!("[FaceEngine] ArcFace embedder CUDA initialization failed ({}), falling back to CPU", e);
                }
            }
        }
        return ArcFaceEmbedder::builder(path)
            .build()
            .map(|emb| {
                info!("[FaceEngine] ArcFace embedder loaded on CPU from {}", path.display());
                emb
            })
            .map_err(|e| format!("Failed to load local ArcFace embedder from {}: {}", path.display(), e));
    }

    info!("[FaceEngine] Local ArcFace embedder not found, downloading/loading from HuggingFace...");
    if onnx_helper::is_cuda_usable() {
        let ep = [ort::ep::CUDA::default().build()];
        match ArcFaceEmbedder::from_hf()
            .with_execution_providers(&ep)
            .build()
            .await
        {
            Ok(embedder) => {
                info!("[FaceEngine] ArcFace embedder loaded with CUDA GPU acceleration from HuggingFace");
                return Ok(embedder);
            }
            Err(e) => {
                info!("[FaceEngine] ArcFace embedder CUDA initialization failed ({}), falling back to CPU", e);
            }
        }
    }

    ArcFaceEmbedder::from_hf()
        .build()
        .await
        .map(|emb| {
            info!("[FaceEngine] ArcFace embedder loaded on CPU from HuggingFace");
            emb
        })
        .map_err(|e| format!("Failed to load ArcFace embedder from HuggingFace: {}", e))
}

/// get_engine - Retrieves engine or initializes it lazily.
async fn get_engine() -> Result<Arc<FaceEngine>, String> {
    if let Some(engine) = engine_cache().lock().map_err(|_| "face model cache lock poisoned".to_string())?.as_ref() {
        return Ok(Arc::clone(engine));
    }

    info!("[FaceEngine] Initializing optimized in-process face engine...");

    let det_path = find_model_path("face/scrfd_500m_kps.onnx")
        .or_else(|| find_model_path("face/det_10g.onnx"));
    let rec_path = find_model_path("face/w600k_mbf.onnx")
        .or_else(|| find_model_path("face/w600k_r50.onnx"));

    let detector = load_detector(det_path.as_deref()).await?;
    let embedder = load_embedder(rec_path.as_deref()).await?;

    let engine = Arc::new(FaceEngine {
        detector: Mutex::new(detector),
        embedder: Mutex::new(embedder),
    });

    info!("[FaceEngine] Face engine ready (detection + landmark alignment + embeddings)");
    let mut cache = engine_cache().lock().map_err(|_| "face model cache lock poisoned".to_string())?;
    Ok(Arc::clone(cache.get_or_insert(engine)))
}

/// Releases the face detector/embedding model after editor face restoration.
pub fn unload() -> bool {
    engine_cache()
        .lock()
        .map(|mut cache| cache.take().is_some())
        .unwrap_or(false)
}

/// Scan a photo for faces in-process. Boxes are absolute pixel [x, y, w, h],
/// embeddings are 512-d L2-normalized vectors (same contract as the old
/// Python /ml/face endpoint).
pub async fn scan_faces(photo_path: &str) -> Result<Vec<DetectedFace>, String> {
    let engine = get_engine().await?;

    // Content-sniff the format instead of trusting the extension — photos
    // with mislabeled extensions (e.g. JPEG named .png) are common in real
    // libraries, and image::open() guesses by extension only.
    let bytes = std::fs::read(photo_path)
        .map_err(|e| format!("Failed to read {}: {}", photo_path, e))?;
    let format = image::guess_format(&bytes)
        .map_err(|e| format!("Unsupported image format for {}: {}", photo_path, e))?;
    let img = image::load_from_memory_with_format(&bytes, format)
        .map_err(|e| format!("Failed to decode {}: {}", photo_path, e))?;
    let (width, height) = (img.width(), img.height());

    let engine = engine.clone();
    let faces = tokio::task::spawn_blocking(move || engine.analyze(&img))
        .await
        .map_err(|e| format!("Face inference task panicked: {}", e))?
        .map_err(|e| format!("Face analysis failed: {}", e))?;

    let mut results = Vec::with_capacity(faces.len());
    for (det, embedding) in faces {
        let abs_det = det.to_absolute(width, height);
        let b = abs_det.bbox;
        let box_json = serde_json::to_string(&[
            b.x1.round() as i64,
            b.y1.round() as i64,
            (b.x2 - b.x1).round() as i64,
            (b.y2 - b.y1).round() as i64,
        ])
        .unwrap_or_default();
        let embedding_json = serde_json::to_string(&embedding).unwrap_or_default();
        results.push(DetectedFace {
            confidence: abs_det.score as f64,
            box_json,
            embedding_json,
        });
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_local_model_paths_resolution() {
        let det_path = find_model_path("face/scrfd_500m_kps.onnx")
            .or_else(|| find_model_path("face/det_10g.onnx"));
        let rec_path = find_model_path("face/w600k_mbf.onnx")
            .or_else(|| find_model_path("face/w600k_r50.onnx"));

        assert!(det_path.is_some(), "SCRFD detector model should be found locally");
        assert!(rec_path.is_some(), "ArcFace embedder model should be found locally");
        assert!(det_path.unwrap().exists());
        assert!(rec_path.unwrap().exists());
    }

    #[tokio::test]
    async fn test_face_engine_scan_and_unload() {
        let candidates = [
            "../frontend/public/sample_images/woman.png",
            "frontend/public/sample_images/woman.png",
        ];
        let sample_path = candidates.iter().find(|p| Path::new(p).exists());
        if sample_path.is_none() {
            eprintln!("[test] Skipping face scan test, woman.png not found");
            return;
        }
        let sample_path = sample_path.unwrap();

        // Ensure clean state
        unload();

        let faces = scan_faces(sample_path)
            .await
            .expect("scan_faces should succeed on woman.png");

        assert!(!faces.is_empty(), "Should detect at least 1 face in woman.png");
        let first = &faces[0];
        assert!(first.confidence >= 0.5, "Confidence score should be >= 0.5");

        let bbox: Vec<i64> = serde_json::from_str(&first.box_json).expect("valid box_json");
        assert_eq!(bbox.len(), 4, "bbox must be [x, y, w, h]");
        assert!(bbox[2] > 0, "width must be > 0");
        assert!(bbox[3] > 0, "height must be > 0");

        let embedding: Vec<f32> = serde_json::from_str(&first.embedding_json).expect("valid embedding_json");
        assert_eq!(embedding.len(), 512, "ArcFace embedding must be 512 dimensions");

        // Verify L2 normalization: sum(x^2) should be ~1.0
        let norm_sq: f32 = embedding.iter().map(|x| x * x).sum();
        assert!((norm_sq - 1.0).abs() < 0.01, "Embedding should be L2-normalized, norm_sq = {}", norm_sq);

        // Test unload
        assert!(unload(), "unload() should return true when engine was cached");
        assert!(!unload(), "subsequent unload() should return false");
    }
}

