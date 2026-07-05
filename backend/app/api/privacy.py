"""
Privacy transparency dashboard endpoint.

Reports exactly what each feature flag does and whether it makes any network calls.
All Prism AI features run locally — this endpoint makes that verifiable.
"""

from fastapi import APIRouter
from app.config import settings

router = APIRouter()

# Ground truth: what each feature actually does, verified from the source code.
# "network_calls" documents every external endpoint the code path touches.
# If the list is empty, the feature is fully local.

FEATURE_FLAGS = [
    {
        "id": "ENABLE_AI_AGENT",
        "label": "AI Agent (Chat Assistant)",
        "enabled": settings.ENABLE_AI_AGENT,
        "description": "Natural-language assistant that searches your photos, answers questions, and performs actions.",
        "network_calls": [],
        "what_runs_locally": [
            "llama-server (gemma-4 text model) on localhost:9090",
            "SQLite full-text search (photos_fts)",
        ],
        "what_is_sent": "Your query text is processed by the local model. Nothing leaves your machine.",
        "model": "gemma-4-E4B-it (QAT quantized, ~4GB VRAM)",
    },
    {
        "id": "ENABLE_AI_FACE",
        "label": "Face Detection & Recognition",
        "enabled": settings.ENABLE_AI_FACE,
        "description": "Detects faces in photos, clusters them by person, and enables People view.",
        "network_calls": [],
        "what_runs_locally": [
            "InspireFace SDK (local C library)",
            "Face embedding computation (on-device)",
            "DBSCAN clustering (pure Python)",
        ],
        "what_is_sent": "Face crops are processed entirely on-device. No face data leaves your machine.",
        "model": "InspireFace (face detection + embedding, ~200MB)",
    },
    {
        "id": "ENABLE_AI_CLIP",
        "label": "Semantic Search & Embeddings",
        "enabled": settings.ENABLE_AI_CLIP,
        "description": "Generates vector embeddings for semantic search, explore themes, and similarity.",
        "network_calls": [],
        "what_runs_locally": [
            "SigLIP2 model via HuggingFace transformers",
            "ONNX Runtime for inference",
            "Cosine similarity search (in-memory)",
        ],
        "what_is_sent": "Image pixels are processed by the local SigLIP2 model. Embeddings are stored in SQLite.",
        "model": "SigLIP2 (~300MB)",
    },
    {
        "id": "ENABLE_AI_OCR",
        "label": "Text Extraction (OCR)",
        "enabled": settings.ENABLE_AI_OCR,
        "description": "Extracts text from photos — documents, receipts, screenshots, signs.",
        "network_calls": [],
        "what_runs_locally": [
            "PaddleOCR-VL via llama-server on localhost:9092",
            "Text stored in SQLite (ocr_text column)",
        ],
        "what_is_sent": "Image pixels are processed by the local PaddleOCR model. Extracted text stays in your database.",
        "model": "PaddleOCR-VL-1.6 (GGUF, ~1GB)",
    },
    {
        "id": "ENABLE_AI_INPAINTING",
        "label": "Object Removal (Inpainting)",
        "enabled": settings.ENABLE_AI_INPAINTING,
        "description": "Remove unwanted objects from photos using AI-powered inpainting.",
        "network_calls": [],
        "what_runs_locally": [
            "SAM (Segment Anything Model) for mask generation",
            "SimpleLama / Stable Diffusion for inpainting",
            "All inference via ONNX Runtime / PyTorch",
        ],
        "what_is_sent": "Image pixels and masks are processed entirely on-device. Output is saved locally.",
        "model": "SAM-ViT-Base + SimpleLama (~1GB combined)",
    },
    {
        "id": "ENABLE_AI_REMBG",
        "label": "Background Removal",
        "enabled": settings.ENABLE_AI_REMBG,
        "description": "Remove backgrounds from photos for collages, exports, and creative use.",
        "network_calls": [],
        "what_runs_locally": [
            "rembg library with local ONNX model",
            "U2Net or ISNET architecture",
        ],
        "what_is_sent": "Image pixels are processed by the local segmentation model. No data leaves your machine.",
        "model": "U2Net/ISNET (~170MB)",
    },
    {
        "id": "ENABLE_AI_SUBTITLES",
        "label": "Video Subtitles",
        "enabled": settings.ENABLE_AI_SUBTITLES,
        "description": "Auto-generate subtitles for videos using speech-to-text.",
        "network_calls": [],
        "what_runs_locally": [
            "faster-whisper (CTranslate2 port of Whisper)",
            "Audio extracted via ffmpeg",
        ],
        "what_is_sent": "Audio is transcribed entirely on-device. Subtitles are saved as SRT files locally.",
        "model": "Whisper base (~150MB)",
    },
    {
        "id": "ENABLE_AI_STORY",
        "label": "Story Recaps",
        "enabled": settings.ENABLE_AI_STORY,
        "description": "Generate natural-language summaries for events and photo clusters.",
        "network_calls": [],
        "what_runs_locally": [
            "llama-server (gemma-4 text model) on localhost:9090",
            "Uses only metadata: tags, names, locations, dates",
        ],
        "what_is_sent": "Photo metadata (not images) is processed by the local model. No data leaves your machine.",
        "model": "gemma-4-E4B-it (shared with AI Agent)",
    },
    {
        "id": "ENABLE_AI_CONTENT_CLASSIFY",
        "label": "Content Classification",
        "enabled": settings.ENABLE_AI_CONTENT_CLASSIFY,
        "description": "Automatically detect screenshots, documents, and regular photos.",
        "network_calls": [],
        "what_runs_locally": [
            "EXIF analysis (heuristic)",
            "Resolution matching (heuristic)",
            "OCR text density check (local)",
            "OpenCV histogram analysis",
        ],
        "what_is_sent": "Pure heuristics — no ML model, no network. Classification happens entirely on-device.",
        "model": "None (heuristic-based)",
    },
]


@router.get("/status")
async def privacy_status():
    """Return the privacy status of all AI features.

    This is a transparency endpoint — it reports exactly what each
    feature does based on the actual source code, not marketing claims.
    """
    enabled_count = sum(1 for f in FEATURE_FLAGS if f["enabled"])
    total_network = sum(len(f["network_calls"]) for f in FEATURE_FLAGS)

    return {
        "summary": {
            "total_features": len(FEATURE_FLAGS),
            "enabled": enabled_count,
            "disabled": len(FEATURE_FLAGS) - enabled_count,
            "total_network_endpoints": total_network,
            "all_local": total_network == 0,
            "verdict": "All data stays on your device" if total_network == 0 else "Some features make network calls",
        },
        "features": FEATURE_FLAGS,
    }


@router.get("/feature/{feature_id}")
async def privacy_feature_detail(feature_id: str):
    """Return detailed privacy info for a specific feature."""
    feature = next((f for f in FEATURE_FLAGS if f["id"] == feature_id), None)
    if not feature:
        return {"error": f"Unknown feature: {feature_id}"}
    return feature
