use axum::extract::Path;
use axum::response::Json;
use serde_json::{json, Value};

/// get_privacy_status - Retrieves get privacy status.
pub async fn get_privacy_status() -> Json<Value> {
    Json(json!({
        "summary": {
            "total_features": 4, "enabled": 4, "disabled": 0,
            "total_network_endpoints": 0, "all_local": true,
            "verdict": "All features execute completely on-device without remote telemetry or cloud dependency."
        },
        "features": [
            { "id": "semantic_search", "label": "Semantic Vector Search", "enabled": true, "description": "On-device SigLIP embedding generation for natural language image retrieval", "network_calls": [], "what_runs_locally": ["Image vector embeddings", "Local cosine similarity search index"], "what_is_sent": "Zero data transmitted. Fully airgapped on local CPU/GPU.", "model": "SigLIP-Base-384" },
            { "id": "face_detection", "label": "Face Recognition & Clustering", "enabled": true, "description": "Local face bounding box detection and identity grouping", "network_calls": [], "what_runs_locally": ["Face detection & cropping", "Euclidean vector distance clustering"], "what_is_sent": "Zero data transmitted. Kept in local SQLite index.", "model": "InsightFace / SCRFD" },
            { "id": "ocr_text", "label": "Text & Document OCR", "enabled": true, "description": "On-device document classification and optical character recognition", "network_calls": [], "what_runs_locally": ["Text extraction from images", "Document indexing"], "what_is_sent": "Zero data transmitted. Processed 100% on local machine.", "model": "PaddleOCR / Tesseract" },
            { "id": "inpainting", "label": "AI Object Removal & Inpainting", "enabled": true, "description": "Generative mask removal and background restoration", "network_calls": [], "what_runs_locally": ["Canvas mask tensor generation", "Inpainting diffusion pass"], "what_is_sent": "Zero data transmitted. Runs inside local PyTorch runtime.", "model": "LaMa / Stable Diffusion Inpainting" }
        ]
    }))
}


/// GET /api/v1/privacy/feature/:feature_id — Return detailed privacy info for a specific feature.
pub async fn get_privacy_feature_detail(
    Path(feature_id): Path<String>,
) -> Json<Value> {
    let features = [
        ("semantic_search", "Semantic Vector Search", "On-device SigLIP embedding generation for natural language image retrieval", "SigLIP-Base-384", vec!["Image vector embeddings", "Local cosine similarity search index"]),
        ("face_detection", "Face Recognition & Clustering", "Local face bounding box detection and identity grouping", "InsightFace / SCRFD", vec!["Face detection & cropping", "Euclidean vector distance clustering"]),
        ("ocr_text", "Text & Document OCR", "On-device document classification and optical character recognition", "PaddleOCR / Tesseract", vec!["Text extraction from images", "Document indexing"]),
        ("inpainting", "AI Object Removal & Inpainting", "Generative mask removal and background restoration", "LaMa / Stable Diffusion Inpainting", vec!["Canvas mask tensor generation", "Inpainting diffusion pass"]),
    ];

    if let Some((id, label, desc, model, runs_locally)) = features.iter().find(|(id, _, _, _, _)| *id == feature_id.as_str()) {
        Json(json!({
            "id": id,
            "label": label,
            "enabled": true,
            "description": desc,
            "network_calls": [],
            "what_runs_locally": runs_locally,
            "what_is_sent": "Zero data transmitted. Fully airgapped on local device.",
            "model": model,
        }))
    } else {
        Json(json!({
            "error": format!("Unknown feature: {}", feature_id),
        }))
    }
}
