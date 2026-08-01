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

#[derive(Deserialize)]
pub struct EventLimitQuery {
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct FrontendEventPayload {
    pub event_type: String,
    pub component: Option<String>,
    pub action: Option<String>,
    pub metadata_json: Option<String>,
    pub status: Option<String>,
}

#[derive(Serialize)]
pub struct TelemetrySummaryResponse {
    pub total_events: i64,
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

    let event_id = state
        .telemetry
        .log_event(
            "frontend",
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

    let events_to_insert: Vec<_> = payload
        .events
        .into_iter()
        .map(|evt| {
            (
                "frontend".to_string(),
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
