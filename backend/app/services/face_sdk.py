"""Face SDK initialization and session management for InspireFace."""

import os
import logging
import inspireface as isf
from app.config import settings

logger = logging.getLogger(__name__)


class FaceSDK:
    """Manages InspireFace SDK lifecycle and session."""

    def __init__(self):
        self._session = None
        self._launched = False

    def _ensure_launched(self):
        """Lazy launch InspireFace SDK and create session on first request."""
        if not self._launched:
            if not isf.query_launch_status():
                # Launch using locally saved Pikachu model pack file dynamically resolved relative to this file
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                local_model_path = os.path.join(backend_dir, "models", "Pikachu")
                isf.launch(resource_path=local_model_path)
            self._launched = True

        if self._session is None:
            # Enable recognition (required for feature extraction)
            self._session = isf.InspireFaceSession(
                param=isf.HF_ENABLE_FACE_RECOGNITION,
                detect_mode=isf.HF_DETECT_MODE_ALWAYS_DETECT
            )
            # Set high-accuracy detection threshold dynamically
            self._session.set_detection_confidence_threshold(0.55)

    def shutdown(self):
        """Release session and terminate SDK resources on app shutdown."""
        if self._session is not None:
            try:
                self._session.release()
            except Exception:
                pass
            self._session = None
        if self._launched:
            try:
                isf.terminate()
            except Exception:
                pass
            self._launched = False

    @property
    def session(self):
        """Get the active InspireFace session, ensuring SDK is launched."""
        self._ensure_launched()
        return self._session

    def detect_faces(self, stream):
        """Detect faces in an image stream."""
        try:
            return self.session.face_detection(stream)
        except Exception as e:
            logger.exception(f"InspireFace face detection failed: {e}")
            return []

    def extract_feature(self, stream, face):
        """Extract 512-dimensional face embedding from a face."""
        try:
            return self.session.face_feature_extract(stream, face)
        except Exception as e:
            logger.exception(f"Failed to extract face feature: {e}")
            return None

    def compare_features(self, feat1, feat2):
        """Compare two face features using native C++ comparison."""
        try:
            return isf.feature_comparison(feat1, feat2)
        except Exception as e:
            logger.exception(f"Failed to compare face features: {e}")
            return -1.0


face_sdk = FaceSDK()
