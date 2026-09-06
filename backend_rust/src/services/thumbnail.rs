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
