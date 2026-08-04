import os
import cv2
import numpy as np
import onnxruntime as ort
import logging
from app.config import settings

logger = logging.getLogger(__name__)

class PortraitService:
    def __init__(self):
        self.model_path = os.path.join(settings.BASE_DIR, "models", "face", "face_parsing.onnx")
        self.session = None
        self.input_size = (512, 512)
        self.mean = np.array([0.485, 0.456, 0.406]).reshape(1, 1, 3)
        self.std = np.array([0.229, 0.224, 0.225]).reshape(1, 1, 3)

    def _load_model(self):
        if self.session is None:
            if not os.path.exists(self.model_path):
                logger.error(f"Portrait model not found at {self.model_path}")
                return False
            try:
                self.session = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
                return True
            except Exception as e:
                logger.error(f"Failed to load portrait model: {e}")
                return False
        return True

    def _preprocess(self, face_img):
        img = cv2.resize(face_img, self.input_size)
        img = img.astype(np.float32) / 255.0
        img = (img - self.mean) / self.std
        img = img.astype(np.float32) # Ensure float32 after arithmetic
        img = img.transpose(2, 0, 1) # HWC to CHW
        img = np.expand_dims(img, axis=0) # Add batch dim
        return img

    def get_face_masks(self, img, faces):
        """
        Generate masks for different face parts.
        faces: list of (x1, y1, x2, y2)
        """
        if not self._load_model():
            return None

        results = []
        h, w = img.shape[:2]

        for i, (x1, y1, x2, y2) in enumerate(faces):
            # Crop face with some padding
            fw = x2 - x1
            fh = y2 - y1
            padding = 0.3
            px = int(fw * padding)
            py = int(fh * padding)
            
            cx1, cy1 = max(0, x1 - px), max(0, y1 - py)
            cx2, cy2 = min(w, x2 + px), min(h, y2 + py)
            
            face_img = img[cy1:cy2, cx1:cx2].copy()
            input_tensor = self._preprocess(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))
            
            # Run inference
            outputs = self.session.run(None, {self.session.get_inputs()[0].name: input_tensor})
            parsing = outputs[0][0].argmax(0).astype(np.uint8) # 512x512
            
            # Map classes to semantic masks
            # 0: background, 1: skin, 2: l_brow, 3: r_brow, 4: l_eye, 5: r_eye, 10: nose, 11: mouth, 12: u_lip, 13: l_lip
            skin_classes = [1, 2, 3, 10, 12, 13] # Skin + Brows + Nose + Lips
            eye_classes = [4, 5]
            teeth_classes = [11]

            skin_mask = np.isin(parsing, skin_classes).astype(np.uint8) * 255
            eye_mask = np.isin(parsing, eye_classes).astype(np.uint8) * 255
            teeth_mask = np.isin(parsing, teeth_classes).astype(np.uint8) * 255

            # Resize back to crop size
            ch, cw = cy2 - cy1, cx2 - cx1
            skin_mask = cv2.resize(skin_mask, (cw, ch), interpolation=cv2.INTER_LINEAR)
            eye_mask = cv2.resize(eye_mask, (cw, ch), interpolation=cv2.INTER_LINEAR)
            teeth_mask = cv2.resize(teeth_mask, (cw, ch), interpolation=cv2.INTER_LINEAR)

            # Create full-image masks
            full_skin_mask = np.zeros((h, w), dtype=np.uint8)
            full_eye_mask = np.zeros((h, w), dtype=np.uint8)
            full_teeth_mask = np.zeros((h, w), dtype=np.uint8)

            full_skin_mask[cy1:cy2, cx1:cx2] = skin_mask
            full_eye_mask[cy1:cy2, cx1:cx2] = eye_mask
            full_teeth_mask[cy1:cy2, cx1:cx2] = teeth_mask

            results.append({
                "face_index": i,
                "box": [x1, y1, x2, y2],
                "masks": {
                    "skin": full_skin_mask,
                    "eyes": full_eye_mask,
                    "teeth": full_teeth_mask
                }
            })

        return results

portrait_service = PortraitService()
