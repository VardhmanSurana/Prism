//! Florence-2 vision-language model — captioning, object detection, and phrase grounding.
//!
//! Pipeline: vision_encoder → embed_tokens → encoder → decoder (autoregressive).
//! Uses 4 ONNX sessions + Rust tokenizers for the BART tokenizer.
//!
//! Model: onnx-community/Florence-2-base-ft (MIT license).
//! Tasks: `<CAPTION>`, `<DETAILED_CAPTION>`, `<MORE_DETAILED_CAPTION>`, `<OD>`, `<CAPTION_TO_PHRASE_GROUNDING>`.

use ndarray::s;
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::DynTensor;
use serde_json::Value;
use std::path::Path;
use std::sync::{Arc, Mutex, OnceLock};
use tokenizers::Tokenizer;
use tracing::{info, warn};

// ─────────────────────────── Model paths ─────────────────────────────────

const VISION_ENCODER_PATHS: &[&str] = &[
    "models/florence2/vision_encoder_q4f16.onnx",
    "../models/florence2/vision_encoder_q4f16.onnx",
];
const EMBED_TOKENS_PATHS: &[&str] = &[
    "models/florence2/embed_tokens_q4f16.onnx",
    "../models/florence2/embed_tokens_q4f16.onnx",
];
const ENCODER_PATHS: &[&str] = &[
    "models/florence2/encoder_model_q4f16.onnx",
    "../models/florence2/encoder_model_q4f16.onnx",
];
const DECODER_PATHS: &[&str] = &[
    "models/florence2/decoder_model_merged.onnx",
    "../models/florence2/decoder_model_merged.onnx",
];
const TOKENIZER_PATHS: &[&str] = &[
    "models/florence2/tokenizer/tokenizer.json",
    "../models/florence2/tokenizer/tokenizer.json",
];

// Florence-2 image preprocessing (from preprocessor_config.json — CLIPImageProcessor)
const IMG_SIZE: u32 = 768;
const IMG_MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const IMG_STD: [f32; 3] = [0.229, 0.224, 0.225];

// Florence-2-base: 6 layers, 12 heads
const EOS_TOKEN_ID: i64 = 2;
const MAX_NEW_TOKENS: usize = 128;

// ─────────────────────────── Session cache ───────────────────────────────

struct CachedSession {
    session: Mutex<Session>,
    input_names: Vec<String>,
    output_names: Vec<String>,
}

fn load_cached_session(paths: &[&str], tag: &str) -> Result<Arc<CachedSession>, String> {
    static CACHE: OnceLock<Mutex<std::collections::HashMap<String, Option<Arc<CachedSession>>>>> =
        OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(std::collections::HashMap::new()));
    if let Some(cached) = cache.lock().unwrap().get(tag) {
        return cached.clone().ok_or_else(|| {
            format!("{} model failed to load previously; see earlier log", tag)
        });
    }

    let found = paths.iter().find(|p| Path::new(p).exists()).copied();
    let loaded = match found {
        Some(path) => {
            match Session::builder()
                .map_err(|e| e.to_string())?
                .with_optimization_level(GraphOptimizationLevel::Level3)
                .map_err(|e| e.to_string())?
                .commit_from_file(path)
            {
                Ok(session) => {
                    let input_names: Vec<String> =
                        session.inputs().iter().map(|i| i.name().to_string()).collect();
                    let output_names: Vec<String> =
                        session.outputs().iter().map(|o| o.name().to_string()).collect();
                    info!(
                        "[Florence2] {} loaded from {} ({} inputs, {} outputs)",
                        tag, path, input_names.len(), output_names.len()
                    );
                    Some(Arc::new(CachedSession {
                        session: Mutex::new(session),
                        input_names,
                        output_names,
                    }))
                }
                Err(e) => {
                    warn!("[Florence2] Failed to load {} from {}: {}", tag, path, e);
                    None
                }
            }
        }
        None => None,
    };
    cache
        .lock()
        .unwrap()
        .insert(tag.to_string(), loaded.clone());
    loaded.ok_or_else(|| {
        format!(
            "{} unavailable: download the Florence-2 model first (Model Manager). Expected at {}",
            tag, paths[0]
        )
    })
}

// ─────────────────────────── Tokenizer ───────────────────────────────────

fn load_tokenizer() -> Result<Tokenizer, String> {
    static TOKENIZER: OnceLock<Option<Tokenizer>> = OnceLock::new();
    if let Some(ref tok) = *TOKENIZER.get_or_init(|| {
        let path = TOKENIZER_PATHS
            .iter()
            .find(|p| Path::new(p).exists())
            .copied()?;
        match Tokenizer::from_file(path) {
            Ok(tok) => {
                info!("[Florence2] Tokenizer loaded from {}", path);
                Some(tok)
            }
            Err(e) => {
                warn!("[Florence2] Failed to load tokenizer from {}: {}", path, e);
                None
            }
        }
    }) {
        Ok(tok.clone())
    } else {
        Err("Tokenizer unavailable: download the Florence-2 model first".to_string())
    }
}

// ─────────────────────────── Image preprocessing ─────────────────────────

/// Resize + normalize image to Florence-2 input tensor [1, 3, 768, 768] f32.
fn preprocess_image(photo_path: &str) -> Result<ndarray::Array4<f32>, String> {
    let bytes = std::fs::read(photo_path)
        .map_err(|e| format!("Failed to read image {}: {}", photo_path, e))?;
    let img = image::load_from_memory(&bytes)
        .map_err(|e| format!("Failed to decode image {}: {}", photo_path, e))?;
    let resized =
        img.resize_exact(IMG_SIZE, IMG_SIZE, image::imageops::FilterType::Triangle);
    let rgb = resized.to_rgb8();

    let mut arr = ndarray::Array4::<f32>::zeros((1, 3, IMG_SIZE as usize, IMG_SIZE as usize));
    for (x, y, p) in rgb.enumerate_pixels() {
        for c in 0..3 {
            let val = p[c] as f32 / 255.0;
            arr[[0, c, y as usize, x as usize]] = (val - IMG_MEAN[c]) / IMG_STD[c];
        }
    }
    Ok(arr)
}

// ─────────────────────────── Captioning pipeline ─────────────────────────

/// Run the full Florence-2 captioning pipeline for a photo.
fn caption_inner(photo_path: &str, task: &str) -> Result<String, String> {
    let sess_enc = load_cached_session(VISION_ENCODER_PATHS, "Florence2-VisionEncoder")?;
    let sess_embed = load_cached_session(EMBED_TOKENS_PATHS, "Florence2-EmbedTokens")?;
    let sess_encoder = load_cached_session(ENCODER_PATHS, "Florence2-Encoder")?;
    let sess_decoder = load_cached_session(DECODER_PATHS, "Florence2-Decoder")?;
    let tokenizer = load_tokenizer()?;

    // 1. Preprocess image → [1, 3, 768, 768]
    let pixel_values = preprocess_image(photo_path)?;
    let pixel_tensor =
        ort::value::Value::from_array(pixel_values).map_err(|e| format!("pixel_values: {}", e))?;

    // 2. Vision encoder → image_features [1, N_img, 768]
    let enc_in = &sess_enc.input_names[0];
    let enc_out = &sess_enc.output_names[0];
    let image_features = {
        let mut guard = sess_enc.session.lock().unwrap();
        let outputs = guard
            .run(ort::inputs![enc_in.as_str() => pixel_tensor])
            .map_err(|e| format!("Vision encoder: {}", e))?;
        let (shape, data) = outputs[enc_out.as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Vision encoder output: {}", e))?;
        let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
        ndarray::Array::from_shape_vec(dims, data.to_vec())
            .map_err(|e| format!("Vision encoder reshape: {}", e))?
    };
    let n_img = image_features.shape()[1];
    info!("[Florence2] Image features: [1, {}, 768]", n_img);

    // 3. Tokenize task prefix
    let encoding = tokenizer
        .encode(task, true)
        .map_err(|e| format!("Tokenize: {}", e))?;
    let input_ids: Vec<i64> = encoding.get_ids().iter().map(|&id| id as i64).collect();
    let n_txt = input_ids.len();
    info!("[Florence2] Task tokens: {:?} (len={})", input_ids, n_txt);

    let ids_array =
        ndarray::Array2::from_shape_vec((1, n_txt), input_ids).map_err(|e| format!("ids: {}", e))?;
    let ids_tensor =
        ort::value::Value::from_array(ids_array).map_err(|e| format!("input_ids: {}", e))?;

    // 4. Embed tokens → text_embeds [1, N_txt, 768]
    let emb_in = &sess_embed.input_names[0];
    let emb_out = &sess_embed.output_names[0];
    let text_embeds = {
        let mut guard = sess_embed.session.lock().unwrap();
        let outputs = guard
            .run(ort::inputs![emb_in.as_str() => ids_tensor])
            .map_err(|e| format!("Embed tokens: {}", e))?;
        let (shape, data) = outputs[emb_out.as_str()]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Embed tokens output: {}", e))?;
        let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
        ndarray::Array::from_shape_vec(dims, data.to_vec())
            .map_err(|e| format!("Embed tokens reshape: {}", e))?
    };

    // 5. Concatenate: [image_features, text_embeds] along seq dim
    let seq_len = n_img + n_txt;
    let mut combined_embeds = ndarray::Array3::<f32>::zeros((1, seq_len, 768));
    combined_embeds
        .slice_mut(s![.., ..n_img, ..])
        .assign(&image_features);
    combined_embeds
        .slice_mut(s![.., n_img.., ..])
        .assign(&text_embeds);

    // 6. Attention mask: all ones
    let attention_mask = ndarray::Array2::<i64>::from_elem((1, seq_len), 1);

    // 7. Encoder: combined_embeds + attention_mask → encoder_hidden_states
    let enc_embed_tensor =
        ort::value::Value::from_array(combined_embeds.clone()).map_err(|e| e.to_string())?;
    let enc_mask_tensor =
        ort::value::Value::from_array(attention_mask.clone()).map_err(|e| e.to_string())?;
    let encoder_hidden_states = {
        let mut guard = sess_encoder.session.lock().unwrap();
        let outputs = guard
            .run(ort::inputs![
                "inputs_embeds" => enc_embed_tensor,
                "attention_mask" => enc_mask_tensor,
            ])
            .map_err(|e| format!("Encoder: {}", e))?;
        let (shape, data) = outputs["last_hidden_state"]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Encoder output: {}", e))?;
        let dims: Vec<usize> = shape.iter().map(|&d| d as usize).collect();
        ndarray::Array::from_shape_vec(dims, data.to_vec())
            .map_err(|e| format!("Encoder reshape: {}", e))?
    };
    info!("[Florence2] Encoder hidden: {:?}", encoder_hidden_states.shape());

    // 8. Decoder prefill: last token only, use_cache_branch=false
    let _dec_prefill_embed = combined_embeds
        .slice(s![.., seq_len - 1..seq_len, ..])
        .to_owned();

    let mut logits: ndarray::ArrayD<f32>;
    // Present KV: decoder self-attn KV for each layer (not encoder cross-attn — those don't change)
    let mut present_dec_kv: Vec<(String, ndarray::ArrayD<f32>)> = Vec::new();    {
        let prefill_last_token = combined_embeds.slice(s![.., seq_len - 1..seq_len, ..]).to_owned();
        let prefill_past_zero = ndarray::Array4::<f32>::zeros((1, 12, 0, 64));

        // Build decoder inputs as HashMap<String, DynTensor>
        let mut dec_inputs: std::collections::HashMap<String, DynTensor> = std::collections::HashMap::new();
        for name in &sess_decoder.input_names {
            match name.as_str() {
                "encoder_attention_mask" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(attention_mask.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "encoder_hidden_states" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(encoder_hidden_states.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "inputs_embeds" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(prefill_last_token.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "use_cache_branch" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(ndarray::Array1::<bool>::from_vec(vec![false])).map_err(|e| e.to_string())?.upcast());
                }
                n if n.starts_with("past_key_values.") => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(prefill_past_zero.clone()).map_err(|e| e.to_string())?.upcast());
                }
                _ => {}
            }
        }

        // Extract everything from outputs while guard is alive
        {
            let mut guard = sess_decoder.session.lock().unwrap();
            let outputs = guard
                .run(dec_inputs)
                .map_err(|e| format!("Decoder prefill: {}", e))?;

            let val = outputs["logits"].try_extract_tensor::<f32>()
                .map_err(|e| e.to_string())?;
            let (ls, ld) = val;
            let dims: Vec<usize> = ls.iter().map(|&d| d as usize).collect();
            logits = ndarray::Array::from_shape_vec(dims, ld.to_vec())
                .map_err(|e| e.to_string())?;

            for name in &sess_decoder.output_names {
                if name.starts_with("present.") && name.contains(".decoder.") {
                    if let Some(val) = outputs.get(name.as_str()) {
                        if let Ok((s, d)) = val.try_extract_tensor::<f32>() {
                            let dims: Vec<usize> = s.iter().map(|&d| d as usize).collect();
                            if let Ok(arr) = ndarray::Array::from_shape_vec(dims, d.to_vec()) {
                                present_dec_kv.push((name.clone(), arr));
                            }
                        }
                    }
                }
            }
        } // guard dropped here
    }

    // 9. Autoregressive decode loop
    let mut generated_tokens: Vec<i64> = Vec::new();

    for step in 0..MAX_NEW_TOKENS {
        let seq_len_logits = logits.shape()[1];
        let next_logits = logits
            .slice(s![.., seq_len_logits - 1, ..])
            .to_owned();
        let next_token = next_logits
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .map(|(i, _)| i as i64)
            .unwrap_or(EOS_TOKEN_ID);

        if next_token == EOS_TOKEN_ID {
            break;
        }
        generated_tokens.push(next_token);

        // Embed next token → [1, 1, 768]
        let next_ids_tensor = {
            let arr = ndarray::Array2::from_shape_vec((1, 1), vec![next_token])
                .map_err(|e| e.to_string())?;
            ort::value::Value::from_array(arr).map_err(|e| e.to_string())?
        };
        let next_embed = {
            let mut guard = sess_embed.session.lock().unwrap();
            let outputs = guard
                .run(ort::inputs![emb_in.as_str() => next_ids_tensor])
                .map_err(|e| e.to_string())?;
            let (s, d) = outputs[emb_out.as_str()]
                .try_extract_tensor::<f32>()
                .map_err(|e| e.to_string())?;
            let dims: Vec<usize> = s.iter().map(|&d| d as usize).collect();
            ndarray::Array::from_shape_vec(dims, d.to_vec())
                .map_err(|e| e.to_string())?
        };

        // Run decoder with KV cache (use_cache_branch=true)
        let step_present_zero = ndarray::Array::zeros(ndarray::IxDyn(&[1, 12, seq_len, 64]));
        let mut dec_inputs: std::collections::HashMap<String, DynTensor> = std::collections::HashMap::new();
        for name in &sess_decoder.input_names {
            match name.as_str() {
                "encoder_attention_mask" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(attention_mask.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "encoder_hidden_states" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(encoder_hidden_states.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "inputs_embeds" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(next_embed.clone()).map_err(|e| e.to_string())?.upcast());
                }
                "use_cache_branch" => {
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(ndarray::Array1::<bool>::from_vec(vec![true])).map_err(|e| e.to_string())?.upcast());
                }
                n if n.starts_with("past_key_values.") => {
                    let present_name = n.replace("past_key_values.", "present.");
                    let kv = if let Some((_, kv)) = present_dec_kv.iter().find(|(pn, _)| *pn == present_name) {
                        kv.clone()
                    } else {
                        warn!("[Florence2] Missing KV for {}", n);
                        step_present_zero.clone()
                    };
                    dec_inputs.insert(name.clone(), ort::value::Value::from_array(kv).map_err(|e| e.to_string())?.upcast());
                }
                _ => {}
            }
        }

        // Extract everything from outputs while guard is alive, then drop
        let (new_logits, updates) = {
            let mut guard = sess_decoder.session.lock().unwrap();
            let outputs = guard
                .run(dec_inputs)
                .map_err(|e| format!("Decoder step {}: {}", step, e))?;

            let val = outputs["logits"].try_extract_tensor::<f32>()
                .map_err(|e| e.to_string())?;
            let (ls, ld) = val;
            let dims: Vec<usize> = ls.iter().map(|&d| d as usize).collect();
            let new_logits: ndarray::ArrayD<f32> = ndarray::Array::from_shape_vec(dims, ld.to_vec())
                .map_err(|e| e.to_string())?;

            let mut updates: Vec<(String, ndarray::ArrayD<f32>)> = Vec::new();
            for (pname, _) in &present_dec_kv {
                if let Some(val) = outputs.get(pname.as_str()) {
                    if let Ok((s, d)) = val.try_extract_tensor::<f32>() {
                        let shape: Vec<usize> = s.iter().map(|&d| d as usize).collect();
                        if let Ok(arr) = ndarray::Array::from_shape_vec(shape, d.to_vec()) {
                            updates.push((pname.clone(), arr));
                        }
                    }
                }
            }
            (new_logits, updates)
        }; // guard dropped here

        logits = new_logits;
        for (pname, arr) in updates {
            if let Some(slot) = present_dec_kv.iter_mut().find(|(n, _)| *n == pname) {
                *slot = (pname, arr);
            }
        }
    }

    // 10. Decode tokens to text
    let token_u32: Vec<u32> = generated_tokens.iter().map(|&t| t as u32).collect();
    let text = tokenizer
        .decode(&token_u32, true)
        .map_err(|e| format!("Decode: {}", e))?;

    Ok(text)
}

// ─────────────────────────── Public API ──────────────────────────────────

pub struct Florence2Engine;

pub static FLORENCE2_ENGINE: OnceLock<Florence2Engine> = OnceLock::new();

/// Supported Florence-2 tasks.
#[derive(Debug)]
pub enum Florence2Task {
    Caption,
    DetailedCaption,
    MoreDetailedCaption,
    ObjectDetection,
    PhraseGrounding,
}

impl Florence2Task {
    pub fn as_str(&self) -> &str {
        match self {
            Florence2Task::Caption => "<CAPTION>",
            Florence2Task::DetailedCaption => "<DETAILED_CAPTION>",
            Florence2Task::MoreDetailedCaption => "<MORE_DETAILED_CAPTION>",
            Florence2Task::ObjectDetection => "<OD>",
            Florence2Task::PhraseGrounding => "<CAPTION_TO_PHRASE_GROUNDING>",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "detailed" => Florence2Task::DetailedCaption,
            "more_detailed" => Florence2Task::MoreDetailedCaption,
            "od" | "object_detection" | "detect" => Florence2Task::ObjectDetection,
            "phrase_grounding" | "grounding" => Florence2Task::PhraseGrounding,
            _ => Florence2Task::Caption,
        }
    }

    /// Returns the full task prompt string (with input text for grounding).
    pub fn full_prompt(&self, input_text: Option<&str>) -> String {
        match self {
            Florence2Task::PhraseGrounding => {
                let text = input_text.unwrap_or("");
                format!("Locate the phrases in the caption: {}", text)
            }
            _ => self.as_str().to_string(),
        }
    }
}

impl Florence2Engine {
    pub fn get() -> &'static Self {
        FLORENCE2_ENGINE.get_or_init(|| Florence2Engine)
    }

    /// Async entry point — acquires the global inference slot and runs
    /// the blocking pipeline off the async runtime.
    pub async fn caption_async(
        &self,
        photo_path: &str,
        task: Florence2Task,
    ) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let task_str = task.as_str().to_string();
        let _slot = crate::services::inference_slot::acquire("florence2-caption").await;
        tokio::task::spawn_blocking(move || Florence2Engine::get().caption(&photo, &task_str))
            .await
            .map_err(|e| format!("Florence2 task panicked: {}", e))?
    }

    /// Blocking core. Prefer `caption_async`.
    pub fn caption(&self, photo_path: &str, task: &str) -> Result<Value, String> {
        if !Path::new(photo_path).exists() {
            return Err(format!("Photo file not found: {}", photo_path));
        }

        let t0 = std::time::Instant::now();
        let caption = caption_inner(photo_path, task)?;
        let elapsed = t0.elapsed().as_secs_f32();

        info!(
            "[Florence2] Caption ({}): \"{}\" ({:.1}s)",
            task, caption, elapsed
        );

        Ok(serde_json::json!({
            "success": true,
            "caption": caption,
            "task": task,
            "elapsed_seconds": elapsed,
            "model": "florence-2-base-ft",
        }))
    }

    /// Async entry point for detection/grounding — acquires the global inference
    /// slot and runs the blocking pipeline off the async runtime.
    pub async fn detect_async(
        &self,
        photo_path: &str,
        task: Florence2Task,
        input_text: Option<String>,
    ) -> Result<Value, String> {
        let photo = photo_path.to_string();
        let task_variant = task;
        let input = input_text.unwrap_or_default();
        let _slot = crate::services::inference_slot::acquire("florence2-detect").await;
        tokio::task::spawn_blocking(move || {
            Florence2Engine::get().detect(&photo, &task_variant, if input.is_empty() { None } else { Some(&input) })
        })
        .await
        .map_err(|e| format!("Florence2 detect panicked: {}", e))?
    }

    /// Blocking core for detection/grounding. Prefer `detect_async`.
    pub fn detect(&self, photo_path: &str, task: &Florence2Task, input_text: Option<&str>) -> Result<Value, String> {
        if !Path::new(photo_path).exists() {
            return Err(format!("Photo file not found: {}", photo_path));
        }

        let prompt = task.full_prompt(input_text);
        let t0 = std::time::Instant::now();
        let raw_text = caption_inner(photo_path, &prompt)?;
        let elapsed = t0.elapsed().as_secs_f32();

        // Get original image dimensions for dequantization
        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read image for dimensions: {}", e))?;
        let img = image::load_from_memory(&bytes)
            .map_err(|e| format!("Failed to decode image for dimensions: {}", e))?;
        let img_w = img.width();
        let img_h = img.height();

        let instances = match task {
            Florence2Task::ObjectDetection => {
                parse_description_with_bboxes(&raw_text, img_w, img_h)
            }
            Florence2Task::PhraseGrounding => {
                parse_phrase_grounding(&raw_text, img_w, img_h)
            }
            _ => {
                return Err(format!("Task {:?} is not a detection task", task));
            }
        };

        info!(
            "[Florence2] {} detected {} instances ({:.1}s)",
            task.as_str(), instances.len(), elapsed
        );

        Ok(serde_json::json!({
            "success": true,
            "task": task.as_str(),
            "instances": instances,
            "image_width": img_w,
            "image_height": img_h,
            "elapsed_seconds": elapsed,
            "model": "florence-2-base-ft",
            "raw_text": raw_text,
        }))
    }

    /// Check whether all Florence-2 models are available on disk.
    pub fn is_available(&self) -> bool {
        VISION_ENCODER_PATHS.iter().any(|p| Path::new(p).exists())
            && EMBED_TOKENS_PATHS.iter().any(|p| Path::new(p).exists())
            && ENCODER_PATHS.iter().any(|p| Path::new(p).exists())
            && DECODER_PATHS.iter().any(|p| Path::new(p).exists())
            && TOKENIZER_PATHS.iter().any(|p| Path::new(p).exists())
    }
}

// ─────────────────────────── Tests ───────────────────────────────────────

// ──────────────────── Output post-processing ──────────────────────────

/// Dequantize a single `<loc_N>` value (0–999) back to pixel coordinates.
/// Formula: `(loc_value + 0.5) * (image_size / 1000)`
fn dequantize_loc(loc: i64, image_size: u32) -> f32 {
    (loc as f32 + 0.5) * (image_size as f32 / 1000.0)
}

/// Tokenize raw Florence-2 output into alternating text/loc segments.
/// E.g. `"hello<loc_100><loc_200>world"` → `[Text("hello"), Loc(100), Loc(200), Text("world")]`
#[derive(Debug, PartialEq)]
enum Token {
    Text(String),
    Loc(i64),
}

fn tokenize_raw(text: &str) -> Vec<Token> {
    let text = text
        .replace("<s>", "")
        .replace("</s>", "")
        .replace("<pad>", "")
        .replace("<ground>", "")
        .replace("<obj>", "");
    let loc_re = regex::Regex::new(r"<loc_(\d+)>").unwrap();
    let mut tokens = Vec::new();
    let mut last_end = 0;
    for m in loc_re.find_iter(&text) {
        let start = m.start();
        if start > last_end {
            let segment = &text[last_end..start];
            if !segment.is_empty() {
                tokens.push(Token::Text(segment.to_string()));
            }
        }
        let val: i64 = m.as_str()[5..m.as_str().len()-1].parse().unwrap_or(0);
        tokens.push(Token::Loc(val));
        last_end = m.end();
    }
    if last_end < text.len() {
        let segment = &text[last_end..];
        if !segment.is_empty() {
            tokens.push(Token::Text(segment.to_string()));
        }
    }
    tokens
}

/// Parse `<OD>` output: extracts label + bounding box pairs.
/// Raw text format: `label<loc_X1><loc_Y1><loc_X2><loc_Y2> label2<loc_...>...`
fn parse_description_with_bboxes(raw: &str, img_w: u32, img_h: u32) -> Vec<Value> {
    let tokens = tokenize_raw(raw);
    let mut instances = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        // Find a text token (the label)
        if let Token::Text(ref label) = tokens[i] {
            let label = label.trim();
            if !label.is_empty() {
                // Collect consecutive loc tokens after this text token
                let mut j = i + 1;
                let mut locs = Vec::new();
                while j < tokens.len() {
                    if let Token::Loc(v) = tokens[j] {
                        locs.push(v);
                        j += 1;
                    } else {
                        break;
                    }
                }
                // Group locs into bboxes of 4
                for chunk in locs.chunks(4) {
                    if chunk.len() == 4 {
                        instances.push(serde_json::json!({
                            "label": label.to_string(),
                            "bbox": [
                                dequantize_loc(chunk[0], img_w),
                                dequantize_loc(chunk[1], img_h),
                                dequantize_loc(chunk[2], img_w),
                                dequantize_loc(chunk[3], img_h),
                            ],
                        }));
                    }
                }
                i = j;
                continue;
            }
        }
        i += 1;
    }
    instances
}

/// Parse `<CAPTION_TO_PHRASE_GROUNDING>` output: each phrase maps to one or more bboxes.
/// Same token format as OD, but multiple bboxes per label are grouped.
fn parse_phrase_grounding(raw: &str, img_w: u32, img_h: u32) -> Vec<Value> {
    let tokens = tokenize_raw(raw);
    let mut instances = Vec::new();
    let mut i = 0;
    while i < tokens.len() {
        if let Token::Text(ref label) = tokens[i] {
            let label = label.trim();
            if !label.is_empty() {
                let mut j = i + 1;
                let mut locs = Vec::new();
                while j < tokens.len() {
                    if let Token::Loc(v) = tokens[j] {
                        locs.push(v);
                        j += 1;
                    } else {
                        break;
                    }
                }
                let mut bboxes = Vec::new();
                for chunk in locs.chunks(4) {
                    if chunk.len() == 4 {
                        bboxes.push(serde_json::json!([
                            dequantize_loc(chunk[0], img_w),
                            dequantize_loc(chunk[1], img_h),
                            dequantize_loc(chunk[2], img_w),
                            dequantize_loc(chunk[3], img_h),
                        ]));
                    }
                }
                if !bboxes.is_empty() {
                    instances.push(serde_json::json!({
                        "label": label.to_string(),
                        "bboxes": bboxes,
                    }));
                }
                i = j;
                continue;
            }
        }
        i += 1;
    }
    instances
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_od_output_basic() {
        // Simulated OD output: two objects
        let raw = "cat<loc_100><loc_150><loc_500><loc_600>dog<loc_200><loc_300><loc_800><loc_900>";
        let instances = parse_description_with_bboxes(raw, 1000, 1000);
        assert_eq!(instances.len(), 2);
        assert_eq!(instances[0]["label"], "cat");
        assert_eq!(instances[1]["label"], "dog");
        // bbox should be [x1, y1, x2, y2]
        let bbox0 = instances[0]["bbox"].as_array().unwrap();
        assert!((bbox0[0].as_f64().unwrap() - 100.5).abs() < 1.0);
    }

    #[test]
    fn parse_phrase_grounding_basic() {
        let raw = "a cat<loc_100><loc_150><loc_500><loc_600><loc_200><loc_300><loc_400><loc_500>";
        let instances = parse_phrase_grounding(raw, 1000, 1000);
        assert_eq!(instances.len(), 1);
        assert_eq!(instances[0]["label"], "a cat");
        let bboxes = instances[0]["bboxes"].as_array().unwrap();
        assert_eq!(bboxes.len(), 2); // two bounding boxes for the same phrase
    }

    #[test]
    fn tokenize_raw_basic() {
        let tokens = tokenize_raw("hello<loc_100><loc_200>world");
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0], Token::Text("hello".to_string()));
        assert_eq!(tokens[1], Token::Loc(100));
        assert_eq!(tokens[2], Token::Loc(200));
        assert_eq!(tokens[3], Token::Text("world".to_string()));
    }

    #[test]
    fn dequantize_loc_roundtrip() {
        // 0 → 0.5, 999 → 999.5
        assert!((dequantize_loc(0, 1000) - 0.5).abs() < 0.01);
        assert!((dequantize_loc(999, 1000) - 999.5).abs() < 0.01);
        // For a 640px image: 500 → (500+0.5)*640/1000 = 320.32
        assert!((dequantize_loc(500, 640) - 320.32).abs() < 0.1);
    }

    #[test]
    fn florence2_caption_on_sample_image() {
        if !Florence2Engine::get().is_available() {
            eprintln!("skip: Florence-2 models not downloaded");
            return;
        }

        let dir = std::env::temp_dir().join("prism_florence2_test");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sample_caption.png");

        // Simple gradient image
        let (w, h) = (128u32, 128u32);
        let mut img = image::RgbaImage::new(w, h);
        for (x, y, p) in img.enumerate_pixels_mut() {
            let r = (x as f32 / w as f32 * 255.0) as u8;
            let g = (y as f32 / h as f32 * 255.0) as u8;
            *p = image::Rgba([r, g, 128, 255]);
        }
        image::DynamicImage::ImageRgba8(img)
            .save_with_format(&path, image::ImageFormat::Png)
            .unwrap();

        eprintln!("[test] running Florence-2 caption (CPU, may take a while)...");
        let res = Florence2Engine::get()
            .caption(path.to_str().unwrap(), "<CAPTION>")
            .expect("caption failed");
        assert_eq!(res["success"], true);
        assert!(res["caption"].is_string());
        let caption_text = res["caption"].as_str().unwrap();
        assert!(!caption_text.is_empty());
        eprintln!("caption: \"{}\"", caption_text);
    }
}
