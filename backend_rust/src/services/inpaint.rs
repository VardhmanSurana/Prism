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
/// Output:  "output" [1,3,512,512] f32 RGB in [0,255] (or [0,1] depending on export)
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
    /// Supports grayscale masks, white-on-transparent RGBA masks, and alpha masks.
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
        let rgba = img.to_rgba8();
        let (w, h) = rgba.dimensions();
        let mut gray = image::GrayImage::new(w, h);
        for (x, y, p) in rgba.enumerate_pixels() {
            let luma = (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32).round() as u8;
            // Active if RGB has brightness or alpha indicates a mask stroke
            let val = if p[3] > 25 && (luma > 30 || p[3] > 128) {
                luma.max(p[3])
            } else {
                luma
            };
            gray.put_pixel(x, y, image::Luma([val]));
        }
        Ok(gray)
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

        // ── Analyze mask bounding box for localized high-res inpainting ──
        let mut min_x = orig_w;
        let mut max_x = 0;
        let mut min_y = orig_h;
        let mut max_y = 0;
        let mut mask_count = 0usize;

        for (x, y, p) in mask_img.enumerate_pixels() {
            if p[0] > 25 {
                mask_count += 1;
                min_x = min_x.min(x);
                max_x = max_x.max(x);
                min_y = min_y.min(y);
                max_y = max_y.max(y);
            }
        }

        // If no masked pixels, return original image immediately
        if mask_count == 0 {
            info!("Magic Eraser called with empty mask, returning untouched image");
            let mut png_bytes = std::io::Cursor::new(Vec::new());
            source
                .write_to(&mut png_bytes, image::ImageFormat::Png)
                .map_err(|e| format!("Failed to encode result PNG: {}", e))?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes.into_inner());
            return Ok(serde_json::json!({
                "success": true,
                "result": format!("data:image/png;base64,{}", b64),
                "path": photo_path_or_data,
                "width": orig_w,
                "height": orig_h,
                "model": "lama_fp32",
            }));
        }

        let mask_w = max_x.saturating_sub(min_x) + 1;
        let mask_h = max_y.saturating_sub(min_y) + 1;
        let total_pixels = (orig_w as u64) * (orig_h as u64);
        let mask_box_pixels = (mask_w as u64) * (mask_h as u64);

        // Localized high-res crop: if the image is large (> 512 in either dimension)
        // and mask covers < 80% of image, crop around the mask with context margin.
        let use_crop = (orig_w > 512 || orig_h > 512)
            && ((mask_box_pixels as f64 / total_pixels as f64) < 0.80);

        let (crop_x, crop_y, crop_w, crop_h, crop_src, crop_mask) = if use_crop {
            let margin = ((mask_w.max(mask_h) as f32) * 0.40).max(64.0) as u32;
            let side = (mask_w.max(mask_h) + margin * 2).min(orig_w).min(orig_h);

            let center_x = min_x + mask_w / 2;
            let center_y = min_y + mask_h / 2;
            let cx = center_x.saturating_sub(side / 2).min(orig_w.saturating_sub(side));
            let cy = center_y.saturating_sub(side / 2).min(orig_h.saturating_sub(side));

            let c_src = source.crop_imm(cx, cy, side, side);
            let c_mask = image::imageops::crop_imm(&mask_img, cx, cy, side, side).to_image();
            (cx, cy, side, side, c_src, c_mask)
        } else {
            (0, 0, orig_w, orig_h, source.clone(), mask_img.clone())
        };

        // ── Prepare model inputs at 512x512 ──────────────────────────────
        const IN: usize = 512;
        let resized_src =
            crop_src.resize_exact(IN as u32, IN as u32, image::imageops::FilterType::Triangle);
        let rgb = resized_src.to_rgb8();
        let mask_small = image::imageops::resize(
            &crop_mask,
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
            mask_arr[[0, 0, py as usize, px as usize]] = if p[0] > 25 { 1.0 } else { 0.0 };
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

        // Model output → RGBA image at model resolution.
        // Carve/LaMa ONNX outputs in [0, 255] range; handle both [0, 255] and [0, 1] scales.
        let is_255_scale = out_data.iter().any(|&v| v > 1.5);
        let mut out_rgba = image::RgbaImage::new(ow as u32, oh as u32);
        for y in 0..oh {
            for x in 0..ow {
                let idx = y * ow + x;
                let (r, g, b) = if is_255_scale {
                    (
                        out_data[idx].clamp(0.0, 255.0).round() as u8,
                        out_data[plane + idx].clamp(0.0, 255.0).round() as u8,
                        out_data[2 * plane + idx].clamp(0.0, 255.0).round() as u8,
                    )
                } else {
                    (
                        (out_data[idx] * 255.0).clamp(0.0, 255.0).round() as u8,
                        (out_data[plane + idx] * 255.0).clamp(0.0, 255.0).round() as u8,
                        (out_data[2 * plane + idx] * 255.0).clamp(0.0, 255.0).round() as u8,
                    )
                };
                let _ = och;
                out_rgba.put_pixel(x as u32, y as u32, image::Rgba([r, g, b, 255]));
            }
        }

        // Scale the filled region back to crop's original resolution
        let upscaled = image::DynamicImage::ImageRgba8(out_rgba)
            .resize_exact(crop_w, crop_h, image::imageops::FilterType::Triangle)
            .to_rgba8();

        // Blend: inject into the full-resolution source image with Hermite smoothstep feathering
        let mut src_rgba = source.to_rgba8();
        for ly in 0..crop_h {
            for lx in 0..crop_w {
                let gx = crop_x + lx;
                let gy = crop_y + ly;
                if gx < orig_w && gy < orig_h {
                    let m = crop_mask.get_pixel(lx, ly)[0];
                    let strength: f32 = if m >= 200 {
                        1.0
                    } else if m > 25 {
                        let t = (m - 25) as f32 / 175.0;
                        t * t * (3.0 - 2.0 * t) // Hermite smoothstep
                    } else {
                        0.0
                    };
                    if strength > 0.0 {
                        let orig_p = src_rgba.get_pixel(gx, gy);
                        let fill_p = upscaled.get_pixel(lx, ly);
                        let blended_p = image::Rgba([
                            (orig_p[0] as f32 * (1.0 - strength) + fill_p[0] as f32 * strength)
                                .round()
                                .clamp(0.0, 255.0) as u8,
                            (orig_p[1] as f32 * (1.0 - strength) + fill_p[1] as f32 * strength)
                                .round()
                                .clamp(0.0, 255.0) as u8,
                            (orig_p[2] as f32 * (1.0 - strength) + fill_p[2] as f32 * strength)
                                .round()
                                .clamp(0.0, 255.0) as u8,
                            orig_p[3],
                        ]);
                        src_rgba.put_pixel(gx, gy, blended_p);
                    }
                }
            }
        }
        source = image::DynamicImage::ImageRgba8(src_rgba);

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

            let mut img = image::RgbaImage::new(256, 256);
            for (x, y, p) in img.enumerate_pixels_mut() {
                *p = image::Rgba([(x % 150) as u8, (y % 150) as u8, 160, 255]);
            }
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

            let result_img = image::open(&photo_path).expect("Inpainted image should exist").to_rgba8();
            let center_px = *result_img.get_pixel(125, 125);
            assert!(
                !(center_px[0] > 250 && center_px[1] > 250 && center_px[2] > 250),
                "Inpainted area must not be pure white: {:?}", center_px
            );
            eprintln!("[test] LaMa inpainting OK, center pixel: {:?}", center_px);
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
