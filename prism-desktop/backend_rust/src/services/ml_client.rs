use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::Duration;
use tracing::{error, info};

#[derive(Clone)]
pub struct MlClient {
    client: Client,
    base_url: String,
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
pub struct FaceScanResponse {
    pub status: String,
    pub faces: Vec<DetectedFace>,
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
    pub fn new(base_url: String) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| Client::new());

        MlClient { client, base_url }
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

    pub async fn scan_faces(&self, photo_path: &str) -> Result<FaceScanResponse, String> {
        let url = format!("{}/ml/face", self.base_url);
        let req = PhotoPathRequest {
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

    pub async fn get_vision_caption(&self, photo_path: &str) -> Result<VisionResponse, String> {
        let url = format!("{}/ml/vision", self.base_url);
        let req = PhotoPathRequest {
            photo_path: photo_path.to_string(),
        };

        info!("Sending Vision caption request for path: {}", photo_path);

        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            error!("ML service Vision error: {}", err_text);
            return Err(format!("ML service error: {}", err_text));
        }

        resp.json::<VisionResponse>()
            .await
            .map_err(|e| format!("Failed to parse Vision response: {}", e))
    }

    pub async fn get_ocr_text(&self, photo_path: &str) -> Result<OcrResponse, String> {
        let url = format!("{}/ml/ocr", self.base_url);
        let req = PhotoPathRequest {
            photo_path: photo_path.to_string(),
        };

        info!("Sending OCR request for path: {}", photo_path);

        let resp = self
            .client
            .post(&url)
            .json(&req)
            .send()
            .await
            .map_err(|e| format!("Failed to reach Python ML service: {}", e))?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            error!("ML service OCR error: {}", err_text);
            return Err(format!("ML service error: {}", err_text));
        }

        resp.json::<OcrResponse>()
            .await
            .map_err(|e| format!("Failed to parse OCR response: {}", e))
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
}
