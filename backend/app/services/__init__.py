"""Face services package - provides face detection, recognition, and clustering."""

from app.services.face_clustering import FaceClusteringService, face_service
from app.services.face_sdk import FaceSDK, face_sdk
from app.services.face_detection import FaceDetector
from app.services.face_recognition import FaceRecognizer
from app.services.face_utils import (
    ensure_face_thumbnail_dir,
    crop_face_thumbnail,
    save_face_thumbnail,
    format_face_box_json,
    free_image_memory,
    load_image,
)

__all__ = [
    # Main service
    "FaceClusteringService",
    "face_service",
    # SDK
    "FaceSDK",
    "face_sdk",
    # Components
    "FaceDetector",
    "FaceRecognizer",
    # Utilities
    "ensure_face_thumbnail_dir",
    "crop_face_thumbnail",
    "save_face_thumbnail",
    "format_face_box_json",
    "free_image_memory",
    "load_image",
]
