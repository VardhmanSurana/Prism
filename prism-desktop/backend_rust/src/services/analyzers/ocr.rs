use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;

pub struct OcrAnalyzer;

#[async_trait]
impl Analyzer for OcrAnalyzer {
    fn name(&self) -> &'static str {
        "ocr"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::CpuLight
    }

    fn priority(&self) -> u32 {
        0
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        !photo.has_ocr
    }

    async fn execute(
        &self,
        ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        match ml_client.get_ocr_text(photo_path).await {
            Ok(resp) if resp.status == "success" => {
                if let Some(ref text) = resp.text {
                    if !text.is_empty() {
                        let _ = sqlx::query("UPDATE photos SET ocr_text = ? WHERE id = ?")
                            .bind(text)
                            .bind(photo_id)
                            .execute(db)
                            .await;
                        worker.increment_counter("ocr");
                        info!(
                            "[Scheduler] OCR done for photo_id={} ({} chars)",
                            photo_id,
                            text.len()
                        );
                    }
                }
                true // empty OCR is still success
            }
            Ok(resp) => {
                warn!(
                    "[Scheduler] OCR error for photo_id={}: {:?}",
                    photo_id, resp.status
                );
                false
            }
            Err(e) => {
                warn!("[Scheduler] OCR failed for photo_id={}: {}", photo_id, e);
                false
            }
        }
    }
}
