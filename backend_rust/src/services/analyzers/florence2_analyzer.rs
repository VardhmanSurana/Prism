use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::florence2::Florence2Engine;
use crate::services::ml_client::MlClient;

/// Florence-2 analyzer: generates AI captions and extracts object tags for search indexing.
/// Runs as a fallback when the LLM vision analyzer hasn't populated ai_summary/tags,
/// or as a complementary source of caption + object data.
pub struct Florence2Analyzer;

#[async_trait]
impl Analyzer for Florence2Analyzer {
    fn name(&self) -> &'static str {
        "florence2"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::Gpu
    }

    /// Priority 90 — runs after SigLIP (100) and Face (95) but before Vision/Gemma (100).
    /// Falls through to VisionAnalyzer if Florence-2 is unavailable.
    fn priority(&self) -> u32 {
        90
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        // Run if: Florence-2 available AND (no summary yet OR no tags yet)
        if !Florence2Engine::get().is_available() {
            return false;
        }
        !photo.has_summary
    }

    async fn execute(
        &self,
        _ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        let t0 = std::time::Instant::now();

        // Step 1: Generate caption
        let caption = match Florence2Engine::get().caption(photo_path, "<CAPTION>") {
            Ok(val) => {
                val.get("caption")
                    .and_then(|c| c.as_str())
                    .unwrap_or("")
                    .to_string()
            }
            Err(e) => {
                warn!("[Scheduler] Florence-2 caption failed for photo_id={}: {}", photo_id, e);
                return false;
            }
        };

        if caption.is_empty() {
            return false;
        }

        // Step 2: Run object detection for additional tags
        let mut all_tags: Vec<String> = Vec::new();
        if let Ok(od_result) = Florence2Engine::get().detect(
            photo_path,
            &crate::services::florence2::Florence2Task::ObjectDetection,
            None,
        ) {
            if let Some(instances) = od_result.get("instances").and_then(|i| i.as_array()) {
                for inst in instances {
                    if let Some(label) = inst.get("label").and_then(|l| l.as_str()) {
                        let tag = label.trim().to_lowercase();
                        if !tag.is_empty() && !all_tags.contains(&tag) {
                            all_tags.push(tag);
                        }
                    }
                }
            }
        }

        // Also extract caption words as tags
        for word in extract_tags_from_caption(&caption) {
            if !all_tags.contains(&word) {
                all_tags.push(word);
            }
        }

        // Step 3: Store results in DB
        // Store caption in ai_summary (don't overwrite if already has content)
        let _ = sqlx::query(
            "UPDATE photos SET ai_summary = COALESCE(NULLIF(ai_summary, ''), ?) WHERE id = ?"
        )
        .bind(&caption)
        .bind(photo_id)
        .execute(db)
        .await;

        // Store tags in auto_tags (don't overwrite if already has content)
        if !all_tags.is_empty() {
            let tags_json = serde_json::to_string(&all_tags).unwrap_or_default();
            let _ = sqlx::query(
                "UPDATE photos SET auto_tags = COALESCE(NULLIF(auto_tags, '[]'), ?) WHERE id = ?"
            )
            .bind(&tags_json)
            .bind(photo_id)
            .execute(db)
            .await;
        }

        worker.increment_counter("florence2");
        let elapsed = t0.elapsed().as_secs_f32();
        info!(
            "[Scheduler] Florence-2 done for photo_id={} ({:.1}s, {} chars, {} tags)",
            photo_id, elapsed, caption.len(), all_tags.len()
        );
        true
    }
}

/// Extract simple keyword tags from a Florence-2 caption string.
fn extract_tags_from_caption(caption: &str) -> Vec<String> {
    if caption.is_empty() {
        return vec![];
    }

    let stop_words: std::collections::HashSet<&str> = [
        "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "to", "of", "in", "for",
        "on", "with", "at", "by", "from", "as", "into", "through", "during",
        "before", "after", "above", "below", "between", "out", "off", "over",
        "under", "again", "further", "then", "once", "here", "there", "when",
        "where", "why", "how", "all", "both", "each", "few", "more", "most",
        "other", "some", "such", "no", "nor", "not", "only", "own", "same",
        "so", "than", "too", "very", "just", "don", "now", "and",
        "but", "or", "if", "it", "its", "this", "that", "these", "those",
        "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
        "she", "her", "they", "them", "their", "what", "which", "who", "whom",
        "up", "about", "one", "two", "three", "also",
        "appears", "appearing", "set", "sitting", "standing", "lying", "looking",
    ].iter().cloned().collect();

    let words: Vec<String> = caption
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .map(|w| w.trim().to_string())
        .filter(|w| w.len() > 2 && !stop_words.contains(w.as_str()))
        .collect();

    let mut freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for w in &words {
        *freq.entry(w.clone()).or_insert(0) += 1;
    }

    let mut tags: Vec<(String, usize)> = freq.into_iter().collect();
    tags.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    tags.into_iter().take(15).map(|(w, _)| w).collect()
}
