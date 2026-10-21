//! Seekable media file serving with HTTP Range (RFC 9110) support.
//!
//! Browsers require `206 Partial Content` responses to scrub video/audio
//! without downloading the whole file. Every route that feeds a `<video>`
//! or `<audio>` element (`/local`, `/nle/stream`, `/transcode`,
//! `/hls/playlist`) streams through [`serve_seekable_file`].

use axum::{
    body::Body,
    http::{header, HeaderMap, StatusCode},
    response::Response,
};
use std::io::SeekFrom;
use std::path::{Path, PathBuf};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::AppState;

/// Outcome of validating a `Range` header against a file of `len` bytes.
#[derive(Debug, PartialEq, Eq)]
pub enum RangeRequest {
    /// No (or an ignorable) range header — serve the full body.
    Full,
    /// Valid single range; `start..=end` are inclusive byte offsets.
    Partial { start: u64, end: u64 },
    /// Syntactically valid range that cannot be satisfied — reply 416.
    Unsatisfiable,
}

/// Parse a single-range `bytes` header (RFC 9110 §14.1).
///
/// Multi-range requests are served as the full body (spec-legal), and
/// syntactically broken headers are ignored so playback never hard-fails
/// on malformed client requests.
/// `parse_byte_range` - Performs parse byte range.
pub fn parse_byte_range(header_value: &str, len: u64) -> RangeRequest {
    let Some(spec) = header_value.trim().strip_prefix("bytes=") else {
        return RangeRequest::Full;
    };
    if spec.is_empty() || spec.contains(',') {
        return RangeRequest::Full;
    }
    let (start_str, end_str) = match spec.split_once('-') {
        Some(pair) => pair,
        None => return RangeRequest::Full,
    };
    if len == 0 {
        return RangeRequest::Unsatisfiable;
    }
    match (start_str.trim(), end_str.trim()) {
        ("", "") => RangeRequest::Unsatisfiable,
        // Open-ended: "start-"
        (s, "") => match s.parse::<u64>() {
            Ok(start) if start < len => RangeRequest::Partial { start, end: len - 1 },
            Ok(_) => RangeRequest::Unsatisfiable,
            Err(_) => RangeRequest::Full,
        },
        // Suffix: "-n" → last n bytes
        ("", n) => match n.parse::<u64>() {
            Ok(n) if n > 0 => {
                let start = len.saturating_sub(n);
                RangeRequest::Partial { start, end: len - 1 }
            }
            Ok(_) => RangeRequest::Unsatisfiable,
            Err(_) => RangeRequest::Full,
        },
        // Explicit: "start-end" (end clamped to len-1)
        (s, e) => match (s.parse::<u64>(), e.parse::<u64>()) {
            // start > end is syntactically invalid → ignore the header.
            (Ok(start), Ok(end)) if start > end => RangeRequest::Full,
            (Ok(start), Ok(end)) if start < len => {
                RangeRequest::Partial { start, end: end.min(len - 1) }
            }
            (Ok(_), Ok(_)) => RangeRequest::Unsatisfiable,
            _ => RangeRequest::Full,
        },
    }
}

/// Resolve a user-supplied media path to a canonical on-disk path, trying
/// (in order): the raw path, cwd-relative, `uploads/`-relative by filename.
/// `resolve_media_path` - Performs resolve media path.
pub fn resolve_media_path(path_str: &str) -> Option<PathBuf> {
    let raw = Path::new(path_str);
    if raw.is_absolute() && raw.exists() {
        return raw.canonicalize().ok();
    }
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    for candidate in [raw.to_path_buf(), cwd.join(path_str)] {
        if candidate.exists() {
            return candidate.canonicalize().ok();
        }
    }
    let filename = raw.file_name()?.to_string_lossy().to_string();
    let alt = cwd.join("uploads").join(&filename);
    if alt.exists() {
        return alt.canonicalize().ok();
    }
    None
}

/// Reject sensitive internal files (SQLite DBs, vault keys, encrypted blobs,
/// dotfiles, source files) by filename.
/// `is_sensitive_filename` - Performs is sensitive filename.
fn is_sensitive_filename(canonical: &Path) -> bool {
    let file_name = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    file_name.starts_with('.')
        || file_name.ends_with(".db")
        || file_name.ends_with(".db-wal")
        || file_name.ends_with(".db-shm")
        || file_name.ends_with(".key")
        || file_name.ends_with(".prism_enc")
        || file_name.ends_with(".thumb_enc")
        || file_name.ends_with(".env")
        || file_name.ends_with(".toml")
        || file_name.ends_with(".rs")
}

/// True when the canonical path lies under one of the (post-canonicalize)
/// allowed roots.
/// `under_allowed_roots` - Performs under allowed roots.
pub fn under_allowed_roots(canonical: &Path, allowed_roots: &[PathBuf]) -> bool {
    for root in allowed_roots {
        if let Ok(canonical_root) = root.canonicalize() {
            if canonical.starts_with(&canonical_root) {
                return true;
            }
        }
    }
    false
}

/// Full allowlist gate for `/nle/stream`-style routes: proxy scratch dir,
/// configured roots, registered external locations, then a DB lookup for
/// registered (unlocked) photos. Mirrors `safe_resolve_library_path` but
/// accepts a pre-resolved canonical path so the two never diverge on
/// symlink handling.
/// `ensure_streamable_path` - Performs ensure streamable path.
pub async fn ensure_streamable_path(
    canonical: &Path,
    raw_path: &str,
    state: &AppState,
) -> Result<(), (StatusCode, String)> {
    if !canonical.is_file() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }
    if is_sensitive_filename(canonical) {
        return Err((
            StatusCode::FORBIDDEN,
            "Access denied: sensitive file type".to_string(),
        ));
    }

    // NLE proxies live in the temp scratch dir.
    let proxy_root = std::env::temp_dir().join("prism_proxies");
    if canonical.starts_with(&proxy_root) {
        return Ok(());
    }

    let allowed_roots = [
        state.config.upload_dir.clone(),
        state.config.thumbnails_dir.clone(),
    ];
    if under_allowed_roots(canonical, &allowed_roots) {
        return Ok(());
    }

    if let Ok(external_paths) = sqlx::query_scalar::<_, String>(
        "SELECT mount_path FROM external_locations WHERE enabled = 1"
    )
    .fetch_all(&state.db)
    .await
    {
        for ext in external_paths {
            if let Ok(canonical_ext) = PathBuf::from(ext).canonicalize() {
                if canonical.starts_with(&canonical_ext) {
                    return Ok(());
                }
            }
        }
    }

    let path_str = canonical.to_string_lossy().to_string();
    let raw_str = raw_path.to_string();
    let exists_in_db: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM photos WHERE (path = ? OR path = ?) AND is_locked = 0)"
    )
    .bind(&raw_str)
    .bind(&path_str)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if exists_in_db {
        return Ok(());
    }

    Err((
        StatusCode::FORBIDDEN,
        "Access denied: path is outside allowed media directories".to_string(),
    ))
}

/// Serve `file_path` honoring single-range `Range` requests with 206
/// Partial Content, and always advertising `Accept-Ranges: bytes`.
/// `serve_seekable_file` - Performs serve seekable file.
pub async fn serve_seekable_file(
    headers: &HeaderMap,
    file_path: PathBuf,
) -> Result<Response, (StatusCode, String)> {
    let metadata = tokio::fs::metadata(&file_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let len = metadata.len();
    let mime = mime_guess::from_path(&file_path)
        .first_or_octet_stream()
        .to_string();

    let mut builder = Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(header::CACHE_CONTROL, "private, max-age=3600");

    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(|v| parse_byte_range(v, len))
        .unwrap_or(RangeRequest::Full);

    match range {
        RangeRequest::Unsatisfiable => {
            builder = builder.status(StatusCode::RANGE_NOT_SATISFIABLE);
            builder
                .header(header::CONTENT_RANGE, format!("bytes */{}", len))
                .body(Body::empty())
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
        RangeRequest::Partial { start, end } => {
            let count = end - start + 1;
            let mut file = tokio::fs::File::open(&file_path)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            file.seek(SeekFrom::Start(start))
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            let stream = ReaderStream::new(file.take(count));
            builder = builder.status(StatusCode::PARTIAL_CONTENT);
            builder
                .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, len))
                .header(header::CONTENT_LENGTH, count)
                .body(Body::from_stream(stream))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
        RangeRequest::Full => {
            let file = tokio::fs::File::open(&file_path)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            let stream = ReaderStream::new(file);
            builder = builder.status(StatusCode::OK);
            builder
                .header(header::CONTENT_LENGTH, len)
                .body(Body::from_stream(stream))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
        }
    }
}

/// Shared handler for `/local`-style raw media routes. Resolves the query
/// path, applies the library allowlist (including DB-registered photos),
/// then serves it with Range support.
/// `serve_stream_route` - Performs serve stream route.
pub async fn serve_stream_route(
    state: &AppState,
    headers: HeaderMap,
    path_str: &str,
) -> Result<Response, (StatusCode, String)> {
    let canonical = resolve_media_path(path_str.trim()).ok_or((
        StatusCode::NOT_FOUND,
        format!("File not found: {}", path_str),
    ))?;
    ensure_streamable_path(&canonical, path_str.trim(), state).await?;
    serve_seekable_file(&headers, canonical).await
}
