//! llm_client.rs — direct HTTP calls to the local llama-server, replicating
//! Python's payloads exactly:
//!   - vision summary + tags: `app/services/image_summary/llm.py` (Gemma E4B :9091)
//!   - OCR: `app/services/ocr/ocr_manager.py` (PaddleOCR-VL :9092)
//! Replaces the Python-orchestrated `/ml/vision` and `/ml/ocr` endpoints.

use std::sync::Arc;
use std::time::Duration;

use base64::Engine;
use serde_json::{json, Value};
use tracing::warn;

use super::llm_server::{LlmMode, LlmServer};

#[derive(Clone)]
pub struct LlmClient {
    pub server: Arc<crate::services::llm_server::LlmServer>,
    http: reqwest::Client,
}

pub struct VisionResult {
    pub summary: Option<String>,
    pub caption: Option<String>,
    pub tags: Vec<String>,
}

impl LlmClient {
    /// preload_agent - Performs preload agent.
    pub async fn preload_agent(&self) -> Result<(), String> {
        self.server.base_url(crate::services::llm_server::LlmMode::Agent).await.map(|_| ())
    }

    /// new - Performs new.
    pub fn new(server: Arc<LlmServer>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(180))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        LlmClient { server, http }
    }

    /// Vision summary + tags for an image (Python `/ml/vision` parity).
    pub async fn vision(&self, image_path: &str) -> Result<VisionResult, String> {
        let base_url = self.server.base_url(LlmMode::Vision).await?;

        let summary = self
            .chat_completions(
                &base_url,
                &[chat_message(
                    image_path,
                    "Describe this image in a single concise sentence focusing on the main subjects and setting.",
                )],
                500,
                0.1,
                0.95,
                64,
            )
            .await
            .ok()
            .flatten();

        let caption = summary.as_ref().map(|s| {
            if s.len() > 120 {
                format!("{}...", &s[..120])
            } else {
                s.clone()
            }
        });

        let tags = match self
            .chat_completions(
                &base_url,
                &[chat_message(
                    image_path,
                    "Extract 15 descriptive tags from this image. Return ONLY a JSON object with a single key \"tags\" containing an array of tag strings. Example: {\"tags\": [\"person\", \"outdoor\", \"sunset\"]}",
                )],
                800,
                0.1,
                0.95,
                64,
            )
            .await
        {
            Ok(Some(content)) => parse_tags_json(&content),
            Ok(None) | Err(_) => Vec::new(),
        };

        Ok(VisionResult { summary, caption, tags })
    }

    /// OCR text extraction (Python `/ml/ocr` parity).
    pub async fn ocr(&self, image_path: &str) -> Result<Option<String>, String> {
        let base_url = self.server.base_url(LlmMode::Ocr).await?;
        let text = self
            .chat_completions(
                &base_url,
                &[chat_message(
                    image_path,
                    "Extract all visible text from this image. Return only the extracted text, preserving line breaks. If no text is visible, return an empty string.",
                )],
                2000,
                0.1,
                0.95,
                64,
            )
            .await?;
        Ok(text.filter(|t| !t.trim().is_empty()))
    }

    /// POST a multimodal chat completion; returns the assistant content or None.
    async fn chat_completions(
        &self,
        base_url: &str,
        messages: &[Value],
        max_tokens: u32,
        temperature: f32,
        top_p: f32,
        top_k: u32,
    ) -> Result<Option<String>, String> {
        let payload = json!({
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
        });

        let resp = self
            .http
            .post(format!("{base_url}/v1/chat/completions"))
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("llama-server request failed: {e}"))?;

        if !resp.status().is_success() {
            return Err(format!("llama-server error: {}", resp.text().await.unwrap_or_default()));
        }

        let data: Value = resp.json().await.map_err(|e| format!("bad response JSON: {e}"))?;
        let message = &data["choices"][0]["message"];
        let content = message["content"].as_str().map(|s| s.trim().to_string());
        if content.as_deref().map_or(true, |s| s.is_empty()) {
            Ok(message["reasoning_content"].as_str().map(|s| s.trim().to_string()))
        } else {
            Ok(content)
        }
    }
}

/// chat_message - Performs chat message.
fn chat_message(image_path: &str, text: &str) -> Value {
    let data_url = image_to_data_url(image_path);
    json!({
        "role": "user",
        "content": [
            { "type": "text", "text": text },
            { "type": "image_url", "image_url": { "url": data_url } }
        ]
    })
}

/// Python reads the raw file bytes and labels them image/jpeg regardless of
/// the real type — replicate exactly.
fn image_to_data_url(image_path: &str) -> String {
    match std::fs::read(image_path) {
        Ok(bytes) => {
            let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
            format!("data:image/jpeg;base64,{b64}")
        }
        Err(e) => {
            warn!("Failed to read image for LLM: {}: {}", image_path, e);
            String::new()
        }
    }
}

/// Port of Python `generate_tags_json`'s parsing: strip code fences, fall back
/// to the last JSON array, require a `tags` list of strings.
fn parse_tags_json(content: &str) -> Vec<String> {
    let stripped = strip_code_fence(content);

    let mut candidates: Vec<String> = vec![stripped.to_string()];
    if !stripped.trim_start().starts_with('{') {
        if let Some(arr) = last_json_array(stripped) {
            candidates.push(arr);
        }
    }

    for cand in candidates {
        if let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&cand) {
            if let Some(Value::Array(tags)) = map.get("tags") {
                let v: Vec<String> = tags.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect();
                if !v.is_empty() {
                    return v.into_iter().take(20).collect();
                }
            }
        }
        if let Ok(Value::Array(tags)) = serde_json::from_str::<Value>(&cand) {
            let v: Vec<String> = tags.iter().filter_map(|t| t.as_str().map(|s| s.to_string())).collect();
            if !v.is_empty() {
                return v.into_iter().take(20).collect();
            }
        }
    }

    Vec::new()
}

/// strip_code_fence - Performs strip code fence.
fn strip_code_fence(content: &str) -> &str {
    let trimmed = content.trim();
    if let Some(rest) = trimmed.strip_prefix("```json") {
        if let Some(end) = rest.find("```") {
            return rest[..end].trim();
        }
    }
    if let Some(rest) = trimmed.strip_prefix("```") {
        if let Some(end) = rest.find("```") {
            return rest[..end].trim();
        }
    }
    trimmed
}

/// last_json_array - Performs last json array.
fn last_json_array(content: &str) -> Option<String> {
    // Find the last [...] block (Python uses re.findall(r'\[.*?\]', ...)).
    let mut last: Option<String> = None;
    let bytes = content.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'[' {
            let mut depth = 0;
            let mut j = i;
            while j < bytes.len() {
                match bytes[j] {
                    b'[' => depth += 1,
                    b']' => {
                        depth -= 1;
                        if depth == 0 {
                            break;
                        }
                    }
                    _ => {}
                }
                j += 1;
            }
            if depth == 0 && j < bytes.len() {
                last = Some(content[i..=j].to_string());
            }
        }
        i += 1;
    }
    last
}
