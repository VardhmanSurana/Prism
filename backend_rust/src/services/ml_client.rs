use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{error, info};

#[derive(Clone)]
pub struct MlClient {
    client: Client,
    base_url: String,
}

#[derive(Serialize)]
pub struct FaceScanRequest {
    pub photo_path: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DetectedFace {
    pub confidence: f64,
    pub box_json: String,
    pub embedding_json: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct FaceScanResponse {
    pub status: String,
    pub faces: Vec<DetectedFace>,
}

#[derive(Serialize)]
pub struct ClipRequest {
    pub photo_path: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ClipResponse {
    pub status: String,
    pub embedding: Vec<f32>,
    pub summary: Option<String>,
}

impl MlClient {
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| Client::new());

        MlClient { client, base_url }
    }

    pub async fn check_health(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn scan_faces(&self, photo_path: &str) -> Result<FaceScanResponse, String> {
        let url = format!("{}/ml/face", self.base_url);
        let req = FaceScanRequest {
            photo_path: photo_path.to_string(),
        };

        info!("Sending ML face scan request for path: {}", photo_path);

        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            error!("ML service face error: {}", err_text);
            return Err(format!("ML service error: {}", err_text));
        }

        resp.json::<FaceScanResponse>()
            .await
            .map_err(|e| format!("Failed to parse ML response: {}", e))
    }

    pub async fn get_clip_embedding(&self, photo_path: &str) -> Result<ClipResponse, String> {
        let url = format!("{}/ml/clip", self.base_url);
        let req = ClipRequest {
            photo_path: photo_path.to_string(),
        };

        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;

        resp.json::<ClipResponse>()
            .await
            .map_err(|e| format!("Failed to parse CLIP response: {}", e))
    }
}
