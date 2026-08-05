"""Image loading helpers (cv2 with PIL/HEIC fallback)."""

import os
import logging

import cv2
import numpy as np

logger = logging.getLogger(__name__)


def load_image(photo_path):
    """
    Load an image from disk using OpenCV, falling back to PIL for HEIC support.

    Args:
        photo_path: Absolute path to the image file

    Returns:
        numpy array or None if loading fails
    """
    if not os.path.exists(photo_path):
        return None

    # Try OpenCV first (fastest for supported formats)
    img = cv2.imread(photo_path)

    if img is None:
        # Fallback to PIL for HEIC or other formats OpenCV might miss
        try:
            from PIL import Image, ImageOps
            with Image.open(photo_path) as pil_img:
                # Apply orientation fix
                pil_img = ImageOps.exif_transpose(pil_img)
                # Convert to RGB
                pil_img = pil_img.convert('RGB')
                # Convert to BGR for OpenCV compatibility
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        except Exception as e:
            logger.error(f"Failed to load image via PIL fallback: {e}")
            return None

    return img
