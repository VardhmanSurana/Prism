use serde::{Deserialize, Serialize};
use tracing::info;

use super::llm_client::LlmClient;

/// Thin wrapper around the local llama-server client. Previously proxied a
/// Python ML microservice (`/ml/*` endpoints); every one of those features now
/// runs in-process (SigLIP/segmentation/auto-enhance/face/OCR), so this only
/// exposes vision captions through the local LLM server.
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

impl MlClient {
    /// new - Performs new.
    pub fn new(llm: LlmClient) -> Self {
        MlClient { llm }
    }

    /// Vision caption + tags via local llama-server (Gemma E4B :9091).
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

}
