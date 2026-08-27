//! ocr_engine.rs — PP-OCRv4 ONNX text detection + recognition pipeline.
//!
//! Loads the detection model (`ch_PP-OCRv4_det_infer.onnx`) and recognition
//! model (`ch_PP-OCRv4_rec_infer.onnx`) via ONNX Runtime. Runs the full
//! pipeline: detect text regions → crop → recognize → CTC decode.
//!
//! Returns structured results with per-line bounding boxes and confidence
//! scores, suitable for the frontend Text Actions overlay.

use ndarray::Array4;
use ort::session::Session;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tracing::{info, warn};

// ─── Public Types ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrBbox {
    pub text: String,
    /// Four corner points: [top-left, top-right, bottom-right, bottom-left].
    /// Coordinates are normalized to [0, 1] relative to the original image.
    pub bbox: [[f32; 2]; 4],
    pub confidence: f32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OcrResult {
    pub full_text: String,
    pub lines: Vec<OcrBbox>,
}

// ─── Engine Singleton ───────────────────────────────────────────────────────

struct DetSession {
    session: Mutex<Session>,
    input_name: String,
    output_name: String,
}

struct RecSession {
    session: Mutex<Session>,
    input_name: String,
    output_name: String,
}

struct OcrSessions {
    det: DetSession,
    rec: RecSession,
    dict: Vec<String>,
}

static OCR: OnceLock<Option<Arc<OcrSessions>>> = OnceLock::new();

const DET_MODEL_PATHS: &[&str] = &[
    "models/ocr/ch_PP-OCRv4_det_infer.onnx",
    "../models/ocr/ch_PP-OCRv4_det_infer.onnx",
];

const REC_MODEL_PATHS: &[&str] = &[
    "models/ocr/ch_PP-OCRv4_rec_infer.onnx",
    "../models/ocr/ch_PP-OCRv4_rec_infer.onnx",
];

const DICT_PATHS: &[&str] = &[
    "models/ocr/ppocr_keys_v1.txt",
    "../models/ocr/ppocr_keys_v1.txt",
];

// PP-OCRv4 recognition uses index 0 as CTC blank.
const CTC_BLANK: usize = 0;


/// Load the PP-OCRv4 character dictionary (one character per line).
fn load_dict() -> Result<Vec<String>, String> {
    let found = DICT_PATHS.iter().find(|p| Path::new(p).exists()).copied();
    match found {
        Some(path) => {
            let content = std::fs::read_to_string(path)
                .map_err(|e| format!("Failed to read OCR dict {}: {}", path, e))?;
            let chars: Vec<String> = content.lines().map(|l| l.to_string()).collect();
            info!("[OcrEngine] Loaded {} characters from {}", chars.len(), path);
            Ok(chars)
        }
        None => {
            // Fallback: minimal ASCII + common punctuation dict for English-only OCR.
            // This won't handle Chinese but allows basic text extraction.
            warn!("[OcrEngine] OCR dict not found; using minimal fallback (English only)");
            let mut chars = vec!["".to_string()]; // index 0 = blank
            // Space + ASCII printable
            chars.push(" ".to_string());
            for c in 33u8..=126 {
                chars.push((c as char).to_string());
            }
            // Common CJK punctuation
            for c in &['。', '，', '！', '？', '：', '；', '「', '」', '『', '』'] {
                chars.push(c.to_string());
            }
            Ok(chars)
        }
    }
}

fn load_session(path: &str, label: &str) -> Result<(Session, String, String), String> {
    let build = crate::services::onnx_helper::build_session(path, label)
        .map_err(|e| format!("Failed to load {} model {}: {}", label, path, e))?;

    let input_name = build
        .inputs()
        .first()
        .map(|i| i.name().to_string())
        .ok_or_else(|| format!("{} model has no inputs", label))?;
    let output_name = build
        .outputs()
        .first()
        .map(|o| o.name().to_string())
        .ok_or_else(|| format!("{} model has no outputs", label))?;

    info!("[OcrEngine] {} session loaded from {}", label, path);
    Ok((build, input_name, output_name))
}

fn get_sessions() -> Result<Arc<OcrSessions>, String> {
    if let Some(cached) = OCR.get() {
        return cached
            .clone()
            .ok_or_else(|| "OCR models failed to load previously; see earlier log".to_string());
    }

    let det_path = DET_MODEL_PATHS
        .iter()
        .find(|p| Path::new(p).exists())
        .copied();
    let rec_path = REC_MODEL_PATHS
        .iter()
        .find(|p| Path::new(p).exists())
        .copied();

    let loaded = match (det_path, rec_path) {
        ( Some(det), Some(rec) ) => {
            match (load_session(det, "det"), load_session(rec, "rec")) {
                ( Ok((det_sess, det_in, det_out)), Ok((rec_sess, rec_in, rec_out)) ) => {
                    match load_dict() {
                        Ok(dict) => Some(Arc::new(OcrSessions {
                            det: DetSession { session: Mutex::new(det_sess), input_name: det_in, output_name: det_out },
                            rec: RecSession { session: Mutex::new(rec_sess), input_name: rec_in, output_name: rec_out },
                            dict,
                        })),
                        Err(e) => {
                            warn!("[OcrEngine] Failed to load dict: {}", e);
                            None
                        }
                    }
                }
                (Err(e), _) | (_, Err(e)) => {
                    warn!("[OcrEngine] Failed to load OCR sessions: {}", e);
                    None
                }
            }
        }
        _ => {
            warn!(
                "[OcrEngine] OCR models not found. Det: {}, Rec: {}",
                det_path.unwrap_or("MISSING"),
                rec_path.unwrap_or("MISSING")
            );
            None
        }
    };

    let _ = OCR.set(loaded.clone());
    loaded.ok_or_else(|| {
        format!(
            "OCR unavailable: download the PP-OCRv4 models first \
             (Model Manager → 'RapidOCR / PP-OCRv4'). Expected at {}",
            DET_MODEL_PATHS[0]
        )
    })
}

// ─── Detection ──────────────────────────────────────────────────────────────

/// Maximum dimension for detection input (PP-OCRv4 default).
const DET_MAX_DIM: u32 = 960;

/// Detection normalization (ImageNet stats used by PP-OCRv4).
const DET_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const DET_STD: [f32; 3] = [0.229, 0.224, 0.225];

/// Threshold for binarizing the detection heatmap.
const DET_THRESHOLD: f32 = 0.3;

/// A detected text region as an axis-aligned bounding box in pixel coordinates.
#[derive(Debug, Clone)]
struct DetBox {
    x1: u32,
    y1: u32,
    x2: u32,
    y2: u32,
}

/// Preprocess image for detection: resize, normalize, pad to multiple of 32.
fn det_preprocess(
    img: &image::DynamicImage,
) -> Result<(ndarray::Array4<f32>, f32, f32, u32, u32), String> {
    let (orig_w, orig_h) = (img.width(), img.height());

    // Scale so max dimension ≤ DET_MAX_DIM
    let scale = if orig_w > orig_h {
        DET_MAX_DIM as f32 / orig_w as f32
    } else {
        DET_MAX_DIM as f32 / orig_h as f32
    };
    let scale = scale.min(1.0); // never upscale

    let new_w = (orig_w as f32 * scale).round() as u32;
    let new_h = (orig_h as f32 * scale).round() as u32;

    // Pad to multiple of 32
    let pad_w = ((new_w + 31) / 32) * 32;
    let pad_h = ((new_h + 31) / 32) * 32;

    let resized = img
        .resize_exact(new_w, new_h, image::imageops::FilterType::Triangle)
        .to_rgb8();

    let mut arr = Array4::<f32>::zeros((1, 3, pad_h as usize, pad_w as usize));

    for (x, y, pixel) in resized.enumerate_pixels() {
        let nx = x as usize;
        let ny = y as usize;
        for c in 0..3 {
            let v = pixel[c] as f32 / 255.0;
            arr[[0, c, ny, nx]] = (v - DET_MEAN[c]) / DET_STD[c];
        }
    }

    Ok((arr, orig_w as f32, orig_h as f32, new_w, new_h))
}

/// Postprocess detection heatmap: threshold → connected components → bounding boxes.
fn det_postprocess(
    heatmap: &[f32],
    heat_h: usize,
    heat_w: usize,
    orig_w: f32,
    orig_h: f32,
    scaled_w: u32,
    scaled_h: u32,
) -> Vec<DetBox> {
    // Binarize
    let mut binary = vec![0u8; heat_h * heat_w];
    for i in 0..heatmap.len() {
        binary[i] = if heatmap[i] > DET_THRESHOLD { 1 } else { 0 };
    }

    // Connected components via Union-Find
    let n = heat_h * heat_w;
    let mut parent: Vec<usize> = (0..n).collect();
    let mut rank = vec![0u16; n];

    fn find(parent: &mut [usize], x: usize) -> usize {
        if parent[x] != x {
            parent[x] = find(parent, parent[x]);
        }
        parent[x]
    }

    fn union(parent: &mut [usize], rank: &mut [u16], a: usize, b: usize) {
        let ra = find(parent, a);
        let rb = find(parent, b);
        if ra == rb {
            return;
        }
        if rank[ra] < rank[rb] {
            parent[ra] = rb;
        } else if rank[ra] > rank[rb] {
            parent[rb] = ra;
        } else {
            parent[rb] = ra;
            rank[ra] += 1;
        }
    }

    // 4-connectivity union
    for y in 0..heat_h {
        for x in 0..heat_w {
            let idx = y * heat_w + x;
            if binary[idx] == 0 {
                continue;
            }
            if x + 1 < heat_w && binary[idx + 1] == 1 {
                union(&mut parent, &mut rank, idx, idx + 1);
            }
            if y + 1 < heat_h && binary[idx + heat_w] == 1 {
                union(&mut parent, &mut rank, idx, idx + heat_w);
            }
        }
    }

    // Collect bounding boxes per component
    let mut min_x = vec![u32::MAX; n];
    let mut min_y = vec![u32::MAX; n];
    let mut max_x = vec![0u32; n];
    let mut max_y = vec![0u32; n];
    let mut count = vec![0u32; n];

    for y in 0..heat_h {
        for x in 0..heat_w {
            let idx = y * heat_w + x;
            if binary[idx] == 0 {
                continue;
            }
            let root = find(&mut parent, idx);
            min_x[root] = min_x[root].min(x as u32);
            min_y[root] = min_y[root].min(y as u32);
            max_x[root] = max_x[root].max(x as u32);
            max_y[root] = max_y[root].max(y as u32);
            count[root] += 1;
        }
    }

    // Filter tiny components and scale back to original coordinates
    let scale_x = orig_w / scaled_w as f32;
    let scale_y = orig_h / scaled_h as f32;
    let min_area = 50; // minimum pixel area in heatmap space

    let mut boxes = Vec::new();
    for root in 0..n {
        if count[root] < min_area {
            continue;
        }
        // Add 2-pixel margin in heatmap space
        let x1 = (min_x[root] as i32 - 2).max(0) as u32;
        let y1 = (min_y[root] as i32 - 2).max(0) as u32;
        let x2 = (max_x[root] + 3).min(heat_w as u32 - 1);
        let y2 = (max_y[root] + 3).min(heat_h as u32 - 1);

        boxes.push(DetBox {
            x1: (x1 as f32 * scale_x).round() as u32,
            y1: (y1 as f32 * scale_y).round() as u32,
            x2: (x2 as f32 * scale_x).round() as u32,
            y2: (y2 as f32 * scale_y).round() as u32,
        });
    }

    // Sort top-to-bottom, left-to-right
    boxes.sort_by(|a, b| {
        let row_a = a.y1 / 20; // group lines within 20px
        let row_b = b.y1 / 20;
        row_a.cmp(&row_b).then(a.x1.cmp(&b.x1))
    });

    boxes
}

// ─── Recognition ────────────────────────────────────────────────────────────

/// Fixed height for recognition input.
const REC_HEIGHT: u32 = 48;
/// Maximum width for recognition input.
const REC_MAX_WIDTH: u32 = 320;

/// Recognition normalization.
const REC_MEAN: [f32; 3] = [0.5, 0.5, 0.5];
const REC_STD: [f32; 3] = [0.5, 0.5, 0.5];

/// Preprocess a cropped text region for recognition.
fn rec_preprocess(
    img: &mut image::DynamicImage,
    crop_x1: u32,
    crop_y1: u32,
    crop_x2: u32,
    crop_y2: u32,
) -> Result<(ndarray::Array4<f32>, u32), String> {
    let crop_w = crop_x2.saturating_sub(crop_x1).max(1);
    let crop_h = crop_y2.saturating_sub(crop_y1).max(1);

    // Resize to REC_HEIGHT, maintaining aspect ratio
    let new_w = ((crop_w as f32 * REC_HEIGHT as f32 / crop_h as f32).round() as u32)
        .max(1)
        .min(REC_MAX_WIDTH);

    let cropped = img.crop(crop_x1, crop_y1, crop_w, crop_h);
    let resized = cropped.resize_exact(new_w, REC_HEIGHT, image::imageops::FilterType::Triangle);
    let rgb = resized.to_rgb8();

    // Pad to REC_MAX_WIDTH
    let mut arr = Array4::<f32>::zeros((1, 3, REC_HEIGHT as usize, REC_MAX_WIDTH as usize));
    for (x, y, pixel) in rgb.enumerate_pixels() {
        let nx = x as usize;
        let ny = y as usize;
        for c in 0..3 {
            let v = pixel[c] as f32 / 255.0;
            arr[[0, c, ny, nx]] = (v - REC_MEAN[c]) / REC_STD[c];
        }
    }

    Ok((arr, new_w))
}

/// CTC greedy decode: argmax → collapse repeats → remove blanks → map to chars.
fn ctc_decode(logits: &[f32], num_classes: usize, timesteps: usize, dict: &[String]) -> (String, f32) {
    let mut result = String::new();
    let mut conf_sum: f32 = 0.0;
    let mut conf_count: u32 = 0;
    let mut prev_idx = usize::MAX;

    for t in 0..timesteps {
        let offset = t * num_classes;
        let slice = &logits[offset..offset + num_classes];

        // Argmax
        let (best_idx, best_val) = slice
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or((0, &0.0));

        // Softmax confidence for the best class
        let max_val = *best_val;
        let exp_sum: f32 = slice.iter().map(|v| (v - max_val).exp()).sum();
        let confidence = 1.0 / exp_sum; // simplified softmax confidence

        if best_idx != CTC_BLANK && best_idx != prev_idx {
            if best_idx < dict.len() {
                result.push_str(&dict[best_idx]);
            }
            conf_sum += confidence;
            conf_count += 1;
        }
        prev_idx = best_idx;
    }

    let avg_conf = if conf_count > 0 {
        conf_sum / conf_count as f32
    } else {
        0.0
    };

    (result, avg_conf)
}

// ─── Full Pipeline ──────────────────────────────────────────────────────────

/// Run the full PP-OCRv4 pipeline on an image file.
pub fn recognize(photo_path: &str) -> Result<OcrResult, String> {
    let sessions = get_sessions()?;

    let bytes = std::fs::read(photo_path)
        .map_err(|e| format!("Failed to read image {}: {}", photo_path, e))?;
    let mut img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to decode image {}: {}", photo_path, e))?;
    let (orig_w_f, orig_h_f) = (img.width() as f32, img.height() as f32);

    // ── Detection ────────────────────────────────────────────────────────
    let (det_input, _orig_w, _orig_h, scaled_w, scaled_h) = det_preprocess(&img)?;
    let det_tensor = ort::value::Value::from_array(det_input).map_err(|e| e.to_string())?;

    let det_heatmap = {
        let mut guard = sessions.det.session.lock().unwrap();
        let outputs = guard
            .run(ort::inputs![sessions.det.input_name.as_str() => det_tensor])
            .map_err(|e| format!("Detection inference failed: {}", e))?;

        let (shape, data) = outputs[sessions.det.output_name.as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Detection output decode failed: {}", e))?;

        (shape.to_vec(), data.to_vec())
    };

    let heat_shape = &det_heatmap.0;
    let heat_h = if heat_shape.len() >= 3 {
        heat_shape[heat_shape.len() - 2] as usize
    } else {
        scaled_h as usize
    };
    let heat_w = if heat_shape.len() >= 2 {
        heat_shape[heat_shape.len() - 1] as usize
    } else {
        scaled_w as usize
    };

    let boxes = det_postprocess(&det_heatmap.1, heat_h, heat_w, orig_w_f, orig_h_f, scaled_w, scaled_h);

    if boxes.is_empty() {
        return Ok(OcrResult {
            full_text: String::new(),
            lines: Vec::new(),
        });
    }

    // ── Recognition per region ───────────────────────────────────────────
    let mut lines = Vec::new();

    for det_box in &boxes {
        let (rec_input, _actual_width) =
            rec_preprocess(&mut img, det_box.x1, det_box.y1, det_box.x2, det_box.y2)?;

        let rec_tensor =
            ort::value::Value::from_array(rec_input).map_err(|e| e.to_string())?;

        let rec_output = {
            let mut guard = sessions.rec.session.lock().unwrap();
            let outputs = guard
                .run(ort::inputs![sessions.rec.input_name.as_str() => rec_tensor])
                .map_err(|e| format!("Recognition inference failed: {}", e))?;

            let (shape, data) = outputs[sessions.rec.output_name.as_str()]
                .try_extract_tensor::<f32>()
                .map_err(|e| format!("Recognition output decode failed: {}", e))?;

            (shape.to_vec(), data.to_vec())
        };

        let rec_shape = &rec_output.0;
        let num_classes = if rec_shape.len() >= 3 {
            rec_shape[rec_shape.len() - 1] as usize
        } else {
            sessions.dict.len()
        };
        let timesteps = if rec_shape.len() >= 2 {
            rec_shape[1] as usize
        } else {
            1
        };

        let (text, confidence) = ctc_decode(&rec_output.1, num_classes, timesteps, &sessions.dict);

        if text.trim().is_empty() {
            continue;
        }

        // Normalized bounding box coordinates [0, 1]
        let nx1 = det_box.x1 as f32 / orig_w_f;
        let ny1 = det_box.y1 as f32 / orig_h_f;
        let nx2 = det_box.x2 as f32 / orig_w_f;
        let ny2 = det_box.y2 as f32 / orig_h_f;

        lines.push(OcrBbox {
            text,
            bbox: [[nx1, ny1], [nx2, ny1], [nx2, ny2], [nx1, ny2]],
            confidence,
        });
    }

    let full_text = lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join("\n");

    info!(
        "[OcrEngine] Extracted {} lines from {} ({}x{})",
        lines.len(),
        photo_path,
        orig_w_f as u32,
        orig_h_f as u32
    );

    Ok(OcrResult { full_text, lines })
}

/// Check whether the OCR models are available on disk.
pub fn is_available() -> bool {
    let det = DET_MODEL_PATHS.iter().any(|p| Path::new(p).exists());
    let rec = REC_MODEL_PATHS.iter().any(|p| Path::new(p).exists());
    det && rec
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ocr_on_sample_image() {
        if is_available() {
            let dir = std::env::temp_dir().join("prism_ocr_test");
            std::fs::create_dir_all(&dir).unwrap();
            let photo_path = dir.join("test_ocr.png");

            let img = image::RgbImage::new(256, 256);
            img.save(&photo_path).unwrap();

            let res = recognize(photo_path.to_str().unwrap());
            assert!(res.is_ok(), "OCR extract failed: {:?}", res.err());
            eprintln!("[test] OCR extract OK");
        } else {
            eprintln!("skip: ocr models not downloaded");
        }
    }
}
