use axum::response::Json;
use serde_json::{json, Value};

pub async fn get_privacy_status() -> Json<Value> {
    Json(json!({
        "summary": {
            "total_features": 4,
            "enabled": 4,
            "disabled": 0,
            "total_network_endpoints": 0,
            "all_local": true,
            "verdict": "All features execute completely on-device without remote telemetry or cloud dependency."
        },
        "features": [
            {
                "id": "semantic_search",
                "label": "Semantic Vector Search",
                "enabled": true,
                "description": "On-device SigLIP embedding generation for natural language image retrieval",
                "network_calls": [],
                "what_runs_locally": [
                    "Image vector embeddings",
                    "Local cosine similarity search index"
                ],
                "what_is_sent": "Zero data transmitted. Fully airgapped on local CPU/GPU.",
                "model": "SigLIP-Base-384"
            },
            {
                "id": "face_detection",
                "label": "Face Recognition & Clustering",
                "enabled": true,
                "description": "Local face bounding box detection and identity grouping",
                "network_calls": [],
                "what_runs_locally": [
                    "Face detection & cropping",
                    "Euclidean vector distance clustering"
                ],
                "what_is_sent": "Zero data transmitted. Kept in local SQLite index.",
                "model": "InsightFace / SCRFD"
            },
            {
                "id": "ocr_text",
                "label": "Text & Document OCR",
                "enabled": true,
                "description": "On-device document classification and optical character recognition",
                "network_calls": [],
                "what_runs_locally": [
                    "Text extraction from images",
                    "Document indexing"
                ],
                "what_is_sent": "Zero data transmitted. Processed 100% on local machine.",
                "model": "PaddleOCR / Tesseract"
            },
            {
                "id": "inpainting",
                "label": "AI Object Removal & Inpainting",
                "enabled": true,
                "description": "Generative mask removal and background restoration",
                "network_calls": [],
                "what_runs_locally": [
                    "Canvas mask tensor generation",
                    "Inpainting diffusion pass"
                ],
                "what_is_sent": "Zero data transmitted. Runs inside local PyTorch runtime.",
                "model": "LaMa / Stable Diffusion Inpainting"
            }
        ]
    }))
}
