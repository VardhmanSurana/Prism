#![allow(dead_code)]

use image::GenericImageView;
use std::fs;
use std::path::{Path, PathBuf};

pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub aspect_ratio: f64,
}

fn load_image_sniffed(path: &Path) -> Result<image::DynamicImage, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    image::load_from_memory(&bytes).map_err(|e| e.to_string())
}

pub fn get_image_info(path: &Path) -> Result<ImageInfo, String> {
    let img = load_image_sniffed(path)?;
    let (width, height) = img.dimensions();
    let aspect_ratio = if height > 0 {
        width as f64 / height as f64
    } else {
        1.0
    };

    Ok(ImageInfo {
        width,
        height,
        aspect_ratio,
    })
}

/// generate_thumbnail - Generates thumbnail.
pub fn generate_thumbnail(
    source_path: &Path,
    thumb_dir: &Path,
    photo_id: i64,
    max_dim: u32,
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let thumb_filename = if max_dim == 400 {
        format!("{}_thumb.jpg", photo_id)
    } else {
        format!("{}_thumb_{}.jpg", photo_id, max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = load_image_sniffed(source_path)?;
    let resized = img.thumbnail(max_dim, max_dim);
    resized.save(&thumb_path).map_err(|e| e.to_string())?;

    Ok(thumb_path)
}

/// Generates a thumbnail from in-memory image bytes (used for decrypted vault
/// photos so plaintext never needs to exist on disk again).
/// Returns the path of the written thumbnail.
pub fn generate_thumbnail_from_bytes(
    bytes: &[u8],
    thumb_dir: &Path,
    photo_id: i64,
    max_dim: u32,
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let thumb_filename = if max_dim == 400 {
        format!("{}_thumb.jpg", photo_id)
    } else {
        format!("{}_thumb_{}.jpg", photo_id, max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
    let resized = img.thumbnail(max_dim, max_dim);
    resized.save(&thumb_path).map_err(|e| e.to_string())?;

    Ok(thumb_path)
}

/// Generates (and caches) an **encrypted** thumbnail for a vaulted photo.
///
/// The resized JPEG is rendered from in-memory decrypted bytes and stored as
/// `<id>_thumb[_<max>].jpg.thumb_enc` (AES-256-GCM, fresh nonce) so that no
/// plaintext image of a locked photo ever persists on disk. Returns the
/// ciphertext path; callers decrypt it back into memory for serving.
/// When the cached ciphertext already exists, generation is skipped.
pub fn generate_vault_thumbnail(
    decrypted_bytes: &[u8],
    thumb_dir: &Path,
    photo_id: i64,
    max_dim: u32,
    key: &[u8; 32],
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let thumb_filename = if max_dim == 400 {
        format!("{}_thumb.jpg.thumb_enc", photo_id)
    } else {
        format!("{}_thumb_{}.jpg.thumb_enc", photo_id, max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = image::load_from_memory(decrypted_bytes).map_err(|e| e.to_string())?;
    let resized = img.thumbnail(max_dim, max_dim);
    let mut jpeg_buf = std::io::Cursor::new(Vec::new());
    resized
        .write_to(&mut jpeg_buf, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    let ciphertext =
        crate::services::vault_crypto::VaultManager::encrypt_bytes(jpeg_buf.get_ref(), key)?;
    fs::write(&thumb_path, ciphertext).map_err(|e| e.to_string())?;

    Ok(thumb_path)
}
