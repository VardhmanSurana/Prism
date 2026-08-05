use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;
use crate::services::siglip::get_engine;

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
        _ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        let engine = match get_engine() {
            Ok(engine) => engine,
            Err(e) => {
                warn!("[Scheduler] Failed to get SigLIP engine: {}", e);
                return false;
            }
        };

        let path = photo_path.to_string();
        let result = tokio::task::spawn_blocking(move || {
            engine.embed_image(&path)
        }).await;

        match result {
            Ok(Ok(embedding)) if !embedding.is_empty() => {
                let json = serde_json::to_string(&embedding).unwrap_or_default();
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
            Ok(Ok(_)) => {
                warn!("[Scheduler] SigLIP returned empty embedding for photo_id={}", photo_id);
                false
            }
            Ok(Err(e)) => {
                warn!("[Scheduler] SigLIP error for photo_id={}: {}", photo_id, e);
                false
            }
            Err(e) => {
                warn!("[Scheduler] SigLIP task panicked for photo_id={}: {}", photo_id, e);
                false
            }
        }
    }
}
