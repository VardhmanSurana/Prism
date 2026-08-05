use serde::{Deserialize, Serialize};
use tracing::info;

use super::llm_client::LlmClient;

/// Thin wrapper around the local llama-server client. Previously proxied a
/// Python ML microservice (`/ml/*` endpoints); every one of those features now
/// runs in-process (SigLIP/segmentation/auto-enhance/face), so this only
/// exposes vision captions and OCR through the local LLM server.
#[derive(Clone)]
pub struct MlClient {
    pub llm: LlmClient,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DetectedFace {
    pub confidence: f64,
    pub box_json: String,
    pub embedding_json: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct VisionResponse {
    pub status: String,
    pub summary: Option<String>,
    pub caption: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OcrResponse {
    pub status: String,
    pub text: Option<String>,
}

impl MlClient {
    pub fn new(llm: LlmClient) -> Self {
        MlClient { llm }
    }

    /// Vision caption + tags via local llama-server (Gemma E2B :9091).
    pub async fn get_vision_caption(&self, photo_path: &str) -> Result<VisionResponse, String> {
        info!("Sending Vision caption request for path: {}", photo_path);

        let result = self.llm.vision(photo_path).await?;
        Ok(VisionResponse {
            status: "success".to_string(),
            summary: result.summary,
            caption: result.caption,
            tags: result.tags,
        })
    }

    /// OCR via local llama-server (PaddleOCR-VL :9092).
    pub async fn get_ocr_text(&self, photo_path: &str) -> Result<OcrResponse, String> {
        info!("Sending OCR request for path: {}", photo_path);

        let text = self.llm.ocr(photo_path).await?;
        Ok(OcrResponse { status: "success".to_string(), text })
    }
}
