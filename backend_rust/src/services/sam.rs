use image::{DynamicImage, GenericImageView};
use ndarray::{Array, Array4, Axis, IxDyn, s};
use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use ort::value::Value;
use std::sync::{Arc, Mutex, OnceLock};

pub struct SamEngine {
    encoder: Mutex<Session>,
    decoder: Mutex<Session>,
}

static SAM: OnceLock<Arc<SamEngine>> = OnceLock::new();

pub fn get_sam() -> Result<Arc<SamEngine>, String> {
    if let Some(sam) = SAM.get() {
        return Ok(sam.clone());
    }

    let encoder_path = "models/SAM/image_encoder.onnx";
    let decoder_path = "models/SAM/mask_decoder.onnx";

    let encoder = Session::builder()
        .map_err(|e| e.to_string())?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| e.to_string())?
        .commit_from_file(encoder_path)
        .map_err(|e| format!("Failed to load SAM encoder: {}", e))?;

    let decoder = Session::builder()
        .map_err(|e| e.to_string())?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| e.to_string())?
        .commit_from_file(decoder_path)
        .map_err(|e| format!("Failed to load SAM decoder: {}", e))?;

    let sam = Arc::new(SamEngine {
        encoder: Mutex::new(encoder),
        decoder: Mutex::new(decoder),
    });

    let _ = SAM.set(sam.clone());
    Ok(sam)
}

impl SamEngine {
    pub fn segment_point(&self, image: &DynamicImage, x: u32, y: u32) -> Result<Vec<u8>, String> {
        let orig_w = image.width() as f32;
        let orig_h = image.height() as f32;

        let resized = image.resize_exact(1024, 1024, image::imageops::FilterType::Triangle);
        let rgb = resized.to_rgb8();

        let mut input_array = Array4::<f32>::zeros((1, 3, 1024, 1024));
        let mean = [123.675, 116.28, 103.53];
        let std = [58.395, 57.12, 57.375];

        for (px, py, pixel) in rgb.enumerate_pixels() {
            input_array[[0, 0, py as usize, px as usize]] = (pixel[0] as f32 - mean[0]) / std[0];
            input_array[[0, 1, py as usize, px as usize]] = (pixel[1] as f32 - mean[1]) / std[1];
            input_array[[0, 2, py as usize, px as usize]] = (pixel[2] as f32 - mean[2]) / std[2];
        }

        let tensor = Value::from_array(input_array).map_err(|e| e.to_string())?;

        let mut enc_guard = self.encoder.lock().unwrap();
        let enc_inputs = ort::inputs!["pixel_values" => tensor];
        let enc_outputs = enc_guard.run(enc_inputs).map_err(|e| e.to_string())?;

        let (emb_shape, emb_data) = enc_outputs["image_embeddings"].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        
        let mut emb_array = ndarray::Array::from_shape_vec(emb_shape.iter().map(|&x| x as usize).collect::<Vec<usize>>(), emb_data.to_vec()).unwrap();

        // decoder expects image_embeddings, point_coords, point_labels
        let scale_x = 1024.0 / orig_w;
        let scale_y = 1024.0 / orig_h;
        
        let px = x as f32 * scale_x;
        let py = y as f32 * scale_y;
        
        // shape [1, 1, 2]
        let point_coords = ndarray::Array3::<f32>::from_shape_vec((1, 1, 2), vec![px, py]).unwrap();
        let point_labels = ndarray::Array2::<f32>::from_shape_vec((1, 1), vec![1.0]).unwrap();
        
        let emb_tensor = Value::from_array(emb_array).map_err(|e| e.to_string())?;
        let coords_tensor = Value::from_array(point_coords).map_err(|e| e.to_string())?;
        let labels_tensor = Value::from_array(point_labels).map_err(|e| e.to_string())?;
        
        let mut dec_guard = self.decoder.lock().unwrap();
        let dec_inputs = ort::inputs![
            "image_embeddings" => emb_tensor,
            "point_coords" => coords_tensor,
            "point_labels" => labels_tensor
        ];
        
        let dec_outputs = dec_guard.run(dec_inputs).map_err(|e| e.to_string())?;
        
        let (mask_shape, mask_data) = dec_outputs["masks"].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        
        let mut mask_vec = vec![0u8; (1024 * 1024) as usize];
        let h = mask_shape[2] as usize;
        let w = mask_shape[3] as usize;
        
        let flat_data: Vec<f32> = mask_data.iter().copied().collect();
        for i in 0..(h * w) {
            let val = flat_data[i];
            if val > 0.0 {
                mask_vec[i] = 255;
            }
        }
        
        let img = image::GrayImage::from_raw(w as u32, h as u32, mask_vec).unwrap();
        let mut buf = std::io::Cursor::new(Vec::new());
        img.write_to(&mut buf, image::ImageFormat::Png).unwrap();
        Ok(buf.into_inner())
    }
}
