use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Json, Response},
};
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::fs::File;
use tokio_util::io::ReaderStream;

use crate::models::Photo;
use crate::services::thumbnail::{generate_thumbnail, generate_vault_thumbnail};
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

    if is_locked {
        let vault_initialized: Option<String> = sqlx::query_scalar(
            "SELECT value FROM settings WHERE key = 'vault_initialized'",
        )
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if vault_initialized.as_deref() == Some("true")
            && !crate::services::vault_crypto::get_vault().is_unlocked()
        {
            return Err((
                StatusCode::LOCKED,
                "Vault is locked. Unlock the vault to view locked photos.".to_string(),
            ));
        }
    }

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
        p.normalize_display_fields();
    }


    Ok(Json(photos))
}

/// get_photo - Retrieves get photo.
pub async fn get_photo(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<Photo>, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;
    if photo.is_locked {
        let vault_initialized: Option<String> = sqlx::query_scalar(
            "SELECT value FROM settings WHERE key = 'vault_initialized'",
        )
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten();

        if vault_initialized.as_deref() == Some("true")
            && !crate::services::vault_crypto::get_vault().is_unlocked()
        {
            return Err((
                StatusCode::LOCKED,
                "Vault is locked. Unlock the vault to view this photo.".to_string(),
            ));
        }
    }
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

    // Reject sensitive internal files (SQLite DBs, vault keys, encrypted blobs, dotfiles, source files)
    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if file_name.starts_with('.')
        || file_name.ends_with(".db")
        || file_name.ends_with(".db-wal")
        || file_name.ends_with(".db-shm")
        || file_name.ends_with(".key")
        || file_name.ends_with(".prism_enc")
        || file_name.ends_with(".thumb_enc")
        || file_name.ends_with(".env")
        || file_name.ends_with(".toml")
        || file_name.ends_with(".rs")
    {
        return Err((
            StatusCode::FORBIDDEN,
            "Access denied: sensitive file type".to_string(),
        ));
    }

    // 1. Check configured media root directories (upload_dir, thumbnails_dir — never cwd)
    let allowed_roots = [
        state.config.upload_dir.clone(),
        state.config.thumbnails_dir.clone(),
    ];
    for root in &allowed_roots {
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

    // 3. Check registered unlocked photos in database
    let raw_str = path.to_string();
    let canonical_str = canonical.to_string_lossy().to_string();
    let exists_in_db: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM photos WHERE (path = ? OR path = ?) AND is_locked = 0)"
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

/// Resolution outcome for a photo's content location.
///
/// Vaulted photos keep their ciphertext at `<original>.prism_enc` after the
/// plaintext original is shredded on lock, so path resolution must consider
/// both siblings at every candidate location.
pub struct ResolvedPhotoContentPaths {
    /// Plaintext original if it exists on disk.
    pub plaintext: Option<PathBuf>,
    /// `.prism_enc` ciphertext if it exists on disk.
    pub encrypted: Option<PathBuf>,
}

/// Resolves a photo path to its plaintext and/or `.prism_enc` ciphertext.
///
/// Mirrors `resolve_photo_path`'s candidate strategy (raw path, cwd-relative,
/// uploads-relative), but accepts the `<candidate>.prism_enc` sibling when the
/// plaintext itself is gone — the steady state for photos locked into the
/// encrypted vault.
pub fn resolve_photo_content_paths(raw_path: &str) -> ResolvedPhotoContentPaths {
    let raw = PathBuf::from(raw_path);
    let filename = raw
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    let candidates = [
        raw.clone(),
        cwd.join(raw_path),
        cwd.join("uploads").join(&filename),
    ];

    for candidate in candidates {
        let enc = PathBuf::from(format!("{}.prism_enc", candidate.display()));
        if candidate.exists() {
            return ResolvedPhotoContentPaths {
                plaintext: Some(candidate),
                encrypted: enc.exists().then_some(enc),
            };
        }
        if enc.exists() {
            return ResolvedPhotoContentPaths {
                plaintext: None,
                encrypted: Some(enc),
            };
        }
    }

    ResolvedPhotoContentPaths {
        plaintext: None,
        encrypted: None,
    }
}

/// Content source for serving a photo, transparently decrypting vaulted files.
///
/// For locked photos the plaintext original has been shredded and replaced by
/// `<path>.prism_enc` ciphertext. Instead of writing decrypted data to disk
/// (zero-knowledge requirement), the ciphertext is decrypted into memory and
/// returned as full bytes for direct streaming in the response.
enum PhotoContent {
    /// Plaintext file on disk — stream it.
    File(PathBuf),
    /// Decrypted-in-memory bytes from a `.prism_enc` vault file.
    DecryptedBytes(Vec<u8>, String),
}

async fn resolve_photo_content(
    photo: &Photo,
) -> Result<PhotoContent, (StatusCode, String)> {
    let resolved = resolve_photo_content_paths(&photo.path);
    if resolved.plaintext.is_none() && resolved.encrypted.is_none() {
        return Err((StatusCode::NOT_FOUND, "Source file missing".to_string()));
    }

    // Vaulted photo: prefer decrypting the ciphertext so plaintext is never
    // re-materialized on disk. Legacy pre-vault locked photos (DB flag only,
    // no ciphertext) fall through to plaintext serving.
    if photo.is_locked {
        if let Some(enc_path) = resolved.encrypted {
            let key = crate::services::vault_crypto::get_vault().get_key().ok_or((
                StatusCode::LOCKED,
                "Vault is locked. Unlock the vault to view this photo.".to_string(),
            ))?;
            let base = resolved.plaintext.clone().unwrap_or_else(|| {
                PathBuf::from(enc_path.to_string_lossy().trim_end_matches(".prism_enc"))
            });
            let bytes = tokio::task::spawn_blocking(move || {
                crate::services::vault_crypto::VaultManager::decrypt_file(
                    std::path::Path::new(&enc_path),
                    &key,
                )
            })
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .map_err(|e| (StatusCode::UNAUTHORIZED, e))?;
            let mime = mime_guess::from_path(&base)
                .first_or_octet_stream()
                .to_string();
            return Ok(PhotoContent::DecryptedBytes(bytes, mime));
        }
    }

    let real_path = resolved
        .plaintext
        .ok_or((StatusCode::NOT_FOUND, "Source file missing".to_string()))?;
    Ok(PhotoContent::File(real_path))
}

/// get_photo_file - Retrieves get photo file.
pub async fn get_photo_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let photo = find_photo_by_id_or_uuid(&state.db, &id).await?;

    let (mime, body) = match resolve_photo_content(&photo).await? {
        PhotoContent::File(file_path) => {
            let mime = mime_guess::from_path(&file_path)
                .first_or_octet_stream()
                .to_string();
            let file = File::open(&file_path)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            let stream = ReaderStream::new(file);
            (mime, axum::body::Body::from_stream(stream))
        }
        PhotoContent::DecryptedBytes(bytes, mime) => {
            (mime, axum::body::Body::from(bytes))
        }
    };

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

    let max_dim = query.size.unwrap_or(400).clamp(64, 2048);
    let thumbnails_dir = state.config.thumbnails_dir.clone();
    let photo_id = photo.id;
    let thumb_quality = state.config.thumb_quality.clone();

    // Vaulted photos: the decrypted thumbnail is encrypted-at-rest in the
    // thumbnails dir (AES-256-GCM, `.thumb_enc`) so no plaintext image ever
    // persists on disk; it is decrypted back into memory on every request.
    let content = resolve_photo_content(&photo).await?;

    let (thumb_path, thumb_bytes) = match content {
        PhotoContent::File(source_path) => {
            let source_path_clone = source_path.clone();
            let target = tokio::task::spawn_blocking(move || {
                generate_thumbnail(&source_path_clone, &thumbnails_dir, photo_id, max_dim, Some(&thumb_quality))
            })
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .unwrap_or_else(|_| source_path.clone());
            (target, None)
        }
        PhotoContent::DecryptedBytes(bytes, _) => {
            let key = crate::services::vault_crypto::get_vault().get_key().ok_or((
                StatusCode::LOCKED,
                "Vault is locked. Unlock the vault to view this photo.".to_string(),
            ))?;
            let enc_thumb = tokio::task::spawn_blocking(move || {
                generate_vault_thumbnail(&bytes, &thumbnails_dir, photo_id, max_dim, &key, Some(&thumb_quality))
            })
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            let enc_thumb_clone = enc_thumb.clone();
            let plain = tokio::task::spawn_blocking(move || {
                crate::services::vault_crypto::VaultManager::decrypt_file(
                    std::path::Path::new(&enc_thumb_clone),
                    &key,
                )
            })
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
            (enc_thumb, Some(plain))
        }
    };

    let body = if let Some(bytes) = thumb_bytes {
        axum::body::Body::from(bytes)
    } else {
        let file = File::open(&thumb_path)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        axum::body::Body::from_stream(ReaderStream::new(file))
    };

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, "image/jpeg")
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
    headers: axum::http::HeaderMap,
    Query(query): Query<ServeLocalQuery>,
) -> Result<Response, (StatusCode, String)> {
    let file_path = safe_resolve_library_path(&query.path, &state).await?;
    serve_file_by_path(headers, file_path).await
}

/// serve_sample_image - Performs serve sample image.
pub async fn serve_sample_image(
    headers: axum::http::HeaderMap,
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
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../frontend/public/sample_images"),
    ];

    for sample_dir in &candidates {
        if sample_dir.exists() {
            if let Ok(p) = safe_resolve_under(&sample_dir.join(&filename).to_string_lossy(), sample_dir) {
                if p.exists() {
                    return serve_file_by_path(headers, p).await;
                }
            }
        }
    }

    Err((StatusCode::NOT_FOUND, format!("Sample image '{}' not found", filename)))
}


/// serve_file_by_path - Performs serve file by path.
async fn serve_file_by_path(headers: axum::http::HeaderMap, file_path: PathBuf) -> Result<Response, (StatusCode, String)> {
    crate::services::media_stream::serve_seekable_file(&headers, file_path).await
}
