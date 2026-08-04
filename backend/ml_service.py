import os
import sys
import logging
import json
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
import uvicorn

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prism-ml-service")

# ml: single-image interrogation (EXIF + OCR + vision + object detection + SAM)
# Imported after sys.path insertion so the `app` package is resolvable.
from app.api import interrogate as interrogate_api

app = FastAPI(title="Prism Python ML Microservice", version="0.2.0")

# Register the interrogate router so POST /ml/interrogate is served on this
# microservice (port 8270), matching what the Rust backend's ml_client calls
# (http://127.0.0.1:8270/ml/interrogate). Without this, image uploads hit a 404
# and the agent surfaces "_Interrogation backend unavailable_".
app.include_router(interrogate_api.router, prefix="/ml", tags=["ml"])

# ─── Request / Response Models ─────────────────────────────────────────────

class PhotoPathRequest(BaseModel):
    photo_path: str

class FaceBox(BaseModel):
    confidence: float
    box_json: str
    embedding_json: str

class FaceScanResponse(BaseModel):
    status: str
    faces: List[FaceBox]

class SiglipResponse(BaseModel):
    status: str
    embedding: List[float]

class VisionResponse(BaseModel):
    status: str
    summary: Optional[str] = None
    caption: Optional[str] = None
    tags: List[str] = []

class OcrResponse(BaseModel):
    status: str
    text: Optional[str] = None

class ClipResponse(BaseModel):
    status: str
    embedding: List[float]
    summary: Optional[str] = None

# ─── Health ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "prism-python-ml", "port": 8270}

# ─── Face Detection (InspireFace) ─────────────────────────────────────────

@app.post("/ml/face", response_model=FaceScanResponse)
def scan_faces(req: PhotoPathRequest):
    if not os.path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        from app.services.face_sdk import face_sdk
        import cv2

        img = cv2.imread(req.photo_path)
        if img is None:
            return FaceScanResponse(status="error", faces=[])

        faces = face_sdk.detect_faces(img)
        results = []
        for face in faces:
            feature = face_sdk.extract_feature(img, face)
            embedding_list = feature.tolist() if feature is not None else []
            box = getattr(face, "location", None) or [0, 0, 0, 0]

            results.append(
                FaceBox(
                    confidence=float(getattr(face, "confidence", 1.0)),
                    box_json=str(list(box)),
                    embedding_json=str(embedding_list),
                )
            )

        return FaceScanResponse(status="success", faces=results)
    except Exception as e:
        logger.exception(f"Error scanning faces: {e}")
        return FaceScanResponse(status="error", faces=[])

# ─── SigLIP 2 Embedding ───────────────────────────────────────────────────

@app.post("/ml/siglip", response_model=SiglipResponse)
def get_siglip_embedding(req: PhotoPathRequest):
    if not os.path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        from app.services.vision_pipeline import extract_siglip_embedding
        embedding = extract_siglip_embedding(req.photo_path)
        return SiglipResponse(status="success", embedding=embedding)
    except Exception as e:
        logger.exception(f"Error generating SigLIP embedding: {e}")
        return SiglipResponse(status="error", embedding=[])

# ─── Gemma 4 E2B Vision (Caption + Tags) ─────────────────────────────────

@app.post("/ml/vision", response_model=VisionResponse)
def get_vision_caption(req: PhotoPathRequest):
    if not os.path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        from app.services.image_summary.llm import generate_ollama_summary, generate_tags_json

        summary = None
        caption = None
        tags = []

        try:
            summary = generate_ollama_summary(req.photo_path)
            if summary:
                caption = summary[:120] + ("..." if len(summary) > 120 else "")
        except Exception as e:
            logger.warning(f"Gemma caption failed: {e}")

        try:
            tags = generate_tags_json(req.photo_path) or []
        except Exception as e:
            logger.warning(f"Gemma tags failed: {e}")

        return VisionResponse(status="success", summary=summary, caption=caption, tags=tags)
    except Exception as e:
        logger.exception(f"Error in vision pipeline: {e}")
        return VisionResponse(status="error")

# ─── PaddleOCR Text Extraction ────────────────────────────────────────────

@app.post("/ml/ocr", response_model=OcrResponse)
def get_ocr_text(req: PhotoPathRequest):
    if not os.path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        from app.services.ocr.ocr_extract import extract_ocr_text
        text = extract_ocr_text(req.photo_path)
        return OcrResponse(status="success", text=text)
    except Exception as e:
        logger.exception(f"Error extracting OCR text: {e}")
        return OcrResponse(status="error")

# ─── Legacy CLIP endpoint (routes to SigLIP for backward compat) ──────────

@app.post("/ml/clip", response_model=ClipResponse)
def get_clip_embedding_legacy(req: PhotoPathRequest):
    if not os.path.exists(req.photo_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        from app.services.vision_pipeline import extract_siglip_embedding
        embedding = extract_siglip_embedding(req.photo_path)
        return ClipResponse(status="success", embedding=embedding)
    except Exception as e:
        logger.exception(f"Error in CLIP/SigLIP endpoint: {e}")
        return ClipResponse(status="error", embedding=[])

if __name__ == "__main__":
    uvicorn.run("ml_service:app", host="0.0.0.0", port=8270, reload=False)
