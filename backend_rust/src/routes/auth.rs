use axum::{
    extract::{State, Json, Path},
    http::StatusCode,
    response::IntoResponse,
    routing::{post, get, delete},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, SaltString},
    Argon2, PasswordVerifier,
};

use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub uuid: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    #[allow(dead_code)]
    pub role: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

// Hash a password
/// hash_password - Performs hash password.
fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())
        .map(|hash| hash.to_string())
}

// Verify a password
/// verify_password - Performs verify password.
fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| e.to_string())?;
    match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

/// Generate a signed token bound to the server's vault_key with 24-hour expiration.
fn generate_token(user_id: i64, role: &str, key: &[u8; 32]) -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let payload = format!("{}:{}:{}", user_id, role, timestamp);
    let mut hasher = Sha256::new();
    hasher.update(key);
    hasher.update(payload.as_bytes());
    hasher.update(key);
    let sig = crate::services::vault_crypto::to_hex(&hasher.finalize());
    format!("{}.{}", payload, sig)
}

/// Verify a signed token and return `(user_id, role)` if valid and not expired (24h).
fn verify_token(token: &str, key: &[u8; 32]) -> Option<(i64, String)> {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};
    let (payload, sig) = token.rsplit_once('.')?;
    let mut parts = payload.splitn(3, ':');
    let user_id: i64 = parts.next()?.parse().ok()?;
    let role = parts.next()?.to_string();
    let issued_at: u64 = parts.next()?.parse().ok()?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    if now.saturating_sub(issued_at) > 86_400 {
        return None;
    }

    let mut hasher = Sha256::new();
    hasher.update(key);
    hasher.update(payload.as_bytes());
    hasher.update(key);
    let expected_sig = crate::services::vault_crypto::to_hex(&hasher.finalize());
    if !crate::routes::constant_time_eq_str(sig, &expected_sig) {
        return None;
    }
    Some((user_id, role))
}

fn extract_bearer_claims(headers: &axum::http::HeaderMap, key: &[u8; 32]) -> Option<(i64, String)> {
    let header_val = headers.get(axum::http::header::AUTHORIZATION)?.to_str().ok()?;
    let token = header_val.strip_prefix("Bearer ").unwrap_or(header_val).trim();
    verify_token(token, key)
}

// Login handler
/// login - Performs login.
pub async fn login(
    State(state): State<std::sync::Arc<AppState>>,
    Json(request): Json<LoginRequest>,
) -> axum::response::Response {
    let result = sqlx::query(
        "SELECT id, uuid, username, email, password_hash, role, created_at FROM users WHERE username = ?"
    )
    .bind(&request.username)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(Some(row)) => {
            let id: i64 = row.get("id");
            let uuid: String = row.get("uuid");
            let username: String = row.get("username");
            let email: String = row.get("email");
            let password_hash: String = row.get("password_hash");
            let role: String = row.get("role");
            let created_at: String = row.get("created_at");

            if let Ok(true) = verify_password(&request.password, &password_hash) {
                let key = *state.vault_key.read();
                let token = generate_token(id, &role, &key);
                let user = User {
                    id,
                    uuid,
                    username,
                    email,
                    role,
                    created_at,
                };
                return (StatusCode::OK, Json(AuthResponse { token, user })).into_response();
            }
            (StatusCode::UNAUTHORIZED, Json(ErrorResponse { error: "Invalid credentials".to_string() })).into_response()
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse { error: "Invalid credentials".to_string() }),
        ).into_response(),
    }
}

// Register handler
/// register - Performs register (always assigns 'user' role to prevent self-escalation).
pub async fn register(
    State(state): State<std::sync::Arc<AppState>>,
    Json(request): Json<CreateUserRequest>,
) -> axum::response::Response {
    let password_hash = match hash_password(&request.password) {
        Ok(hash) => hash,
        Err(e) => return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse { error: format!("Failed to hash password: {}", e) }),
        ).into_response(),
    };

    let uuid = Uuid::new_v4().to_string();
    let role = "user".to_string();

    let result = sqlx::query(
        "INSERT INTO users (uuid, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&uuid)
    .bind(&request.username)
    .bind(&request.email)
    .bind(&password_hash)
    .bind(&role)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            let key = *state.vault_key.read();
            let token = generate_token(id, &role, &key);
            let user = User {
                id,
                uuid,
                username: request.username,
                email: request.email,
                role,
                created_at: String::new(),
            };
            (StatusCode::CREATED, Json(AuthResponse { token, user })).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: format!("Registration failed: {}", e) }),
        ).into_response(),
    }
}

// Get current user (requires auth)
/// me - Retrieves authenticated user profile from signed Bearer token.
pub async fn me(
    State(state): State<std::sync::Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    let key = *state.vault_key.read();
    let Some((user_id, _)) = extract_bearer_claims(&headers, &key) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse { error: "Missing or invalid authorization token".to_string() }),
        )
            .into_response();
    };

    let row = sqlx::query(
        "SELECT id, uuid, username, email, role, created_at FROM users WHERE id = ?"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let Some(row) = row else {
        return (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse { error: "User not found".to_string() }),
        )
            .into_response();
    };

    let user = User {
        id: row.get("id"),
        uuid: row.get("uuid"),
        username: row.get("username"),
        email: row.get("email"),
        role: row.get("role"),
        created_at: row.get("created_at"),
    };
    (StatusCode::OK, Json(user)).into_response()
}

// List all users (admin only)
/// list_users - Retrieves list users (requires admin Bearer token).
pub async fn list_users(
    State(state): State<std::sync::Arc<AppState>>,
    headers: axum::http::HeaderMap,
) -> axum::response::Response {
    let key = *state.vault_key.read();
    let Some((_, role)) = extract_bearer_claims(&headers, &key) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse { error: "Missing or invalid authorization token".to_string() }),
        )
            .into_response();
    };
    if role != "admin" {
        return (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse { error: "Admin role required".to_string() }),
        )
            .into_response();
    }

    let result = sqlx::query(
        "SELECT id, uuid, username, email, role, created_at FROM users"
    )
    .fetch_all(&state.db)
    .await;

    match result {
        Ok(rows) => {
            let users: Vec<User> = rows
                .into_iter()
                .map(|row| User {
                    id: row.get("id"),
                    uuid: row.get("uuid"),
                    username: row.get("username"),
                    email: row.get("email"),
                    role: row.get("role"),
                    created_at: row.get("created_at"),
                })
                .collect();
            (StatusCode::OK, Json(users)).into_response()
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(Vec::<User>::new()),
        )
            .into_response(),
    }
}

// Delete user (admin only)
/// delete_user - Deletes user by ID (requires admin Bearer token).
pub async fn delete_user(
    State(state): State<std::sync::Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Path(user_id): Path<i64>,
) -> axum::response::Response {
    let key = *state.vault_key.read();
    let Some((_, role)) = extract_bearer_claims(&headers, &key) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse { error: "Missing or invalid authorization token".to_string() }),
        )
            .into_response();
    };
    if role != "admin" {
        return (
            StatusCode::FORBIDDEN,
            Json(ErrorResponse { error: "Admin role required".to_string() }),
        )
            .into_response();
    }

    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"message": "User deleted"}))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("Failed to delete user: {}", e)})),
        )
            .into_response(),
    }
}

// Create auth routes
/// create_auth_routes - Handles create auth routes.
pub fn create_auth_routes() -> Router<std::sync::Arc<AppState>> {
    Router::new()
        .route("/login", post(login))
        .route("/register", post(register))
        .route("/me", get(me))
        .route("/users", get(list_users))
        .route("/users/:user_id", delete(delete_user))
}
