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

// Generate a simple JWT-like token (for demo purposes)
// In production, use a proper JWT library like `jsonwebtoken`
/// generate_token - Performs generate token.
fn generate_token(user_id: i64, username: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    format!("{}_{}_{}", user_id, username, timestamp)
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
                let token = generate_token(id, &username);
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
/// register - Performs register.
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
    let role = request.role.unwrap_or_else(|| "user".to_string());

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
        Ok(_) => {
            let user = User {
                id: 0,
                uuid,
                username: request.username,
                email: request.email,
                role,
                created_at: String::new(),
            };
            (StatusCode::CREATED, Json(AuthResponse { token: String::new(), user })).into_response()
        }
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse { error: format!("Registration failed: {}", e) }),
        ).into_response(),
    }
}

// Get current user (requires auth)
/// me - Performs me.
pub async fn me(
    State(_state): State<std::sync::Arc<AppState>>,
) -> impl IntoResponse {
    // In a real implementation, extract user from JWT token
    // For now, return a placeholder
    let user = User {
        id: 1,
        uuid: "admin-uuid".to_string(),
        username: "admin".to_string(),
        email: "admin@prism.local".to_string(),
        role: "admin".to_string(),
        created_at: "2024-01-01".to_string(),
    };
    (StatusCode::OK, Json(user))
}

// List all users (admin only)
/// list_users - Retrieves list users.
pub async fn list_users(
    State(state): State<std::sync::Arc<AppState>>,
) -> impl IntoResponse {
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
            (StatusCode::OK, Json(users))
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(vec![]),
        ),
    }
}

// Delete user (admin only)
/// delete_user - Deletes delete user.
pub async fn delete_user(
    State(state): State<std::sync::Arc<AppState>>,
    Path(user_id): Path<i64>,
) -> impl IntoResponse {
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => (StatusCode::OK, Json(serde_json::json!({"message": "User deleted"}))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": format!("Failed to delete user: {}", e)})),
        ),
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
        .route("/users/{user_id}", delete(delete_user))
}
