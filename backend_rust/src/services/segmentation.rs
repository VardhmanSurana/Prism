use std::sync::{Mutex, OnceLock};
use image::{DynamicImage, GrayImage, Luma};
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
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
    u2netp:       Mutex<Session>,
    semantic:     Mutex<Session>,
    face_parsing: Option<Mutex<Session>>,
}

pub static SEGMENTATION_ENGINE: OnceLock<SegmentationEngine> = OnceLock::new();

impl SegmentationEngine {
    pub fn get() -> &'static Self {
        SEGMENTATION_ENGINE.get_or_init(|| {
            let base      = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("models/segmentation");
            let face_base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("models/face");

            let u2netp = Session::builder()
                .expect("ort builder")
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .expect("opt level")
                .commit_from_file(base.join("u2netp.onnx"))
                .expect("load u2netp.onnx");

            let semantic = Session::builder()
                .expect("ort builder")
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .expect("opt level")
                .commit_from_file(base.join("semantic.onnx"))
                .expect("load semantic.onnx");

            let face_parsing = Session::builder()
                .ok()
                .and_then(|b| b.with_optimization_level(GraphOptimizationLevel::Level3).ok())
                .and_then(|mut b| b.commit_from_file(face_base.join("face_parsing.onnx")).ok());

            SegmentationEngine {
                u2netp:       Mutex::new(u2netp),
                semantic:     Mutex::new(semantic),
                face_parsing: face_parsing.map(Mutex::new),
            }
        })
    }

    // ── Background mask (U²-Net-p) ───────────────────────────────────────────
    pub fn get_background_mask(
        &self,
        photo_path: &str,
        photo_id:   i64,
        masks_dir:  &std::path::Path,
    ) -> Result<BackgroundMaskResponse, String> {
        let img = image::open(photo_path).map_err(|e| e.to_string())?;
        let (orig_w, orig_h) = (img.width(), img.height());
        let (h, w) = (320usize, 320usize);

        let resized = img.resize_exact(w as u32, h as u32, image::imageops::FilterType::Triangle);
        let rgb     = resized.to_rgb8();

        // Build flat [1,3,320,320] tensor in NCHW order, normalised [0,1]
        let mut data = vec![0.0f32; 3 * h * w];
        for (x, y, p) in rgb.enumerate_pixels() {
            let idx = y as usize * w + x as usize;
            data[0 * h * w + idx] = p[0] as f32 / 255.0;
            data[1 * h * w + idx] = p[1] as f32 / 255.0;
            data[2 * h * w + idx] = p[2] as f32 / 255.0;
        }

        let tensor = Value::from_array(([1usize, 3, h, w], data))
            .map_err(|e| e.to_string())?;
        let inputs  = ort::inputs!["input.1" => tensor];
        let mut session_guard = self.u2netp.lock().unwrap();
        let outputs = session_guard.run(inputs)
            .map_err(|e| e.to_string())?;

        // Output "1959" is [1,1,320,320] — grab the data flat
        let (_, mask_cow) = outputs["1959"]
            .try_extract_tensor::<f32>()
            .map_err(|e| e.to_string())?;
        let mask_flat: Vec<f32> = mask_cow.iter().copied().collect();

        // Build 320×320 grayscale, then resize back to original
        let mut gray = GrayImage::new(w as u32, h as u32);
        for py in 0..h {
            for px in 0..w {
                let v = (mask_flat[py * w + px].clamp(0.0, 1.0) * 255.0) as u8;
                gray.put_pixel(px as u32, py as u32, Luma([v]));
            }
        }
        let out = DynamicImage::ImageLuma8(gray)
            .resize_exact(orig_w, orig_h, image::imageops::FilterType::Triangle);

        std::fs::create_dir_all(masks_dir).map_err(|e| e.to_string())?;
        let filename = format!("mask_{}_background.png", photo_id);
        out.save(masks_dir.join(&filename)).map_err(|e| e.to_string())?;

        Ok(BackgroundMaskResponse { mask_url: format!("/thumbnails/masks/{}", filename) })
    }

    // ── Semantic segmentation (SegFormer ADE20K-150) ─────────────────────────
    pub fn get_semantic_masks(
        &self,
        photo_path: &str,
        photo_id:   i64,
        masks_dir:  &std::path::Path,
    ) -> Result<SemanticMasksResponse, String> {
        let img = image::open(photo_path).map_err(|e| e.to_string())?;
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
        let outputs = session_guard.run(inputs).map_err(|e| e.to_string())?;

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
        let fp_mutex = match &self.face_parsing {
            Some(m) => m,
            None    => return Ok(PortraitMasksResponse { faces: vec![] }),
        };

        let img = image::open(photo_path).map_err(|e| e.to_string())?;
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
        let mut session_guard = fp_mutex.lock().unwrap();
        let outputs = session_guard.run(inputs).map_err(|e| e.to_string())?;

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
