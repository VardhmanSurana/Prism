use std::sync::{Arc, OnceLock};
use ort::session::Session;
use ort::session::builder::GraphOptimizationLevel;
use ort::value::Value;
use tokenizers::Tokenizer;
use image::imageops::FilterType;
use tracing::info;

pub struct SiglipEngine {
    vision_session: std::sync::Mutex<Session>,
    text_session: std::sync::Mutex<Session>,
    tokenizer: Tokenizer,
}

static ENGINE: OnceLock<Arc<SiglipEngine>> = OnceLock::new();

pub fn get_engine() -> Result<Arc<SiglipEngine>, String> {
    if let Some(engine) = ENGINE.get() {
        return Ok(engine.clone());
    }

    info!("[SiglipEngine] Initializing in-process Siglip inference engine...");

    let models_dir = std::path::Path::new("models/llm");
    let vision_model_path = models_dir.join("siglip2_image.onnx");
    let text_model_path = models_dir.join("siglip2_text.onnx");
    let tokenizer_path = models_dir.join("tokenizer.json");

    if !vision_model_path.exists() || !text_model_path.exists() || !tokenizer_path.exists() {
        return Err("SigLIP models or tokenizer not found. Ensure siglip2_image.onnx, siglip2_text.onnx, and tokenizer.json are in models/llm.".into());
    }

    let vision_session = Session::builder()
        .map_err(|e| format!("Failed to build ONNX session: {}", e))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| format!("Failed to set opt level: {}", e))?
        .commit_from_file(&vision_model_path)
        .map_err(|e| format!("Failed to load vision model: {}", e))?;

    let text_session = Session::builder()
        .map_err(|e| format!("Failed to build ONNX session: {}", e))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| format!("Failed to set opt level: {}", e))?
        .commit_from_file(&text_model_path)
        .map_err(|e| format!("Failed to load text model: {}", e))?;

    let tokenizer = Tokenizer::from_file(&tokenizer_path)
        .map_err(|e| format!("Failed to load tokenizer: {}", e))?;

    let engine = Arc::new(SiglipEngine {
        vision_session: std::sync::Mutex::new(vision_session),
        text_session: std::sync::Mutex::new(text_session),
        tokenizer,
    });

    info!("[SiglipEngine] Siglip analyzer ready");
    Ok(ENGINE.get_or_init(|| engine).clone())
}

impl SiglipEngine {
    /// Generate 768-dimensional L2-normalized image embeddings
    pub fn embed_image(&self, photo_path: &str) -> Result<Vec<f32>, String> {
        let bytes = std::fs::read(photo_path)
            .map_err(|e| format!("Failed to read {}: {}", photo_path, e))?;
        let format = image::guess_format(&bytes)
            .map_err(|e| format!("Unsupported image format for {}: {}", photo_path, e))?;
        let img = image::load_from_memory_with_format(&bytes, format)
            .map_err(|e| format!("Failed to decode {}: {}", photo_path, e))?;
        
        let resized = img.resize_exact(224, 224, FilterType::Triangle).to_rgb8();
        let mut pixel_values = vec![0.0f32; 1 * 3 * 224 * 224];
        
        // Channel-first (NCHW): Batch = 0, C = 0..3, H = y, W = x
        for y in 0..224 {
            for x in 0..224 {
                let p = resized.get_pixel(x as u32, y as u32);
                let idx = y * 224 + x;
                pixel_values[0 * 224 * 224 + idx] = (p[0] as f32 / 255.0 - 0.5) / 0.5;
                pixel_values[1 * 224 * 224 + idx] = (p[1] as f32 / 255.0 - 0.5) / 0.5;
                pixel_values[2 * 224 * 224 + idx] = (p[2] as f32 / 255.0 - 0.5) / 0.5;
            }
        }

        let pixel_values_tensor = Value::from_array(([1, 3, 224, 224], pixel_values))
            .map_err(|e| format!("Failed to convert array to Value: {}", e))?;
        let inputs = ort::inputs!["pixel_values" => pixel_values_tensor];
        
        let mut session_guard = self.vision_session.lock()
            .map_err(|_| "Failed to lock vision session Mutex".to_string())?;
        let outputs = session_guard.run(inputs)
            .map_err(|e| format!("Vision ONNX inference failed: {}", e))?;
        
        let output = outputs["image_features"]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract tensor: {}", e))?;
        
        let mut embedding: Vec<f32> = output.1.to_vec();
        l2_normalize(&mut embedding);
        
        Ok(embedding)
    }

    /// Generate 768-dimensional L2-normalized text embeddings
    pub fn embed_text(&self, text: &str) -> Result<Vec<f32>, String> {
        let encoding = self.tokenizer.encode(text, true)
            .map_err(|e| format!("Failed to tokenize text: {}", e))?;
        
        let ids = encoding.get_ids();
        let input_ids: Vec<i64> = ids.iter().map(|&x| x as i64).collect();
        
        let seq_len = input_ids.len();
        let input_ids_tensor = Value::from_array(([1, seq_len], input_ids))
            .map_err(|e| format!("Failed to convert array to Value: {}", e))?;
        let inputs = ort::inputs!["input_ids" => input_ids_tensor];
        
        let mut session_guard = self.text_session.lock()
            .map_err(|_| "Failed to lock text session Mutex".to_string())?;
        let outputs = session_guard.run(inputs)
            .map_err(|e| format!("Text ONNX inference failed: {}", e))?;
        
        let output = outputs["text_features"]
            .try_extract_tensor::<f32>()
            .map_err(|e| format!("Failed to extract tensor: {}", e))?;
        
        let mut embedding: Vec<f32> = output.1.to_vec();
        l2_normalize(&mut embedding);
        
        Ok(embedding)
    }
}

fn l2_normalize(vec: &mut [f32]) {
    let sum_sq: f32 = vec.iter().map(|&x| x * x).sum();
    let norm = sum_sq.sqrt().max(1e-12);
    for x in vec.iter_mut() {
        *x /= norm;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siglip_embeddings() {
        let engine = get_engine().expect("Failed to get SigLIP engine");
        
        let text_emb = engine.embed_text("a dog in the forest").expect("Failed to embed text");
        assert_eq!(text_emb.len(), 768);
        
        let norm: f32 = text_emb.iter().map(|&x| x * x).sum::<f32>().sqrt();
        assert!((norm - 1.0).abs() < 1e-5, "Text embedding is not L2-normalized: {}", norm);

        let image_path = "../sample_images/pet.png";
        let img_emb = engine.embed_image(image_path).expect("Failed to embed image");
        assert_eq!(img_emb.len(), 768);
        
        let img_norm: f32 = img_emb.iter().map(|&x| x * x).sum::<f32>().sqrt();
        assert!((img_norm - 1.0).abs() < 1e-5, "Image embedding is not L2-normalized: {}", img_norm);

        let similarity: f32 = text_emb.iter().zip(img_emb.iter()).map(|(a, b)| a * b).sum();
        println!("Test similarity: {:.4}", similarity);
        assert!(similarity > 0.0, "Similarity should be positive");
    }
}
