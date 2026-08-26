//! SCUNet blind image denoising.  Single session serialized through the global
//! inference slot (4 GB VRAM budget — one model at a time).
//!
//! Model: `scunet_color_real_psnr` (blind real-world denoising, Apache-2.0).
//! Input:  `[1, 3, H, W]` NCHW float32 in `[0, 1]`, H/W divisible by 8.
//! Output: same shape, clipped `[0, 1]`.
//! H/W must be padded to multiples of 8 before feeding the model; the result
//! is cropped back to the original dimensions.

use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use serde_json::Value;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::info;

// ─────────────────────────── Shared plumbing ──────────────────────────────

struct NamedSession {
    session: Mutex<ort::session::Session>,
    input_name: String,
    output_name: String,
}

fn load_session(paths: &[&str], tag: &str) -> Result<Arc<NamedSession>, String> {
    static CACHE: OnceLock<Mutex<std::collections::HashMap<String, Option<Arc<NamedSession>>>>> =
        OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    if let Some(cached) = cache.lock().unwrap().get(tag) {
        return cached.clone().ok_or_else(|| {
            format!("{} model failed to load previously; see earlier log", tag)
        });
    }

    let found = paths.iter().find(|p| Path::new(p).exists()).copied();
    let loaded = match found {
        Some(path) => match Session::builder()
            .map_err(|e| e.to_string())?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| e.to_string())?
            .commit_from_file(path)
        {
            Ok(session) => {
                info!("[Denoise] {} session loaded from {}", tag, path);
                let input_name = session.inputs().first().map(|i| i.name().to_string())
                    .ok_or_else(|| format!("{} model has no inputs", tag))?;
                let output_name = session.outputs().first().map(|o| o.name().to_string())
                    .ok_or_else(|| format!("{} model has no outputs", tag))?;
                Some(Arc::new(NamedSession {
                    session: Mutex::new(session),
                    input_name,
                    output_name,
                }))
            }
            Err(e) => {
                tracing::warn!("[Denoise] Failed to load {} from {}: {}", tag, path, e);
                None
            }
        },
        None => None,
    };
    cache.lock().unwrap().insert(tag.to_string(), loaded.clone());
    loaded.ok_or_else(|| format!(
        "{} unavailable: download the model first (Model Manager). Expected at {}",
        tag, paths[0]
    ))
}

/// Round `v` up to the nearest multiple of `align`.
fn align_up(v: usize, align: usize) -> usize {
    (v + align - 1) / align * align
}

// ─────────────────────────── SCUNet denoise ───────────────────────────────

pub struct DenoiseEngine {}

pub static DENOISE_ENGINE: OnceLock<DenoiseEngine> = OnceLock::new();

const SCUNET_PATHS: &[&str] = &[
    "models/denoise/scunet_color_real_psnr.onnx",
    "../models/denoise/scunet_color_real_psnr.onnx",
];

/// Tile size fed to the model; bounds peak memory on small VRAM GPUs.
const TILE: usize = 256;
/// Overlap blended away between adjacent tiles to hide seams.
const OVERLAP: usize = 32;
/// SCUNet requires H/W divisible by 8.
const ALIGN: usize = 8;

impl DenoiseEngine {
    pub fn get() -> &'static Self {
        DENOISE_ENGINE.get_or_init(|| DenoiseEngine {})
    }

    pub async fn denoise_async(&self, photo_path: &str) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let _slot = crate::services::inference_slot::acquire("scunet-denoise").await;
        tokio::task::spawn_blocking(move || Self::get().denoise(&photo))
            .await
            .map_err(|e| format!("Denoise task panicked: {}", e))?
    }

    /// Blocking core: tiled SCUNet blind denoising. Writes result back to the
    /// photo file in-place.
    pub fn denoise(&self, photo_path: &str) -> Result<Value, String> {
        let sess = load_session(SCUNET_PATHS, "SCUNet")?;
        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
        let source = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
        let rgb = source.to_rgb8();
        let (w, h) = (rgb.width() as usize, rgb.height() as usize);
        info!("Denoising {} ({}x{})", photo_path, w, h);

        // Pad to multiples of 8 for the model.
        let pw = align_up(w, ALIGN);
        let ph = align_up(h, ALIGN);
        let mut padded = image::RgbImage::new(pw as u32, ph as u32);
        // Copy original pixels; edge-repeat for the padding border.
        for y in 0..ph {
            for x in 0..pw {
                let sx = (x).min(w - 1);
                let sy = (y).min(h - 1);
                padded.put_pixel(x as u32, y as u32, rgb.get_pixel(sx as u32, sy as u32).clone());
            }
        }

        let mut canvas = image::RgbaImage::new(pw as u32, ph as u32);

        // Tile walk: tiles start at multiples of the interior stride; the last
        // tile is pinned to the far edge so borders are always covered.
        let stride = TILE - 2 * OVERLAP;
        let tile_starts = |len: usize| -> Vec<usize> {
            if len <= TILE {
                return vec![0];
            }
            let mut v: Vec<usize> = (0..len - TILE).step_by(stride).collect();
            v.push(len - TILE);
            v
        };

        for ty in tile_starts(ph) {
            for tx in tile_starts(pw) {
                let t0 = std::time::Instant::now();
                let cw = TILE.min(pw - tx);
                let ch = TILE.min(ph - ty);
                let mut tile = image::RgbImage::new(TILE as u32, TILE as u32);
                for yy in 0..ch {
                    for xx in 0..cw {
                        tile.put_pixel(
                            xx as u32,
                            yy as u32,
                            padded.get_pixel((tx + xx) as u32, (ty + yy) as u32).clone(),
                        );
                    }
                }

                // RGB → CHW f32 [0,1] — SCUNet expects raw 0–255 normalised to [0,1].
                let (tw, th) = (tile.width() as usize, tile.height() as usize);
                let mut arr = ndarray::Array4::<f32>::zeros((1, 3, th, tw));
                for (x, y, p) in tile.enumerate_pixels() {
                    for c in 0..3 {
                        arr[[0, c, y as usize, x as usize]] = p[c] as f32 / 255.0;
                    }
                }
                let tensor = ort::value::Value::from_array(arr).map_err(|e| e.to_string())?;

                let (shape, data) = {
                    let mut guard = sess.session.lock().unwrap();
                    let outputs = guard
                        .run(ort::inputs![sess.input_name.as_str() => tensor])
                        .map_err(|e| format!("SCUNet inference failed: {}", e))?;
                    let (s, d) = outputs[sess.output_name.as_str()]
                        .try_extract_tensor::<f32>()
                        .map_err(|e| format!("SCUNet output decode failed: {}", e))?;
                    (s.to_vec(), d.to_vec())
                };

                // CHW [1,3,H,W] f32 in [0,1] → RGBA tile.
                if shape.len() != 4 || shape[1] != 3 {
                    return Err(format!("Unexpected SCUNet output shape {:?}", shape));
                }
                let oh = shape[2] as usize;
                let ow = shape[3] as usize;
                let plane = oh * ow;

                // Composite: copy unique interior of this tile (skip OVERLAP ring
                // except at image edges).
                let x0 = if tx == 0 { 0 } else { tx + OVERLAP };
                let y0 = if ty == 0 { 0 } else { ty + OVERLAP };
                let x1 = (tx + TILE - OVERLAP).min(pw);
                let y1 = (ty + TILE - OVERLAP).min(ph);
                for gy in y0..y1 {
                    for gx in x0..x1 {
                        // Map canvas-global to output-tile-local.
                        let lx = gx - tx;
                        let ly = gy - ty;
                        let i = ly * ow + lx;
                        let px = image::Rgba([
                            (data[i].clamp(0.0, 1.0) * 255.0) as u8,
                            (data[plane + i].clamp(0.0, 1.0) * 255.0) as u8,
                            (data[2 * plane + i].clamp(0.0, 1.0) * 255.0) as u8,
                            255,
                        ]);
                        canvas.put_pixel(gx as u32, gy as u32, px);
                    }
                }
                info!(
                    "[denoise] tile @({},{}) done in {:.1}s",
                    tx, ty,
                    t0.elapsed().as_secs_f32()
                );
            }
        }

        // Crop back to original dimensions (discard padding).
        let cropped = image::imageops::crop_imm(&canvas, 0, 0, w as u32, h as u32).to_image();
        let result = image::DynamicImage::ImageRgba8(cropped);
        super::enhance::save_back(&result, photo_path)?;

        info!("Denoised {} ({}x{})", photo_path, w, h);
        Ok(serde_json::json!({
            "success": true,
            "path": photo_path,
            "width": w,
            "height": h,
            "model": "scunet_color_real_psnr",
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn denoise_on_sample_image() {
        if !SCUNET_PATHS.iter().any(|p| Path::new(p).exists()) {
            eprintln!("skip: scunet model not downloaded");
            return;
        }

        let dir = std::env::temp_dir().join("prism_denoise_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sample_denoise.png");

        // 64×64 noisy checkerboard (divisible by 8).
        let mut img = image::RgbaImage::new(64, 64);
        for (x, y, p) in img.enumerate_pixels_mut() {
            let base = if (x / 8 + y / 8) % 2 == 0 { 200u8 } else { 40 };
            let noise = ((x * 7 + y * 13) % 30) as i16 - 15;
            let v = (base as i16 + noise).clamp(0, 255) as u8;
            *p = image::Rgba([v, v, v, 255]);
        }
        image::DynamicImage::ImageRgba8(img)
            .save_with_format(&path, image::ImageFormat::Png)
            .unwrap();

        eprintln!("[test] running SCUNet denoise pass (CPU, may take a minute)...");
        let res = DenoiseEngine::get()
            .denoise(path.to_str().unwrap())
            .expect("denoise failed");
        assert_eq!(res["success"], true);
        assert_eq!(res["width"], 64_u64);
        assert_eq!(res["height"], 64_u64);
        eprintln!("denoise sample OK");
    }

    #[test]
    fn denoise_non_divisible_by_8() {
        if !SCUNET_PATHS.iter().any(|p| Path::new(p).exists()) {
            eprintln!("skip: scunet model not downloaded");
            return;
        }

        let dir = std::env::temp_dir().join("prism_denoise_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sample_37x51.png");

        // 37×51 — neither dimension divisible by 8; tests padding logic.
        let mut img = image::RgbaImage::new(37, 51);
        for (x, y, p) in img.enumerate_pixels_mut() {
            let v = ((x * 3 + y * 7) % 200) as u8;
            *p = image::Rgba([v, v, v, 255]);
        }
        image::DynamicImage::ImageRgba8(img)
            .save_with_format(&path, image::ImageFormat::Png)
            .unwrap();

        let res = DenoiseEngine::get()
            .denoise(path.to_str().unwrap())
            .expect("denoise non-aligned failed");
        assert_eq!(res["width"], 37_u64);
        assert_eq!(res["height"], 51_u64);
        eprintln!("denoise non-aligned sample OK");
    }
}
