//! MobileSAM interactive segmentation.
//!
//! Two-stage design (the reason SAM feels instant in editors):
//!   1. Image encoder — expensive, run ONCE per photo; embeddings cached here
//!      keyed by (path, mtime).
//!   2. Mask decoder — tiny (~4 MB), re-run per prompt change (clicks).
//!
//! Supports N-point prompting: positive points include regions, negative
//! points exclude them (left/right click in the editor). Points are given in
//! ORIGINAL image pixel space and scaled into the encoder's square space.

use image::DynamicImage;
use ndarray::Array3;
use ort::session::Session;
use ort::value::Value;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::info;

const ENC_SIZE: f32 = 1024.0;

pub struct SamEngine {
    encoder: Mutex<Session>,
    encoder_input: String,
    encoder_output: String,
    decoder: Mutex<Session>,
    /// Names of all decoder inputs — optional ones are fed conditionally.
    decoder_inputs: Vec<String>,
    cache: Mutex<Option<EmbeddingCache>>,
}

struct EmbeddingCache {
    key: String,
    embeddings: Vec<f32>,
    shape: Vec<i64>,
    orig_w: u32,
    orig_h: u32,
}

static SAM: OnceLock<Result<Arc<SamEngine>, String>> = OnceLock::new();

pub fn get_sam() -> Result<Arc<SamEngine>, String> {
    if let Some(res) = SAM.get() {
        return res.clone();
    }
    let built = build_sam();
    let _ = SAM.set(built.clone());
    built
}

fn build_sam() -> Result<Arc<SamEngine>, String> {
    let encoder_path = "models/SAM/image_encoder.onnx";
    let decoder_path = "models/SAM/mask_decoder.onnx";
    for p in [encoder_path, decoder_path] {
        if !Path::new(p).exists() {
            return Err(format!(
                "Segment Anything unavailable: download the model first \
                 (Model Manager → 'Segment Anything (MobileSAM)'). Expected at {}",
                p
            ));
        }
    }

    let encoder = crate::services::onnx_helper::build_session(encoder_path, "SAM-Encoder")
        .map_err(|e| format!("Failed to load SAM encoder: {}", e))?;
    let encoder_input = encoder
        .inputs()
        .first()
        .map(|i| i.name().to_string())
        .ok_or("SAM encoder has no inputs")?;
    let encoder_output = encoder
        .outputs()
        .first()
        .map(|o| o.name().to_string())
        .ok_or("SAM encoder has no outputs")?;

    let decoder = crate::services::onnx_helper::build_session(decoder_path, "SAM-Decoder")
        .map_err(|e| format!("Failed to load SAM decoder: {}", e))?;
    let decoder_inputs: Vec<String> =
        decoder.inputs().iter().map(|i| i.name().to_string()).collect();

    info!("[SAM] ready (decoder inputs: {:?})", decoder_inputs);

    Ok(Arc::new(SamEngine {
        encoder: Mutex::new(encoder),
        encoder_input,
        encoder_output,
        decoder: Mutex::new(decoder),
        decoder_inputs,
        cache: Mutex::new(None),
    }))
}

/// Cache key including mtime so edits invalidate stale embeddings.
fn file_key(path: &str) -> String {
    let mtime = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}:{}", path, mtime)
}

impl SamEngine {
    /// Path-based entry point with embedding caching — use for interactive
    /// editing where the user clicks the same photo repeatedly.
    pub fn segment_points(
        &self,
        photo_path: &str,
        points: &[(f32, f32)],
        positive: &[bool],
    ) -> Result<Vec<u8>, String> {
        validate_prompt(points, positive)?;

        // ── Stage 1: embeddings (cached per photo revision) ──────────────
        let key = file_key(photo_path);
        let cached = {
            let guard = self.cache.lock().unwrap();
            guard
                .as_ref()
                .filter(|c| c.key == key)
                .map(|c| (c.embeddings.clone(), c.shape.clone(), c.orig_w, c.orig_h))
        };
        let (emb_data, emb_shape, orig_w, orig_h) = match cached {
            Some(hit) => hit,
            None => {
                let bytes = std::fs::read(photo_path)
                    .map_err(|e| format!("Failed to read photo {}: {}", photo_path, e))?;
                let img = image::load_from_memory(&bytes)
                    .map_err(|e| format!("Failed to decode photo {}: {}", photo_path, e))?;
                let (emb_data, emb_shape) = self.encode(&img)?;
                *self.cache.lock().unwrap() = Some(EmbeddingCache {
                    key,
                    embeddings: emb_data.clone(),
                    shape: emb_shape.clone(),
                    orig_w: img.width(),
                    orig_h: img.height(),
                });
                (emb_data, emb_shape, img.width(), img.height())
            }
        };

        self.decode(emb_data, emb_shape, orig_w, orig_h, points, positive)
    }

    /// Image-based entry point without caching — one-shot pipelines
    /// (auto-interrogation) that already hold the decoded image.
    pub fn segment_points_image(
        &self,
        image: &DynamicImage,
        points: &[(f32, f32)],
        positive: &[bool],
    ) -> Result<Vec<u8>, String> {
        validate_prompt(points, positive)?;
        let (emb_data, emb_shape) = self.encode(image)?;
        self.decode(emb_data, emb_shape, image.width(), image.height(), points, positive)
    }

    fn decode(
        &self,
        emb_data: Vec<f32>,
        mut emb_shape: Vec<i64>,
        orig_w: u32,
        orig_h: u32,
        points: &[(f32, f32)],
        positive: &[bool],
    ) -> Result<Vec<u8>, String> {
        let n = points.len();
        let sx = ENC_SIZE / orig_w.max(1) as f32;
        let sy = ENC_SIZE / orig_h.max(1) as f32;
        let mut coords_flat = Vec::with_capacity(n * 2);
        for &(x, y) in points {
            coords_flat.push(x * sx);
            coords_flat.push(y * sy);
        }
        let labels_vec: Vec<f32> = positive.iter().map(|&p| if p { 1.0 } else { 0.0 }).collect();

        // Decoder wants batched embeddings; this encoder may emit them
        // unbatched ([256, 64, 64]) — prepend the batch dim when needed.
        if emb_shape.len() == 3 {
            emb_shape.insert(0, 1);
        }
        let emb_arr = ndarray::Array::from_shape_vec(
            emb_shape.iter().map(|&x| x as usize).collect::<Vec<usize>>(),
            emb_data,
        )
        .map_err(|e| e.to_string())?;

        let emb_tensor = Value::from_array(emb_arr).map_err(|e| e.to_string())?;
        let coords_tensor = Value::from_array(
            ndarray::Array3::<f32>::from_shape_vec((1, n, 2), coords_flat)
                .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        let labels_tensor = Value::from_array(
            ndarray::Array2::<f32>::from_shape_vec((1, n), labels_vec)
                .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;

        // Run + threshold into an L-mode image while the session lock is held.
        // The standard SAM decoder export takes the three prompt inputs plus
        // mask refinement inputs (mask_input, has_mask_input, orig_im_size).
        let (_, _, low) = {
            let mut guard = self.decoder.lock().unwrap();
            let outputs = if self.decoder_inputs.iter().any(|nm| nm == "orig_im_size") {
                guard
                    .run(ort::inputs![
                        "image_embeddings" => emb_tensor,
                        "point_coords" => coords_tensor,
                        "point_labels" => labels_tensor,
                        "mask_input" => Value::from_array(ndarray::Array4::<f32>::zeros((1, 1, 256, 256))).map_err(|e| e.to_string())?,
                        "has_mask_input" => Value::from_array(ndarray::Array1::<f32>::from_vec(vec![0.0])).map_err(|e| e.to_string())?,
                        "orig_im_size" => Value::from_array(ndarray::Array1::<f32>::from_vec(vec![orig_h as f32, orig_w as f32])).map_err(|e| e.to_string())?,
                    ])
                    .map_err(|e| format!("SAM decode failed: {}", e))?
            } else {
                guard
                    .run(ort::inputs![
                        "image_embeddings" => emb_tensor,
                        "point_coords" => coords_tensor,
                        "point_labels" => labels_tensor,
                    ])
                    .map_err(|e| format!("SAM decode failed: {}", e))?
            };
            let (mask_shape, mask_data) = outputs["masks"]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("SAM output decode failed: {}", e))?;

            // Decoder emits a low-res mask ([1,1,H,W]).
            let mh = mask_shape[mask_shape.len() - 2] as u32;
            let mw = mask_shape[mask_shape.len() - 1] as u32;
            let mw_us = mw as usize;
            let mut low = image::GrayImage::new(mw, mh);
            for y in 0..mh as usize {
                for x in 0..mw as usize {
                    let v = mask_data[y * mw_us + x];
                    low.put_pixel(x as u32, y as u32, image::Luma([if v > 0.0 { 255 } else { 0 }]));
                }
            }
            (mw, mh, low)
        };

        let full = image::DynamicImage::ImageLuma8(low)
            .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle);
        let mut buf = std::io::Cursor::new(Vec::new());
        full.write_to(&mut buf, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode SAM mask: {}", e))?;
        Ok(buf.into_inner())
    }

    fn encode(&self, image: &DynamicImage) -> Result<(Vec<f32>, Vec<i64>), String> {
        let resized = image.resize_exact(
            ENC_SIZE as u32,
            ENC_SIZE as u32,
            image::imageops::FilterType::Triangle,
        );
        let rgb = resized.to_rgb8();

        // This export takes UNBATCHED HWC input ([H, W, 3]) with raw 0–255
        // RGB — normalization, channel permute and padding are all baked into
        // the graph (Acly/MobileSAM export_image_encoder.py --use-preprocess).
        let mut input_array = Array3::<f32>::zeros((
            ENC_SIZE as usize,
            ENC_SIZE as usize,
            3,
        ));
        for (px, py, pixel) in rgb.enumerate_pixels() {
            input_array[[py as usize, px as usize, 0]] = pixel[0] as f32;
            input_array[[py as usize, px as usize, 1]] = pixel[1] as f32;
            input_array[[py as usize, px as usize, 2]] = pixel[2] as f32;
        }

        let tensor = Value::from_array(input_array).map_err(|e| e.to_string())?;
        let enc_name = self.encoder_input.clone();
        let out_name = self.encoder_output.clone();
        let mut guard = self.encoder.lock().unwrap();
        let outputs = guard
            .run(ort::inputs![enc_name.as_str() => tensor])
            .map_err(|e| format!("SAM encode failed: {}", e))?;
        let (shape, data) = outputs[out_name.as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;
        Ok((data.to_vec(), shape.to_vec()))
    }
}

fn validate_prompt(points: &[(f32, f32)], positive: &[bool]) -> Result<(), String> {
    if points.is_empty() {
        return Err("At least one prompt point is required".to_string());
    }
    if positive.len() != points.len() {
        return Err("points/positive length mismatch".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn point_prompt_produces_mask_and_uses_cache() {
        if !Path::new("models/SAM/image_encoder.onnx").exists() {
            eprintln!("skip: SAM models not downloaded");
            return;
        }
        let dir = std::env::temp_dir().join("prism_sam_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sample_sam.png");

        // Bright disc on dark background gives the encoder something clean to
        // segment.
        let mut img = image::RgbImage::new(512, 512);
        for (x, y, p) in img.enumerate_pixels_mut() {
            let dx = x as f32 - 256.0;
            let dy = y as f32 - 256.0;
            let inside = (dx * dx + dy * dy).sqrt() < 120.0;
            *p = if inside { [230, 230, 230].into() } else { [20, 20, 20].into() };
        }
        image::DynamicImage::ImageRgb8(img)
            .save_with_format(&path, image::ImageFormat::Png)
            .unwrap();

        let eng = get_sam().expect("SAM should initialize");
        let t0 = std::time::Instant::now();
        let mask1 = eng
            .segment_points(path.to_str().unwrap(), &[(256.0, 256.0)], &[true])
            .expect("segmentation failed");
        let cold = t0.elapsed();

        let t1 = std::time::Instant::now();
        let mask2 = eng
            .segment_points(path.to_str().unwrap(), &[(256.0, 256.0), (10.0, 10.0)], &[true, false])
            .expect("multi-point segmentation failed");
        let warm = t1.elapsed();

        // Mask arrives at original resolution with the disc selected.
        let decoded = image::load_from_memory(&mask1).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (512, 512));
        let luma = decoded.to_luma8();
        assert_eq!(luma.get_pixel(256, 256)[0], 255, "center should be selected");

        // Negative point on dark corner must shrink/remove selection there.
        let decoded2 = image::load_from_memory(&mask2).unwrap();
        let luma2 = decoded2.to_luma8();
        assert_eq!(luma2.get_pixel(10, 10)[0], 0, "negative point area stays unselected");

        eprintln!(
            "SAM ok — cold {:?}, warm {:?} (encoder skipped on warm call)",
            cold, warm
        );
        assert!(warm < cold, "embedding cache did not skip the encoder");

        // Empty prompt rejected.
        assert!(eng.segment_points(path.to_str().unwrap(), &[], &[]).is_err());
    }

    #[test]
    fn test_sam_on_woman_sample() {
        let woman_path = "/home/chotaxdon/Work/Projects/Prism/frontend/public/sample_images/woman.png";
        let artifact_dir = Path::new("/home/chotaxdon/.gemini/antigravity/brain/f8fee3f8-2ef0-45f9-8207-61e475632392");
        if !Path::new(woman_path).exists() {
            eprintln!("skip: woman.png not found at {}", woman_path);
            return;
        }

        let eng = match get_sam() {
            Ok(e) => e,
            Err(err) => {
                eprintln!("skip: SAM model not available: {}", err);
                return;
            }
        };

        // 1. Cold run (Encoder + Decoder) with positive point on the woman's torso/face
        let prompt_points = vec![(512.0f32, 450.0f32)];
        let positive = vec![true];

        let t0 = std::time::Instant::now();
        let mask_bytes = eng
            .segment_points(woman_path, &prompt_points, &positive)
            .expect("SAM cold segmentation failed on woman.png");
        let cold_duration = t0.elapsed();

        // 2. Warm run (Cached encoder embeddings, decoder only)
        let t1 = std::time::Instant::now();
        let _ = eng
            .segment_points(woman_path, &[(512.0, 450.0), (80.0, 80.0)], &[true, false])
            .expect("SAM warm segmentation failed on woman.png");
        let warm_duration = t1.elapsed();

        eprintln!(
            "[SAM Benchmark] woman.png (1024x1024) -> Cold: {:.2?}, Warm: {:.2?}",
            cold_duration, warm_duration
        );

        // 3. Load original image and decoded SAM mask
        let orig_bytes = std::fs::read(woman_path).unwrap();
        let orig = image::load_from_memory(&orig_bytes).unwrap().to_rgba8();
        let mask_img = image::load_from_memory(&mask_bytes).unwrap().to_luma8();
        let (w, h) = (orig.width(), orig.height());

        // 4. Save SAM Mask
        let mask_art = artifact_dir.join("woman_sam_mask.png");
        mask_img.save_with_format(&mask_art, image::ImageFormat::Png).unwrap();

        // 5. Create transparent cutout
        let mut cutout = image::RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let p = orig.get_pixel(x, y);
                let alpha = mask_img.get_pixel(x, y)[0];
                cutout.put_pixel(x, y, image::Rgba([p[0], p[1], p[2], alpha]));
            }
        }
        let cutout_art = artifact_dir.join("woman_sam_cutout_transparent.png");
        cutout.save_with_format(&cutout_art, image::ImageFormat::Png).unwrap();

        // 6. Create Visual Point Prompt overlay on original
        let mut prompt_overlay = orig.clone();
        let px = 512i32;
        let py = 450i32;
        // Draw green ring target indicator at prompt point
        for dy in -12..=12 {
            for dx in -12..=12 {
                let dist_sq = dx * dx + dy * dy;
                let nx = px + dx;
                let ny = py + dy;
                if nx >= 0 && nx < w as i32 && ny >= 0 && ny < h as i32 {
                    if (dist_sq >= 64 && dist_sq <= 144) || dist_sq <= 16 {
                        prompt_overlay.put_pixel(nx as u32, ny as u32, image::Rgba([0, 255, 128, 255]));
                    }
                }
            }
        }
        let prompt_art = artifact_dir.join("woman_sam_prompt_overlay.png");
        prompt_overlay.save_with_format(&prompt_art, image::ImageFormat::Png).unwrap();

        // 7. Create Side-by-Side Comparison
        let mut side_by_side = image::RgbaImage::new(w * 2, h);
        for y in 0..h {
            for x in 0..w {
                // Left: Prompt annotated original
                side_by_side.put_pixel(x, y, *prompt_overlay.get_pixel(x, y));

                // Right: SAM cutout on checkerboard
                let check = if (x / 20 + y / 20) % 2 == 0 { 240u8 } else { 200u8 };
                let alpha = mask_img.get_pixel(x, y)[0] as f32 / 255.0;
                let orig_p = orig.get_pixel(x, y);
                let r = (orig_p[0] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;
                let g = (orig_p[1] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;
                let b = (orig_p[2] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;
                side_by_side.put_pixel(w + x, y, image::Rgba([r, g, b, 255]));
            }
            side_by_side.put_pixel(w, y, image::Rgba([255, 255, 255, 255]));
            side_by_side.put_pixel(w + 1, y, image::Rgba([255, 255, 255, 255]));
        }
        let comp_art = artifact_dir.join("woman_sam_comparison.png");
        side_by_side.save_with_format(&comp_art, image::ImageFormat::Png).unwrap();

        eprintln!("[test] All SAM visual artifacts saved to {:?}", artifact_dir);
    }
}
