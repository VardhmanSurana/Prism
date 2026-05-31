"""Utility functions for face processing, image handling, and thumbnail generation."""

import os
import json
import gc
import cv2
import logging
from uuid import uuid4
from app.config import settings

logger = logging.getLogger(__name__)


THUMB_SIZE = (200, 200)
FACE_THUMB_SUBDIR = "Face_Thumbnail"


def ensure_face_thumbnail_dir():
    """Ensure the Face_Thumbnail directory exists inside static thumbnails folder."""
    face_thumb_dir = os.path.join(settings.THUMBNAILS_DIR, FACE_THUMB_SUBDIR)
    os.makedirs(face_thumb_dir, exist_ok=True)
    return face_thumb_dir


def crop_face_thumbnail(img, x1, y1, x2, y2, padding_ratio=0.2):
    """
    Crop a face region from the image with padding.

    Args:
        img: OpenCV image (numpy array)
        x1, y1, x2, y2: Bounding box coordinates
        padding_ratio: Padding factor around the face (default 20%)

    Returns:
        numpy array: Cropped and resized thumbnail image
    """
    h, w = img.shape[:2]
    fw = x2 - x1
    fh = y2 - y1
    pad_w = int(fw * padding_ratio)
    pad_h = int(fh * padding_ratio)

    crop_x1 = max(0, x1 - pad_w)
    crop_y1 = max(0, y1 - pad_h)
    crop_x2 = min(w, x2 + pad_w)
    crop_y2 = min(h, y2 + pad_h)

    # Crop from the original full-res img for thumbnail quality and copy to break RAM links
    cropped_img = img[crop_y1:crop_y2, crop_x1:crop_x2].copy()

    # Resize to standard thumbnail size
    cropped_img = cv2.resize(cropped_img, THUMB_SIZE, interpolation=cv2.INTER_AREA)

    return cropped_img


def save_face_thumbnail(cropped_img, photo_id, face_thumb_dir):
    """
    Save a face thumbnail to disk with JPEG compression.

    Args:
        cropped_img: OpenCV image (numpy array)
        photo_id: ID of the parent photo
        face_thumb_dir: Directory to save the thumbnail

    Returns:
        str: Filename of the saved thumbnail
    """
    # Generate unique uuid4 thumbnail filename to avoid collisions
    thumb_filename = f"face_{photo_id}_{uuid4().hex[:8]}.jpg"
    thumb_path = os.path.join(face_thumb_dir, thumb_filename)
    cv2.imwrite(thumb_path, cropped_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return thumb_filename


def format_face_box_json(x1, y1, x2, y2):
    """
    Format face bounding box as JSON string.

    Args:
        x1, y1, x2, y2: Bounding box coordinates

    Returns:
        str: JSON string with x, y, w, h
    """
    box_dict = {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}
    return json.dumps(box_dict)


def free_image_memory(detect_img, img, stream):
    """
    Free heavy image memory completely before commencing async DB work.

    Args:
        detect_img: Downscaled detection image (may be same as img)
        img: Original full-resolution image
        stream: InspireFace image stream
    """
    if detect_img is not None and detect_img is not img:
        del detect_img
    if img is not None:
        del img
    if stream is not None:
        del stream
    gc.collect()


def load_image(photo_path):
    """
    Load an image from disk using OpenCV.

    Args:
        photo_path: Absolute path to the image file

    Returns:
        numpy array or None if loading fails
    """
    if not os.path.exists(photo_path):
        return None

    img = cv2.imread(photo_path)
    return img
