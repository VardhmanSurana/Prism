//! Shared file-import engine.
//!
//! Prism indexes media **in place** (no copying). A single media file is
//! indexed by inserting a `photos` row pointing at its absolute on-disk path,
//! pre-generating a thumbnail, and enqueueing AI analysis. This module is the
//! one implementation of that flow, shared by:
//!
//! - `POST /api/v1/photos/upload` (JSON path-indexing branch and blob branch)
//! - the watch-folder indexer (`services::watcher`)
//! - tests
//!
//! Deduplication is by absolute path: importing an already-indexed file is a
//! no-op that only backfills missing `uuid`/`file_size` (legacy rows).

use std::path::{Path, PathBuf};
use uuid::Uuid;

use crate::models::Photo;
use crate::services::exif::extract_exif;
use crate::services::thumbnail::get_image_info;
use crate::AppState;

/// Image extensions accepted for in-place indexing.
pub const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "tif", "tiff"];

/// Video extensions accepted for in-place indexing.
pub const VIDEO_EXTS: &[&str] = &["mp4", "mov", "m4v", "avi", "mkv", "webm", "3gp"];

/// file_extension - Lowercased extension of `path` (without the dot).
pub fn file_extension(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
}

/// is_importable_media - True when the path has a supported media extension.
pub fn is_importable_media(path: &Path) -> bool {
    let ext = file_extension(path);
    IMAGE_EXTS.contains(&ext.as_str()) || VIDEO_EXTS.contains(&ext.as_str())
}

/// is_video_extension - True when the path looks like a video file.
pub fn is_video_extension(path: &Path) -> bool {
    VIDEO_EXTS.contains(&file_extension(path).as_str())
}

/// expand_tilde - Expands a leading `~` or `~/` using `$HOME`.
///
/// Watched/excluded folder entries and manual inputs frequently use `~`
/// (the default watched folder is `~/Pictures`), while the library stores
/// absolute paths — everything that compares or matches paths must expand.
pub fn expand_tilde(path_str: &str) -> PathBuf {
    let trimmed = path_str.trim();
    if trimmed == "~" {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home);
        }
    } else if let Some(rest) = trimmed.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(trimmed)
}

/// Loads a photo row and attaches its canonical thumbnail URL.
async fn load_photo_with_url(db: &crate::db::DbPool, id: i64) -> Result<Photo, String> {
    let mut photo = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE id = ?")
        .bind(id)
        .fetch_one(db)
        .await
        .map_err(|e| e.to_string())?;
    let p_key = photo.uuid.as_deref().unwrap_or(&photo.id.to_string()).to_string();
    photo.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
    Ok(photo)
}

/// import_file - Indexes one on-disk media file into the library.
///
/// Returns the indexed photo (with thumbnail URL set) and whether it was
/// newly imported. Existing rows (matched by absolute path) are returned with
/// `newly_imported = false` after backfilling any missing `uuid`/`file_size`.
pub async fn import_file(state: &AppState, target_path: &Path) -> Result<(Photo, bool), String> {
    let abs_path_str = target_path.to_string_lossy().to_string();

    if !target_path.exists() {
        return Err(format!("File not found: {}", abs_path_str));
    }

    // Dedupe by absolute path; backfill uuid/file_size on legacy rows.
    if let Ok(Some(mut existing)) = sqlx::query_as::<_, Photo>("SELECT * FROM photos WHERE path = ?")
        .bind(&abs_path_str)
        .fetch_optional(&state.db)
        .await
    {
        let file_size = std::fs::metadata(target_path).ok().map(|m| m.len() as i64);
        let sz = existing.file_size.or(file_size);
        if existing.uuid.is_none() || existing.file_size.is_none() {
            let u = existing.uuid.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
            sqlx::query("UPDATE photos SET uuid = ?, file_size = ? WHERE id = ?")
                .bind(&u)
                .bind(sz)
                .bind(existing.id)
                .execute(&state.db)
                .await
                .ok();
            existing.uuid = Some(u);
            existing.file_size = sz;
        }
        let p_key = existing.uuid.as_deref().unwrap_or(&existing.id.to_string()).to_string();
        existing.url = Some(format!("/api/v1/photos/{}/thumbnail", p_key));
        return Ok((existing, false));
    }

    let filename = target_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "photo.jpg".to_string());
    let is_video = is_video_extension(target_path);
    let file_size = std::fs::metadata(target_path).ok().map(|m| m.len() as i64);
    let mime = mime_guess::from_path(target_path)
        .first_or_octet_stream()
        .to_string();

    // Dimensions: images decode through the thumbnail engine; videos keep
    // placeholder dimensions (same fallback as the upload API).
    let img_info = get_image_info(target_path).unwrap_or_else(|_| crate::services::thumbnail::ImageInfo {
        width: 1920,
        height: 1080,
        aspect_ratio: 1.77,
    });
    let exif = extract_exif(target_path);
    let now_str = chrono::Utc::now().to_rfc3339();
    let new_uuid = Uuid::new_v4().to_string();

    let id = sqlx::query(
        r#"
        INSERT INTO photos (uuid, filename, path, width, height, aspect_ratio, exif_make, exif_model, exif_iso, exif_focal_length, date_taken, date, upload_date, file_type, mime_type, file_size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&new_uuid)
    .bind(&filename)
    .bind(&abs_path_str)
    .bind(img_info.width as i32)
    .bind(img_info.height as i32)
    .bind(img_info.aspect_ratio)
    .bind(&exif.make)
    .bind(&exif.model)
    .bind(&exif.iso)
    .bind(&exif.focal_length)
    .bind(&now_str)
    .bind(&now_str)
    .bind(&now_str)
    .bind(if is_video { "video" } else { "image" })
    .bind(&mime)
    .bind(file_size)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .last_insert_rowid();

    // Pre-generate the thumbnail in the background (images only).
    if !is_video {
        let src = target_path.to_path_buf();
        let thumb_dir = state.config.thumbnails_dir.clone();
        let thumb_quality = state.config.thumb_quality.clone();
        tokio::task::spawn_blocking(move || {
            let _ = crate::services::thumbnail::generate_thumbnail(&src, &thumb_dir, id, 400, Some(&thumb_quality));
        });
    }

    // Enqueue for AI processing.
    crate::services::worker::enqueue_photo(&state.db, id).await;
    state.worker.notify.notify_one();

    let photo = load_photo_with_url(&state.db, id).await?;
    Ok((photo, true))
}

/// BatchImportStats - Outcome counters for a batch import.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct BatchImportStats {
    pub imported: usize,
    pub skipped: usize,
    pub failed: usize,
}

/// collect_media_files_public - Recursively lists importable media files under
/// `dir`, skipping hidden entries and vault/backup artifacts (but with no
/// exclusion list — used by `expand-directory`).
pub fn collect_media_files_public(dir: &Path, out: &mut Vec<PathBuf>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if name.starts_with('.')
            || name.ends_with(".prism_enc")
            || name.ends_with(".prism_backup")
            || name.ends_with(".prism_backup.lock")
        {
            continue;
        }
        match entry.file_type() {
            Ok(t) if t.is_dir() => collect_media_files_public(&path, out),
            Ok(t) if t.is_file() => {
                if is_importable_media(&path) {
                    out.push(path);
                }
            }
            _ => {}
        }
    }
}

/// import_batch - Imports a batch of file paths with bounded concurrency.
pub async fn import_batch(state: &AppState, paths: &[PathBuf]) -> BatchImportStats {
    const CONCURRENCY: usize = 8;
    let mut stats = BatchImportStats::default();

    for chunk in paths.chunks(CONCURRENCY) {
        let results = futures::future::join_all(
            chunk.iter().map(|p| import_file(state, p)),
        )
        .await;
        for result in results {
            match result {
                Ok((_photo, newly_imported)) => {
                    if newly_imported {
                        stats.imported += 1;
                    } else {
                        stats.skipped += 1;
                    }
                }
                Err(_) => stats.failed += 1,
            }
        }
    }

    stats
}
