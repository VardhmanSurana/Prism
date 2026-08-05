use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tracing::{error, info};

use super::llm_client::LlmClient;

#[derive(Clone)]
pub struct MlClient {
    client: Client,
    base_url: String,
    pub llm: LlmClient,
}

#[derive(Serialize)]
pub struct PhotoPathRequest {
    pub photo_path: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct DetectedFace {
    pub confidence: f64,
    pub box_json: String,
    pub embedding_json: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SiglipResponse {
    pub status: String,
    pub embedding: Vec<f32>,
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
    pub fn new(base_url: String, llm: LlmClient) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());

        MlClient { client, base_url, llm }
    }

    pub async fn post_json(&self, url: &str, body: &Value) -> Result<Value, String> {
        let resp = self.client.post(url)
            .json(body)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }

    pub async fn check_health(&self) -> bool {
        let url = format!("{}/health", self.base_url);
        match self.client.get(&url).send().await {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    }

    pub async fn get_siglip_embedding(&self, photo_path: &str) -> Result<SiglipResponse, String> {
        let url = format!("{}/ml/siglip", self.base_url);
        let req = PhotoPathRequest {
            photo_path: photo_path.to_string(),
        };

        info!("Sending SigLIP embedding request for path: {}", photo_path);

        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            error!("ML service SigLIP error: {}", err_text);
            return Err(format!("ML service error: {}", err_text));
        }

        resp.json::<SiglipResponse>()
            .await
            .map_err(|e| format!("Failed to parse SigLIP response: {}", e))
    }

    /// Vision caption + tags via local llama-server (Gemma E2B :9091) —
    /// replaces the Python `/ml/vision` endpoint.
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

    /// OCR via local llama-server (PaddleOCR-VL :9092) — replaces the Python
    /// `/ml/ocr` endpoint.
    pub async fn get_ocr_text(&self, photo_path: &str) -> Result<OcrResponse, String> {
        info!("Sending OCR request for path: {}", photo_path);

        let text = self.llm.ocr(photo_path).await?;
        Ok(OcrResponse { status: "success".to_string(), text })
    }

    pub async fn get_semantic_masks(&self, photo_path: &str) -> Result<Value, String> {
        let url = format!("{}/ml/semantic-masks", self.base_url);
        let req = PhotoPathRequest { photo_path: photo_path.to_string() };
        let resp = self.client.post(&url).json(&req).send().await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("ML service error: {}", resp.text().await.unwrap_or_default()));
        }
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }

    pub async fn get_background_mask(&self, photo_path: &str) -> Result<Value, String> {
        let url = format!("{}/ml/background-mask", self.base_url);
        let req = PhotoPathRequest { photo_path: photo_path.to_string() };
        let resp = self.client.post(&url).json(&req).send().await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("ML service error: {}", resp.text().await.unwrap_or_default()));
        }
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }

    pub async fn get_portrait_masks(&self, photo_path: &str) -> Result<Value, String> {
        let url = format!("{}/ml/portrait-masks", self.base_url);
        let req = PhotoPathRequest { photo_path: photo_path.to_string() };
        let resp = self.client.post(&url).json(&req).send().await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("ML service error: {}", resp.text().await.unwrap_or_default()));
        }
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }

    pub async fn get_auto_enhance(&self, photo_path: &str) -> Result<Value, String> {
        let url = format!("{}/ml/auto-enhance", self.base_url);
        let req = PhotoPathRequest { photo_path: photo_path.to_string() };
        let resp = self.client.post(&url).json(&req).send().await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("ML service error: {}", resp.text().await.unwrap_or_default()));
        }
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }

    pub async fn interrogate(&self, photo_path: &str, prompt: Option<&str>) -> Result<Value, String> {
        let url = format!("{}/ml/interrogate", self.base_url);
        let body = serde_json::json!({
            "photo_path": photo_path,
            "prompt": prompt,
        });
        let resp = self.client.post(&url).json(&body).send().await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(format!("ML service error: {}", err_text));
        }
        resp.json::<Value>().await.map_err(|e| e.to_string())
    }
}
