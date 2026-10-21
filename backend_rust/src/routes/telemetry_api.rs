use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{
        sse::{Event, KeepAlive, Sse},
        Json,
    },
    Json as AxumJson,
};
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;

use crate::AppState;
use super::get_telemetry_enabled;

#[derive(Deserialize)]
pub struct EventLimitQuery {
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct FrontendEventPayload {
    pub session_id: Option<String>,
    pub event_type: String,
    pub component: Option<String>,
    pub action: Option<String>,
    pub metadata_json: Option<String>,
    pub status: Option<String>,
}

#[derive(Serialize)]
pub struct TelemetrySummaryResponse {
    pub total_events: i64,
    pub session_count: i64,
    pub error_count: i64,
    pub warning_count: i64,
    pub avg_latency_ms: f64,
    pub events_per_minute: f64,
    pub recent_events: Vec<serde_json::Value>,
}

/// GET /api/v1/telemetry/summary
pub async fn get_telemetry_summary(
    State(state): State<Arc<AppState>>,
) -> Result<Json<TelemetrySummaryResponse>, (StatusCode, String)> {
    let summary = state.telemetry.get_summary().await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to fetch telemetry summary: {}", e),
        )
    })?;

    let recent_events: Vec<serde_json::Value> = summary
        .recent_events
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "id": e.id,
                "source": e.source,
                "session_id": e.session_id,
                "event_type": e.event_type,
                "component": e.component,
                "action": e.action,
                "metadata_json": e.metadata_json,
                "status": e.status,
                "duration_ms": e.duration_ms,
                "created_at": e.created_at,
            })
        })
        .collect();

    Ok(Json(TelemetrySummaryResponse {
        total_events: summary.total_events,
        session_count: summary.session_count,
        error_count: summary.error_count,
        warning_count: summary.warning_count,
        avg_latency_ms: summary.avg_latency_ms,
        events_per_minute: summary.events_per_minute,
        recent_events,
    }))
}

/// GET /api/v1/telemetry/events?limit=50
pub async fn get_telemetry_events(
    State(state): State<Arc<AppState>>,
    Query(query): Query<EventLimitQuery>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(100);
    let events = state
        .telemetry
        .get_recent_events(limit)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch telemetry events: {}", e),
            )
        })?;

    let response: Vec<serde_json::Value> = events
        .into_iter()
        .map(|e| {
            serde_json::json!({
                "id": e.id,
                "source": e.source,
                "session_id": e.session_id,
                "event_type": e.event_type,
                "component": e.component,
                "action": e.action,
                "metadata_json": e.metadata_json,
                "status": e.status,
                "duration_ms": e.duration_ms,
                "created_at": e.created_at,
            })
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/v1/telemetry/stream - SSE endpoint for real-time telemetry
pub async fn telemetry_sse_stream(
    State(state): State<Arc<AppState>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.telemetry.subscribe();

    let event_stream = futures::stream::unfold(rx, |mut rx| async {
        match rx.recv().await {
            Ok(event) => {
                let data = serde_json::json!({
                    "id": event.id,
                    "source": event.source,
                    "session_id": event.session_id,
                    "event_type": event.event_type,
                    "component": event.component,
                    "action": event.action,
                    "metadata_json": event.metadata_json,
                    "status": event.status,
                    "duration_ms": event.duration_ms,
                    "created_at": event.created_at,
                });

                let sse_event = Event::default()
                    .event("telemetry")
                    .data(data.to_string());

                Some((Ok(sse_event), rx))
            }
            Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                // Skip missed events, continue streaming
                Some((Ok(Event::default().event("ping").data("lagged")), rx))
            }
            Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                // Channel closed, end the stream
                None
            }
        }
    });

    Sse::new(event_stream).keep_alive(KeepAlive::default())
}

/// POST /api/v1/telemetry/log - Frontend sends a single telemetry event to backend
pub async fn log_frontend_event(
    State(state): State<Arc<AppState>>,
    AxumJson(payload): AxumJson<FrontendEventPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let status = payload.status.unwrap_or_else(|| "ok".to_string());

    // Respect global opt-out: when disabled, only error events are stored
    if !get_telemetry_enabled() && status != "error" {
        return Ok(Json(serde_json::json!({
            "status": "ok",
            "event_id": 0,
            "skipped": true
        })));
    }

    let event_id = state
        .telemetry
        .log_event(
            "frontend",
            payload.session_id.as_deref(),
            &payload.event_type,
            payload.component.as_deref(),
            payload.action.as_deref(),
            payload.metadata_json.as_deref(),
            Some(&status),
            None,
        )
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to log frontend event: {}", e),
            )
        })?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "event_id": event_id
    })))
}

// ── Batch endpoint ───────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct BatchEventPayload {
    pub events: Vec<FrontendEventPayload>,
}

/// POST /api/v1/telemetry/log-batch - Frontend sends a batch of telemetry events
/// Uses a single DB transaction for all events to reduce write amplification.
pub async fn log_frontend_event_batch(
    State(state): State<Arc<AppState>>,
    AxumJson(payload): AxumJson<BatchEventPayload>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    if payload.events.is_empty() {
        return Ok(Json(serde_json::json!({ "status": "ok", "count": 0 })));
    }

    // Respect global opt-out: when disabled, only error events are stored
    let enabled = get_telemetry_enabled();
    let events_to_insert: Vec<_> = payload
        .events
        .into_iter()
        .filter(|evt| enabled || evt.status.as_deref() == Some("error"))
        .map(|evt| {
            (
                "frontend".to_string(),
                evt.session_id,
                evt.event_type,
                evt.component,
                evt.action,
                evt.metadata_json,
                evt.status,
                None,
            )
        })
        .collect();

    let count = state
        .telemetry
        .log_events_batch(events_to_insert)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to log batch events: {}", e),
            )
        })?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "count": count
    })))
}

/// DELETE /api/v1/telemetry/events - Clear all telemetry events
pub async fn clear_telemetry_events(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let deleted = sqlx::query("DELETE FROM telemetry_events")
        .execute(&state.db)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to clear telemetry events: {}", e),
            )
        })?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "deleted": deleted.rows_affected()
    })))
}

#[derive(Deserialize)]
pub struct TelemetryTimeseriesQuery {
    pub window_minutes: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryTimeseriesPoint {
    pub timestamp: String,
    pub minutes_ago: i64,
    pub events_count: i64,
    pub avg_latency_ms: f64,
}

#[derive(Serialize)]
pub struct TelemetryTimeseriesResponse {
    pub window_minutes: i64,
    pub points: Vec<TelemetryTimeseriesPoint>,
    pub current_throughput: f64,
    pub current_latency: f64,
}

/// GET /api/v1/telemetry/timeseries?window_minutes=15
/// Returns uniform 1-minute historical buckets of throughput and API latency.
pub async fn get_telemetry_timeseries(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TelemetryTimeseriesQuery>,
) -> Result<Json<TelemetryTimeseriesResponse>, (StatusCode, String)> {
    let window = query.window_minutes.unwrap_or(15).clamp(5, 60);
    let window_secs = window * 60;

    // 1. Query telemetry events per minute bucket
    let telem_rows: Vec<(i64, i64, Option<f64>)> = sqlx::query_as(
        r#"
        SELECT
            CAST((strftime('%s', 'now') - strftime('%s', created_at)) / 60 AS INTEGER) AS minutes_ago,
            COUNT(*) AS events_cnt,
            AVG(duration_ms) AS avg_lat
        FROM telemetry_events
        WHERE strftime('%s', created_at) >= strftime('%s', 'now') - ?
        GROUP BY minutes_ago
        "#
    )
    .bind(window_secs)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    // 2. Query completed background jobs per minute bucket
    let job_rows: Vec<(i64, i64)> = sqlx::query_as(
        r#"
        SELECT
            CAST((strftime('%s', 'now') - strftime('%s', updated_at)) / 60 AS INTEGER) AS minutes_ago,
            COUNT(*) AS jobs_cnt
        FROM background_jobs
        WHERE status = 'completed' AND strftime('%s', updated_at) >= strftime('%s', 'now') - ?
        GROUP BY minutes_ago
        "#
    )
    .bind(window_secs)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let mut telem_map: std::collections::HashMap<i64, (i64, f64)> = std::collections::HashMap::new();
    for (m, cnt, lat) in telem_rows {
        if m >= 0 && m < window {
            telem_map.insert(m, (cnt, lat.unwrap_or(0.0)));
        }
    }

    let mut job_map: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
    for (m, cnt) in job_rows {
        if m >= 0 && m < window {
            job_map.insert(m, cnt);
        }
    }

    // Baseline latency: find the latest non-zero latency across the dataset
    let mut last_valid_lat = 15.0f64;
    for m in (0..window).rev() {
        if let Some((_, lat)) = telem_map.get(&m) {
            if *lat > 0.0 {
                last_valid_lat = *lat;
            }
        }
    }

    let now_utc = chrono::Utc::now();
    let mut points = Vec::with_capacity(window as usize);

    // Build uniform array from oldest (e.g. 14 mins ago) down to 0 (now)
    for m in (0..window).rev() {
        let (telem_cnt, telem_lat) = telem_map.get(&m).cloned().unwrap_or((0, 0.0));
        let job_cnt = job_map.get(&m).cloned().unwrap_or(0);
        let total_cnt = telem_cnt + job_cnt;

        let lat = if telem_lat > 0.0 {
            last_valid_lat = telem_lat;
            telem_lat
        } else {
            last_valid_lat
        };

        let bucket_time = now_utc - chrono::Duration::minutes(m);
        points.push(TelemetryTimeseriesPoint {
            timestamp: bucket_time.to_rfc3339(),
            minutes_ago: m,
            events_count: total_cnt,
            avg_latency_ms: (lat * 10.0).round() / 10.0,
        });
    }

    let current_throughput = points.last().map(|p| p.events_count as f64).unwrap_or(0.0);
    let current_latency = points.last().map(|p| p.avg_latency_ms).unwrap_or(last_valid_lat);

    Ok(Json(TelemetryTimeseriesResponse {
        window_minutes: window,
        points,
        current_throughput,
        current_latency,
    }))
}
