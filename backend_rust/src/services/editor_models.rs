//! Lifecycle management for heavyweight image-editor models.

use serde_json::{json, Value};

/// Waits for active inference to finish, then releases the editor's cached
/// ONNX sessions. Each model reloads lazily on the next request.
pub async fn unload_all() -> Value {
    let _slot = crate::services::inference_slot::acquire("editor-model-unload").await;
    json!({
        "status": "unloaded",
        "models": {
            "inpaint": crate::services::inpaint::unload(),
            "depth": crate::services::depth::unload(),
            "denoise": crate::services::denoise::unload(),
            "enhance": crate::services::enhance::unload(),
            "sam": crate::services::sam::unload(),
            "face_detection": crate::services::face_engine::unload(),
            "segmentation": crate::services::segmentation::SegmentationEngine::unload(),
        }
    })
}
