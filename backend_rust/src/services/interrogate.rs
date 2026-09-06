use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use tracing::info;

use crate::services::exif::extract_exif;
use crate::services::florence2::Florence2Engine;
use crate::services::object_detector::get_detector;
use crate::services::sam::get_sam;
use crate::services::llm_client::LlmClient;

#[derive(Serialize, Deserialize)]
pub struct InterrogateResult {
    pub status: String,
    pub photo_path: String,
    pub exif: JsonValue,
    pub objects: Vec<JsonValue>,
    pub ocr: JsonValue,
    pub vision: JsonValue,
    pub sam: JsonValue,
}

pub async fn run_interrogate(photo_path: &str, _prompt: Option<&str>, llm_client: &LlmClient, db: &crate::db::DbPool) -> Result<InterrogateResult, String> {
    if !Path::new(photo_path).exists() {
        return Err("Photo file not found".to_string());
    }

    let exif_data = serde_json::to_value(extract_exif(Path::new(photo_path))).unwrap_or(serde_json::json!({}));

    let mut result = InterrogateResult {
        status: "success".to_string(),
        photo_path: photo_path.to_string(),
        exif: exif_data,
        objects: vec![],
        ocr: serde_json::json!({"status": "disabled", "text": null}),
        vision: serde_json::json!({"status": "disabled", "caption": null, "tags": []}),
        sam: serde_json::json!({"status": "disabled", "center_mask": null}),
    };

    // Florence-2 captioning (local model, no external API needed)
    // This always runs first — captions are stored in ai_summary and used for search.
    let mut florence2_caption: Option<String> = None;
    if Florence2Engine::get().is_available() {
        match Florence2Engine::get().caption(photo_path, "<CAPTION>") {
            Ok(val) => {
                if let Some(caption) = val.get("caption").and_then(|c| c.as_str()) {
                    if !caption.is_empty() {
                        let caption_owned = caption.to_string();
                        florence2_caption = Some(caption_owned.clone());
                        result.vision = serde_json::json!({
                            "status": "success",
                            "caption": caption_owned,
                            "source": "florence2",
                        });
                    }
                }
            }
            Err(e) => {
                tracing::warn!("[Interrogate] Florence-2 caption failed: {}", e);
            }
        }
    }

    let img = match std::fs::read(photo_path) {
        Ok(bytes) => match image::load_from_memory(&bytes) {
            Ok(i) => i,
            Err(e) => return Err(format!("Failed to decode image: {}", e)),
        },
        Err(e) => return Err(format!("Failed to read image {}: {}", photo_path, e)),
    };

    // OCR
    match llm_client.ocr(photo_path).await {
        Ok(Some(text)) => {
            result.ocr = serde_json::json!({"status": "success", "text": text});
        }
        Ok(None) => {
            result.ocr = serde_json::json!({"status": "empty", "text": null});
        }
        Err(e) => {
            result.ocr = serde_json::json!({"status": "error", "text": e});
        }
    }

    // Vision (LLM/Gemma) — only if Florence-2 didn't provide a caption,
    // or to enrich with tags and summary.
    match llm_client.vision(photo_path).await {
        Ok(v) => {
            // Merge: use LLM caption/summary/tags if available, otherwise keep Florence-2
            let caption = v.caption
                .or_else(|| florence2_caption.clone())
                .unwrap_or_default();
            let summary = v.summary.unwrap_or_default();
            let tags = if !v.tags.is_empty() { v.tags } else {
                // Extract simple tags from Florence-2 caption if LLM didn't provide any
                extract_tags_from_caption(florence2_caption.as_deref().unwrap_or(""))
            };
            result.vision = serde_json::json!({
                "status": "success",
                "caption": caption,
                "summary": summary,
                "tags": tags,
            });
        }
        Err(e) => {
            // LLM failed — use Florence-2 caption with extracted tags
            let tags = extract_tags_from_caption(florence2_caption.as_deref().unwrap_or(""));
            result.vision = serde_json::json!({
                "status": if florence2_caption.is_some() { "partial" } else { "error" },
                "caption": florence2_caption.clone().unwrap_or_default(),
                "tags": tags,
                "error": e
            });
        }
    }

    // Objects
    if let Ok(detector) = get_detector() {
        match detector.detect(&img) {
            Ok(detections) => {
                for d in detections {
                    result.objects.push(serde_json::json!({
                        "label": d.label,
                        "confidence": d.confidence,
                        "bbox": d.bbox
                    }));
                }
            }
            Err(_) => {
                // Object detection is best-effort; skip on failure
            }
        }
    }

    // SAM
    if let Ok(sam) = get_sam() {
        let cx = img.width() / 2;
        let cy = img.height() / 2;
        match sam.segment_points_image(&img, &[(cx as f32, cy as f32)], &[true]) {
            Ok(mask_bytes) => {
                let base64_str = STANDARD.encode(&mask_bytes);
                result.sam = serde_json::json!({
                    "status": "success",
                    "center_mask_png_base64": base64_str
                });
            }
            Err(e) => {
                result.sam = serde_json::json!({
                    "status": "error",
                    "error": e
                });
            }
        }
    }

    // ── Persist Florence-2 results to DB for search indexing ──
    // Store caption in ai_summary (used by agent search, fused search, explore)
    // and tags in auto_tags (used by tag cloud, album classification).
    if let Some(ref caption) = florence2_caption {
        if !caption.is_empty() {
            // Store caption as ai_summary (only if empty — don't overwrite richer LLM summary)
            let _ = sqlx::query(
                "UPDATE photos SET ai_summary = COALESCE(NULLIF(ai_summary, ''), ?) WHERE path = ?"
            )
            .bind(caption)
            .bind(photo_path)
            .execute(db)
            .await;

            // Extract and store tags
            let tags = result.vision.get("tags")
                .and_then(|t| t.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect::<Vec<_>>())
                .unwrap_or_default();
            if !tags.is_empty() {
                let tags_json = serde_json::to_string(&tags).unwrap_or_default();
                let _ = sqlx::query(
                    "UPDATE photos SET auto_tags = COALESCE(NULLIF(auto_tags, '[]'), ?) WHERE path = ?"
                )
                .bind(&tags_json)
                .bind(photo_path)
                .execute(db)
                .await;
            }
            info!("[Interrogate] Stored Florence-2 caption ({} chars, {} tags) for {}", caption.len(), tags.len(), photo_path);
        }
    }

    Ok(result)
}

/// Extract simple keyword tags from a Florence-2 caption string.
/// Uses frequency-based noun extraction from common caption patterns.
fn extract_tags_from_caption(caption: &str) -> Vec<String> {
    if caption.is_empty() {
        return vec![];
    }

    // Common stop words to filter out
    let stop_words: std::collections::HashSet<&str> = [
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "to", "of", "in", "for",
        "on", "with", "at", "by", "from", "as", "into", "through", "during",
        "before", "after", "above", "below", "between", "out", "off", "over",
        "under", "again", "further", "then", "once", "here", "there", "when",
        "where", "why", "how", "all", "both", "each", "few", "more", "most",
        "other", "some", "such", "no", "nor", "not", "only", "own", "same",
        "so", "than", "too", "very", "s", "t", "just", "don", "now", "and",
        "but", "or", "if", "it", "its", "this", "that", "these", "those",
        "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
        "she", "her", "they", "them", "their", "what", "which", "who", "whom",
        "up", "about", "getting", "看起来像", "one", "two", "three", "also",
        "appears", "appearing", "set", "sitting", "standing", "lying", "looking",
    ].iter().cloned().collect();

    let words: Vec<String> = caption
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .map(|w| w.trim().to_string())
        .filter(|w| w.len() > 2 && !stop_words.contains(w.as_str()))
        .collect();

    // Count word frequency
    let mut freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for w in &words {
        *freq.entry(w.clone()).or_insert(0) += 1;
    }

    // Take top words by frequency, then alphabetically
    let mut tags: Vec<(String, usize)> = freq.into_iter().collect();
    tags.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    tags.into_iter().take(15).map(|(w, _)| w).collect()
}
