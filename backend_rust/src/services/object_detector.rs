use image::DynamicImage;
use ndarray::Array4;
use ort::session::Session;
use ort::value::Value;
use std::sync::{Arc, Mutex, OnceLock};

pub struct ObjectDetector {
    session: Mutex<Session>,
    input_name: String,
    output_name: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Detection {
    pub label: String,
    pub confidence: f32,
    pub bbox: [f32; 4], // [x1, y1, x2, y2]
}

static DETECTOR: OnceLock<Arc<ObjectDetector>> = OnceLock::new();

pub fn get_detector() -> Result<Arc<ObjectDetector>, String> {
    if let Some(detector) = DETECTOR.get() {
        return Ok(detector.clone());
    }

    let candidates = [
        "models/objects/yolov8n.onnx",
        "models/detection/yolov8n.onnx",
        "../models/objects/yolov8n.onnx",
        "../models/detection/yolov8n.onnx",
    ];
    let model_path = candidates
        .iter()
        .find(|p| std::path::Path::new(p).exists())
        .copied()
        .unwrap_or("models/objects/yolov8n.onnx");
    
    let session = crate::services::onnx_helper::build_session(model_path, "YOLOv8")
        .map_err(|e| format!("Failed to load YOLO model from {}: {}", model_path, e))?;

    let input_name = session
        .inputs()
        .first()
        .map(|i| i.name().to_string())
        .unwrap_or_else(|| "images".to_string());
    let output_name = session
        .outputs()
        .first()
        .map(|o| o.name().to_string())
        .unwrap_or_else(|| "output0".to_string());

    let detector = Arc::new(ObjectDetector {
        session: Mutex::new(session),
        input_name,
        output_name,
    });

    let _ = DETECTOR.set(detector.clone());
    Ok(detector)
}

const COCO_CLASSES: [&str; 80] = [
    "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
    "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
    "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
    "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
    "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
    "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
    "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
    "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush",
];

impl ObjectDetector {
    pub fn detect(&self, image: &DynamicImage) -> Result<Vec<Detection>, String> {
        let orig_width = image.width() as f32;
        let orig_height = image.height() as f32;
        
        // YOLOv8 expects 640x640
        let resized = image.resize_exact(640, 640, image::imageops::FilterType::Triangle);
        let rgb = resized.to_rgb8();

        let mut input_array = Array4::<f32>::zeros((1, 3, 640, 640));
        for (x, y, pixel) in rgb.enumerate_pixels() {
            input_array[[0, 0, y as usize, x as usize]] = pixel[0] as f32 / 255.0;
            input_array[[0, 1, y as usize, x as usize]] = pixel[1] as f32 / 255.0;
            input_array[[0, 2, y as usize, x as usize]] = pixel[2] as f32 / 255.0;
        }

        let tensor = Value::from_array(input_array).map_err(|e| e.to_string())?;
        
        let mut guard = self.session.lock().unwrap();
        let inputs = ort::inputs![self.input_name.as_str() => tensor];
        
        let outputs = guard.run(inputs).map_err(|e| e.to_string())?;
        
        let (shape, data) = outputs[self.output_name.as_str()].try_extract_tensor::<f32>().map_err(|e| e.to_string())?;
        
        let num_boxes = shape[2] as usize;
        let num_classes = (shape[1] - 4) as usize;
        
        let mut detections = Vec::new();
        
        let flat_data: Vec<f32> = data.iter().copied().collect();
        
        for i in 0..num_boxes {
            let mut max_class_score = 0.0_f32;
            let mut class_id: usize = 0;
            
            for c in 0..num_classes {
                let score = flat_data[0 * (84 * 8400) + (c + 4) * 8400 + i];
                if score > max_class_score {
                    max_class_score = score;
                    class_id = c;
                }
            }
            
            if max_class_score > 0.25 {
                let cx = flat_data[0 * (84 * 8400) + 0 * 8400 + i];
                let cy = flat_data[0 * (84 * 8400) + 1 * 8400 + i];
                let w = flat_data[0 * (84 * 8400) + 2 * 8400 + i];
                let h = flat_data[0 * (84 * 8400) + 3 * 8400 + i];
                
                let x1 = (cx - w / 2.0) / 640.0 * orig_width;
                let y1 = (cy - h / 2.0) / 640.0 * orig_height;
                let x2 = (cx + w / 2.0) / 640.0 * orig_width;
                let y2 = (cy + h / 2.0) / 640.0 * orig_height;
                
                detections.push(Detection {
                    label: COCO_CLASSES[class_id].to_string(),
                    confidence: max_class_score,
                    bbox: [x1.max(0.0), y1.max(0.0), x2.min(orig_width), y2.min(orig_height)],
                });
            }
        }
        
        // NMS
        let mut nms_detections = Vec::new();
        detections.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap_or(std::cmp::Ordering::Equal));
        
        let mut active = vec![true; detections.len()];
        for i in 0..detections.len() {
            if !active[i] { continue; }
            nms_detections.push(detections[i].clone());
            
            for j in (i + 1)..detections.len() {
                if !active[j] || detections[i].label != detections[j].label { continue; }
                
                let iou = bbox_iou(&detections[i].bbox, &detections[j].bbox);
                if iou > 0.45 {
                    active[j] = false;
                }
            }
        }
        
        Ok(nms_detections)
    }
}

fn bbox_iou(box1: &[f32; 4], box2: &[f32; 4]) -> f32 {
    let x1 = box1[0].max(box2[0]);
    let y1 = box1[1].max(box2[1]);
    let x2 = box1[2].min(box2[2]);
    let y2 = box1[3].min(box2[3]);
    
    let intersection = (x2 - x1).max(0.0) * (y2 - y1).max(0.0);
    let area1 = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    let area2 = (box2[2] - box2[0]) * (box2[3] - box2[1]);
    
    let union = area1 + area2 - intersection;
    if union <= 0.0 { 0.0 } else { intersection / union }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn object_detector_on_sample_image() {
        let detector_res = get_detector();
        if let Ok(detector) = detector_res {
            let img = DynamicImage::ImageRgb8(image::RgbImage::new(640, 640));
            let det_res = detector.detect(&img);
            assert!(det_res.is_ok(), "YOLO detection failed: {:?}", det_res.err());
            eprintln!("[test] YOLOv8 detection OK");
        } else {
            eprintln!("skip: yolov8 model not present");
        }
    }
}
