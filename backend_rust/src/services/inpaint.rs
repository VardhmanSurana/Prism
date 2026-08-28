use std::path::Path;
use std::sync::{Mutex, OnceLock};
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
    input_img_name: String,
    input_mask_name: String,
    output_name: String,
}

static LAMA: crate::services::model_cache::ModelCache<LamaSession> =
    crate::services::model_cache::ModelCache::new();

const LAMA_MODEL_PATHS: &[&str] = &[
    "models/inpainting/lama_fp32.onnx",
    "../models/inpainting/lama_fp32.onnx",
];

fn get_lama() -> Result<std::sync::Arc<LamaSession>, String> {
    LAMA.get_or_try_init(|| {
    let found = LAMA_MODEL_PATHS.iter().find(|p| Path::new(p).exists()).copied();
    match found {
        Some(path) => {
            let build = crate::services::onnx_helper::build_session(path, "Inpaint")
                .map_err(|e| format!("Failed to load LaMa model: {}", e));
            match build {
                Ok(session) => {
                    let inputs: Vec<String> = session.inputs().iter().map(|i| i.name().to_string()).collect();
                    let outputs: Vec<String> = session.outputs().iter().map(|o| o.name().to_string()).collect();
                    let input_img_name = inputs.get(0).cloned().unwrap_or_else(|| "image".to_string());
                    let input_mask_name = inputs.get(1).cloned().unwrap_or_else(|| "mask".to_string());
                    let output_name = outputs.get(0).cloned().unwrap_or_else(|| "output".to_string());
                    info!("[Inpaint] LaMa ONNX session loaded from {} (in: {:?}, out: {:?})", path, inputs, outputs);
                    Ok(LamaSession {
                        session: Mutex::new(session),
                        input_img_name,
                        input_mask_name,
                        output_name,
                    })
                }
                Err(e) => {
                    warn!("[Inpaint] Failed to load LaMa session from {}: {}", path, e);
                    Err(e)
                }
            }
        }
        None => Err(format!(
        "Magic Eraser unavailable: download the LaMa model first \
         (Model Manager → 'LaMa Inpainting (Object Removal)'). Expected at {}",
        LAMA_MODEL_PATHS[0]
        )),
    }
    })
}

/// Releases LaMa weights once the editor no longer needs Magic Eraser.
pub fn unload() -> bool {
    LAMA.unload()
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
        photo_path_or_data: &str,
        mask_data: &str,
        _operation: &str,
        _prompt: Option<&str>,
        _guidance_scale: f64,
        _num_steps: i32,
    ) -> Result<Value, String> {
        let is_data_uri = photo_path_or_data.starts_with("data:image/") || photo_path_or_data.contains("base64,");
        info!(
            "Magic Eraser requested for: {}",
            if is_data_uri { "data URI input" } else { photo_path_or_data }
        );

        let lama = get_lama()?;
        let mut mask_img = Self::decode_mask(mask_data)?;

        let mut source = if is_data_uri {
            let raw = photo_path_or_data
                .split_once("base64,")
                .map(|(_, b)| b)
                .unwrap_or(photo_path_or_data);
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(raw.trim())
                .map_err(|e| format!("Invalid base64 image: {}", e))?;
            image::load_from_memory(&bytes)
                .map_err(|e| format!("Failed to decode image from memory: {}", e))?
        } else {
            let bytes = std::fs::read(photo_path_or_data)
                .map_err(|e| format!("Failed to read photo {}: {}", photo_path_or_data, e))?;
            image::load_from_memory(&bytes)
                .map_err(|e| format!("Failed to decode photo {}: {}", photo_path_or_data, e))?
        };

        let (orig_w, orig_h) = (source.width(), source.height());
        if mask_img.dimensions() != (orig_w, orig_h) {
            mask_img = image::imageops::resize(
                &mask_img,
                orig_w,
                orig_h,
                image::imageops::FilterType::Triangle,
            );
        }

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
                lama.input_img_name.as_str() => img_tensor,
                lama.input_mask_name.as_str() => mask_tensor,
            ])
            .map_err(|e| format!("LaMa inference failed: {}", e))?;

        let (out_shape, out_data) = outputs[lama.output_name.as_str()]
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

        // If a file on disk was passed, save back in original format
        if !is_data_uri && Path::new(photo_path_or_data).exists() {
            let ext = Path::new(photo_path_or_data)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("jpg")
                .to_lowercase();
            let saved = match ext.as_str() {
                "png" => source.save_with_format(photo_path_or_data, image::ImageFormat::Png),
                "webp" => source.save_with_format(photo_path_or_data, image::ImageFormat::WebP),
                _ => source.save_with_format(photo_path_or_data, image::ImageFormat::Jpeg),
            };
            saved.map_err(|e| format!("Failed to write inpainted photo: {}", e))?;
        }

        // Encode result as PNG data URI for client
        let mut png_bytes = std::io::Cursor::new(Vec::new());
        source
            .write_to(&mut png_bytes, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode result PNG: {}", e))?;
        let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes.into_inner());
        let result_data_url = format!("data:image/png;base64,{}", b64);

        info!("Magic Eraser completed ({}x{})", orig_w, orig_h);
        Ok(serde_json::json!({
            "success": true,
            "result": result_data_url,
            "path": photo_path_or_data,
            "width": orig_w,
            "height": orig_h,
            "model": "lama_fp32",
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inpaint_on_sample_image() {
        if LAMA_MODEL_PATHS.iter().any(|p| Path::new(p).exists()) {
            let dir = std::env::temp_dir().join("prism_inpaint_test");
            std::fs::create_dir_all(&dir).unwrap();
            let photo_path = dir.join("test_inpaint.png");

            let img = image::RgbaImage::new(256, 256);
            let mut mask = image::GrayImage::new(256, 256);
            for y in 100..150 {
                for x in 100..150 {
                    mask.put_pixel(x, y, image::Luma([255]));
                }
            }
            img.save(&photo_path).unwrap();

            let mut mask_bytes = std::io::Cursor::new(Vec::new());
            image::DynamicImage::ImageLuma8(mask).write_to(&mut mask_bytes, image::ImageFormat::Png).unwrap();
            let mask_b64 = format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(mask_bytes.into_inner()));

            let res = MagicEraserEngine::get()
                .process_inpaint(photo_path.to_str().unwrap(), &mask_b64, "erase", None, 7.5, 20);
            assert!(res.is_ok(), "LaMa inpainting failed: {:?}", res.err());
            eprintln!("[test] LaMa inpainting OK");
        } else {
            eprintln!("skip: lama model not downloaded");
        }
    }

    #[test]
    fn unload_releases_the_cached_lama_session() {
        unload();
        if LAMA_MODEL_PATHS.iter().any(|path| Path::new(path).exists()) {
            let session = get_lama().expect("LaMa model should load");
            assert!(LAMA.is_loaded());
            drop(session);

            assert!(unload());
            assert!(!LAMA.is_loaded());
        } else {
            assert!(!unload(), "unloading an empty cache is safe");
        }
    }
}
