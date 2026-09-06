use async_trait::async_trait;
use serde_json;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;
use crate::services::ocr_engine;

/// Background analyzer that runs PP-OCRv4 to extract text AND bounding boxes.
///
/// Replaces the old `OcrAnalyzer` which used PaddleOCR-VL via llama-server
/// (text only, no spatial data). This analyzer produces both `ocr_text` and
/// `ocr_bboxes` in a single inference pass.
pub struct OcrBboxAnalyzer;

#[async_trait]
impl Analyzer for OcrBboxAnalyzer {
    fn name(&self) -> &'static str {
        "ocr_bbox"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::CpuLight
    }

    /// Priority 0 — runs last in the pipeline (after siglip, face, vision, florence2).
    fn priority(&self) -> u32 {
        0
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        !photo.has_ocr
    }

    async fn execute(
        &self,
        _ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        // Check if models are available
        if !ocr_engine::is_available() {
            warn!(
                "[Scheduler] OCR bbox skipped for photo_id={}: PP-OCRv4 models not downloaded",
                photo_id
            );
            return true; // Not a failure — models not available yet
        }

        // Run the PP-OCRv4 pipeline (blocking ONNX inference, offloaded to spawn_blocking)
        let path = photo_path.to_string();
        let result = match tokio::task::spawn_blocking(move || ocr_engine::recognize(&path))
            .await
        {
            Ok(Ok(result)) => result,
            Ok(Err(e)) => {
                warn!("[Scheduler] OCR bbox failed for photo_id={}: {}", photo_id, e);
                return false;
            }
            Err(e) => {
                warn!(
                    "[Scheduler] OCR bbox task panicked for photo_id={}: {}",
                    photo_id, e
                );
                return false;
            }
        };

        // Store results in DB
        if !result.full_text.is_empty() {
            let bboxes_json = serde_json::to_string(&result.lines).unwrap_or_default();

            let _ = sqlx::query(
                "UPDATE photos SET ocr_text = ?, ocr_bboxes = ? WHERE id = ?",
            )
            .bind(&result.full_text)
            .bind(&bboxes_json)
            .bind(photo_id)
            .execute(db)
            .await;

            worker.increment_counter("ocr_bbox");
            info!(
                "[Scheduler] OCR bbox done for photo_id={} ({} chars, {} lines)",
                photo_id,
                result.full_text.len(),
                result.lines.len()
            );
        }

        true
    }
}
