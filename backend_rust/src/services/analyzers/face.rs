use async_trait::async_trait;
use tracing::{info, warn};

use super::super::worker::{Analyzer, PhotoRecord, ResourceNeed, WorkerState};
use crate::db::DbPool;
use crate::services::ml_client::MlClient;

pub struct FaceAnalyzer;

#[async_trait]
impl Analyzer for FaceAnalyzer {
    fn name(&self) -> &'static str {
        "face"
    }

    fn resource_need(&self) -> ResourceNeed {
        ResourceNeed::CpuHeavy
    }

    fn priority(&self) -> u32 {
        200
    }

    fn should_run(&self, photo: &PhotoRecord) -> bool {
        !photo.has_faces
    }

    async fn execute(
        &self,
        ml_client: &MlClient,
        db: &DbPool,
        worker: &WorkerState,
        photo_id: i64,
        photo_path: &str,
    ) -> bool {
        match ml_client.scan_faces(photo_path).await {
            Ok(resp) if resp.status == "success" => {
                for face in &resp.faces {
                    let _ = sqlx::query(
                        "INSERT OR IGNORE INTO faces (photo_id, confidence, box_json, embedding_json) VALUES (?, ?, ?, ?)"
                    )
                    .bind(photo_id)
                    .bind(face.confidence)
                    .bind(&face.box_json)
                    .bind(&face.embedding_json)
                    .execute(db)
                    .await;
                }
                worker.increment_counter("face");
                info!(
                    "[Scheduler] Face scan done for photo_id={}, {} face(s)",
                    photo_id,
                    resp.faces.len()
                );
                true
            }
            Ok(resp) => {
                warn!(
                    "[Scheduler] Face scan error for photo_id={}: {:?}",
                    photo_id, resp.status
                );
                false
            }
            Err(e) => {
                warn!(
                    "[Scheduler] Face scan failed for photo_id={}: {}",
                    photo_id, e
                );
                false
            }
        }
    }
}
