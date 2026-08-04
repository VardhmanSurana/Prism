use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;

pub struct SiglipAnalyzer;

#[async_trait]
impl Analyzer for SiglipAnalyzer {
    fn name(&self) -> &'static str {
        "siglip"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::CpuHeavy
    }

    fn priority(&self) -> u32 {
        300
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        !photo.has_embedding
    }

    async fn execute(
        &self,
        ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        match ml_client.get_siglip_embedding(photo_path).await {
            Ok(resp) if resp.status == "success" && !resp.embedding.is_empty() => {
                let json = serde_json::to_string(&resp.embedding).unwrap_or_default();
                let _ = sqlx::query("UPDATE photos SET embedding = ?, clip_embedding = ? WHERE id = ?")
                    .bind(&json)
                    .bind(&json)
                    .bind(photo_id)
                    .execute(db)
                    .await;
                worker.increment_counter("siglip");
                info!("[Scheduler] SigLIP done for photo_id={}", photo_id);
                true
            }
            Ok(resp) => {
                warn!(
                    "[Scheduler] SigLIP empty/error for photo_id={}: {:?}",
                    photo_id, resp.status
                );
                false
            }
            Err(e) => {
                warn!("[Scheduler] SigLIP failed for photo_id={}: {}", photo_id, e);
                false
            }
        }
    }
}
