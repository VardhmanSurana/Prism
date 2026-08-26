//! AI Enhancement engines: Real-ESRGAN x4 super-resolution and GFPGAN v1.4
//! face restoration. Both are heavyweight single sessions serialized through
//! the global inference slot (4 GB VRAM budget — one model at a time).

use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use serde_json::Value;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::{info, warn};

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
                info!("[Enhance] {} session loaded from {}", tag, path);
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
                warn!("[Enhance] Failed to load {} from {}: {}", tag, path, e);
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

/// RGB image → CHW f32 tensor in [0,1].
fn to_chw(rgb: &image::RgbImage) -> ndarray::Array4<f32> {
    let (w, h) = (rgb.width() as usize, rgb.height() as usize);
    let mut arr = ndarray::Array4::<f32>::zeros((1, 3, h, w));
    for (x, y, p) in rgb.enumerate_pixels() {
        for c in 0..3 {
            arr[[0, c, y as usize, x as usize]] = p[c] as f32 / 255.0;
        }
    }
    arr
}

/// CHW [1,3,H,W] f32 in [0,1] → RGBA image.
fn from_chw(shape: &[i64], data: &[f32]) -> Result<image::RgbaImage, String> {
    if shape.len() != 4 || shape[1] != 3 || data.is_empty() {
        return Err(format!("Unexpected output shape {:?}", shape));
    }
    let (oh, ow) = (shape[2] as usize, shape[3] as usize);
    let plane = oh * ow;
    let mut out = image::RgbaImage::new(ow as u32, oh as u32);
    for y in 0..oh {
        for x in 0..ow {
            let i = y * ow + x;
            out.put_pixel(x as u32, y as u32, image::Rgba([
                (data[i].clamp(0.0, 1.0) * 255.0) as u8,
                (data[plane + i].clamp(0.0, 1.0) * 255.0) as u8,
                (data[2 * plane + i].clamp(0.0, 1.0) * 255.0) as u8,
                255,
            ]));
        }
    }
    Ok(out)
}

/// Save an image back over the original file, preserving container format.
pub fn save_back(img: &image::DynamicImage, photo_path: &str) -> Result<(), String> {
    let ext = Path::new(photo_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg")
        .to_lowercase();
    let saved = match ext.as_str() {
        "png" => img.save_with_format(photo_path, image::ImageFormat::Png),
        "webp" => img.save_with_format(photo_path, image::ImageFormat::WebP),
        _ => img.save_with_format(photo_path, image::ImageFormat::Jpeg),
    };
    saved.map_err(|e| format!("Failed to write enhanced photo: {}", e))
}

// ─────────────────────── Real-ESRGAN x4 super-resolution ──────────────────

pub struct UpscaleEngine {}

pub static UPSCALE_ENGINE: OnceLock<UpscaleEngine> = OnceLock::new();

const ESRGAN_PATHS: &[&str] = &[
    "models/upscale/real_esrgan_x4.onnx",
    "../models/upscale/real_esrgan_x4.onnx",
];

/// Tile size fed to the model; bounds peak memory on small VRAM GPUs.
const TILE: usize = 256;
/// Overlap blended away between adjacent tiles to hide seams.
const OVERLAP: usize = 32;

impl UpscaleEngine {
    pub fn get() -> &'static Self {
        UPSCALE_ENGINE.get_or_init(|| UpscaleEngine {})
    }

    pub async fn upscale_async(&self, photo_path: &str, scale: i32) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let _slot = crate::services::inference_slot::acquire("esrgan-upscale").await;
        tokio::task::spawn_blocking(move || Self::get().upscale(&photo, scale))
            .await
            .map_err(|e| format!("Upscale task panicked: {}", e))?
    }

    /// Blocking core: tiled 4× Real-ESRGAN. `scale` of 2 runs the ×4 model and
    /// downsamples by half. Writes result back to the photo file.
    pub fn upscale(&self, photo_path: &str, scale: i32) -> Result<Value, String> {
        if scale != 2 && scale != 4 {
            return Err("scale must be 2 or 4".to_string());
        }
        let sess = load_session(ESRGAN_PATHS, "Real-ESRGAN")?;
        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
        let source = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
        let rgb = source.to_rgb8();
        let (w, h) = (rgb.width() as usize, rgb.height() as usize);
        info!("Upscaling {} ({}x{}) x{}", photo_path, w, h, scale);

        // ponytail: cap input side at 4096 — bigger sources are pre-downscaled
        // (tiled time grows quadratically); raise only if someone complains.
        const MAX_SIDE: usize = 4096;
        let rgb = if w.max(h) > MAX_SIDE {
            let k = MAX_SIDE as f32 / w.max(h) as f32;
            image::DynamicImage::ImageRgb8(rgb)
                .resize((w as f32 * k) as u32, (h as f32 * k) as u32, image::imageops::FilterType::Triangle)
                .to_rgb8()
        } else {
            rgb
        };
        let (w, h) = (rgb.width() as usize, rgb.height() as usize);
        let out_w = (w * 4) as u32;
        let out_h = (h * 4) as u32;
        let mut canvas = image::RgbaImage::new(out_w, out_h);

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

        for ty in tile_starts(h) {
            for tx in tile_starts(w) {
                let t0 = std::time::Instant::now();
                // Extract (clamped) tile.
                let cw = TILE.min(w - tx);
                let ch = TILE.min(h - ty);
                let mut tile = image::RgbImage::new(TILE as u32, TILE as u32);
                for yy in 0..ch {
                    for xx in 0..cw {
                        tile.put_pixel(xx as u32, yy as u32, rgb.get_pixel((tx + xx) as u32, (ty + yy) as u32).clone());
                    }
                }

                let tensor = ort::value::Value::from_array(to_chw(&tile)).map_err(|e| e.to_string())?;
                let (shape, data) = {
                    let mut guard = sess.session.lock().unwrap();
                    let outputs = guard
                        .run(ort::inputs![sess.input_name.as_str() => tensor])
                        .map_err(|e| format!("ESRGAN inference failed: {}", e))?;
                    let (s, d) = outputs[sess.output_name.as_str()]
                        .try_extract_tensor::<f32>()
                        .map_err(|e| format!("ESRGAN output decode failed: {}", e))?;
                    (s.to_vec(), d.to_vec())
                };

                let up = from_chw(&shape, &data)?;

                // Composite this tile's unique interior: everything except the
                // OVERLAP ring (kept for neighbors), full tile at image edges.
                // Upscaled-tile coords are simply global-out minus tile origin.
                let x0 = if tx == 0 { 0 } else { tx + OVERLAP };
                let y0 = if ty == 0 { 0 } else { ty + OVERLAP };
                let x1 = (tx + TILE - OVERLAP).min(w);
                let y1 = (ty + TILE - OVERLAP).min(h);
                for gy in (y0 * 4)..(y1 * 4) {
                    for gx in (x0 * 4)..(x1 * 4) {
                        let px = up.get_pixel((gx - tx * 4) as u32, (gy - ty * 4) as u32);
                        canvas.put_pixel(gx as u32, gy as u32, px.clone());
                    }
                }
                eprintln!(
                    "[upscale] tile @({},{}) done in {:.1}s",
                    tx, ty,
                    t0.elapsed().as_secs_f32()
                );
            }
        }

        let mut result = image::DynamicImage::ImageRgba8(canvas);
        if scale == 2 {
            result = result.resize_exact(out_w / 2, out_h / 2, image::imageops::FilterType::Triangle);
        }
        save_back(&result, photo_path)?;

        info!("Upscaled {} → {}x{} (x{})", photo_path, result.width(), result.height(), scale);
        Ok(serde_json::json!({
            "success": true,
            "path": photo_path,
            "width": result.width(),
            "height": result.height(),
            "model": "real_esrgan_x4",
        }))
    }
}

// ───────────────────────── GFPGAN v1.4 face restoration ───────────────────

pub struct FaceRestoreEngine {}

pub static FACE_RESTORE_ENGINE: OnceLock<FaceRestoreEngine> = OnceLock::new();

const GFPGAN_PATHS: &[&str] = &[
    "models/face_restore/gfpgan_v14.onnx",
    "../models/face_restore/gfpgan_v14.onnx",
];

impl FaceRestoreEngine {
    pub fn get() -> &'static Self {
        FACE_RESTORE_ENGINE.get_or_init(|| FaceRestoreEngine {})
    }

    pub async fn restore_async(
        &self,
        photo_path: &str,
        face_boxes: Vec<[i64; 4]>,
        strength: f32,
    ) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let _slot = crate::services::inference_slot::acquire("gfpgan-restore").await;
        tokio::task::spawn_blocking(move || {
            Self::get().restore(&photo, &face_boxes, strength)
        })
        .await
        .map_err(|e| format!("Face restore task panicked: {}", e))?
    }

    /// Blocking core: run GFPGAN on each detected face crop and paste it back.
    /// `face_boxes` are absolute `[x, y, w, h]` pixels (SCRFD output).
    ///
    /// ponytail: whole-crop restore with feathered paste — identity-preserving
    /// aligned pipelines come later if quality demands it.
    pub fn restore(
        &self,
        photo_path: &str,
        face_boxes: &[[i64; 4]],
        strength: f32,
    ) -> Result<Value, String> {
        if face_boxes.is_empty() {
            return Err("No faces detected in photo — nothing to restore".to_string());
        }
        let sess = load_session(GFPGAN_PATHS, "GFPGAN")?;
        const IN: usize = 512;

        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
        let source = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
        let src_rgba = source.to_rgba8();
        let (iw, ih) = (src_rgba.width() as i64, src_rgba.height() as i64);
        let strength = strength.clamp(0.0, 1.0);
        let mut out = src_rgba.clone();

        for &[bx, by, bw, bh] in face_boxes.iter().filter(|b| b[2] > 4 && b[3] > 4) {
            // Expand box ~35% margin, square it around center, clamp to bounds.
            let cx = bx + bw / 2;
            let cy = by + bh / 2;
            let side = ((bw.max(bh) as f32) * 1.35) as i64;
            let half = side / 2;
            let x0 = (cx - half).max(0);
            let y0 = (cy - half).max(0);
            let x1 = (cx + half).min(iw);
            let y1 = (cy + half).min(ih);
            if x1 - x0 < 8 || y1 - y0 < 8 { continue; }

            // Crop → resize to model input.
            let crop = image::imageops::crop_imm(
                &out, x0 as u32, y0 as u32, (x1 - x0) as u32, (y1 - y0) as u32,
            ).to_image();
            let resized = image::DynamicImage::ImageRgba8(crop.clone())
                .resize_exact(IN as u32, IN as u32, image::imageops::FilterType::Triangle)
                .to_rgb8();

            let tensor = ort::value::Value::from_array(to_chw(&resized)).map_err(|e| e.to_string())?;
            let (shape, data) = {
                let mut guard = sess.session.lock().unwrap();
                let outputs = guard
                    .run(ort::inputs![sess.input_name.as_str() => tensor])
                    .map_err(|e| format!("GFPGAN inference failed: {}", e))?;
                let (s, d) = outputs[sess.output_name.as_str()]
                    .try_extract_tensor::<f32>()
                    .map_err(|e| format!("GFPGAN output decode failed: {}", e))?;
                (s.to_vec(), d.to_vec())
            };

            let restored = image::DynamicImage::ImageRgba8(from_chw(&shape, &data)?)
                .resize_exact((x1 - x0) as u32, (y1 - y0) as u32, image::imageops::FilterType::Triangle)
                .to_rgba8();

            // Paste back with a feathered border so the seam disappears.
            let cw = restored.width() as i64;
            let ch = restored.height() as i64;
            let feather = 16.0_f32;
            for yy in 0..ch {
                for xx in 0..cw {
                    let fx = (xx.min(cw - 1 - xx) as f32 / feather).clamp(0.0, 1.0);
                    let fy = (yy.min(ch - 1 - yy) as f32 / feather).clamp(0.0, 1.0);
                    let alpha = fx.min(fy) * strength;
                    if alpha <= 0.0 { continue; }
                    let rp = restored.get_pixel(xx as u32, yy as u32);
                    let op = out.get_pixel((x0 + xx) as u32, (y0 + yy) as u32);
                    let mixed: image::Rgba<u8> = image::Rgba([
                        (op[0] as f32 * (1.0 - alpha) + rp[0] as f32 * alpha).round() as u8,
                        (op[1] as f32 * (1.0 - alpha) + rp[1] as f32 * alpha).round() as u8,
                        (op[2] as f32 * (1.0 - alpha) + rp[2] as f32 * alpha).round() as u8,
                        op[3],
                    ]);
                    out.put_pixel((x0 + xx) as u32, (y0 + yy) as u32, mixed);
                }
            }
        }

        let result = image::DynamicImage::ImageRgba8(out);
        save_back(&result, photo_path)?;

        info!("Face restore applied {} faces to {}", face_boxes.len(), photo_path);
        Ok(serde_json::json!({
            "success": true,
            "path": photo_path,
            "faces_restored": face_boxes.len(),
            "strength": strength,
            "width": result.width(),
            "height": result.height(),
            "model": "gfpgan_v14",
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthetic sample-image test for both enhancement engines. Skips
    /// silently when models haven't been downloaded yet.
    #[test]
    fn upscale_and_face_restore_on_sample_images() {
        let dir = std::env::temp_dir().join("prism_enhance_test");
        std::fs::create_dir_all(&dir).unwrap();

        // ── Upscale: checkerboard sample 256×256 → expect 1024×1024 ─────
        if ESRGAN_PATHS.iter().any(|p| Path::new(p).exists()) {
            let path = dir.join("sample_upscale.png");
            let mut img = image::RgbaImage::new(256, 256);
            for (x, y, p) in img.enumerate_pixels_mut() {
                let v = if (x / 16 + y / 16) % 2 == 0 { 200u8 } else { 40 };
                *p = image::Rgba([v, v, v, 255]);
            }
            image::DynamicImage::ImageRgba8(img)
                .save_with_format(&path, image::ImageFormat::Png).unwrap();

            eprintln!("[test] running ESRGAN x4 pass (CPU, may take a minute)...");
            let res = UpscaleEngine::get()
                .upscale(path.to_str().unwrap(), 4)
                .expect("upscale failed");
            assert_eq!(res["width"], 1024_u64);
            assert_eq!(res["height"], 1024_u64);

            // Invalid scale rejected without inference.
            assert!(UpscaleEngine::get().upscale(path.to_str().unwrap(), 3).is_err());
            eprintln!("upscale sample OK");
        } else {
            eprintln!("skip: esrgan model not downloaded");
        }

        // ── Face restore: synthetic "face" box covering center quarter ──
        if GFPGAN_PATHS.iter().any(|p| Path::new(p).exists()) {
            let path = dir.join("sample_face.png");
            let mut img = image::RgbaImage::new(512, 512);
            for (_, _, p) in img.enumerate_pixels_mut() {
                *p = image::Rgba([180, 140, 120, 255]); // skin-ish flat tone
            }
            image::DynamicImage::ImageRgba8(img)
                .save_with_format(&path, image::ImageFormat::Png).unwrap();

            let res = FaceRestoreEngine::get()
                .restore(path.to_str().unwrap(), &[[192, 192, 128, 128]], 1.0)
                .expect("face restore failed");
            assert_eq!(res["faces_restored"], 1_i64);
            assert_eq!(res["width"], 512_u64);

            // Empty boxes must error clearly.
            let err = FaceRestoreEngine::get().restore(path.to_str().unwrap(), &[], 1.0);
            assert!(err.is_err());
            eprintln!("face restore sample OK");
        } else {
            eprintln!("skip: gfpgan model not downloaded");
        }
    }
}
