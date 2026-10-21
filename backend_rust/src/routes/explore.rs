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

/// explore_photos - Performs explore photos.
pub async fn explore_photos(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ExploreQuery>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(50).clamp(1, 200);

    let mut sql = String::from("SELECT * FROM photos WHERE is_trash = 0 AND is_locked = 0");
    if params.query.is_some() {
        sql.push_str(" AND (caption LIKE ? OR location LIKE ? OR auto_tags LIKE ?)");
    }
    if params.city.is_some() {
        sql.push_str(" AND city = ?");
    }
    if params.country.is_some() {
        sql.push_str(" AND country = ?");
    }
    if params.camera_make.is_some() {
        sql.push_str(" AND exif_make = ?");
    }

    sql.push_str(" ORDER BY date_taken DESC LIMIT ?");

    let mut query = sqlx::query_as::<_, Photo>(&sql);
    if let Some(ref q) = params.query {
        let pattern = format!("%{}%", q);
        query = query.bind(pattern.clone()).bind(pattern.clone()).bind(pattern);
    }
    if let Some(ref c) = params.city {
        query = query.bind(c);
    }
    if let Some(ref co) = params.country {
        query = query.bind(co);
    }
    if let Some(ref make) = params.camera_make {
        query = query.bind(make);
    }
    query = query.bind(limit);

    let start_time = std::time::Instant::now();
    let mut photos = query
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for p in &mut photos {
        p.normalize_display_fields();
    }


    let duration_ms = start_time.elapsed().as_secs_f64() * 1000.0;
    let meta = json!({
        "query": params.query.as_deref().unwrap_or(""),
        "results_count": photos.len(),
        "city": params.city.as_deref(),
        "country": params.country.as_deref(),
        "camera_make": params.camera_make.as_deref()
    }).to_string();

    let _ = state.telemetry.log_event(
        "backend",
        None,
        "search_query",
        Some("explore"),
        Some("search"),
        Some(&meta),
        Some("ok"),
        Some(duration_ms),
    ).await;

    Ok(Json(photos))
}

/// explore_insights - Performs explore insights.
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

/// explore_themes - Performs explore themes.
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

/// explore_on_this_day - Photos taken on this calendar day in earlier years.
pub async fn explore_on_this_day(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let now = chrono::Utc::now();
    let month_day = now.format("%m-%d").to_string();
    let year = now.format("%Y").to_string();

    // ponytail: string-slice date match — stored timestamps are RFC3339 text ('T' + offset),
    // avoids SQLite datetime parsing quirks entirely
    let photos = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND date_taken IS NOT NULL \
         AND substr(date_taken, 6, 5) = ? AND substr(date_taken, 1, 4) < ? \
         ORDER BY date_taken DESC LIMIT 60",
    )
    .bind(&month_day)
    .bind(&year)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut by_year: std::collections::BTreeMap<i32, Vec<Photo>> = std::collections::BTreeMap::new();
    for p in photos {
        if let Some(dt) = p.date_taken {
            let y = dt.format("%Y").to_string().parse().unwrap_or(0);
            by_year.entry(y).or_default().push(p);
        }
    }

    let items: Vec<Value> = by_year
        .into_iter()
        .rev()
        .map(|(y, photos)| json!({
            "year": y,
            "photo_count": photos.len(),
            "photos": photos,
        }))
        .collect();

    Ok(Json(json!({ "items": items })))
}

/// explore_rediscover_prompts - Performs explore rediscover prompts.
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


// ── Explore endpoints (Python-only, TODO stubs) ────────────────────────────

/// GET /api/v1/explore/timeline — Event-based timeline with cover photos.
pub async fn explore_timeline(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let events = sqlx::query_as::<_, crate::models::Event>(
        "SELECT * FROM events ORDER BY start_date DESC NULLS LAST"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut timeline = Vec::new();
    for e in &events {
        let cover_url: Option<String> = if let Some(pid) = e.cover_photo_id {
            sqlx::query_scalar::<_, String>("SELECT path FROM photos WHERE id = ?")
                .bind(pid)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten()
        } else {
            None
        };

        timeline.push(json!({
            "id": e.id,
            "title": e.title,
            "event_type": e.event_type,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "location": e.location,
            "summary": e.summary,
            "cover_url": cover_url,
        }));
    }

    Json(json!({ "events": timeline }))
}

/// GET /api/v1/explore/seasons — Seasonal photo grouping.
pub async fn explore_seasons(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let season_map = json!({
        "3": "spring", "4": "spring", "5": "spring",
        "6": "summer", "7": "summer", "8": "summer",
        "9": "autumn", "10": "autumn", "11": "autumn",
        "12": "winter", "1": "winter", "2": "winter",
    });

    let photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 AND date_taken IS NOT NULL ORDER BY date_taken DESC"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut buckets: std::collections::HashMap<String, Vec<Value>> = std::collections::HashMap::new();
    for photo in &photos {
        if let Some(ref dt) = photo.date_taken {
            let month = dt.format("%m").to_string().parse::<i32>().unwrap_or(1);
            let season = season_map.get(&month.to_string()).and_then(|v| v.as_str()).unwrap_or("unknown");
            let year = dt.format("%Y").to_string();
            let key = format!("{}_{}", season, year);
            buckets.entry(key).or_default().push(json!({
                "id": photo.id,
                "filename": photo.filename,
                "path": photo.path,
                "date_taken": photo.date_taken,
            }));
        }
    }

    let seasons: Vec<Value> = buckets.into_iter().map(|(key, photos)| {
        let parts: Vec<&str> = key.split('_').collect();
        let season = parts.first().unwrap_or(&"unknown");
        let year = parts.get(1).unwrap_or(&"0");
        json!({
            "label": format!("{} {}", season.chars().next().unwrap().to_uppercase().collect::<String>() + &season[1..], year),
            "season": season,
            "year": year.parse::<i32>().unwrap_or(0),
            "photo_count": photos.len(),
            "photos": photos.into_iter().take(6).collect::<Vec<_>>(),
        })
    }).collect();

    Json(json!({ "seasons": seasons }))
}

/// GET /api/v1/explore/activity — Recent activity timeline.
pub async fn explore_activity(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let recent_photos = sqlx::query_as::<_, crate::models::Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY id DESC LIMIT 12"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut activities = Vec::new();

    if !recent_photos.is_empty() {
        let locations: Vec<&str> = recent_photos.iter()
            .filter_map(|p| p.city.as_deref().or(p.country.as_deref()))
            .collect::<std::collections::HashSet<_>>()
            .into_iter().take(3).collect();

        activities.push(json!({
            "id": "import-latest",
            "type": "import",
            "title": format!("Imported {} photos", recent_photos.len()),
            "subtitle": if locations.is_empty() { format!("{} new items", recent_photos.len()) } else { locations.join(", ") },
            "timestamp": recent_photos[0].upload_date,
            "photo_count": recent_photos.len(),
        }));
    }

    Json(json!({ "activities": activities }))
}

/// GET /api/v1/explore/highlights — Memory highlight reels from events.
pub async fn explore_highlights(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
    let events = sqlx::query_as::<_, crate::models::Event>(
        "SELECT * FROM events ORDER BY start_date DESC NULLS LAST LIMIT 6"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut highlights = Vec::new();
    for e in &events {
        let (Some(start), Some(end)) = (e.start_date, e.end_date) else {
            continue;
        };

        // ponytail: date-window association — event_photos table doesn't exist yet
        let photo_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM photos WHERE is_trash = 0 AND date_taken >= ? AND date_taken <= ?",
        )
        .bind(start)
        .bind(end)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        if photo_count == 0 {
            continue;
        }

        let cover_photos: Vec<Value> = sqlx::query_as::<_, crate::models::Photo>(
            "SELECT * FROM photos WHERE is_trash = 0 AND date_taken >= ? AND date_taken <= ? ORDER BY date_taken DESC LIMIT 4",
        )
        .bind(start)
        .bind(end)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default()
        .iter()
        .map(|p| json!({ "id": p.id, "filename": p.filename, "path": p.path }))
        .collect();

        highlights.push(json!({
            "id": format!("highlight-event-{}", e.id),
            "event_id": e.id,
            "title": format!("{} Highlights", e.title),
            "subtitle": format!("{}", e.event_type),
            "location": e.location,
            "duration_sec": 30,
            "photo_count": photo_count,
            "cover_photos": cover_photos,
            "summary": e.summary,
        }));
    }

    Json(json!({ "highlights": highlights }))
}

/// POST /api/v1/explore/highlights/generate — Generate NLE project from event.
pub async fn generate_highlight_project(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, (StatusCode, String)> {
    let event_id = payload.get("event_id").and_then(|v| v.as_i64());

    let window: Option<(chrono::DateTime<chrono::Utc>, chrono::DateTime<chrono::Utc>)> = if let Some(eid) = event_id {
        sqlx::query_as::<_, (Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>)>(
            "SELECT start_date, end_date FROM events WHERE id = ?",
        )
        .bind(eid)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|(s, e)| Some((s?, e?)))
    } else {
        None
    };

    // ponytail: date-window association with recent-library fallback — event_photos table doesn't exist yet
    let recent_or_empty = sqlx::query_as::<_, Photo>(
        "SELECT * FROM photos WHERE is_trash = 0 ORDER BY date_taken DESC LIMIT 12",
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();
    let photos = if let Some((start, end)) = window {
        let event_photos = sqlx::query_as::<_, Photo>(
            "SELECT * FROM photos WHERE is_trash = 0 AND date_taken >= ? AND date_taken <= ? ORDER BY date_taken DESC LIMIT 12",
        )
        .bind(start)
        .bind(end)
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
        if event_photos.is_empty() { recent_or_empty } else { event_photos }
    } else {
        recent_or_empty
    };

    let project_name = if let Some(eid) = event_id {
        let title: Option<String> = sqlx::query_scalar("SELECT title FROM events WHERE id = ?")
            .bind(eid).fetch_optional(&state.db).await.unwrap_or_default();
        format!("{} Reel", title.unwrap_or_else(|| "Event".to_string()))
    } else {
        "Library Highlight Reel".to_string()
    };

    let mut time_offset: f64 = 0.0;
    let mut clips = Vec::new();
    for (i, photo) in photos.iter().enumerate() {
        let duration: f64 = 4.0;
        clips.push(json!({
            "id": format!("clip-hl-{}-{}", photo.id, i),
            "photoId": photo.id,
            "name": photo.filename,
            "path": photo.path,
            "type": "image",
            "startTime": (time_offset * 100.0_f64).round() / 100.0_f64,
            "duration": duration,
            "sourceStart": 0.0,
            "sourceDuration": duration,
            "volume": 1.0,
            "opacity": 1.0,
        }));
        time_offset += duration - 0.5;
    }

    Ok(Json(json!({
        "status": "ok",
        "name": project_name,
        "tracks": [{
            "id": "track-video-main",
            "name": "Video Track 1",
            "type": "video",
            "clips": clips,
        }],
        "fps": 30,
        "width": 1920,
        "height": 1080,
    })))
}

#[derive(Deserialize)]
pub struct CaptureActivityQuery {
    pub days: Option<i64>,
}

/// explore_capture_activity - Daily capture counts for the activity heatmap.
pub async fn explore_capture_activity(
    State(state): State<Arc<AppState>>,
    Query(params): Query<CaptureActivityQuery>,
) -> Json<Value> {
    let days = params.days.unwrap_or(0).clamp(0, 3650);

    let mut sql = String::from(
        "SELECT substr(COALESCE(date_taken, upload_date), 1, 10), COUNT(*) FROM photos WHERE is_trash = 0",
    );
    if days > 0 {
        // days is a clamped i64 interpolated below via bind — format! here builds the bind value only
        sql.push_str(" AND substr(COALESCE(date_taken, upload_date), 1, 10) >= date('now', ?)");
    }
    sql.push_str(" GROUP BY 1 ORDER BY 1");

    let mut query = sqlx::query_as::<_, (String, i64)>(&sql);
    if days > 0 {
        query = query.bind(format!("-{} days", days));
    }
    let buckets = query.fetch_all(&state.db).await.unwrap_or_default();

    Json(json!({
        "days": days,
        "buckets": buckets.iter().map(|(d, c)| json!({ "date": d, "count": c })).collect::<Vec<_>>(),
        "total": buckets.iter().map(|(_, c)| c).sum::<i64>(),
    }))
}
