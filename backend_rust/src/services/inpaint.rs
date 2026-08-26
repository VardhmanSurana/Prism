use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use base64::Engine as _;
use serde_json::Value;
use tracing::{info, warn};

pub struct MagicEraserEngine {}

pub static MAGIC_ERASER_ENGINE: OnceLock<MagicEraserEngine> = OnceLock::new();

#[allow(dead_code)]
pub type InpaintEngine = MagicEraserEngine;
#[allow(dead_code)]
pub static INPAINT_ENGINE: OnceLock<MagicEraserEngine> = OnceLock::new();

/// LaMa ONNX session (Carve/LaMa-ONNX `lama_fp32.onnx`).
/// Inputs:  "image" [1,3,512,512] f32 RGB in [0,1]; "mask" [1,1,512,512] f32 in [0,1] (1 = hole)
/// Output:  "image" [1,3,512,512] f32 RGB in [0,1]
struct LamaSession {
    session: Mutex<ort::session::Session>,
}

static LAMA: OnceLock<Option<Arc<LamaSession>>> = OnceLock::new();

const LAMA_MODEL_PATHS: &[&str] = &[
    "models/inpainting/lama_fp32.onnx",
    "../models/inpainting/lama_fp32.onnx",
];

fn get_lama() -> Result<Arc<LamaSession>, String> {
    if let Some(cached) = LAMA.get() {
        return cached
            .clone()
            .ok_or_else(|| "LaMa model failed to load previously; see earlier log".to_string());
    }

    let found = LAMA_MODEL_PATHS.iter().find(|p| Path::new(p).exists()).copied();
    let loaded = match found {
        Some(path) => {
            let build = Session::builder()
                .map_err(|e| e.to_string())?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| e.to_string())?
                .commit_from_file(path)
                .map_err(|e| format!("Failed to load LaMa model: {}", e));
            match build {
                Ok(session) => {
                    info!("[Inpaint] LaMa ONNX session loaded from {}", path);
                    Some(Arc::new(LamaSession { session: Mutex::new(session) }))
                }
                Err(e) => {
                    warn!("[Inpaint] Failed to load LaMa session from {}: {}", path, e);
                    None
                }
            }
        }
        None => None,
    };
    let _ = LAMA.set(loaded.clone());
    loaded.ok_or_else(|| format!(
        "Magic Eraser unavailable: download the LaMa model first \
         (Model Manager → 'LaMa Inpainting (Object Removal)'). Expected at {}",
        LAMA_MODEL_PATHS[0]
    ))
}

impl MagicEraserEngine {
    pub fn get() -> &'static Self {
        MAGIC_ERASER_ENGINE.get_or_init(|| MagicEraserEngine {})
    }

    /// Decode a base64 PNG mask into a grayscale image.
    fn decode_mask(mask_b64: &str) -> Result<image::GrayImage, String> {
        // Tolerate data-URI prefixes
        let raw = mask_b64
            .split_once("base64,")
            .map(|(_, b)| b)
            .unwrap_or(mask_b64);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(raw.trim())
            .map_err(|e| format!("Invalid base64 mask: {}", e))?;
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Invalid mask image: {}", e))?;
        Ok(img.to_luma8())
    }

    /// LaMa / Neural Eraser object removal — async entry point.
    ///
    /// Serializes heavy-model inference through the global inference slot and
    /// runs the blocking pipeline off the async runtime.
    pub async fn process_inpaint_async(
        &self,
        photo_path: &str,
        mask_data: &str,
        operation: &str,
        prompt: Option<&str>,
        guidance_scale: f64,
        num_steps: i32,
    ) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let mask = mask_data.to_string();
        let op = operation.to_string();
        let prompt = prompt.map(|s| s.to_string());

        let _slot = crate::services::inference_slot::acquire("lama-inpaint").await;

        tokio::task::spawn_blocking(move || {
            Self::get().process_inpaint(&photo, &mask, &op, prompt.as_deref(), guidance_scale, num_steps)
        })
        .await
        .map_err(|e| format!("Inpaint task panicked: {}", e))?
    }

    /// Blocking core of the LaMa pipeline. Prefer `process_inpaint_async`.
    pub fn process_inpaint(
        &self,
        photo_path: &str,
        mask_data: &str,
        _operation: &str,
        _prompt: Option<&str>,
        _guidance_scale: f64,
        _num_steps: i32,
    ) -> Result<Value, String> {
        info!("Magic Eraser requested for: {}", photo_path);

        let lama = get_lama()?;
        let mask_img = Self::decode_mask(mask_data)?;

        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
        let mut source = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
        let (orig_w, orig_h) = (source.width(), source.height());

        // ── Prepare model inputs at 512x512 ──────────────────────────────
        const IN: usize = 512;
        let resized_src =
            source.resize_exact(IN as u32, IN as u32, image::imageops::FilterType::Triangle);
        let rgb = resized_src.to_rgb8();
        let mask_small = image::imageops::resize(
            &mask_img,
            IN as u32,
            IN as u32,
            image::imageops::FilterType::Triangle,
        );

        let mut img_arr = ndarray::Array4::<f32>::zeros((1, 3, IN, IN));
        for (px, py, pixel) in rgb.enumerate_pixels() {
            img_arr[[0, 0, py as usize, px as usize]] = pixel[0] as f32 / 255.0;
            img_arr[[0, 1, py as usize, px as usize]] = pixel[1] as f32 / 255.0;
            img_arr[[0, 2, py as usize, px as usize]] = pixel[2] as f32 / 255.0;
        }
        let mut mask_arr = ndarray::Array4::<f32>::zeros((1, 1, IN, IN));
        for (px, py, p) in mask_small.enumerate_pixels() {
            mask_arr[[0, 0, py as usize, px as usize]] = if p[0] > 127 { 1.0 } else { 0.0 };
        }

        let img_tensor = ort::value::Value::from_array(img_arr).map_err(|e| e.to_string())?;
        let mask_tensor = ort::value::Value::from_array(mask_arr).map_err(|e| e.to_string())?;

        let mut session_guard = lama.session.lock().unwrap();
        let outputs = session_guard
            .run(ort::inputs![
                "image" => img_tensor,
                "mask" => mask_tensor,
            ])
            .map_err(|e| format!("LaMa inference failed: {}", e))?;

        let (out_shape, out_data) = outputs["image"]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("LaMa output decode failed: {}", e))?;
        if out_shape.len() != 4 || out_shape[1] != 3 {
            return Err(format!("Unexpected LaMa output shape {:?}", out_shape));
        }
        let (och, oh, ow) = (
            out_shape[1] as usize,
            out_shape[2] as usize,
            out_shape[3] as usize,
        );
        let plane = oh * ow;

        // Model output → RGBA image at model resolution
        let mut out_rgba = image::RgbaImage::new(ow as u32, oh as u32);
        for y in 0..oh {
            for x in 0..ow {
                let idx = y * ow + x;
                // Layout is [1, 3, H, W]: channel-major planes.
                let r = out_data[idx].clamp(0.0, 1.0);
                let g = out_data[plane + idx].clamp(0.0, 1.0);
                let b = out_data[2 * plane + idx].clamp(0.0, 1.0);
                let _ = och; // channels asserted == 3 above
                out_rgba.put_pixel(
                    x as u32,
                    y as u32,
                    image::Rgba([
                        (r * 255.0) as u8,
                        (g * 255.0) as u8,
                        (b * 255.0) as u8,
                        255,
                    ]),
                );
            }
        }

        // Scale the filled region back to original resolution
        let upscaled = image::DynamicImage::ImageRgba8(out_rgba)
            .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle)
            .to_rgba8();

        // Blend: only replace pixels under the (original-resolution) mask,
        // with a feather band for a seamless seam.
        let src_rgba = source.to_rgba8();
        let mut blended = image::RgbaImage::new(orig_w, orig_h);
        for (x, y, sp) in src_rgba.enumerate_pixels() {
            let mut px = *sp;
            if x < orig_w && y < orig_h {
                let m = mask_img.get_pixel(x.min(mask_img.width() - 1), y.min(mask_img.height() - 1))[0];
                let strength: f32 = if m >= 200 {
                    1.0
                } else if m > 55 {
                    (m - 55) as f32 / 145.0
                } else {
                    0.0
                };
                if strength > 0.0 {
                    let op = upscaled.get_pixel(x, y);
                    for c in 0..3 {
                        px[c] = (px[c] as f32 * (1.0 - strength) + op[c] as f32 * strength)
                            .round()
                            .clamp(0.0, 255.0) as u8;
                    }
                }
            }
            blended.put_pixel(x, y, px);
        }
        source = image::DynamicImage::ImageRgba8(blended);

        // Save back in the original format
        let ext = Path::new(photo_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg")
            .to_lowercase();
        let saved = match ext.as_str() {
            "png" => source.save_with_format(photo_path, image::ImageFormat::Png),
            "webp" => source.save_with_format(photo_path, image::ImageFormat::WebP),
            _ => source.save_with_format(photo_path, image::ImageFormat::Jpeg),
        };
        saved.map_err(|e| format!("Failed to write inpainted photo: {}", e))?;

        info!("Magic Eraser completed for {} ({}x{})", photo_path, orig_w, orig_h);
        Ok(serde_json::json!({
            "success": true,
            "path": photo_path,
            "width": orig_w,
            "height": orig_h,
            "model": "lama_fp32",
        }))
    }
}


