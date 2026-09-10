use sqlx::{SqlitePool, Row};
use std::sync::Arc;
use rayon::prelude::*;
use crate::services::siglip::SiglipEngine;

/// Encodes an f32 slice into raw little-endian bytes.
#[allow(dead_code)]
pub fn encode_f32_slice_to_blob(floats: &[f32]) -> Vec<u8> {
    floats.iter().flat_map(|f| f.to_le_bytes()).collect()
}

/// Decodes raw little-endian bytes into a Vec<f32>.
pub fn decode_blob_to_f32_vec(blob: &[u8]) -> Vec<f32> {
    blob.chunks_exact(4)
        .map(|c| f32::from_le_bytes([c[0], c[1], c[2], c[3]]))
        .collect()
}

/// Computes the dot product of two f32 slices using compiler auto-vectorized SIMD instructions.
#[inline]
pub fn dot_product_simd(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

/// Computes the dot product between a query vector and a raw binary embedding blob.
/// If the blob is 4-byte aligned and matches query length, it avoids all heap allocation
/// by directly casting to &[f32]. Otherwise, it decodes 4-byte chunks in-place.
#[inline]
pub fn dot_product_blob(query: &[f32], blob: &[u8]) -> Option<f32> {
    if blob.len() != query.len() * 4 {
        return None;
    }

    // If 4-byte aligned on little-endian architecture, we can view &[u8] as &[f32] directly without allocation
    if (blob.as_ptr() as usize) % std::mem::align_of::<f32>() == 0 {
        let floats: &[f32] = unsafe {
            std::slice::from_raw_parts(blob.as_ptr() as *const f32, query.len())
        };
        Some(dot_product_simd(query, floats))
    } else {
        let mut sim = 0.0f32;
        for (q, chunk) in query.iter().zip(blob.chunks_exact(4)) {
            let val = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
            sim += *q * val;
        }
        Some(sim)
    }
}

struct PhotoCandidate {
    id: i64,
    blob: Option<Vec<u8>>,
    json: Option<String>,
}

impl PhotoCandidate {
    #[inline]
    fn score(&self, query_emb: &[f32]) -> Option<f32> {
        if let Some(blob) = &self.blob {
            if !blob.is_empty() {
                return dot_product_blob(query_emb, blob);
            }
        }
        if let Some(json_str) = &self.json {
            if let Ok(vec) = serde_json::from_str::<Vec<f32>>(json_str) {
                if vec.len() == query_emb.len() {
                    return Some(dot_product_simd(query_emb, &vec));
                }
            }
        }
        None
    }
}

#[derive(Clone)]
pub struct SearchTools {
    db: SqlitePool,
    siglip: Option<Arc<SiglipEngine>>,
}

impl SearchTools {
    /// new - Performs new.
    pub fn new(db: SqlitePool, siglip: Option<Arc<SiglipEngine>>) -> Self {
        Self { db, siglip }
    }

    /// semantic_search - Performs semantic search.
    pub async fn semantic_search(&self, text_query: &str, top_k: usize, is_locked: bool, _ordered: bool) -> Vec<i64> {
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
            "SELECT id, embedding_blob, embedding FROM photos WHERE is_trash = 0 AND is_locked = ? AND (embedding_blob IS NOT NULL OR embedding IS NOT NULL)"
        )
        .bind(is_locked)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let candidates: Vec<PhotoCandidate> = rows
            .into_iter()
            .map(|r| PhotoCandidate {
                id: r.get("id"),
                blob: r.get("embedding_blob"),
                json: r.get("embedding"),
            })
            .collect();

        let mut scored: Vec<(i64, f32)> = candidates
            .par_iter()
            .filter_map(|c| {
                let sim = c.score(&query_emb)?;
                if sim >= 0.15 {
                    Some((c.id, sim))
                } else {
                    None
                }
            })
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        scored.into_iter().take(top_k).map(|(pid, _)| pid).collect()
    }

    #[allow(dead_code)]
    /// similar_image - Performs similar image.
    pub async fn similar_image(&self, photo_id: i64, top_k: usize, is_locked: bool, _ordered: bool) -> Vec<i64> {
        let row = sqlx::query(
            "SELECT embedding_blob, embedding FROM photos WHERE id = ? AND is_locked = ? AND is_trash = 0 AND (embedding_blob IS NOT NULL OR embedding IS NOT NULL)"
        )
        .bind(photo_id)
        .bind(is_locked)
        .fetch_optional(&self.db)
        .await
        .unwrap_or_default();

        let Some(r) = row else {
            return vec![];
        };

        let query_blob: Option<Vec<u8>> = r.get("embedding_blob");
        let query_json: Option<String> = r.get("embedding");

        let query_emb = if let Some(blob) = query_blob.filter(|b| !b.is_empty()) {
            decode_blob_to_f32_vec(&blob)
        } else if let Some(json) = query_json {
            serde_json::from_str::<Vec<f32>>(&json).unwrap_or_default()
        } else {
            return vec![];
        };

        if query_emb.is_empty() {
            return vec![];
        }

        let rows = sqlx::query(
            "SELECT id, embedding_blob, embedding FROM photos WHERE is_trash = 0 AND id != ? AND is_locked = ? AND (embedding_blob IS NOT NULL OR embedding IS NOT NULL)"
        )
        .bind(photo_id)
        .bind(is_locked)
        .fetch_all(&self.db)
        .await
        .unwrap_or_default();

        let candidates: Vec<PhotoCandidate> = rows
            .into_iter()
            .map(|r| PhotoCandidate {
                id: r.get("id"),
                blob: r.get("embedding_blob"),
                json: r.get("embedding"),
            })
            .collect();

        let mut scored: Vec<(i64, f32)> = candidates
            .par_iter()
            .filter_map(|c| {
                let sim = c.score(&query_emb)?;
                if sim >= 0.15 {
                    Some((c.id, sim))
                } else {
                    None
                }
            })
            .collect();

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        scored.into_iter().take(top_k).map(|(pid, _)| pid).collect()
    }
}

