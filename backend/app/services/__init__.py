"""Face services package - provides face detection, recognition, and clustering."""

from app.services.face_utils import (  # noqa: F401
    ensure_face_thumbnail_dir,
    crop_face_thumbnail,
    save_face_thumbnail,
    format_face_box_json,
    free_image_memory,
    load_image,
)

_LAZY_IMPORTS = {
    "FaceClusteringService": ("app.services.face_clustering", "FaceClusteringService"),
    "face_service": ("app.services.face_clustering", "face_service"),
    "FaceSDK": ("app.services.face_sdk", "FaceSDK"),
    "face_sdk": ("app.services.face_sdk", "face_sdk"),
    "FaceDetector": ("app.services.face_detection", "FaceDetector"),
    "FaceRecognizer": ("app.services.face_recognition", "FaceRecognizer"),
}

def __getattr__(name):
    if name not in _LAZY_IMPORTS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    import importlib
    mod_path, attr = _LAZY_IMPORTS[name]
    mod = importlib.import_module(mod_path)
    return getattr(mod, attr)

__all__ = [
    "FaceClusteringService",
    "face_service",
    "FaceSDK",
    "face_sdk",
    "FaceDetector",
    "FaceRecognizer",
    "ensure_face_thumbnail_dir",
    "crop_face_thumbnail",
    "save_face_thumbnail",
    "format_face_box_json",
    "free_image_memory",
    "load_image",
]
