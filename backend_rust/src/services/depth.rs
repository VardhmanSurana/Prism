//! Depth Anything V2 Small — monocular depth estimation.
//!
//! Produces a normalized depth map (near = bright) used by the editor for
//! background blur / bokeh and depth-map export. Single heavyweight session,
//! serialized through the global inference slot like LaMa / SAM.

use base64::Engine as _;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use serde_json::Value;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::{info, warn};

pub struct DepthEngine {}

pub static DEPTH_ENGINE: OnceLock<DepthEngine> = OnceLock::new();

/// Depth Anything V2 default input resolution.
const IN: usize = 518;

/// ImageNet normalization constants used by Depth Anything preprocessing.
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

struct DepthSession {
    session: Mutex<ort::session::Session>,
    input_name: String,
    output_name: String,
}

static DEPTH: OnceLock<Option<Arc<DepthSession>>> = OnceLock::new();

const DEPTH_MODEL_PATHS: &[&str] = &[
    "models/depth/depth_anything_v2_small.onnx",
    "../models/depth/depth_anything_v2_small.onnx",
];

fn get_depth() -> Result<Arc<DepthSession>, String> {
    if let Some(cached) = DEPTH.get() {
        return cached
            .clone()
            .ok_or_else(|| "Depth model failed to load previously; see earlier log".to_string());
    }

    let found = DEPTH_MODEL_PATHS.iter().find(|p| Path::new(p).exists()).copied();
    let loaded = match found {
        Some(path) => {
            let build = Session::builder()
                .map_err(|e| e.to_string())?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| e.to_string())?
                .commit_from_file(path)
                .map_err(|e| format!("Failed to load Depth Anything model: {}", e));
            match build {
                Ok(session) => {
                    info!("[Depth] Depth Anything V2 small session loaded from {}", path);
                    // Single-input / single-output model — capture tensor names
                    // from the session so we don't depend on exporter naming.
                    let input_name = session.inputs().first().map(|i| i.name().to_string())
                        .ok_or("depth model has no inputs")?;
                    let output_name = session.outputs().first().map(|o| o.name().to_string())
                        .ok_or("depth model has no outputs")?;
                    Some(Arc::new(DepthSession {
                        session: Mutex::new(session),
                        input_name,
                        output_name,
                    }))
                }
                Err(e) => {
                    warn!("[Depth] Failed to load session from {}: {}", path, e);
                    None
                }
            }
        }
        None => None,
    };
    let _ = DEPTH.set(loaded.clone());
    loaded.ok_or_else(|| format!(
        "Depth effects unavailable: download the model first \
         (Model Manager → 'Depth Anything V2 Small'). Expected at {}",
        DEPTH_MODEL_PATHS[0]
    ))
}

/// Run the session on an [1,3,IN,IN] tensor, returning flattened depth output.
fn run_session(sess: &DepthSession, img_arr: ndarray::Array4<f32>) -> Result<(Vec<i64>, Vec<f32>), String> {
    let tensor = ort::value::Value::from_array(img_arr).map_err(|e| e.to_string())?;
    let mut guard = sess.session.lock().unwrap();
    let outputs = guard
        .run(ort::inputs![sess.input_name.as_str() => tensor])
        .map_err(|e| format!("Depth inference failed: {}", e))?;
    let (shape, data) = outputs[sess.output_name.as_str()]
        .try_extract_tensor::<f32>()
        .map_err(|e| format!("Depth output decode failed: {}", e))?;
    Ok((shape.to_vec(), data.to_vec()))
}

impl DepthEngine {
    pub fn get() -> &'static Self {
        DEPTH_ENGINE.get_or_init(|| DepthEngine {})
    }

    /// Async entry point — serializes through the global inference slot and
    /// runs the blocking pipeline off the async runtime.
    ///
    /// mode: "map" → returns base64 PNG depth map (near = white).
    /// mode: "bokeh" → applies depth-weighted background blur to the photo
    /// file and writes it back (same contract as Magic Eraser).
    pub async fn process_async(
        &self,
        photo_path: &str,
        mode: &str,
        strength_px: f32,
        focus: f32,
    ) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let mode = mode.to_string();
        let _slot = crate::services::inference_slot::acquire("depth").await;
        tokio::task::spawn_blocking(move || {
            Self::get().process(&photo, &mode, strength_px, focus)
        })
        .await
        .map_err(|e| format!("Depth task panicked: {}", e))?
    }

    /// Blocking core. Prefer `process_async`.
    pub fn process(
        &self,
        photo_path: &str,
        mode: &str,
        strength_px: f32,
        focus: f32,
    ) -> Result<Value, String> {
        let sess = get_depth()?;
        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
        let source = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
        let (orig_w, orig_h) = (source.width(), source.height());

        // ── Preprocess: resize to 518×518, [0,1], ImageNet-normalize ─────
        let resized = source.resize_exact(
            IN as u32,
            IN as u32,
            image::imageops::FilterType::Triangle,
        );
        let rgb = resized.to_rgb8();
        let mut arr = ndarray::Array4::<f32>::zeros((1, 3, IN, IN));
        for (x, y, p) in rgb.enumerate_pixels() {
            for c in 0..3 {
                arr[[0, c, y as usize, x as usize]] =
                    (p[c] as f32 / 255.0 - MEAN[c]) / STD[c];
            }
        }

        let (shape, data) = run_session(&sess, arr)?;
        if shape.len() < 2 || data.is_empty() {
            return Err(format!("Unexpected depth output shape {:?}", shape));
        }
        let (oh, ow) = (shape[shape.len() - 2] as usize, shape[shape.len() - 1] as usize);

        // Normalize to 0..1 (min-max). Output is inverse-relative depth:
        // higher value = closer to camera. Keep that orientation (near = bright).
        let mut min = f32::MAX;
        let mut max = f32::MIN;
        for v in &data {
            min = min.min(*v);
            max = max.max(*v);
        }
        let span = (max - min).max(1e-6);
        let near01 = |i: usize| (data[i] - min) / span;

        let mut depth_img = image::GrayImage::new(ow as u32, oh as u32);
        for y in 0..oh {
            for x in 0..ow {
                let n = near01(y * ow + x);
                depth_img.put_pixel(x as u32, y as u32, image::Luma([(n * 255.0) as u8]));
            }
        }

        if mode == "bokeh" {
            // ── Bokeh: blur whole frame, keep near-focus region sharp ────
            let sigma = strength_px.max(0.5);
            let blurred = image::DynamicImage::ImageRgba8(image::imageops::blur(&source.to_rgba8(), sigma));

            // Focus band: fully sharp above focus+half_band, fully blurred below
            // focus-half_band, linear ramp between.
            let band = 0.12_f32;
            let fc = focus.clamp(0.05, 0.95);
            let sharpness = |n: f32| ((n - (fc - band)) / (2.0 * band)).clamp(0.0, 1.0);

            let depth_up = image::DynamicImage::ImageLuma8(depth_img)
                .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle)
                .to_luma8();
            let src_rgba = source.to_rgba8();
            let blur_rgba = blurred.to_rgba8();
            let mut out = image::RgbaImage::new(orig_w, orig_h);
            for (x, y, sp) in src_rgba.enumerate_pixels() {
                let n = depth_up.get_pixel(x.min(orig_w - 1), y.min(orig_h - 1))[0] as f32 / 255.0;
                let s = sharpness(n);
                let bp = blur_rgba.get_pixel(x, y);
                let mixed: image::Rgba<u8> = image::Rgba([
                    (sp[0] as f32 * s + bp[0] as f32 * (1.0 - s)).round() as u8,
                    (sp[1] as f32 * s + bp[1] as f32 * (1.0 - s)).round() as u8,
                    (sp[2] as f32 * s + bp[2] as f32 * (1.0 - s)).round() as u8,
                    sp[3],
                ]);
                out.put_pixel(x, y, mixed);
            }

            let result = image::DynamicImage::ImageRgba8(out);
            let ext = Path::new(photo_path)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("jpg")
                .to_lowercase();
            let saved = match ext.as_str() {
                "png" => result.save_with_format(photo_path, image::ImageFormat::Png),
                "webp" => result.save_with_format(photo_path, image::ImageFormat::WebP),
                _ => result.save_with_format(photo_path, image::ImageFormat::Jpeg),
            };
            saved.map_err(|e| format!("Failed to write bokeh photo: {}", e))?;

            info!("Bokeh applied to {} ({}x{}, σ={}, focus={})", photo_path, orig_w, orig_h, sigma, fc);
            return Ok(serde_json::json!({
                "success": true,
                "path": photo_path,
                "mode": "bokeh",
                "strength_px": sigma,
                "focus": fc,
                "width": orig_w,
                "height": orig_h,
                "model": "depth_anything_v2_small",
            }));
        }

        // ── Map mode: return depth preview as base64 data URI ────────────
        let mut png = Vec::new();
        image::DynamicImage::ImageLuma8(depth_img)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode depth map: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png);

        info!("Depth map computed for {} ({}x{})", photo_path, orig_w, orig_h);
        Ok(serde_json::json!({
            "success": true,
            "mode": "map",
            "depth_map_data": format!("data:image/png;base64,{}", b64),
            "width": orig_w,
            "height": orig_h,
            "model": "depth_anything_v2_small",
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Synthetic sample-image test: builds a radial-gradient sample, runs the
    /// full depth pipeline, verifies map + bokeh outputs. Skips silently when
    /// the model file hasn't been downloaded yet.
    #[test]
    fn depth_map_and_bokeh_on_sample_image() {
        if !DEPTH_MODEL_PATHS.iter().any(|p| Path::new(p).exists()) {
            eprintln!("skip: depth model not downloaded");
            return;
        }
        let dir = std::env::temp_dir().join("prism_depth_test");
        std::fs::create_dir_all(&dir).unwrap();
        let src_path = dir.join("sample_depth.png");

        // Radial gradient: bright center (reads as "nearer subject").
        let (w, h) = (320usize, 240usize);
        let mut img = image::RgbaImage::new(w as u32, h as u32);
        for (x, y, p) in img.enumerate_pixels_mut() {
            let dx = (x as f32 - w as f32 / 2.0) / (w as f32 / 2.0);
            let dy = (y as f32 - h as f32 / 2.0) / (h as f32 / 2.0);
            let v = (1.0 - (dx * dx + dy * dy).sqrt()).clamp(0.0, 1.0) * 255.0;
            *p = image::Rgba([v as u8, v as u8, v as u8, 255]);
        }
        image::DynamicImage::ImageRgba8(img)
            .save_with_format(&src_path, image::ImageFormat::Png)
            .unwrap();

        let eng = DepthEngine::get();

        // Map mode → data URI back.
        let map = eng.process(src_path.to_str().unwrap(), "map", 0.0, 0.5).unwrap();
        assert_eq!(map["mode"], "map");
        let uri = map["depth_map_data"].as_str().unwrap();
        assert!(uri.starts_with("data:image/png;base64,"));

        // Bokeh mode → file rewritten, success reported.
        let bokeh = eng.process(src_path.to_str().unwrap(), "bokeh", 4.0, 0.5).unwrap();
        assert_eq!(bokeh["success"], serde_json::Value::Bool(true));
        assert_eq!(bokeh["width"], w as u64);
        assert_eq!(bokeh["height"], h as u64);
        eprintln!("depth sample OK: {} bytes map", uri.len());
    }
}
