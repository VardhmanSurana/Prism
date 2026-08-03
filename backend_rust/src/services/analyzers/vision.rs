use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;

pub struct VisionAnalyzer;

#[async_trait]
impl Analyzer for VisionAnalyzer {
    fn name(&self) -> &'static str {
        "vision"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::Gpu
    }

    fn priority(&self) -> u32 {
        100
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        !photo.has_summary
    }

    async fn execute(
        &self,
        ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        match ml_client.get_vision_caption(photo_path).await {
            Ok(resp) if resp.status == "success" => {
                let mut updated = false;
                if let Some(ref summary) = resp.summary {
                    let _ = sqlx::query("UPDATE photos SET ai_summary = ? WHERE id = ?")
                        .bind(summary)
                        .bind(photo_id)
                        .execute(db)
                        .await;
                    updated = true;
                }
                if let Some(ref caption) = resp.caption {
                    let _ = sqlx::query("UPDATE photos SET caption = ? WHERE id = ?")
                        .bind(caption)
                        .bind(photo_id)
                        .execute(db)
                        .await;
                    updated = true;
                }
                if !resp.tags.is_empty() {
                    let tags_json = serde_json::to_string(&resp.tags).unwrap_or_default();
                    let _ = sqlx::query("UPDATE photos SET auto_tags = ? WHERE id = ?")
                        .bind(&tags_json)
                        .bind(photo_id)
                        .execute(db)
                        .await;
                    updated = true;
                }
                if updated {
                    worker.increment_counter("vision");
                    info!("[Scheduler] Vision done for photo_id={}", photo_id);
                }
                updated
            }
            Ok(resp) => {
                warn!(
                    "[Scheduler] Vision error for photo_id={}: {:?}",
                    photo_id, resp.status
                );
                false
            }
            Err(e) => {
                warn!(
                    "[Scheduler] Vision failed for photo_id={}: {}",
                    photo_id, e
                );
                false
            }
        }
    }
}
