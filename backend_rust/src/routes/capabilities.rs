use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

/// routes - Capabilities API router.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_capabilities))
        .route("/unload-all", post(unload_all_capabilities))
        .route("/:feature/unload", post(unload_capability))
        .route("/:feature/toggle", post(toggle_capability))
}

#[derive(Serialize, Deserialize)]
#[allow(dead_code)]
pub struct CapabilityItem {
    pub name: String,
    pub category: String,
    pub state: String, // "ready" | "model_not_installed" | "disabled"
    pub installed: bool,
    pub enabled: bool,
    pub resident_in_ram: bool,
    pub model_id: Option<String>,
    pub download_size_bytes: u64,
    pub description: String,
}

#[derive(Deserialize)]
pub struct TogglePayload {
    pub enabled: bool,
}

/// Helper to read feature toggle from settings table (defaults to true)
async fn is_feature_enabled(state: &AppState, feature: &str) -> bool {
    let key = format!("feature_{}_enabled", feature);
    let val: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(&state.db)
        .await
        .unwrap_or(None);

    match val {
        Some(v) => v.trim().eq_ignore_ascii_case("true") || v.trim() == "1",
        None => true,
    }
}

/// get_capabilities - Machine-readable capability registry with 3-state lifecycle.
pub async fn get_capabilities(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let hw = crate::services::hardware::detect(&state.config.gpu_mode);
    let installed_models = state.model_manager.list_models().await;

    let is_model_downloaded = |id: &str| -> bool {
        installed_models.iter().any(|m| m.id == id && m.is_downloaded)
    };

    // 1. Semantic Search (SigLIP2)
    let siglip_installed = is_model_downloaded("siglip2");
    let siglip_enabled = is_feature_enabled(&state, "semantic_search").await;
    let siglip_ram = crate::services::siglip::is_loaded();
    let siglip_state = if !siglip_enabled {
        "disabled"
    } else if !siglip_installed {
        "model_not_installed"
    } else {
        "ready"
    };

    // 2. Face Recognition & Clustering (SCRFD + ArcFace)
    let face_installed = is_model_downloaded("face_id");
    let face_enabled = is_feature_enabled(&state, "face_recognition").await;
    let face_ram = crate::services::face_engine::is_loaded();
    let face_state = if !face_enabled {
        "disabled"
    } else if !face_installed {
        "model_not_installed"
    } else {
        "ready"
    };

    // 3. Object Detection (YOLOv8)
    let yolo_installed = is_model_downloaded("yolo_objects");
    let yolo_enabled = is_feature_enabled(&state, "object_detection").await;
    let yolo_state = if !yolo_enabled {
        "disabled"
    } else if !yolo_installed {
        "model_not_installed"
    } else {
        "ready"
    };

    // 4. Magic Eraser (Inpaint + MobileSAM)
    let sam_installed = is_model_downloaded("mobile_sam");
    let inpaint_ram = crate::services::inpaint::is_loaded();
    let sam_ram = crate::services::sam::is_loaded();
    let eraser_installed = sam_installed;
    let eraser_enabled = is_feature_enabled(&state, "magic_eraser").await;
    let eraser_state = if !eraser_enabled {
        "disabled"
    } else if !eraser_installed {
        "model_not_installed"
    } else {
        "ready"
    };

    // 5. OCR (PP-OCRv4)
    let ocr_installed = is_model_downloaded("ocr_paddle");
    let ocr_enabled = is_feature_enabled(&state, "ocr").await;
    let ocr_ram = crate::services::ocr_engine::is_loaded();
    let ocr_state = if !ocr_enabled {
        "disabled"
    } else if !ocr_installed {
        "model_not_installed"
    } else {
        "ready"
    };

    let mut ram_resident_models = Vec::new();
    if siglip_ram { ram_resident_models.push("siglip2"); }
    if face_ram { ram_resident_models.push("face_id"); }
    if inpaint_ram { ram_resident_models.push("lama"); }
    if sam_ram { ram_resident_models.push("mobile_sam"); }
    if ocr_ram { ram_resident_models.push("ocr_paddle"); }

    let host = state.config.host.clone();
    let server_mode = if host == "127.0.0.1" || host == "localhost" || host == "0.0.0.0" {
        "local_bundled"
    } else {
        "remote_lan"
    };

    Ok(Json(json!({
        "capabilities": {
            "core_media": {
                "name": "Core Media & Library",
                "category": "core",
                "state": "ready",
                "installed": true,
                "enabled": true,
                "resident_in_ram": true,
                "model_id": null,
                "download_size_bytes": 0,
                "description": "Local library management, EXIF parsing, albums, timeline, and trash lifecycle"
            },
            "semantic_search": {
                "name": "Semantic Natural Language Search",
                "category": "ai",
                "state": siglip_state,
                "installed": siglip_installed,
                "enabled": siglip_enabled,
                "resident_in_ram": siglip_ram,
                "model_id": "siglip2",
                "download_size_bytes": 970_900_000,
                "description": "Natural language photo search via SigLIP2 image and text embeddings"
            },
            "face_recognition": {
                "name": "Face Detection & Clustering",
                "category": "ai",
                "state": face_state,
                "installed": face_installed,
                "enabled": face_enabled,
                "resident_in_ram": face_ram,
                "model_id": "face_id",
                "download_size_bytes": 191_300_000,
                "description": "Biometric face clustering and person grouping via SCRFD and ArcFace"
            },
            "object_detection": {
                "name": "Object & Scene Tagging",
                "category": "ai",
                "state": yolo_state,
                "installed": yolo_installed,
                "enabled": yolo_enabled,
                "resident_in_ram": false,
                "model_id": "yolo_objects",
                "download_size_bytes": 12_850_000,
                "description": "Identifies 80+ categories of objects, pets, scenes, and vehicles via YOLOv8"
            },
            "magic_eraser": {
                "name": "Magic Eraser (Object Removal)",
                "category": "ai",
                "state": eraser_state,
                "installed": eraser_installed,
                "enabled": eraser_enabled,
                "resident_in_ram": inpaint_ram || sam_ram,
                "model_id": "mobile_sam",
                "download_size_bytes": 45_000_000,
                "description": "Zero-shot segmentation and contextual texture inpainting via MobileSAM and LaMa"
            },
            "ocr": {
                "name": "Text Extraction (OCR)",
                "category": "ai",
                "state": ocr_state,
                "installed": ocr_installed,
                "enabled": ocr_enabled,
                "resident_in_ram": ocr_ram,
                "model_id": "ocr_paddle",
                "download_size_bytes": 18_000_000,
                "description": "High-accuracy text recognition and full-text search extraction via PP-OCRv4"
            },
            "video_editor": {
                "name": "Timeline Video Editor",
                "category": "creative",
                "state": "ready",
                "installed": true,
                "enabled": true,
                "resident_in_ram": false,
                "model_id": null,
                "download_size_bytes": 0,
                "description": "Non-destructive multi-track video editor with export rendering"
            },
            "easy_share": {
                "name": "EasyShare & LAN Mesh",
                "category": "network",
                "state": "ready",
                "installed": true,
                "enabled": true,
                "resident_in_ram": true,
                "model_id": null,
                "download_size_bytes": 0,
                "description": "Subnet discovery via UDP 8272 beacons and direct peer-to-peer media push"
            }
        },
        "hardware": hw,
        "server_mode": server_mode,
        "ram_resident_models": ram_resident_models
    })))
}

/// unload_capability - Frees RAM/VRAM by unloading a specific inference session.
pub async fn unload_capability(
    Path(feature): Path<String>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let feature_clean = feature.to_lowercase();
    let freed = match feature_clean.as_str() {
        "semantic_search" | "siglip" | "siglip2" => crate::services::siglip::unload(),
        "face_recognition" | "face" | "face_id" => crate::services::face_engine::unload(),
        "inpaint" | "lama" => crate::services::inpaint::unload(),
        "sam" | "mobile_sam" => crate::services::sam::unload(),
        "magic_eraser" => {
            let a = crate::services::inpaint::unload();
            let b = crate::services::sam::unload();
            a || b
        }
        "ocr" | "ocr_paddle" => crate::services::ocr_engine::unload(),
        _ => return Err((StatusCode::BAD_REQUEST, format!("Unknown capability: {}", feature))),
    };

    Ok(Json(json!({
        "success": true,
        "feature": feature,
        "freed": freed,
        "message": if freed { "Inference session unloaded from RAM." } else { "Session was not loaded in RAM." }
    })))
}

/// unload_all_capabilities - Drops all resident AI models from RAM.
pub async fn unload_all_capabilities() -> Result<Json<Value>, (StatusCode, String)> {
    let siglip = crate::services::siglip::unload();
    let face = crate::services::face_engine::unload();
    let inpaint = crate::services::inpaint::unload();
    let sam = crate::services::sam::unload();
    let ocr = crate::services::ocr_engine::unload();

    Ok(Json(json!({
        "success": true,
        "unloaded": {
            "semantic_search": siglip,
            "face_recognition": face,
            "inpaint": inpaint,
            "sam": sam,
            "ocr": ocr
        },
        "message": "All resident AI models unloaded from RAM."
    })))
}

/// toggle_capability - Enables or disables a feature flag in settings.
pub async fn toggle_capability(
    State(state): State<Arc<AppState>>,
    Path(feature): Path<String>,
    Json(payload): Json<TogglePayload>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let key = format!("feature_{}_enabled", feature.to_lowercase());
    let value_str = if payload.enabled { "true" } else { "false" };

    sqlx::query(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(&key)
    .bind(value_str)
    .execute(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to save setting: {}", e)))?;

    // If disabling, also unload any resident session from RAM
    if !payload.enabled {
        let _ = match feature.to_lowercase().as_str() {
            "semantic_search" => crate::services::siglip::unload(),
            "face_recognition" => crate::services::face_engine::unload(),
            "magic_eraser" => {
                let _ = crate::services::inpaint::unload();
                crate::services::sam::unload()
            }
            "ocr" => crate::services::ocr_engine::unload(),
            _ => false,
        };
    }

    Ok(Json(json!({
        "success": true,
        "feature": feature,
        "enabled": payload.enabled
    })))
}
