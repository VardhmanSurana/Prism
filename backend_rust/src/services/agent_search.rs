use sqlx::{SqlitePool, Row};
use std::sync::Arc;
use crate::models::{Photo, Album, Event, Person};
use crate::services::siglip::SiglipEngine;

#[derive(Clone)]
pub struct SearchTools {
    db: SqlitePool,
    siglip: Option<Arc<SiglipEngine>>,
}

impl SearchTools {
    pub fn new(db: SqlitePool, siglip: Option<Arc<SiglipEngine>>) -> Self {
        Self { db, siglip }
    }

    pub async fn semantic_search(&self, text_query: &str, top_k: usize, is_locked: bool, ordered: bool) -> Vec<i64> {
        if text_query.is_empty() {
            return vec![];
        }

        let engine = match &self.siglip {
            Some(e) => e,
            None => return vec![],
        };

        let query_emb = match engine.embed_text(text_query) {
            Ok(emb) => emb,
            Err(e) => {
                tracing::error!("SigLIP embed_text error: {}", e);
                return vec![];
            }
        };

        let rows = sqlx::query(
            "SELECT id, embedding FROM photos WHERE is_trash = 0 AND is_locked = ? AND embedding IS NOT NULL"
        )
        .bind(is_locked)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let mut results = Vec::new();

        for row in rows {
            let pid: i64 = row.get("id");
            let emb_str: String = row.get("embedding");
            if let Ok(photo_emb) = serde_json::from_str::<Vec<f32>>(&emb_str) {
                if photo_emb.len() == query_emb.len() {
                    let mut sim: f32 = 0.0;
                    for i in 0..query_emb.len() {
                        sim += query_emb[i] * photo_emb[i];
                    }
                    if sim >= 0.15 {
                        results.push((pid, sim));
                    }
                }
            }
        }

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        let mut final_ids = Vec::new();
        for (pid, _) in results.into_iter().take(top_k) {
            final_ids.push(pid);
        }

        final_ids
    }

    pub async fn similar_image(&self, photo_id: i64, top_k: usize, is_locked: bool, ordered: bool) -> Vec<i64> {
        let row = sqlx::query(
            "SELECT embedding FROM photos WHERE id = ? AND is_locked = ? AND is_trash = 0 AND embedding IS NOT NULL"
        )
        .bind(photo_id)
        .bind(is_locked)
        .fetch_optional(&self.db)
        .await
        .unwrap_or_default();

        let query_emb_str: String = match row {
            Some(r) => r.get("embedding"),
            None => return vec![],
        };

        let query_emb = match serde_json::from_str::<Vec<f32>>(&query_emb_str) {
            Ok(e) => e,
            Err(_) => return vec![],
        };

        let rows = sqlx::query(
            "SELECT id, embedding FROM photos WHERE is_trash = 0 AND id != ? AND is_locked = ? AND embedding IS NOT NULL"
        )
        .bind(photo_id)
        .bind(is_locked)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let mut results = Vec::new();

        for row in rows {
            let pid: i64 = row.get("id");
            let emb_str: String = row.get("embedding");
            if let Ok(photo_emb) = serde_json::from_str::<Vec<f32>>(&emb_str) {
                if photo_emb.len() == query_emb.len() {
                    let mut sim: f32 = 0.0;
                    for i in 0..query_emb.len() {
                        sim += query_emb[i] * photo_emb[i];
                    }
                    results.push((pid, sim));
                }
            }
        }

        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        
        results.into_iter().take(top_k).map(|(pid, _)| pid).collect()
    }
}
