use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::models::Photo;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct BurstQuery {
    pub window_seconds: Option<f64>,
    pub min_count: Option<usize>,
    pub include_all: Option<bool>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BurstCluster {
    pub burst_id: String,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub photo_count: usize,
    pub best_photo_id: Option<i64>,
    pub photos: Vec<Photo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BurstListResponse {
    pub clusters: Vec<BurstCluster>,
    pub total_clusters: usize,
    pub total_photos: usize,
}

#[derive(Debug, Deserialize)]
pub struct CullStatusRequest {
    pub photo_ids: Vec<i64>,
    pub cull_status: Option<String>,
    pub rating: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurgeRejectedResponse {
    pub status: String,
    pub purged_count: usize,
    pub purged_photo_ids: Vec<i64>,
    pub undo_token: String,
}

#[derive(Debug, Deserialize)]
pub struct UndoPurgeRequest {
    pub photo_ids: Option<Vec<i64>>,
    #[allow(dead_code)]
    pub undo_token: Option<String>,
}

fn hamming_distance(ha: &str, hb: &str) -> u32 {
    if ha.len() == hb.len() {
        if let (Ok(val_a), Ok(val_b)) = (u64::from_str_radix(ha, 16), u64::from_str_radix(hb, 16)) {
            (val_a ^ val_b).count_ones()
        } else {
            ha.bytes().zip(hb.bytes()).map(|(x, y)| (x ^ y).count_ones()).sum()
        }
    } else {
        u32::MAX
    }
}

fn is_in_burst(a: &Photo, b: &Photo, max_delta_sec: f64) -> bool {
    let t_a = a.date_taken.or(a.date).or(a.upload_date);
    let t_b = b.date_taken.or(b.date).or(b.upload_date);

    let delta = match (t_a, t_b) {
        (Some(ta), Some(tb)) => (tb - ta).num_milliseconds().abs() as f64 / 1000.0,
        _ => return false,
    };

    if delta > max_delta_sec {
        return false;
    }

    let same_camera = match (&a.exif_model, &b.exif_model) {
        (Some(ma), Some(mb)) if !ma.is_empty() && ma == mb => true,
        _ => match (&a.device_id, &b.device_id) {
            (Some(da), Some(db)) if !da.is_empty() && da == db => true,
            _ => false,
        },
    };

    let phash_close = match (&a.phash, &b.phash) {
        (Some(ha), Some(hb)) => hamming_distance(ha, hb) <= 12,
        _ => false,
    };

    same_camera || phash_close || (a.exif_model.is_none() && b.exif_model.is_none() && delta <= 1.0)
}

fn finalize_cluster(photos: Vec<Photo>) -> BurstCluster {
    let photo_count = photos.len();
    let start_time = photos.first().and_then(|p| p.date_taken.or(p.date).or(p.upload_date));
    let end_time = photos.last().and_then(|p| p.date_taken.or(p.date).or(p.upload_date));

    let best_photo_id = photos.iter().max_by(|a, b| {
        let sa = a.blur_score.unwrap_or(0.0);
        let sb = b.blur_score.unwrap_or(0.0);
        sa.partial_cmp(&sb).unwrap_or(std::cmp::Ordering::Equal)
    }).map(|p| p.id);

    let burst_id = format!("burst_{}", photos[0].id);

    BurstCluster {
        burst_id,
        start_time,
        end_time,
        photo_count,
        best_photo_id,
        photos,
    }
}

/// GET /api/v1/cull/bursts
/// Cluster adjacent photos within window_seconds (default 2.0s) and identical camera or phash hamming <= 12.
pub async fn get_bursts(
    State(state): State<Arc<AppState>>,
    Query(query): Query<BurstQuery>,
) -> Result<Json<BurstListResponse>, (StatusCode, String)> {
    let window_seconds = query.window_seconds.unwrap_or(2.0);
    let min_count = if query.include_all.unwrap_or(false) {
        1
    } else {
        query.min_count.unwrap_or(2)
    };
    let limit = query.limit.unwrap_or(2000);

    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND is_locked = 0 ORDER BY COALESCE(date_taken, date, upload_date) ASC, id ASC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut clusters = Vec::new();
    let mut current_group: Vec<Photo> = Vec::new();

    for photo in photos {
        if let Some(prev) = current_group.last() {
            if is_in_burst(prev, &photo, window_seconds) {
                current_group.push(photo);
                continue;
            } else {
                if current_group.len() >= min_count {
                    clusters.push(finalize_cluster(current_group));
                }
                current_group = vec![photo];
            }
        } else {
            current_group.push(photo);
        }
    }

    if current_group.len() >= min_count {
        clusters.push(finalize_cluster(current_group));
    }

    let total_clusters = clusters.len();
    let total_photos = clusters.iter().map(|c| c.photo_count).sum();

    Ok(Json(BurstListResponse {
        clusters,
        total_clusters,
        total_photos,
    }))
}

/// POST /api/v1/cull/status
/// Batch updates cull_status ('picked', 'rejected', 'unflagged') and/or star rating for photo IDs.
pub async fn update_cull_status(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CullStatusRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    if payload.photo_ids.is_empty() {
        return Ok(Json(json!({ "status": "success", "updated_count": 0 })));
    }

    let mut tx = state.db.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut updated_count = 0;
    for id in &payload.photo_ids {
        if let (Some(ref status), Some(rating)) = (&payload.cull_status, payload.rating) {
            let res = sqlx::query("UPDATE photos SET cull_status = ?, rating = ? WHERE id = ?")
                .bind(status)
                .bind(rating)
                .bind(id)
                .execute(&mut *tx)
                .await;
            if res.is_ok() {
                updated_count += 1;
            }
        } else if let Some(ref status) = payload.cull_status {
            let res = sqlx::query("UPDATE photos SET cull_status = ? WHERE id = ?")
                .bind(status)
                .bind(id)
                .execute(&mut *tx)
                .await;
            if res.is_ok() {
                updated_count += 1;
            }
        } else if let Some(rating) = payload.rating {
            let res = sqlx::query("UPDATE photos SET rating = ? WHERE id = ?")
                .bind(rating)
                .bind(id)
                .execute(&mut *tx)
                .await;
            if res.is_ok() {
                updated_count += 1;
            }
        }
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "updated_count": updated_count
    })))
}

/// POST /api/v1/cull/purge-rejected
/// Atomically moves all photos marked cull_status = 'rejected' to is_trash = 1.
pub async fn purge_rejected(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PurgeRejectedResponse>, (StatusCode, String)> {
    let mut tx = state.db.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let rejected_ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM photos WHERE cull_status = 'rejected' AND is_trash = 0"
    )
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let purged_count = rejected_ids.len();
    if purged_count > 0 {
        for id in &rejected_ids {
            sqlx::query("UPDATE photos SET is_trash = 1 WHERE id = ?")
                .bind(id)
                .execute(&mut *tx)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let undo_token = uuid::Uuid::new_v4().to_string();

    Ok(Json(PurgeRejectedResponse {
        status: "success".to_string(),
        purged_count,
        purged_photo_ids: rejected_ids,
        undo_token,
    }))
}

/// POST /api/v1/cull/undo-purge
/// Restores recently purged rejected photos.
pub async fn undo_purge(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UndoPurgeRequest>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let mut tx = state.db.begin().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut restored_count = 0;
    if let Some(ids) = payload.photo_ids {
        for id in ids {
            let res = sqlx::query("UPDATE photos SET is_trash = 0 WHERE id = ?")
                .bind(id)
                .execute(&mut *tx)
                .await;
            if res.is_ok() {
                restored_count += 1;
            }
        }
    } else {
        let res = sqlx::query(
            "UPDATE photos SET is_trash = 0 WHERE cull_status = 'rejected' AND is_trash = 1"
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        restored_count = res.rows_affected() as usize;
    }

    tx.commit().await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({
        "status": "success",
        "restored_count": restored_count
    })))
}
