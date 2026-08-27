#[cfg(test)]
mod server_enhancement_tests {
    use crate::db::init_db;
    use crate::services::webhooks::{Webhook, WebhookPayload, WebhookService};

    #[tokio::test]
    /// test_webhook_schema_and_payload - Tests webhook schema and payload.
    async fn test_webhook_schema_and_payload() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Verify webhooks table exists and inserts cleanly
        let res = sqlx::query(
            "INSERT INTO webhooks (url, events, secret, enabled) VALUES (?, ?, ?, ?)"
        )
        .bind("http://localhost:9999/webhook")
        .bind("photo.imported,album.created")
        .bind("secret123")
        .bind(true)
        .execute(&pool)
        .await
        .unwrap();

        let id = res.last_insert_rowid();
        assert!(id > 0);

        let list: Vec<Webhook> = sqlx::query_as::<_, Webhook>(
            "SELECT id, url, events, secret, enabled, created_at FROM webhooks"
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(list.len(), 1);
        assert_eq!(list[0].url, "http://localhost:9999/webhook");
        assert_eq!(list[0].events, "photo.imported,album.created");

        // Verify payload serialization
        let payload = WebhookPayload {
            event: "photo.imported".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            data: serde_json::json!({ "id": 1, "filename": "test.jpg" }),
        };

        let json_str = serde_json::to_string(&payload).unwrap();
        assert!(json_str.contains("photo.imported"));
        assert!(json_str.contains("test.jpg"));

        // Dispatch test event
        WebhookService::dispatch_event(&pool, "photo.imported", serde_json::json!({"id": 1})).await;
    }

    #[tokio::test]
    /// test_api_key_security_settings - Tests api key security settings.
    async fn test_api_key_security_settings() {
        let pool = init_db("sqlite::memory:").await.unwrap();

        // Initially no settings key set
        let enabled: Option<String> = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_enabled'")
            .fetch_optional(&pool)
            .await
            .unwrap();
        assert!(enabled.is_none());

        // Set api key and enable
        sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_enabled', 'true')")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("INSERT INTO settings (key, value) VALUES ('api_key_value', 'my_secret_key_123')")
            .execute(&pool)
            .await
            .unwrap();

        let key: String = sqlx::query_scalar("SELECT value FROM settings WHERE key = 'api_key_value'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(key, "my_secret_key_123");
    }
}
