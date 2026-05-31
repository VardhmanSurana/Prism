import os
import hashlib
import logging
import warnings
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
import reverse_geocoder as rg

# Register HEIF opener for Pillow
register_heif_opener()

logger = logging.getLogger(__name__)

def _convert_to_degrees(value):
    """Helper function to convert the GPS coordinates stored in the EXIF to decimal degrees"""
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except (IndexError, TypeError, ValueError):
        return 0.0

def _get_gps_coordinates(exif_data):
    """Extracts GPS coordinates from EXIF data if available"""
    if not exif_data:
        return None
    
    gps_info = exif_data.get(34853) # GPSInfo tag
    if not gps_info:
        return None
    
    try:
        lat_ref = gps_info.get(1)
        lat = gps_info.get(2)
        lon_ref = gps_info.get(3)
        lon = gps_info.get(4)
        
        if lat and lat_ref and lon and lon_ref:
            lat_dec = _convert_to_degrees(lat)
            if lat_ref != 'N':
                lat_dec = 0 - lat_dec
            
            lon_dec = _convert_to_degrees(lon)
            if lon_ref != 'E':
                lon_dec = 0 - lon_dec
                
            return lat_dec, lon_dec
    except Exception:
        pass
    
    return None

def _get_city_name(lat, lon) -> dict | None:
    """Offline reverse geocoding via reverse_geocoder (GeoNames K-D tree, no network calls)."""
    try:
        results = rg.search((lat, lon), mode=1)  # mode=1 = single result
        if results:
            r = results[0]
            return {
                "city": r.get("name") or None,
                "state": r.get("admin1") or None,
                "country": r.get("cc") or None,
            }
    except Exception as e:
        logger.debug(f"Geocoding failed for ({lat}, {lon}): {e}")
    return None

def extract_metadata(img: Image.Image, file_path: str):
    """Unified metadata extraction from a PIL Image and file path."""
    width, height = img.size
    mime_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
    aspect_ratio = width / height if height > 0 else 1.0
    
    date_taken = None
    coords = None
    city = state = country = location_str = None

    try:
        exif = img._getexif()
        if exif:
            # Date extraction
            dt_str = exif.get(36867) or exif.get(306)
            if dt_str:
                date_taken = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S')
            # GPS extraction
            coords = _get_gps_coordinates(exif)
    except Exception:
        pass

    # Fallback for date
    if not date_taken:
        try:
            stat = os.stat(file_path)
            date_taken = datetime.fromtimestamp(min(stat.st_mtime, stat.st_ctime))
        except Exception:
            date_taken = datetime.utcnow()

    if coords:
        location_info = _get_city_name(coords[0], coords[1])
        if location_info:
            city = location_info.get("city")
            state = location_info.get("state")
            country = location_info.get("country")
            location_str = ", ".join(p for p in [city, state, country] if p) or None

    return {
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "mime_type": mime_type,
        "date_taken": date_taken,
        "city": city,
        "state": state,
        "country": country,
        "location": location_str,
        "latitude": coords[0] if coords else None,
        "longitude": coords[1] if coords else None,
    }

def generate_thumbnail(file_path: str, thumb_dir: str):
    """Generates a thumbnail and extracts metadata in a single pass."""
    try:
        # Suppress Pillow transparency warnings
        warnings.filterwarnings("ignore", message="Palette images with Transparency expressed in bytes should be converted to RGBA images")

        hasher = hashlib.md5()
        file_size = 0
        try:
            stat = os.stat(file_path)
            file_size = stat.st_size
            hasher.update(str(file_size).encode())
            with open(file_path, 'rb') as f:
                hasher.update(f.read(1024 * 1024))
        except Exception:
            hasher.update(file_path.encode())
        file_hash = hasher.hexdigest()
        
        # Dynamic blur/sharpness calculation inside the process pool worker
        blur_score = None
        try:
            import cv2
            img_cv = cv2.imread(file_path)
            if img_cv is not None:
                gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
                blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        except Exception as e:
            logger.error(f"Failed to calculate blur score in process pool: {e}")
        
        thumb_path = Path(thumb_dir) / f"{file_hash}.webp"
        
        with Image.open(file_path) as img:
            metadata = extract_metadata(img, file_path)
            metadata["hash"] = file_hash
            metadata["blur_score"] = blur_score
            metadata["file_size"] = file_size

            if thumb_path.exists():
                return metadata, f"/thumbnails/{file_hash}.webp"

            # Fix EXIF orientation before processing
            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            
            # Convert to RGB if needed (e.g., Palette or RGBA) to save memory
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Resize in-place
            img.thumbnail((400, 400))
            
            # Save as highly compressed WebP
            img.save(str(thumb_path), format="WEBP", quality=80)
            
            return metadata, f"/thumbnails/{file_hash}.webp"
    except Exception as e:
        logger.error(f"Thumbnail generation failed for {file_path}: {e}")
        return None, None
class ImageProcessor:
    @staticmethod
    def get_image_metadata(file_path: str):
        try:
            with Image.open(file_path) as img:
                return extract_metadata(img, file_path)
        except Exception as e:
            logger.error(f"Failed to get metadata for {file_path}: {e}")
            return None
