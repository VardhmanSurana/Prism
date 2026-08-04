from PIL import Image
from PIL.ExifTags import TAGS
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import settings

router = APIRouter()


class InterrogateRequest(BaseModel):
    photo_path: str
    prompt: Optional[str] = None


def _extract_exif(photo_path: str) -> dict:
    try:
        img = Image.open(photo_path)
        raw = img.getexif() or {}
        wanted = {
            "DateTimeOriginal",
            "Make",
            "Model",
            "FocalLength",
            "FNumber",
            "ExposureTime",
            "ISO",
            "LensModel",
            "ImageWidth",
            "ImageHeight",
            "Software",
        }
        out = {}
        for tag_id, value in raw.items():
            tag = TAGS.get(tag_id, tag_id)
            if tag in wanted:
                out[tag] = value
        return out
    except Exception:
        return {}


@router.post("/interrogate")
async def interrogate(req: InterrogateRequest):
    if not req.photo_path or not __import__("os").path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    result = {
        "status": "success",
        "photo_path": req.photo_path,
        "exif": _extract_exif(req.photo_path),
        "objects": [],
        "ocr": {"status": "disabled", "text": None},
        "vision": {"status": "disabled", "caption": None, "tags": []},
        "sam": {"status": "disabled", "center_mask": None},
    }

    # OCR
    try:
        from app.services.ocr.ocr_extract import extract_ocr_text
        text = extract_ocr_text(req.photo_path)
        result["ocr"] = {"status": "success" if text else "empty", "text": text}
    except Exception as exc:
        result["ocr"] = {"status": "error", "text": str(exc)}

    # Vision caption + tags
    try:
        from app.services.image_summary.llm import generate_ollama_summary, generate_tags_json
        summary = generate_ollama_summary(req.photo_path)
        tags = generate_tags_json(req.photo_path) or []
        result["vision"] = {
            "status": "success",
            "caption": summary[:120] if summary else None,
            "summary": summary,
            "tags": tags,
        }
    except Exception as exc:
        result["vision"] = {"status": "error", "caption": None, "tags": [], "error": str(exc)}

    # Object detection via existing detector
    try:
        from PIL import Image as PILImage
        from app.services.object_detection import ObjectDetector
        img = PILImage.open(req.photo_path).convert("RGB")
        detector = ObjectDetector()
        boxes = await detector.detect_objects(img)
        result["objects"] = [box.to_dict() for box in boxes]
    except Exception as exc:
        result["objects"] = []
        result["object_detection_error"] = str(exc)

    # SAM center-point segmentation
    try:
        from PIL import Image as PILImage
        from app.services.inference.sam_seg import sam_segment_smart_select
        img = PILImage.open(req.photo_path).convert("RGB")
        cx, cy = img.width // 2, img.height // 2
        mask = await sam_segment_smart_select(img, (cx, cy))
        if mask is not None:
            import base64, io
            buf = io.BytesIO()
            mask.save(buf, format="PNG")
            result["sam"] = {
                "status": "success",
                "center_mask_png_base64": base64.b64encode(buf.getvalue()).decode("ascii"),
            }
    except Exception as exc:
        result["sam"] = {"status": "error", "error": str(exc)}

    return result
