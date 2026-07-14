import os
import hashlib
import logging
import warnings
from datetime import datetime
from pathlib import Path
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
import reverse_geocoder as rg

register_heif_opener()

logger = logging.getLogger(__name__)

RAW_EXTENSIONS = ('.dng', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.raf', '.rw2', '.pef', '.srw')

def is_raw_file(file_path: str) -> bool:
    return os.path.splitext(file_path)[1].lower() in RAW_EXTENSIONS

def open_raw_image(file_path: str) -> Image.Image | None:
    try:
        import rawpy
        with rawpy.imread(file_path) as raw:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=True,
                output_bps=8,
                no_auto_bright=True,
            )
        from PIL import Image as PILImage
        import numpy as np
        img = PILImage.fromarray(rgb)
        return img
    except ImportError:
        logger.warning("rawpy not installed - cannot process RAW files")
        return None
    except Exception as e:
        logger.error(f"Failed to process RAW file {file_path}: {e}")
        return None

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


def reverse_geocode_coords(lat: float, lon: float) -> dict | None:
    """Public wrapper for offline reverse geocoding used outside metadata extraction."""
    return _get_city_name(lat, lon)

def hamming_distance(hash1: str, hash2: str) -> int:
    if len(hash1) != len(hash2):
        return max(len(hash1), len(hash2))
    return bin(int(hash1, 16) ^ int(hash2, 16)).count('1')

def compute_phash(file_path: str, hash_size: int = 16) -> str | None:
    try:
        import cv2
        import numpy as np
        img = cv2.imread(file_path, cv2.IMREAD_COLOR)
        if img is None:
            return None
        img = cv2.resize(img, (hash_size + 1, hash_size), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
        dct = cv2.dct(gray)
        dct_low = dct[:hash_size, :hash_size]
        median_val = np.median(dct_low)
        bits = (dct_low > median_val).flatten()
        hex_str = ''
        for i in range(0, len(bits), 4):
            nibble = 0
            for j in range(4):
                if i + j < len(bits) and bits[i + j]:
                    nibble |= 1 << (3 - j)
            hex_str += format(nibble, 'x')
        return hex_str
    except Exception:
        return compute_dhash(file_path, hash_size)

def compute_dhash(file_path: str, hash_size: int = 16) -> str | None:
    try:
        import cv2
        import numpy as np
        img = cv2.imread(file_path, cv2.IMREAD_COLOR)
        if img is None:
            return None
        img = cv2.resize(img, (hash_size + 1, hash_size), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
        diff = gray[:, 1:] > gray[:, :-1]
        bits = diff.flatten()
        hex_str = ''
        for i in range(0, len(bits), 4):
            nibble = 0
            for j in range(4):
                if i + j < len(bits) and bits[i + j]:
                    nibble |= 1 << (3 - j)
            hex_str += format(nibble, 'x')
        return hex_str
    except Exception:
        return None

def extract_metadata(img: Image.Image, file_path: str):
    """Unified metadata extraction from a PIL Image and file path."""
    width, height = img.size
    mime_type = f"image/{img.format.lower()}" if img.format else "image/jpeg"
    aspect_ratio = width / height if height > 0 else 1.0
    
    date_taken = None
    coords = None
    city = state = country = location_str = None
    exif_make = None
    exif_model = None
    exif_focal_length = None
    exif_iso = None

    try:
        exif = img._getexif()
        if exif:
            # Date extraction
            dt_str = exif.get(36867) or exif.get(306)
            if dt_str:
                date_taken = datetime.strptime(dt_str, '%Y:%m:%d %H:%M:%S')
            # GPS extraction
            coords = _get_gps_coordinates(exif)
            # Camera Make/Model (EXIF tags 271 and 272)
            exif_make = exif.get(271)
            exif_model = exif.get(272)
            focal_length = exif.get(37386)
            if focal_length is not None:
                try:
                    exif_focal_length = float(focal_length)
                except (TypeError, ValueError, ZeroDivisionError):
                    logger.debug("Could not parse EXIF focal length for %s", file_path)
            iso = exif.get(34855)
            if iso is not None:
                try:
                    exif_iso = int(iso)
                except (TypeError, ValueError):
                    logger.debug("Could not parse EXIF ISO for %s", file_path)
    except Exception as e:
        logger.debug(f"Failed to extract EXIF metadata: {e}")

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
        "exif_make": exif_make,
        "exif_model": exif_model,
        "exif_focal_length": exif_focal_length,
        "exif_iso": exif_iso,
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

        phash = compute_phash(file_path)

        raw_img = None
        if is_raw_file(file_path):
            raw_img = open_raw_image(file_path)

        if raw_img is not None:
            metadata = extract_metadata(raw_img, file_path)
            metadata["hash"] = file_hash
            metadata["phash"] = phash
            metadata["blur_score"] = blur_score
            metadata["file_size"] = file_size

            if thumb_path.exists():
                return metadata, f"/thumbnails/{file_hash}.webp"

            try:
                raw_img = ImageOps.exif_transpose(raw_img)
            except Exception:
                pass

            if raw_img.mode != 'RGB':
                raw_img = raw_img.convert('RGB')

            raw_img.thumbnail((400, 400))

            raw_img.save(str(thumb_path), format="WEBP", quality=80)

            return metadata, f"/thumbnails/{file_hash}.webp"

        with Image.open(file_path) as img:
            metadata = extract_metadata(img, file_path)
            metadata["hash"] = file_hash
            metadata["phash"] = phash
            metadata["blur_score"] = blur_score
            metadata["file_size"] = file_size

            if thumb_path.exists():
                return metadata, f"/thumbnails/{file_hash}.webp"

            try:
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            if img.mode != 'RGB':
                img = img.convert('RGB')

            img.thumbnail((400, 400))

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
