import asyncio
import os
import gc
import json
import logging
import re
from PIL import Image
import torch
import numpy as np
from app.config import settings

logger = logging.getLogger(__name__)

# Setup local model caching directory inside backend/models
CACHE_DIR = os.path.join(settings.BASE_DIR, "models", ".cache", "huggingface")
os.makedirs(CACHE_DIR, exist_ok=True)

# Authenticate with Hugging Face if a token is available to avoid rate-limit warnings.
# Set HF_TOKEN in your environment (e.g. export HF_TOKEN=hf_...) to enable this.
if os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN"):
    try:
        from huggingface_hub import login as _hf_login
        _hf_login(token=os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN"), new_session=False)
    except Exception as _hf_err:
        logger.debug(f"HF login skipped: {_hf_err}")

# Device Configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
# Dtype Configuration - float16 on GPU to save memory, float32 on CPU
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

if DEVICE == "cuda":
    torch.backends.cudnn.enabled = False
    logger.info("CUDA detected for vision-language models. cuDNN disabled for stability.")

# Model IDs
SIGLIP_MODEL_ID = "google/siglip2-base-patch16-224"

# Global references for lazy loading
_siglip_model = None
_siglip_processor = None

import time

def unload_models():
    """Unloads SigLIP2 model from memory/GPU."""
    global _siglip_model, _siglip_processor
    logger.info("Unloading SigLIP2 model from memory...")
    _siglip_model = None
    _siglip_processor = None
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    gc.collect()
    logger.info("Models successfully unloaded.")


def _get_siglip():
    global _siglip_model, _siglip_processor
    if not settings.ENABLE_AI_CLIP:
        raise RuntimeError("AI CLIP feature is disabled in config. Enable it to run vector search.")
        
    if _siglip_model is None:
        from transformers import AutoProcessor, AutoModel
        start_time = time.time()

        # Mutual Exclusion: Unload LLM, Face SDK, and Summary Vision model
        from app.agent.service import PrismAgent
        from app.services.face_sdk import face_sdk
        from app.services.image_summary.llm import VisionManager
        PrismAgent.unload_llm()
        face_sdk.shutdown()
        VisionManager.unload_vision()

        logger.info(f"Loading SigLIP2 Model ({SIGLIP_MODEL_ID}) onto {DEVICE} (Dtype: {DTYPE})...")
        
        if torch.cuda.is_available():
            vram_before = torch.cuda.memory_allocated(DEVICE) / (1024 ** 2)
            logger.info(f"VRAM Allocated before loading SigLIP2: {vram_before:.2f} MB")
            
        _siglip_processor = AutoProcessor.from_pretrained(
            SIGLIP_MODEL_ID, 
            cache_dir=CACHE_DIR
        )
        _siglip_model = AutoModel.from_pretrained(
            SIGLIP_MODEL_ID, 
            cache_dir=CACHE_DIR,
            dtype=DTYPE
        ).to(DEVICE)
        _siglip_model.eval()
        
        load_time = time.time() - start_time
        logger.info(f"SigLIP2 Model loaded successfully in {load_time:.2f} seconds.")
        
        if torch.cuda.is_available():
            vram_after = torch.cuda.memory_allocated(DEVICE) / (1024 ** 2)
            vram_used = vram_after - vram_before
            logger.info(f"VRAM Allocated after loading SigLIP2: {vram_after:.2f} MB (Used: {vram_used:.2f} MB)")
            
    return _siglip_model, _siglip_processor

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "could", "did",
    "do", "does", "doing", "down", "during", "each", "few", "for", "from", "further", "had", "has", "have",
    "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "i", "if", "in", "into",
    "is", "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on",
    "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves", "then",
    "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with", "would", "you",
    "your", "yours", "yourself", "yourselves"
}

def clean_tags(tags_list, caption_text=""):
    """
    Cleans, deduplicates, and extracts tags from object detection list
    and helper keywords from the caption text.
    """
    cleaned = set()
    for tag in tags_list:
        tag_clean = tag.strip().lower()
        # Keep alphabetic/space tags, drop empty or too short ones
        tag_clean = re.sub(r'[^a-z0-9\s-]', '', tag_clean)
        if len(tag_clean) > 2:
            cleaned.add(tag_clean)
            
    # Extract keywords from detailed caption
    if caption_text:
        words = re.findall(r'[a-zA-Z]+', caption_text.lower())
        for w in words:
            if w not in STOP_WORDS and len(w) > 2:
                cleaned.add(w)
                
    return sorted(list(cleaned))

def extract_features_and_tags(image_path: str) -> dict:
    """
    Extracts high-quality caption, tags, and embedding vector from an image.
    This runs synchronously and should be wrapped in an executor thread when called async.
    """
    # Guard: check if file exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    # Load PIL image
    try:
        with Image.open(image_path) as raw_img:
            image = raw_img.convert("RGB")
    except Exception as e:
        logger.error(f"Failed to open image {image_path}: {e}")
        raise RuntimeError(f"Could not load image: {e}")

    try:
        # ── Part 1: Gemma 4 E2B Vision (Captioning & Structured Tagging) ──
        from app.services.image_summary.llm import generate_ollama_summary, generate_tags_json
        
        # We run these sequentially to ensure same model stays in VRAM
        detailed_caption = "Photo"
        try:
            # Reusing the summary function for the detailed caption
            detailed_caption = generate_ollama_summary(image_path)
        except Exception as e:
            logger.warning(f"Gemma captioning failed: {e}")

        tags = []
        try:
            # Using the new JSON tagging method
            tags = generate_tags_json(image_path)
        except Exception as e:
            logger.warning(f"Gemma tagging failed: {e}")

        # ── Part 2: SigLIP 2 Embedding Generation ───────────────────
        embedding = extract_siglip_embedding(image_path)

        # Clean GPU VRAM/memory cache
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        gc.collect()

        return {
            "caption": detailed_caption[:120] + ("..." if len(detailed_caption) > 120 else ""),
            "detailed_caption": detailed_caption,
            "tags": tags,
            "embedding": embedding
        }

    except Exception as e:
        logger.error(f"Error in vision pipeline execution: {e}")
        # Clean VRAM on failure
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        gc.collect()
        raise e


def extract_siglip_embedding(image_path: str) -> list[float]:
    """
    Extracts L2-normalized SigLIP 2 embedding from an image.
    This runs synchronously and should be wrapped in an executor thread when called async.
    """
    # Guard: check if file exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    # Load PIL image
    try:
        with Image.open(image_path) as raw_img:
            image = raw_img.convert("RGB")
    except Exception as e:
        logger.error(f"Failed to open image {image_path}: {e}")
        raise RuntimeError(f"Could not load image: {e}")

    siglip_model, siglip_processor = _get_siglip()

    def prepare_inputs(inputs_dict):
        return {
            k: v.to(DEVICE).to(dtype=DTYPE) if v.is_floating_point() else v.to(DEVICE)
            for k, v in inputs_dict.items()
        }

    inputs_siglip = siglip_processor(images=image, return_tensors="pt")
    inputs_siglip = prepare_inputs(inputs_siglip)

    with torch.no_grad():
        image_outputs = siglip_model.get_image_features(**inputs_siglip)
        if hasattr(image_outputs, "pooler_output") and image_outputs.pooler_output is not None:
            image_features = image_outputs.pooler_output
        elif isinstance(image_outputs, torch.Tensor):
            image_features = image_outputs
        else:
            try:
                image_features = image_outputs[0]
            except Exception:
                image_features = image_outputs

        # L2 Normalize the features
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        # If the resulting image_features still has batch dim, extract the first one
        if len(image_features.shape) > 1:
            embedding = image_features[0].cpu().numpy().tolist()
        else:
            embedding = image_features.cpu().numpy().tolist()

    return embedding
