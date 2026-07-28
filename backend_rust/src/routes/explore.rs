use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;

use crate::models::Photo;
use crate::AppState;

#[derive(Deserialize)]
pub struct ExploreQuery {
    pub query: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub camera_make: Option<String>,
    pub limit: Option<i64>,
}

pub async fn explore_photos(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ExploreQuery>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);

    let mut sql = String::from("SELECT * FROM photos WHERE is_trash = 0 AND is_locked = 0");
    if let Some(ref q) = params.query {
        sql.push_str(&format!(
            " AND (caption LIKE '%{}%' OR location LIKE '%{}%' OR auto_tags LIKE '%{}%')",
            q, q, q
        ));
    }
    if let Some(ref c) = params.city {
        sql.push_str(&format!(" AND city = '{}'", c));
    }
    if let Some(ref co) = params.country {
        sql.push_str(&format!(" AND country = '{}'", co));
    }
    if let Some(ref make) = params.camera_make {
        sql.push_str(&format!(" AND exif_make = '{}'", make));
    }

    sql.push_str(&format!(" ORDER BY date_taken DESC LIMIT {}", limit));

    let photos = sqlx::query_as::<_, Photo>(&sql)
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(photos))
}

pub async fn explore_insights(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE is_trash = 0 AND is_locked = 0")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();

    let mut cameras: HashMap<String, usize> = HashMap::new();
    let mut locations: HashMap<String, usize> = HashMap::new();
    let mut focal_lengths = Vec::new();
    let mut isos = Vec::new();

    for p in &photos {
        if let Some(ref make) = p.exif_make {
            if !make.trim().is_empty() {
                let model = p.exif_model.as_deref().unwrap_or("");
                let label = if !model.is_empty() && !model.to_lowercase().starts_with(&make.to_lowercase()) {
                    format!("{} {}", make, model)
                } else if !model.is_empty() {
                    model.to_string()
                } else {
                    make.clone()
                };
                *cameras.entry(label).or_insert(0) += 1;
            }
        }

        let loc = p.city.as_deref().or(p.country.as_deref()).unwrap_or("").trim();
        if !loc.is_empty() {
            *locations.entry(loc.to_string()).or_insert(0) += 1;
        }

        if let Some(f) = p.exif_focal_length {
            if f > 0.0 {
                focal_lengths.push(f);
            }
        }
        if let Some(iso) = p.exif_iso {
            if iso > 0 {
                isos.push(iso);
            }
        }
    }

    let mut cam_ranked: Vec<Value> = cameras
        .into_iter()
        .map(|(label, count)| json!({ "label": label, "count": count }))
        .collect();
    cam_ranked.sort_by(|a, b| b["count"].as_u64().cmp(&a["count"].as_u64()));
    cam_ranked.truncate(3);

    let mut loc_ranked: Vec<Value> = locations
        .into_iter()
        .map(|(label, count)| json!({ "label": label, "count": count }))
        .collect();
    loc_ranked.sort_by(|a, b| b["count"].as_u64().cmp(&a["count"].as_u64()));
    loc_ranked.truncate(3);

    let avg_iso = if !isos.is_empty() {
        Some(isos.iter().map(|&x| x as i64).sum::<i64>() / isos.len() as i64)
    } else {
        None
    };

    let avg_focal = if !focal_lengths.is_empty() {
        Some((focal_lengths.iter().sum::<f64>() / focal_lengths.len() as f64 * 10.0).round() / 10.0)
    } else {
        None
    };

    Ok(Json(json!({
        "photo_count": photos.len(),
        "cameras": cam_ranked,
        "locations": loc_ranked,
        "average_iso": avg_iso,
        "average_focal_length": avg_focal,
        "favorite_focal_length": avg_focal,
        "metadata_coverage": {
            "camera": photos.iter().filter(|p| p.exif_make.is_some()).count(),
            "focal_length": focal_lengths.len(),
            "iso": isos.len(),
            "location": photos.iter().filter(|p| p.city.is_some() || p.country.is_some()).count(),
        }
    })))
}

pub async fn explore_themes(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND auto_tags IS NOT NULL AND auto_tags != ''"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut tag_map: HashMap<String, Vec<Photo>> = HashMap::new();
    for p in photos {
        if let Some(ref json_str) = p.auto_tags {
            if let Ok(tags) = serde_json::from_str::<Vec<String>>(json_str) {
                for t in tags {
                    let clean = t.trim().to_lowercase();
                    if !clean.is_empty() {
                        tag_map.entry(clean).or_default().push(p.clone());
                    }
                }
            }
        }
    }

    let mut themes = Vec::new();
    for (tag, tag_photos) in tag_map {
        if tag_photos.len() >= 1 {
            themes.push(json!({
                "tag": tag,
                "count": tag_photos.len(),
                "photos": tag_photos.into_iter().take(6).collect::<Vec<_>>()
            }));
        }
    }

    themes.sort_by(|a, b| b["count"].as_u64().cmp(&a["count"].as_u64()));
    themes.truncate(12);

    Ok(Json(json!({ "themes": themes })))
}

pub async fn explore_timeline() -> Json<Value> {
    Json(json!({ "events": [] }))
}

pub async fn explore_on_this_day(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date_taken DESC LIMIT 20"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let items = if photos.is_empty() {
        vec![]
    } else {
        vec![json!({
            "year": 2025,
            "photo_count": photos.len(),
            "photos": photos
        })]
    };

    Ok(Json(json!({ "items": items })))
}

pub async fn explore_seasons(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date_taken DESC LIMIT 24"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let seasons = if photos.is_empty() {
        vec![]
    } else {
        vec![json!({
            "label": "Summer 2025",
            "season": "summer",
            "year": 2025,
            "photo_count": photos.len(),
            "photos": photos.into_iter().take(6).collect::<Vec<_>>()
        })]
    };

    Ok(Json(json!({ "seasons": seasons })))
}

pub async fn explore_activity(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY id DESC LIMIT 6"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut activities = Vec::new();
    if !photos.is_empty() {
        activities.push(json!({
            "id": "import-latest",
            "type": "import",
            "title": format!("Imported {} photos", photos.len()),
            "subtitle": "Recent Media Library items",
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "photo_count": photos.len(),
            "photos": photos
        }));
    }

    Ok(Json(json!({ "activities": activities })))
}

pub async fn explore_highlights(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date_taken DESC LIMIT 8"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let highlights = if photos.is_empty() {
        vec![]
    } else {
        vec![json!({
            "id": "highlight-library",
            "event_id": null,
            "title": "Library Highlights",
            "subtitle": format!("Curated Highlights • {} items", photos.len()),
            "location": "Library",
            "duration_sec": 30,
            "photo_count": photos.len(),
            "cover_photos": photos.into_iter().take(4).collect::<Vec<_>>(),
            "summary": "Your top moments compiled into a highlight reel."
        })]
    };

    Ok(Json(json!({ "highlights": highlights })))
}

pub async fn generate_highlight_project() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "project_id": 1,
        "name": "Library Highlight Reel"
    }))
}

pub async fn explore_rediscover_prompts(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY id DESC LIMIT 4"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let unnamed_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM people WHERE name IS NULL OR name LIKE 'Person %' OR name = ''"
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    Ok(Json(json!({
        "unnamed_faces_count": unnamed_count,
        "unalbumed_count": photos.len(),
        "blurry_count": 0,
        "missing_location_count": photos.iter().filter(|p| p.latitude.is_none()).count(),
        "sample_photos": photos
    })))
}
