"""Face detection and quality filtering logic."""

import cv2
import logging
import numpy as np
import inspireface as isf
from app.config import settings

logger = logging.getLogger(__name__)


class FaceDetector:
    """Handles face detection and quality filtering."""

    def __init__(self, face_sdk):
        self._face_sdk = face_sdk

    def prepare_image(self, img):
        """
        Downscale large images before detection to reduce hardware CPU/RAM load.

        Returns:
            tuple: (detect_img, scale_factor) where scale_factor is applied to coords
        """
        h, w = img.shape[:2]
        max_dim = settings.FACE_DETECT_MAX_DIM
        scale = 1.0

        if max(h, w) > max_dim:
            scale = max_dim / max(h, w)
            detect_img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            detect_img = img

        return detect_img, scale

    def detect_faces(self, img):
        """
        Detect faces in an image using InspireFace SDK.

        Args:
            img: OpenCV image (numpy array)

        Returns:
            tuple: (faces, detect_img, scale) or (None, None, 1.0) on failure
        """
        detect_img, scale = self.prepare_image(img)

        try:
            stream = isf.ImageStream.load_from_cv_image(detect_img)
            faces = self._face_sdk.detect_faces(stream)
            return faces, detect_img, scale, stream
        except Exception as e:
            logger.exception(f"Face detection failed: {e}")
            return None, None, 1.0, None

    def is_quality_face(self, face):
        """
        Check if a face meets quality and pose thresholds.

        Args:
            face: InspireFace face object

        Returns:
            bool: True if face passes quality checks
        """
        conf = float(face.detection_confidence)

        # Safely parse yaw and pitch as floats
        try:
            yaw_val = float(getattr(face, "yaw", 0.0))
            pitch_val = float(getattr(face, "pitch", 0.0))
        except (ValueError, TypeError):
            yaw_val = 0.0
            pitch_val = 0.0

        if conf < settings.FACE_CONF_THRESHOLD:
            return False
        if abs(yaw_val) > settings.FACE_YAW_PITCH_LIMIT or abs(pitch_val) > settings.FACE_YAW_PITCH_LIMIT:
            return False

        return True

    def get_face_location_scaled(self, face, scale):
        """
        Get face bounding box coordinates scaled back to original image resolution.

        Args:
            face: InspireFace face object
            scale: Scale factor used during detection

        Returns:
            tuple: (x1, y1, x2, y2) in original image coordinates
        """
        x1, y1, x2, y2 = face.location
        x1 = int(x1 / scale)
        y1 = int(y1 / scale)
        x2 = int(x2 / scale)
        y2 = int(y2 / scale)
        return x1, y1, x2, y2
