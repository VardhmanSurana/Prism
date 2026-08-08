use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use tracing::{info, warn};

use crate::db::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Webhook {
    pub id: i64,
    pub url: String,
    pub events: String,
    pub secret: Option<String>,
    pub enabled: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebhookPayload {
    pub event: String,
    pub timestamp: String,
    pub data: serde_json::Value,
}

pub struct WebhookService;

impl WebhookService {
    /// Dispatch an event asynchronously to all matching enabled webhooks.
    pub async fn dispatch_event(db: &DbPool, event_name: &str, payload_data: serde_json::Value) {
        let webhooks: Vec<Webhook> = match sqlx::query_as::<_, Webhook>(
            "SELECT id, url, events, secret, enabled, created_at FROM webhooks WHERE enabled = 1",
        )
        .fetch_all(db)
        .await
        {
            Ok(list) => list,
            Err(e) => {
                warn!("Failed to fetch webhooks for event dispatch: {}", e);
                return;
            }
        };

        if webhooks.is_empty() {
            return;
        }

        let timestamp = chrono::Utc::now().to_rfc3339();
        let payload = WebhookPayload {
            event: event_name.to_string(),
            timestamp,
            data: payload_data,
        };

        let payload_str = match serde_json::to_string(&payload) {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to serialize webhook payload: {}", e);
                return;
            }
        };

        let event_name_owned = event_name.to_string();

        for webhook in webhooks {
            // Check if webhook listens to this event (* or matching event name in CSV)
            let is_match = webhook.events.trim() == "*"
                || webhook
                    .events
                    .split(',')
                    .any(|e| e.trim().eq_ignore_ascii_case(&event_name_owned));

            if !is_match {
                continue;
            }

            let url = webhook.url.clone();
            let secret = webhook.secret.clone();
            let body = payload_str.clone();
            let evt = event_name_owned.clone();

            tokio::spawn(async move {
                let client = reqwest::Client::builder()
                    .timeout(std::time::Duration::from_secs(10))
                    .build();

                let Ok(client) = client else { return };

                let mut req = client
                    .post(&url)
                    .header("Content-Type", "application/json")
                    .header("User-Agent", "Prism-Server/1.0")
                    .header("X-Prism-Event", &evt);

                if let Some(sec) = secret {
                    if !sec.trim().is_empty() {
                        // Simple SHA256 signature calculation (sha256(secret + payload))
                        use sha2::{Digest, Sha256};
                        let mut hasher = Sha256::new();
                        hasher.update(sec.as_bytes());
                        hasher.update(body.as_bytes());
                        let result = hasher.finalize();
                        let sig_hex = format!("sha256={:x}", result);
                        req = req.header("X-Prism-Signature", sig_hex);
                    }
                }

                match req.body(body).send().await {
                    Ok(resp) => {
                        info!(
                            "Webhook dispatch to {} for event '{}' status {}",
                            url,
                            evt,
                            resp.status()
                        );
                    }
                    Err(e) => {
                        warn!("Webhook dispatch failed for {}: {}", url, e);
                    }
                }
            });
        }
    }
}
