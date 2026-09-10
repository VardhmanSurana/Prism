use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Json, Response},
};
use chrono::Utc;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::File;
use tokio_util::io::ReaderStream;

use crate::models::Photo;
use crate::services::thumbnail::generate_thumbnail;
use crate::AppState;
use super::find_photo_by_id_or_uuid;

#[derive(Deserialize)]
#[allow(dead_code)]
pub struct PhotoQuery {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub is_favorite: Option<bool>,
    pub is_trash: Option<bool>,
    pub is_locked: Option<bool>,
    pub search: Option<String>,
}

/// list_photos - Retrieves list photos.
pub async fn list_photos(
    State(state): State<Arc<AppState>>,
    Query(query): Query<PhotoQuery>,
) -> Result<Json<Vec<Photo>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(50).clamp(1, 500);
    let offset = query.offset.unwrap_or_else(|| {
        let page = query.page.unwrap_or(1).max(1);
        (page - 1) * limit
    });

    let is_trash = query.is_trash.unwrap_or(false);
    let is_locked = query.is_locked.unwrap_or(false);

    let mut sql = String::from("SELECT * FROM photos WHERE is_trash = ? AND is_locked = ?");
    if let Some(fav) = query.is_favorite {
        if fav {
            sql.push_str(" AND is_favorite = 1");
        }
    }
    sql.push_str(" ORDER BY date_taken DESC, id DESC LIMIT ? OFFSET ?");

    let mut photos = sqlx::query_as::<_, Photo>(&sql)
        .bind(is_trash)
        .bind(is_locked)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for p in &mut photos {
        let p_key = p.uuid.as_deref().unwrap_or(&p.id.to_string()).to_string();
        if p.url.as_deref().unwrap_or("").is_empty() { p.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key)); }
        if p.date_taken.is_none() { p.date_taken = p.upload_date.or(Some(Utc::now())); }
        if p.date.is_none() { p.date = p.date_taken; }
        if p.file_size.is_none() || p.file_size == Some(0) {
            if let Some(real_path) = resolve_photo_path(&p.path) {
                if let Ok(meta) = std::fs::metadata(&real_path) {
                    p.file_size = Some(meta.len() as i64);
                }
            }
        }
    }

    Ok(Json(photos))
}

/// get_photo - Retrieves get photo.
pub async fn get_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Photo>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    Ok(Json(photo))
}

/// get_photo_metadata - Retrieves get photo metadata.
pub async fn get_photo_metadata(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Photo>, (StatusCode, String)> {
    get_photo(State(state), Path(id)).await
}

// ponytail: canonicalize a user-supplied path to resolve `..` / symlinks.
// Returns Err if the path is invalid or doesn't exist.
/// safe_resolve - Performs safe resolve.
pub fn safe_resolve(path: &str) -> Result<PathBuf, (StatusCode, String)> {
    let raw = PathBuf::from(path);
    let canonical = raw
        .canonicalize()
        .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid path: {}", path)))?;
    if !canonical.exists() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }
    Ok(canonical)
}

// ponytail: ensure resolved path stays under an allowed directory root.
/// safe_resolve_under - Performs safe resolve under.
pub fn safe_resolve_under(path: &str, root: &std::path::Path) -> Result<PathBuf, (StatusCode, String)> {
    let resolved = safe_resolve(path)?;
    let canonical_root = root.canonicalize().map_err(|_| (StatusCode::BAD_REQUEST, "Invalid root directory".to_string()))?;
    if !resolved.starts_with(&canonical_root) {
        return Err((StatusCode::FORBIDDEN, "Access denied: path traversal detected".to_string()));
    }
    Ok(resolved)
}

/// Resolve and validate a local file path against allowed library and upload roots to prevent path traversal attacks.
pub async fn safe_resolve_library_path(
    path: &str,
    state: &AppState,
) -> Result<PathBuf, (StatusCode, String)> {
    let canonical = safe_resolve(path)?;

    // 1. Check configured root directories (upload_dir, thumbnails_dir, cwd)
    let mut allowed_roots = vec![
        state.config.upload_dir.clone(),
        state.config.thumbnails_dir.clone(),
    ];
    if let Ok(cwd) = std::env::current_dir() {
        allowed_roots.push(cwd);
    }
    for root in allowed_roots {
        if let Ok(canonical_root) = root.canonicalize() {
            if canonical.starts_with(&canonical_root) {
                return Ok(canonical);
            }
        }
    }

    // 2. Check registered external locations
    if let Ok(external_paths) = sqlx::query_scalar::<_, String>(
        "SELECT mount_path FROM external_locations WHERE enabled = 1"
    )
    .fetch_all(&state.db)
    .await {
        for ext in external_paths {
            if let Ok(canonical_ext) = PathBuf::from(ext).canonicalize() {
                if canonical.starts_with(&canonical_ext) {
                    return Ok(canonical);
                }
            }
        }
    }

    // 3. Check registered photos in database
    let raw_str = path.to_string();
    let canonical_str = canonical.to_string_lossy().to_string();
    let exists_in_db: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM photos WHERE path = ? OR path = ?)"
    )
    .bind(&raw_str)
    .bind(&canonical_str)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if exists_in_db {
        return Ok(canonical);
    }

    Err((
        StatusCode::FORBIDDEN,
        "Access denied: path is outside allowed library directories".to_string(),
    ))
}


/// resolve_photo_path - Performs resolve photo path.
pub fn resolve_photo_path(raw_path: &str) -> Option<PathBuf> {
    let path = PathBuf::from(raw_path);
    if path.exists() {
        return Some(path);
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let alt1 = cwd.join(raw_path);
    if alt1.exists() {
        return Some(alt1);
    }
    let filename = PathBuf::from(raw_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let alt2 = cwd.join("uploads").join(&filename);
    if alt2.exists() {
        return Some(alt2);
    }
    None
}

/// get_photo_file - Retrieves get photo file.
pub async fn get_photo_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;

    let file_path = resolve_photo_path(&photo.path)
        .ok_or((StatusCode::NOT_FOUND, "Source file missing".to_string()))?;

    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let file = File::open(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stream = ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap())
}

#[derive(Deserialize)]
pub struct ThumbnailQuery {
    pub size: Option<u32>,
}

/// get_photo_thumbnail - Retrieves get photo thumbnail.
pub async fn get_photo_thumbnail(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<ThumbnailQuery>,
) -> Result<Response, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;

    let source_path = resolve_photo_path(&photo.path)
        .ok_or((StatusCode::NOT_FOUND, "Source file missing".to_string()))?;

    let max_dim = query.size.unwrap_or(400).clamp(64, 2048);
    let source_path_clone = source_path.clone();
    let thumbnails_dir = state.config.thumbnails_dir.clone();
    let photo_id = photo.id;

    let target_file_path = tokio::task::spawn_blocking(move || {
        generate_thumbnail(&source_path_clone, &thumbnails_dir, photo_id, max_dim)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .unwrap_or_else(|_| source_path.clone());

    let mime = mime_guess::from_path(&target_file_path)
        .first_or_octet_stream()
        .to_string();

    let file = File::open(&target_file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stream = ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap())
}

#[derive(Deserialize)]
pub struct ServeLocalQuery {
    pub path: String,
}

/// serve_local_file - Performs serve local file.
pub async fn serve_local_file(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ServeLocalQuery>,
) -> Result<Response, (StatusCode, String)> {
    let file_path = safe_resolve_library_path(&query.path, &state).await?;
    serve_file_by_path(file_path).await
}

/// serve_sample_image - Performs serve sample image.
pub async fn serve_sample_image(
    Path(filename): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err((StatusCode::FORBIDDEN, "Access denied: invalid sample filename".to_string()));
    }

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let candidates = [
        cwd.join("frontend/public/sample_images"),
        cwd.join("../frontend/public/sample_images"),
        cwd.join("sample_images"),
        PathBuf::from("/home/chotaxdon/Work/Projects/Prism/frontend/public/sample_images"),
    ];

    for sample_dir in &candidates {
        if sample_dir.exists() {
            if let Ok(p) = safe_resolve_under(&sample_dir.join(&filename).to_string_lossy(), sample_dir) {
                if p.exists() {
                    return serve_file_by_path(p).await;
                }
            }
        }
    }

    Err((StatusCode::NOT_FOUND, format!("Sample image '{}' not found", filename)))
}


/// serve_file_by_path - Performs serve file by path.
async fn serve_file_by_path(file_path: PathBuf) -> Result<Response, (StatusCode, String)> {
    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let file = File::open(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let stream = ReaderStream::new(file);
    let body = axum::body::Body::from_stream(stream);

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(body)
        .unwrap())
}
