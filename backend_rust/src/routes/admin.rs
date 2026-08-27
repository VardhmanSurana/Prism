use axum::{
    extract::State,
    http::StatusCode,
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use crate::AppState;

// Serve the admin dashboard HTML
/// admin_dashboard - Performs admin dashboard.
pub async fn admin_dashboard() -> impl IntoResponse {
    let html = include_str!("../../admin/index.html");
    Html(html.to_string())
}

// Health check endpoint for admin
/// admin_health - Performs admin health.
pub async fn admin_health(
    State(state): State<std::sync::Arc<AppState>>,
) -> impl IntoResponse {
    let photo_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM photos")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let album_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM albums")
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

    let stats = serde_json::json!({
        "status": "healthy",
        "photos": photo_count,
        "users": user_count,
        "albums": album_count,
        "server_version": "1.0.0"
    });

    (StatusCode::OK, axum::Json(stats))
}

// Create admin routes
/// create_admin_routes - Handles create admin routes.
pub fn create_admin_routes() -> Router<std::sync::Arc<AppState>> {
    Router::new()
        .route("/", get(admin_dashboard))
        .route("/health", get(admin_health))
}
