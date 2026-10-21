#![allow(dead_code)]

use image::GenericImageView;
use std::fs;
use std::path::{Path, PathBuf};

pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub aspect_ratio: f64,
}

/// Thumbnail quality preset mapping: (jpeg_quality, max_dim).
/// - "fast":     60% quality, 256px — smallest files, fastest generation
/// - "balanced": 85% quality, 400px — good default
/// - "quality":  95% quality, 800px — sharpest, largest files
pub fn quality_preset(preset: &str) -> (u8, u32) {
    match preset {
        "fast" => (60, 256),
        "quality" => (95, 800),
        _ => (85, 400), // "balanced" or unknown → balanced
    }
}

/// Size estimate per thumbnail in bytes for a given quality preset.
pub fn thumb_size_estimate(preset: &str) -> usize {
    match preset {
        "fast" => 8_192,     // ~8 KB
        "quality" => 40_960, // ~40 KB
        _ => 15_360,         // ~15 KB (balanced)
    }
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

/// generate_thumbnail - Generates thumbnail with optional quality preset.
/// `quality` is one of "fast", "balanced", "quality" (default: "balanced").
/// When provided, the max_dim is overridden by the preset's value.
pub fn generate_thumbnail(
    source_path: &Path,
    thumb_dir: &Path,
    photo_id: i64,
    max_dim: u32,
    quality: Option<&str>,
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let (jpeg_quality, effective_max_dim) = match quality {
        Some(q) => quality_preset(q),
        None => (85, max_dim),
    };

    let thumb_filename = if effective_max_dim == 400 {
        format!("{}_thumb.jpg", photo_id)
    } else {
        format!("{}_thumb_{}.jpg", photo_id, effective_max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = load_image_sniffed(source_path)?;
    let resized = img.thumbnail(effective_max_dim, effective_max_dim);

    // Encode with explicit JPEG quality
    let mut jpeg_buf = std::io::Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, jpeg_quality);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| e.to_string())?;

    fs::write(&thumb_path, jpeg_buf.into_inner()).map_err(|e| e.to_string())?;

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
    quality: Option<&str>,
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let (jpeg_quality, effective_max_dim) = match quality {
        Some(q) => quality_preset(q),
        None => (85, max_dim),
    };

    let thumb_filename = if effective_max_dim == 400 {
        format!("{}_thumb.jpg", photo_id)
    } else {
        format!("{}_thumb_{}.jpg", photo_id, effective_max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = image::load_from_memory(bytes).map_err(|e| e.to_string())?;
    let resized = img.thumbnail(effective_max_dim, effective_max_dim);

    let mut jpeg_buf = std::io::Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, jpeg_quality);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| e.to_string())?;

    fs::write(&thumb_path, jpeg_buf.into_inner()).map_err(|e| e.to_string())?;

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
    quality: Option<&str>,
) -> Result<PathBuf, String> {
    fs::create_dir_all(thumb_dir).map_err(|e| e.to_string())?;

    let (jpeg_quality, effective_max_dim) = match quality {
        Some(q) => quality_preset(q),
        None => (85, max_dim),
    };

    let thumb_filename = if effective_max_dim == 400 {
        format!("{}_thumb.jpg.thumb_enc", photo_id)
    } else {
        format!("{}_thumb_{}.jpg.thumb_enc", photo_id, effective_max_dim)
    };
    let thumb_path = thumb_dir.join(&thumb_filename);

    if thumb_path.exists() {
        return Ok(thumb_path);
    }

    let img = image::load_from_memory(decrypted_bytes).map_err(|e| e.to_string())?;
    let resized = img.thumbnail(effective_max_dim, effective_max_dim);
    let mut jpeg_buf = std::io::Cursor::new(Vec::new());
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, jpeg_quality);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| e.to_string())?;

    let ciphertext =
        crate::services::vault_crypto::VaultManager::encrypt_bytes(jpeg_buf.get_ref(), key)?;
    fs::write(&thumb_path, ciphertext).map_err(|e| e.to_string())?;

    Ok(thumb_path)
}
