import os
import cv2
import numpy as np
import onnxruntime as ort
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# ADE20K Class IDs
CLASSES = {
    "sky": 2,
    "grass": 9,
    "person": 12,
    "water": 21,
    "mountain": 34,
    "tree": 4
}

class SemanticService:
    def __init__(self):
        self.model_path = os.path.join(settings.BASE_DIR, "models", "semantic.onnx")
        self.session = None
        self.input_size = (512, 512)

    def _load_model(self):
        if self.session is None:
            if not os.path.exists(self.model_path):
                logger.error(f"Semantic model not found at {self.model_path}")
                return False
            try:
                sess_options = ort.SessionOptions()
                sess_options.log_severity_level = 3 # Only Errors
                self.session = ort.InferenceSession(self.model_path, sess_options=sess_options, providers=['CPUExecutionProvider'])
                return True
            except Exception as e:
                logger.error(f"Failed to load semantic model: {e}")
                return False
        return True

    def _preprocess(self, img):
        img_resized = cv2.resize(img, self.input_size, interpolation=cv2.INTER_LINEAR)
        img_data = img_resized.astype(np.float32) / 255.0
        
        # ImageNet normalization - explicitly float32
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)
        img_data = (img_data - mean) / std
        
        img_data = img_data.transpose(2, 0, 1) # HWC to CHW
        img_data = np.expand_dims(img_data, axis=0) # Add batch dim
        return img_data.astype(np.float32)

    def get_semantic_masks(self, img):
        """
        Detects multiple semantic classes and returns masks for found ones.
        """
        if not self._load_model():
            return None

        h, w = img.shape[:2]
        
        # 1. Preprocess
        input_tensor = self._preprocess(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        
        # 2. Run Inference
        outputs = self.session.run(None, {"pixel_values": input_tensor})
        logits = outputs[0]
        
        # 3. Get argmax mask
        # SegFormer-B0 output for ADE20K is 128x128 (1/4 of input size)
        segmentation = np.argmax(logits, axis=1)[0]
        
        found_masks = {}
        
        for name, class_id in CLASSES.items():
            # Create binary mask for this class
            mask = (segmentation == class_id).astype(np.uint8) * 255
            
            # Only include if enough pixels are found (e.g. > 1% of image)
            if np.count_nonzero(mask) > (segmentation.size * 0.005):
                # Resize back to original
                mask_full = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)
                found_masks[name] = mask_full
                
        return found_masks

semantic_service = SemanticService()
