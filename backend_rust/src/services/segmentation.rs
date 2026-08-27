use std::sync::{Mutex, OnceLock};
use image::{DynamicImage, GrayImage, Luma};
use ort::session::Session;
use ort::value::Value;
use serde::{Deserialize, Serialize};


// ─── ADE20K label map (150 classes) ─────────────────────────────────────────
const ADE20K_LABELS: &[&str] = &[
    "wall", "building", "sky", "floor", "tree", "ceiling", "road", "bed",
    "windowpane", "grass", "cabinet", "sidewalk", "person", "earth", "door",
    "table", "mountain", "plant", "curtain", "chair", "car", "water", "painting",
    "sofa", "shelf", "house", "sea", "mirror", "rug", "field", "armchair",
    "seat", "fence", "desk", "rock", "wardrobe", "lamp", "bathtub", "railing",
    "cushion", "base", "box", "column", "signboard", "chest", "counter",
    "sand", "sink", "skyscraper", "fireplace", "refrigerator", "grandstand",
    "path", "stairs", "runway", "case", "pool table", "pillow", "screen door",
    "stairway", "river", "bridge", "bookcase", "blind", "coffee table", "toilet",
    "flower", "book", "hill", "bench", "countertop", "stove", "palm", "kitchen island",
    "computer", "swivel chair", "boat", "bar", "arcade machine", "hovel", "bus",
    "towel", "light", "truck", "tower", "chandelier", "awning", "streetlight",
    "booth", "television", "airplane", "dirt track", "apparel", "pole", "land",
    "bannister", "escalator", "ottoman", "bottle", "buffet", "poster", "stage",
    "van", "ship", "fountain", "conveyer belt", "canopy", "washer", "plaything",
    "swimming pool", "stool", "barrel", "basket", "waterfall", "tent", "bag",
    "minibike", "cradle", "oven", "ball", "food", "step", "tank", "trade name",
    "microwave", "pot", "animal", "bicycle", "lake", "dishwasher", "screen",
    "blanket", "sculpture", "hood", "sconce", "vase", "traffic light", "tray",
    "ashcan", "fan", "pier", "crt screen", "plate", "monitor", "bulletin board",
    "shower", "radiator", "glass", "clock", "flag",
];

// ─── BiSeNet face-parsing labels (CelebAMask-HQ, 19 classes, index 1..18) ───
const FACE_PARTS: &[&str] = &[
    "skin", "l_brow", "r_brow", "l_eye", "r_eye",
    "eye_g", "l_ear", "r_ear", "ear_r", "nose",
    "mouth", "u_lip", "l_lip", "neck", "neck_l",
    "cloth", "hair", "hat",
];

// ─── Response types ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Region {
    pub id: String,
    pub label: String,
    pub r#type: String,
    pub mask_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SemanticMasksResponse {
    pub regions: Vec<Region>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackgroundMaskResponse {
    pub mask_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FaceMask {
    pub id: String,
    pub masks: std::collections::HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PortraitMasksResponse {
    pub faces: Vec<FaceMask>,
}

// ─── Engine ──────────────────────────────────────────────────────────────────

pub struct SegmentationEngine {
    u2netp:       Mutex<Option<Session>>,
    semantic:     Mutex<Option<Session>>,
    face_parsing: Mutex<Option<Session>>,
    matte_sessions: Mutex<std::collections::HashMap<String, (Session, std::time::Instant)>>,
}

pub static SEGMENTATION_ENGINE: OnceLock<SegmentationEngine> = OnceLock::new();

fn load_image_sniffed(path: &str) -> Result<DynamicImage, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    image::load_from_memory(&bytes).map_err(|e| format!("Failed to decode {}: {}", path, e))
}

impl SegmentationEngine {
    pub fn get() -> &'static Self {
        SEGMENTATION_ENGINE.get_or_init(|| {
            let base      = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("models/segmentation");
            let face_base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("models/face");

            let u2netp = crate::services::onnx_helper::build_tier1_session(base.join("u2netp.onnx"), "U2NetP").ok();
            let semantic = crate::services::onnx_helper::build_session(base.join("semantic.onnx"), "Semantic-Seg").ok();
            let face_parsing = crate::services::onnx_helper::build_tier1_session(face_base.join("face_parsing.onnx"), "Face-Parsing").ok();

            SegmentationEngine {
                u2netp:       Mutex::new(u2netp),
                semantic:     Mutex::new(semantic),
                face_parsing: Mutex::new(face_parsing),
                matte_sessions: Mutex::new(std::collections::HashMap::new()),
            }
        })
    }

    // ── Background mask (Generic Matting + U²-Net-p fallback) ───────────────────
    pub fn get_background_mask(
        &self,
        photo_path: &str,
        photo_id:   i64,
        masks_dir:  &std::path::Path,
        model_id:   Option<&str>,
        pack_manager: Option<&crate::services::packs::PackManager>,
    ) -> Result<BackgroundMaskResponse, String> {
        let req_model = model_id.unwrap_or("builtin-u2netp");
        let is_builtin = req_model == "builtin-u2netp" || req_model == "u2netp";

        std::fs::create_dir_all(masks_dir).map_err(|e| e.to_string())?;
        let filename = if is_builtin {
            format!("mask_{}_background.png", photo_id)
        } else {
            format!("mask_{}_background_{}.png", photo_id, req_model)
        };
        let out_path = masks_dir.join(&filename);

        // If mask already generated on disk, return cached URL directly
        if out_path.exists() {
            return Ok(BackgroundMaskResponse { mask_url: format!("/thumbnails/masks/{}", filename) });
        }

        let img = load_image_sniffed(photo_path)?;
        let (orig_w, orig_h) = (img.width(), img.height());

        if is_builtin {
            // Builtin U2Netp execution
            let (h, w) = (320usize, 320usize);
            let resized = img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Triangle);
            let rgb = resized.to_rgb8();

            let mut data = vec![0.0f32; 3 * h * w];
            for (x, y, p) in rgb.enumerate_pixels() {
                let idx = y as usize * w + x as usize;
                data[0 * h * w + idx] = p[0] as f32 / 255.0;
                data[1 * h * w + idx] = p[1] as f32 / 255.0;
                data[2 * h * w + idx] = p[2] as f32 / 255.0;
            }

            let tensor = Value::from_array(([1usize, 3, h, w], data))
                .map_err(|e| e.to_string())?;
            let inputs = ort::inputs!["input.1" => tensor];
            let mut session_guard = self.u2netp.lock().unwrap();
            let session = session_guard.as_mut().ok_or("U2Netp model session not loaded on this system")?;
            let outputs = session.run(inputs).map_err(|e| e.to_string())?;

            let (_, mask_cow) = outputs["1959"]
                .try_extract_tensor::<f32>()
                .map_err(|e| e.to_string())?;
            let mask_flat: Vec<f32> = mask_cow.iter().copied().collect();

            let mut gray = GrayImage::new(w as u32, h as u32);
            for py in 0..h {
                for px in 0..w {
                    let v = (mask_flat[py * w + px].clamp(0.0, 1.0) * 255.0) as u8;
                    gray.put_pixel(px as u32, py as u32, Luma([v]));
                }
            }
            let out = DynamicImage::ImageLuma8(gray)
                .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle);

            out.save(&out_path).map_err(|e| e.to_string())?;
            return Ok(BackgroundMaskResponse { mask_url: format!("/thumbnails/masks/{}", filename) });
        }

        // Generic Capability Pack Model Execution
        let pm = pack_manager.ok_or("Capability pack manager not available")?;
        let (_pack, model_def, model_path) = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(pm.get_model_def(req_model))
        }).ok_or_else(|| format!("Model '{}' not found in capability packs", req_model))?;

        if !model_path.exists() {
            return Err(format!("Model '{}' weights not installed at {:?}", req_model, model_path));
        }

        // Ensure ONNX session is in LRU cache
        let mut cache_guard = self.matte_sessions.lock().unwrap();
        if !cache_guard.contains_key(req_model) {
            // Evict oldest if capacity >= 2
            if cache_guard.len() >= 2 {
                if let Some((oldest_key, _)) = cache_guard.iter()
                    .min_by_key(|(_, (_, time))| *time)
                    .map(|(k, _)| (k.clone(), ())) {
                    tracing::info!("[SegmentationEngine] Evicting matting session '{}' from RAM", oldest_key);
                    cache_guard.remove(&oldest_key);
                }
            }

            tracing::info!("[SegmentationEngine] Loading matting model '{}' from {:?}", req_model, model_path);
            let session = crate::services::onnx_helper::build_session(&model_path, req_model)
                .map_err(|e| format!("Failed to load ONNX file {:?}: {}", model_path, e))?;

            cache_guard.insert(req_model.to_string(), (session, std::time::Instant::now()));
        }

        let (session, last_used) = cache_guard.get_mut(req_model).unwrap();
        *last_used = std::time::Instant::now();

        // 1. Preprocess according to pack model input definition
        let in_w = model_def.input.size[0] as usize;
        let in_h = model_def.input.size[1] as usize;
        let mean = model_def.input.mean;
        let std = model_def.input.std;

        let resized = img.resize_exact(in_w as u32, in_h as u32, image::imageops::FilterType::Triangle);
        let rgb = resized.to_rgb8();

        let mut data = vec![0.0f32; 3 * in_h * in_w];
        if model_def.input.layout.eq_ignore_ascii_case("NCHW") {
            for (x, y, p) in rgb.enumerate_pixels() {
                let idx = y as usize * in_w + x as usize;
                data[0 * in_h * in_w + idx] = ((p[0] as f32 / 255.0) - mean[0]) / std[0];
                data[1 * in_h * in_w + idx] = ((p[1] as f32 / 255.0) - mean[1]) / std[1];
                data[2 * in_h * in_w + idx] = ((p[2] as f32 / 255.0) - mean[2]) / std[2];
            }
        } else {
            // NHWC layout
            for (x, y, p) in rgb.enumerate_pixels() {
                let idx = (y as usize * in_w + x as usize) * 3;
                data[idx] = ((p[0] as f32 / 255.0) - mean[0]) / std[0];
                data[idx + 1] = ((p[1] as f32 / 255.0) - mean[1]) / std[1];
                data[idx + 2] = ((p[2] as f32 / 255.0) - mean[2]) / std[2];
            }
        }

        let tensor_shape = if model_def.input.layout.eq_ignore_ascii_case("NCHW") {
            vec![1usize, 3, in_h, in_w]
        } else {
            vec![1usize, in_h, in_w, 3]
        };

        let tensor = Value::from_array((tensor_shape, data))
            .map_err(|e| format!("Failed to create input tensor: {}", e))?;

        let dynamic_input_name = session
            .inputs()
            .first()
            .map(|i| i.name().to_string());
        let effective_input_name = dynamic_input_name
            .as_deref()
            .unwrap_or(model_def.input.name.as_str());

        let mut inputs_map = std::collections::HashMap::new();
        inputs_map.insert(effective_input_name, tensor);

        let outputs = session.run(inputs_map)
            .map_err(|e| format!("ORT matting inference failed: {}", e))?;

        // 2. Extract output tensor
        let raw_flat: Vec<f32> = if let Some(ref out_name) = model_def.output.output_name {
            if let Some(out_tensor) = outputs.get(out_name.as_str()) {
                let (_, cow) = out_tensor
                    .try_extract_tensor::<f32>()
                    .map_err(|e| format!("Extract output error for '{}': {}", out_name, e))?;
                cow.iter().copied().collect()
            } else {
                let (_, cow) = outputs[0]
                    .try_extract_tensor::<f32>()
                    .map_err(|e| format!("Extract output error: {}", e))?;
                cow.iter().copied().collect()
            }
        } else {
            let out_idx = model_def.output.output_index.unwrap_or(0);
            let (_, cow) = outputs[out_idx]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Extract output error: {}", e))?;
            cow.iter().copied().collect()
        };

        // 3. Postprocess and scale to 8-bit alpha matte
        let postprocess = model_def.output.postprocess.to_lowercase();
        let threshold = model_def.output.threshold;

        let total_pixels = in_w * in_h;
        let slice = if raw_flat.len() >= total_pixels {
            &raw_flat[..total_pixels]
        } else {
            &raw_flat[..]
        };

        let mut gray = GrayImage::new(in_w as u32, in_h as u32);
        for py in 0..in_h {
            for px in 0..in_w {
                let idx = py * in_w + px;
                if idx < slice.len() {
                    let mut val = slice[idx];
                    if postprocess == "sigmoid" {
                        val = 1.0 / (1.0 + (-val).exp());
                    } else if postprocess == "clamp" {
                        val = val.clamp(0.0, 1.0);
                    }

                    if let Some(th) = threshold {
                        val = if val >= th { 1.0 } else { 0.0 };
                    }

                    let byte_val = (val.clamp(0.0, 1.0) * 255.0).round() as u8;
                    gray.put_pixel(px as u32, py as u32, Luma([byte_val]));
                }
            }
        }

        let out = DynamicImage::ImageLuma8(gray)
            .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle);

        out.save(&out_path).map_err(|e| e.to_string())?;

        Ok(BackgroundMaskResponse { mask_url: format!("/thumbnails/masks/{}", filename) })
    }

    // ── Semantic segmentation (SegFormer ADE20K-150) ─────────────────────────
    pub fn get_semantic_masks(
        &self,
        photo_path: &str,
        photo_id:   i64,
        masks_dir:  &std::path::Path,
    ) -> Result<SemanticMasksResponse, String> {
        let img = load_image_sniffed(photo_path)?;
        let (orig_w, orig_h) = (img.width(), img.height());
        let (h, w) = (512usize, 512usize);

        let resized = img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Triangle);
        let rgb     = resized.to_rgb8();

        let mut data = vec![0.0f32; 3 * h * w];
        for (x, y, p) in rgb.enumerate_pixels() {
            let idx = y as usize * w + x as usize;
            data[0 * h * w + idx] = p[0] as f32 / 255.0;
            data[1 * h * w + idx] = p[1] as f32 / 255.0;
            data[2 * h * w + idx] = p[2] as f32 / 255.0;
        }

        let tensor  = Value::from_array(([1usize, 3, h, w], data)).map_err(|e| e.to_string())?;
        let inputs  = ort::inputs!["pixel_values" => tensor];
        let mut session_guard = self.semantic.lock().unwrap();
        let session = session_guard.as_mut().ok_or("Semantic segmentation model session not loaded on this system")?;
        let outputs = session.run(inputs).map_err(|e| e.to_string())?;

        // logits: [1, 150, lh, lw]
        let (logits_shape, logits_cow) = outputs["logits"]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;
        let logits_flat: Vec<f32> = logits_cow.iter().copied().collect();
        let shape: Vec<usize> = logits_shape.iter().map(|&d| d as usize).collect();
        let (num_labels, lh, lw) = (shape[1], shape[2], shape[3]);

        // Argmax per pixel
        let mut class_map = vec![0usize; lh * lw];
        for py in 0..lh {
            for px in 0..lw {
                let mut best = 0usize;
                let mut best_val = f32::NEG_INFINITY;
                for c in 0..num_labels {
                    let v = logits_flat[c * lh * lw + py * lw + px];
                    if v > best_val { best_val = v; best = c; }
                }
                class_map[py * lw + px] = best;
            }
        }

        let present: std::collections::HashSet<usize> = class_map.iter().copied().collect();
        std::fs::create_dir_all(masks_dir).map_err(|e| e.to_string())?;

        let mut regions = Vec::new();
        for label_idx in present {
            let label_name = ADE20K_LABELS.get(label_idx).copied().unwrap_or("unknown");

            let mut gray = GrayImage::new(lw as u32, lh as u32);
            for py in 0..lh {
                for px in 0..lw {
                    let v = if class_map[py * lw + px] == label_idx { 255u8 } else { 0u8 };
                    gray.put_pixel(px as u32, py as u32, Luma([v]));
                }
            }
            let out = DynamicImage::ImageLuma8(gray)
                .resize_exact(orig_w, orig_h, image::imageops::FilterType::Nearest);

            let safe_name = label_name.replace(' ', "_");
            let filename  = format!("mask_{}_semantic_{}.png", photo_id, safe_name);
            out.save(masks_dir.join(&filename)).map_err(|e| e.to_string())?;

            regions.push(Region {
                id:       format!("{}-{}", safe_name, photo_id),
                label:    label_name.to_string(),
                r#type:   "semantic".to_string(),
                mask_url: format!("/thumbnails/masks/{}", filename),
            });
        }

        Ok(SemanticMasksResponse { regions })
    }

    // ── Portrait / face-parsing (BiSeNet CelebAMask-HQ) ──────────────────────
    pub fn get_portrait_masks(
        &self,
        photo_path: &str,
        photo_id:   i64,
        masks_dir:  &std::path::Path,
    ) -> Result<PortraitMasksResponse, String> {
        let mut fp_guard = self.face_parsing.lock().unwrap();
        let session = match fp_guard.as_mut() {
            Some(s) => s,
            None => return Ok(PortraitMasksResponse { faces: vec![] }),
        };

        let img = load_image_sniffed(photo_path)?;
        let (orig_w, orig_h) = (img.width(), img.height());
        let (h, w) = (512usize, 512usize);

        let resized = img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Triangle);
        let rgb     = resized.to_rgb8();

        let mut data = vec![0.0f32; 3 * h * w];
        for (x, y, p) in rgb.enumerate_pixels() {
            let idx = y as usize * w + x as usize;
            data[0 * h * w + idx] = p[0] as f32 / 255.0;
            data[1 * h * w + idx] = p[1] as f32 / 255.0;
            data[2 * h * w + idx] = p[2] as f32 / 255.0;
        }

        let tensor  = Value::from_array(([1usize, 3, h, w], data)).map_err(|e| e.to_string())?;
        let inputs  = ort::inputs!["input" => tensor];
        let outputs = session.run(inputs).map_err(|e| e.to_string())?;

        // First output is [1, num_classes, lh, lw]
        let (out_shape, out_cow) = outputs[0usize]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;
        let out_flat: Vec<f32> = out_cow.iter().copied().collect();
        let shape: Vec<usize> = out_shape.iter().map(|&d| d as usize).collect();
        let (num_labels, lh, lw) = (shape[1], shape[2], shape[3]);

        // Argmax
        let mut class_map = vec![0usize; lh * lw];
        for py in 0..lh {
            for px in 0..lw {
                let mut best = 0usize;
                let mut best_val = f32::NEG_INFINITY;
                for c in 0..num_labels {
                    let v = out_flat[c * lh * lw + py * lw + px];
                    if v > best_val { best_val = v; best = c; }
                }
                class_map[py * lw + px] = best;
            }
        }

        let present: std::collections::HashSet<usize> = class_map.iter().copied().collect();
        // Class 0 = background, skip
        let face_classes: Vec<usize> = present.into_iter().filter(|&c| c > 0).collect();
        if face_classes.is_empty() {
            return Ok(PortraitMasksResponse { faces: vec![] });
        }

        std::fs::create_dir_all(masks_dir).map_err(|e| e.to_string())?;
        let mut masks_map = std::collections::HashMap::new();

        for label_idx in &face_classes {
            let part_name = if *label_idx >= 1 && (*label_idx - 1) < FACE_PARTS.len() {
                FACE_PARTS[label_idx - 1]
            } else {
                "part"
            };

            let mut gray = GrayImage::new(lw as u32, lh as u32);
            for py in 0..lh {
                for px in 0..lw {
                    let v = if class_map[py * lw + px] == *label_idx { 255u8 } else { 0u8 };
                    gray.put_pixel(px as u32, py as u32, Luma([v]));
                }
            }
            let out = DynamicImage::ImageLuma8(gray)
                .resize_exact(orig_w, orig_h, image::imageops::FilterType::Nearest);

            let filename = format!("mask_{}_face_{}.png", photo_id, part_name);
            out.save(masks_dir.join(&filename)).map_err(|e| e.to_string())?;
            masks_map.insert(part_name.to_string(), format!("/thumbnails/masks/{}", filename));
        }

        Ok(PortraitMasksResponse {
            faces: vec![FaceMask { id: format!("face_0-{}", photo_id), masks: masks_map }],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn segmentation_on_sample_image() {
        let dir = std::env::temp_dir().join("prism_segmentation_test");
        std::fs::create_dir_all(&dir).unwrap();
        let photo_path = dir.join("test_seg.png");

        let img = image::RgbaImage::new(256, 256);
        img.save(&photo_path).unwrap();

        let engine = SegmentationEngine::get();
        let mask_res = engine.get_background_mask(photo_path.to_str().unwrap(), 1, &dir, None, None);
        if engine.u2netp.lock().unwrap().is_some() {
            assert!(mask_res.is_ok(), "Segmentation background mask failed: {:?}", mask_res.err());
            eprintln!("[test] Segmentation U2NetP OK");
        } else {
            eprintln!("skip: u2netp model not present");
        }
    }

    #[test]
    fn test_bg_removal_on_woman_sample() {
        let woman_path = "/home/chotaxdon/Work/Projects/Prism/frontend/public/sample_images/woman.png";
        let artifact_dir = Path::new("/home/chotaxdon/.gemini/antigravity/brain/f8fee3f8-2ef0-45f9-8207-61e475632392");
        if !Path::new(woman_path).exists() {
            eprintln!("skip: woman.png not found at {}", woman_path);
            return;
        }

        let engine = SegmentationEngine::get();
        let mask_dir = artifact_dir.join("masks_test");
        let _ = std::fs::create_dir_all(&mask_dir);

        let t0 = std::time::Instant::now();
        let res = engine.get_background_mask(woman_path, 9999, &mask_dir, None, None)
            .expect("Failed to run background removal on woman.png");
        let duration = t0.elapsed();
        eprintln!("[test] Background mask generated in {:.2?}", duration);

        // Load original and mask
        let orig = load_image_sniffed(woman_path).expect("Failed to open original woman.png").to_rgba8();
        let mask_path = mask_dir.join("mask_9999_background.png");
        let mask = load_image_sniffed(mask_path.to_str().unwrap()).expect("Failed to open generated mask").to_luma8();

        let (w, h) = (orig.width(), orig.height());

        // 1. Save original to artifact directory
        let orig_art = artifact_dir.join("woman_original.png");
        orig.save_with_format(&orig_art, image::ImageFormat::Png).unwrap();

        // 2. Save mask to artifact directory
        let mask_art = artifact_dir.join("woman_bg_mask.png");
        mask.save_with_format(&mask_art, image::ImageFormat::Png).unwrap();

        // 3. Create transparent RGBA cutout
        let mut cutout = image::RgbaImage::new(w, h);
        for y in 0..h {
            for x in 0..w {
                let p = orig.get_pixel(x, y);
                let alpha = mask.get_pixel(x, y)[0];
                cutout.put_pixel(x, y, image::Rgba([p[0], p[1], p[2], alpha]));
            }
        }
        let cutout_art = artifact_dir.join("woman_cutout_transparent.png");
        cutout.save_with_format(&cutout_art, image::ImageFormat::Png).unwrap();

        // 4. Create Side-by-Side (Left: Original, Right: Cutout on subtle checkerboard pattern)
        let mut side_by_side = image::RgbaImage::new(w * 2, h);
        for y in 0..h {
            for x in 0..w {
                // Left: original
                side_by_side.put_pixel(x, y, *orig.get_pixel(x, y));

                // Right: cutout over light checkerboard pattern
                let check = if (x / 20 + y / 20) % 2 == 0 { 240u8 } else { 200u8 };
                let alpha = mask.get_pixel(x, y)[0] as f32 / 255.0;
                let orig_p = orig.get_pixel(x, y);
                let r = (orig_p[0] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;
                let g = (orig_p[1] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;
                let b = (orig_p[2] as f32 * alpha + check as f32 * (1.0 - alpha)) as u8;

                side_by_side.put_pixel(w + x, y, image::Rgba([r, g, b, 255]));
            }
            // 2px center divider line
            side_by_side.put_pixel(w, y, image::Rgba([255, 255, 255, 255]));
            side_by_side.put_pixel(w + 1, y, image::Rgba([255, 255, 255, 255]));
        }

        let comp_art = artifact_dir.join("woman_bg_removal_comparison.png");
        side_by_side.save_with_format(&comp_art, image::ImageFormat::Png).unwrap();
        eprintln!("[test] All visual artifacts generated and saved to {:?}", artifact_dir);
    }
}
