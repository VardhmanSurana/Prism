use std::sync::{Arc, OnceLock};

use face_id::analyzer::FaceAnalyzer;
use tracing::info;

use super::ml_client::DetectedFace;

/// Lazily-initialized in-process face engine (SCRFD + ArcFace via ONNX Runtime).
/// Built on first use — downloads ~200MB of models from HuggingFace once.
static ENGINE: OnceLock<Arc<FaceAnalyzer>> = OnceLock::new();

/// get_engine - Retrieves engine.
async fn get_engine() -> Result<Arc<FaceAnalyzer>, String> {
    if let Some(engine) = ENGINE.get() {
        return Ok(engine.clone());
    }

    info!("[FaceEngine] Building in-process face analyzer (first run downloads models from HuggingFace)...");
    let engine = FaceAnalyzer::from_hf()
        .build()
        .await
        .map_err(|e| format!("Failed to init face analyzer: {}", e))?;
    let engine = Arc::new(engine);
    info!("[FaceEngine] Face analyzer ready");
    Ok(ENGINE.get_or_init(|| engine).clone())
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
    for face in faces {
        let det = face.detection.to_absolute(width, height);
        let b = det.bbox;
        let box_json = serde_json::to_string(&[
            b.x1.round() as i64,
            b.y1.round() as i64,
            (b.x2 - b.x1).round() as i64,
            (b.y2 - b.y1).round() as i64,
        ])
        .unwrap_or_default();
        let embedding_json = serde_json::to_string(&face.embedding).unwrap_or_default();
        results.push(DetectedFace {
            confidence: det.score as f64,
            box_json,
            embedding_json,
        });
    }
    Ok(results)
}
