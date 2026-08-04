use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TelemetryEvent {
    pub id: Option<i64>,
    pub source: String,
    pub session_id: Option<String>,
    pub event_type: String,
    pub component: Option<String>,
    pub action: Option<String>,
    pub metadata_json: Option<String>,
    pub status: Option<String>,
    pub duration_ms: Option<f64>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetrySummary {
    pub total_events: i64,
    pub session_count: i64,
    pub error_count: i64,
    pub warning_count: i64,
    pub avg_latency_ms: f64,
    pub events_per_minute: f64,
    pub recent_events: Vec<TelemetryEvent>,
}

pub struct TelemetryService {
    db: SqlitePool,
    broadcast_tx: broadcast::Sender<TelemetryEvent>,
}

impl TelemetryService {
    pub fn new(db: SqlitePool) -> Self {
        let (broadcast_tx, _) = broadcast::channel(1024);
        let service = Self { db, broadcast_tx };
        // Spawn background cleanup task to remove events older than 7 days
        let db_clone = service.db.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(3600));
            loop {
                interval.tick().await;
                let cutoff = Utc::now()
                    .checked_sub_signed(chrono::Duration::days(7))
                    .unwrap()
                    .to_rfc3339();
                let _ = sqlx::query("DELETE FROM telemetry_events WHERE created_at < ?")
                    .bind(&cutoff)
                    .execute(&db_clone)
                    .await;
            }
        });
        service
    }

    /// Log a telemetry event and broadcast it to SSE subscribers
    pub async fn log_event(
        &self,
        source: &str,
        session_id: Option<&str>,
        event_type: &str,
        component: Option<&str>,
        action: Option<&str>,
        metadata: Option<&str>,
        status: Option<&str>,
        duration_ms: Option<f64>,
    ) -> Result<i64, sqlx::Error> {
        let now = Utc::now().to_rfc3339();
        let status_val = status.unwrap_or("ok");

        let result = sqlx::query(
            "INSERT INTO telemetry_events (source, session_id, event_type, component, action, metadata_json, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(source)
        .bind(session_id)
        .bind(event_type)
        .bind(component)
        .bind(action)
        .bind(metadata)
        .bind(status_val)
        .bind(duration_ms)
        .bind(&now)
        .execute(&self.db)
        .await?;

        let event = TelemetryEvent {
            id: Some(result.last_insert_rowid()),
            source: source.to_string(),
            session_id: session_id.map(|s| s.to_string()),
            event_type: event_type.to_string(),
            component: component.map(|s| s.to_string()),
            action: action.map(|s| s.to_string()),
            metadata_json: metadata.map(|s| s.to_string()),
            status: Some(status_val.to_string()),
            duration_ms,
            created_at: Some(now),
        };

        // Broadcast to SSE subscribers (ignore if no subscribers)
        let _ = self.broadcast_tx.send(event);

        Ok(result.last_insert_rowid())
    }

    /// Log a batch of telemetry events within a single database transaction
    pub async fn log_events_batch(
        &self,
        events: Vec<(String, Option<String>, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<f64>)>,
    ) -> Result<i64, sqlx::Error> {
        if events.is_empty() {
            return Ok(0);
        }

        let mut tx = self.db.begin().await?;
        let mut count = 0i64;

        for (source, session_id, event_type, component, action, metadata, status, duration_ms) in events {
            let now = Utc::now().to_rfc3339();
            let status_val = status.as_deref().unwrap_or("ok");

            let result = sqlx::query(
                "INSERT INTO telemetry_events (source, session_id, event_type, component, action, metadata_json, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&source)
            .bind(&session_id)
            .bind(&event_type)
            .bind(&component)
            .bind(&action)
            .bind(&metadata)
            .bind(status_val)
            .bind(duration_ms)
            .bind(&now)
            .execute(&mut *tx)
            .await;

            match result {
                Ok(res) => {
                    count += 1;
                    let event = TelemetryEvent {
                        id: Some(res.last_insert_rowid()),
                        source,
                        session_id,
                        event_type,
                        component,
                        action,
                        metadata_json: metadata,
                        status: Some(status_val.to_string()),
                        duration_ms,
                        created_at: Some(now),
                    };
                    let _ = self.broadcast_tx.send(event);
                }
                Err(e) => {
                    tracing::warn!("Failed to insert batch telemetry event: {}", e);
                }
            }
        }

        tx.commit().await?;
        Ok(count)
    }

    /// Get recent telemetry events
    pub async fn get_recent_events(&self, limit: i64) -> Result<Vec<TelemetryEvent>, sqlx::Error> {
        let events = sqlx::query_as::<_, TelemetryEvent>(
            "SELECT id, source, session_id, event_type, component, action, metadata_json, status, duration_ms, created_at FROM telemetry_events ORDER BY id DESC LIMIT ?"
        )
        .bind(limit)
        .fetch_all(&self.db)
        .await?;

        Ok(events)
    }

    /// Get telemetry summary with stats
    pub async fn get_summary(&self) -> Result<TelemetrySummary, sqlx::Error> {
        let total_events: i64 = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM telemetry_events")
            .fetch_one(&self.db)
            .await
            .unwrap_or(0);

        let session_count: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(DISTINCT session_id) FROM telemetry_events WHERE session_id IS NOT NULL AND session_id != ''"
        )
        .fetch_one(&self.db)
        .await
        .unwrap_or(0);

        let error_count: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM telemetry_events WHERE status = 'error'"
        )
        .fetch_one(&self.db)
        .await
        .unwrap_or(0);

        let warning_count: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM telemetry_events WHERE status = 'warning'"
        )
        .fetch_one(&self.db)
        .await
        .unwrap_or(0);

        let avg_latency: f64 = sqlx::query_scalar::<_, f64>(
            "SELECT COALESCE(AVG(duration_ms), 0) FROM telemetry_events WHERE duration_ms IS NOT NULL"
        )
        .fetch_one(&self.db)
        .await
        .unwrap_or(0.0);

        // Events in last minute
        let one_minute_ago = Utc::now()
            .checked_sub_signed(chrono::Duration::minutes(1))
            .unwrap()
            .to_rfc3339();
        let recent_count: i64 = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM telemetry_events WHERE created_at >= ?"
        )
        .bind(one_minute_ago)
        .fetch_one(&self.db)
        .await
        .unwrap_or(0);

        let recent_events = self.get_recent_events(50).await.unwrap_or_default();

        Ok(TelemetrySummary {
            total_events,
            session_count,
            error_count,
            warning_count,
            avg_latency_ms: avg_latency,
            events_per_minute: recent_count as f64,
            recent_events,
        })
    }

    /// Subscribe to real-time telemetry events
    pub fn subscribe(&self) -> broadcast::Receiver<TelemetryEvent> {
        self.broadcast_tx.subscribe()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::query(
            "CREATE TABLE telemetry_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                session_id TEXT,
                event_type TEXT NOT NULL,
                component TEXT,
                action TEXT,
                metadata_json TEXT,
                status TEXT DEFAULT 'ok',
                duration_ms REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );"
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn test_log_event_and_recent_events() {
        let db = setup_test_db().await;
        let service = TelemetryService::new(db);
        let mut rx = service.subscribe();

        let id = service
            .log_event(
                "frontend",
                Some("sess-abc"),
                "click",
                Some("Button"),
                Some("submit"),
                Some(r#"{"key":"val"}"#),
                Some("ok"),
                Some(42.5),
            )
            .await
            .unwrap();

        assert!(id > 0);

        // Verify SSE broadcast
        let broadcasted = rx.recv().await.unwrap();
        assert_eq!(broadcasted.id, Some(id));
        assert_eq!(broadcasted.source, "frontend");
        assert_eq!(broadcasted.session_id.as_deref(), Some("sess-abc"));
        assert_eq!(broadcasted.event_type, "click");

        // Verify database persistence
        let events = service.get_recent_events(10).await.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].component.as_deref(), Some("Button"));
        assert_eq!(events[0].session_id.as_deref(), Some("sess-abc"));
    }

    #[tokio::test]
    async fn test_log_events_batch() {
        let db = setup_test_db().await;
        let service = TelemetryService::new(db);

        let batch = vec![
            (
                "frontend".to_string(),
                Some("sess-1".to_string()),
                "action_1".to_string(),
                Some("CompA".to_string()),
                None,
                None,
                Some("ok".to_string()),
                Some(10.0),
            ),
            (
                "frontend".to_string(),
                Some("sess-1".to_string()),
                "action_2".to_string(),
                Some("CompB".to_string()),
                None,
                None,
                Some("error".to_string()),
                Some(50.0),
            ),
        ];

        let count = service.log_events_batch(batch).await.unwrap();
        assert_eq!(count, 2);

        let summary = service.get_summary().await.unwrap();
        assert_eq!(summary.total_events, 2);
        assert_eq!(summary.session_count, 1);
        assert_eq!(summary.error_count, 1);
        assert_eq!(summary.avg_latency_ms, 30.0);
    }
}


