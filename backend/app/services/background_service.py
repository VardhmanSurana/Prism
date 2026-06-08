import os
import cv2
import numpy as np
import onnxruntime as ort
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class BackgroundService:
    def __init__(self):
        self.model_path = os.path.join(settings.BASE_DIR, "models", "u2netp.onnx")
        self.session = None
        self.input_size = (320, 320)

    def _load_model(self):
        if self.session is None:
            if not os.path.exists(self.model_path):
                logger.error(f"Background model not found at {self.model_path}")
                return False
            try:
                self.session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
                return True
            except Exception as e:
                logger.error(f"Failed to load background model: {e}")
                return False
        return True

    def _preprocess(self, img):
        # Normalize and resize
        img_resized = cv2.resize(img, self.input_size, interpolation=cv2.INTER_LINEAR)
        img_data = img_resized.astype(np.float32) / 255.0
        
        # HWC to CHW
        img_data = img_data.transpose(2, 0, 1)
        # Add batch dimension
        img_data = np.expand_dims(img_data, axis=0)
        
        # Normalize with ImageNet stats (U2Net standard)
        mean = np.array([0.485, 0.456, 0.406]).reshape(1, 3, 1, 1)
        std = np.array([0.229, 0.224, 0.225]).reshape(1, 3, 1, 1)
        img_data = (img_data - mean) / std
        
        return img_data.astype(np.float32)

    def get_background_mask(self, img):
        """
        Generates a background mask (White = Background, Black = Subject).
        """
        if not self._load_model():
            return None

        h, w = img.shape[:2]
        
        # Preprocess
        input_tensor = self._preprocess(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        
        # Run inference
        outputs = self.session.run(None, {self.session.get_inputs()[0].name: input_tensor})
        
        # Process output (sigmoid + normalization)
        mask = outputs[0][0][0] # Get first mask from output
        
        # Apply sigmoid to map raw logits to probabilities [0, 1]
        mask = 1.0 / (1.0 + np.exp(-mask))
        
        mask_min = mask.min()
        mask_max = mask.max()
        mask_range = mask_max - mask_min
        if mask_range <= 0:
            # Degenerate output: model produced a flat mask. Fall back to a
            # fully-white background mask so the caller gets a valid image
            # rather than NaNs propagating through resize.
            logger.warning("U2Net produced a flat mask (min == max). Returning degenerate background mask.")
            return np.full((h, w), 255, dtype=np.uint8)
        mask = (mask - mask_min) / mask_range

        # Convert to 0-255 and resize back to original
        mask = (mask * 255).astype(np.uint8)
        mask = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)
        
        # U2Net outputs White for Foreground. We want White for Background.
        # Invert the mask
        background_mask = cv2.bitwise_not(mask)
        
        return background_mask

background_service = BackgroundService()
