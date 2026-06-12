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

# ── Suppress deprecation noise from transformers ──────────────────────────────
# Florence-2's processor still references `image_processor_class = 'CLIPImageProcessor'`
# which is deprecated; the canonical replacement is `image_processor_type`.
try:
    from transformers.models.auto.image_processing_auto import (
        AutoImageProcessor,
        IMAGE_PROCESSOR_MAPPING,
    )
    from transformers.models.clip.image_processing_clip import CLIPImageProcessor

    _registered = False
    if "clip" not in IMAGE_PROCESSOR_MAPPING or not any(
        isinstance(p, type) and issubclass(p, CLIPImageProcessor)
        for p in IMAGE_PROCESSOR_MAPPING.get("clip", [])
    ):
        try:
            AutoImageProcessor.register(CLIPImageProcessor, slow_image_processor_class=CLIPImageProcessor)
            _registered = True
        except Exception:
            try:
                AutoImageProcessor.register(CLIPImageProcessor, CLIPImageProcessor)
                _registered = True
            except Exception:
                _registered = False
    if _registered:
        logger.info("Registered CLIPImageProcessor mapping in AutoImageProcessor.")
except Exception as patch_err:
    logger.warning(f"Failed to register CLIPImageProcessor mapping: {patch_err}")

# ── Monkey Patch for Florence-2 Config compatibility in transformers 4.45+ ──
try:
    from transformers.configuration_utils import PretrainedConfig
    original_getattribute = PretrainedConfig.__getattribute__
    def patched_getattribute(self, key):
        try:
            return original_getattribute(self, key)
        except AttributeError as e:
            if key == "forced_bos_token_id":
                return None
            raise e
    PretrainedConfig.__getattribute__ = patched_getattribute
    logger.info("Successfully applied PretrainedConfig monkey patch for Florence-2.")
except Exception as patch_err:
    logger.warning(f"Failed to apply PretrainedConfig monkey patch: {patch_err}")

try:
    from transformers.tokenization_utils_base import PreTrainedTokenizerBase
    original_getattr = PreTrainedTokenizerBase.__getattr__
    def patched_getattr(self, key):
        if key == "additional_special_tokens":
            return []
        return original_getattr(self, key)
    PreTrainedTokenizerBase.__getattr__ = patched_getattr
    logger.info("Successfully applied PreTrainedTokenizerBase monkey patch for Florence-2.")
except Exception as patch_err:
    logger.warning(f"Failed to apply PreTrainedTokenizerBase monkey patch: {patch_err}")

try:
    from transformers.modeling_utils import PreTrainedModel
    original_model_getattr = getattr(PreTrainedModel, "__getattr__", None)
    def patched_model_getattr(self, key):
        if key in ("_supports_sdpa", "_supports_flash_attn_2"):
            return False
        if original_model_getattr:
            try:
                return original_model_getattr(self, key)
            except AttributeError:
                pass
        # Fallback to standard PyTorch Module attribute behavior
        if key in self.__dict__.get("_parameters", {}):
            return self.__dict__["_parameters"][key]
        if key in self.__dict__.get("_buffers", {}):
            return self.__dict__["_buffers"][key]
        if key in self.__dict__.get("_modules", {}):
            return self.__dict__["_modules"][key]
        raise AttributeError(f"'{self.__class__.__name__}' object has no attribute '{key}'")
    PreTrainedModel.__getattr__ = patched_model_getattr
    logger.info("Successfully applied PreTrainedModel __getattr__ monkey patch for Florence-2.")
except Exception as patch_err:
    logger.warning(f"Failed to apply PreTrainedModel monkey patch: {patch_err}")

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
FLORENCE_MODEL_ID = "microsoft/Florence-2-large"
SIGLIP_MODEL_ID = "google/siglip2-base-patch16-224"

# Global references for lazy loading
_florence_model = None
_florence_processor = None
_siglip_model = None
_siglip_processor = None

def _get_florence():
    global _florence_model, _florence_processor
    if _florence_model is None:
        from transformers import AutoProcessor, AutoModelForCausalLM
        logger.info(f"Loading Florence-2 Model ({FLORENCE_MODEL_ID}) onto {DEVICE} (Dtype: {DTYPE})...")
        _florence_processor = AutoProcessor.from_pretrained(
            FLORENCE_MODEL_ID, 
            trust_remote_code=True, 
            cache_dir=CACHE_DIR
        )
        _florence_model = AutoModelForCausalLM.from_pretrained(
            FLORENCE_MODEL_ID, 
            trust_remote_code=True, 
            cache_dir=CACHE_DIR,
            dtype=DTYPE
        ).to(DEVICE)
        _florence_model.eval()
        logger.info("Florence-2 Model loaded successfully.")
    return _florence_model, _florence_processor

def _get_siglip():
    global _siglip_model, _siglip_processor
    if _siglip_model is None:
        from transformers import AutoProcessor, AutoModel
        logger.info(f"Loading SigLIP2 Model ({SIGLIP_MODEL_ID}) onto {DEVICE} (Dtype: {DTYPE})...")
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
        logger.info("SigLIP2 Model loaded successfully.")
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
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        logger.error(f"Failed to open image {image_path}: {e}")
        raise RuntimeError(f"Could not load image: {e}")

    try:
        # Load models
        florence_model, florence_processor = _get_florence()
        siglip_model, siglip_processor = _get_siglip()

        def prepare_inputs(inputs_dict):
            return {
                k: v.to(DEVICE).to(dtype=DTYPE) if v.is_floating_point() else v.to(DEVICE)
                for k, v in inputs_dict.items()
            }

        # Florence-2 works best with a square image to avoid assertion errors in DaViT visual encoder
        image_florence = image.resize((768, 768), Image.Resampling.LANCZOS)

        # ── Part 1: Florence-2 Captioning & Tagging ─────────────────
        # Detailed Caption
        caption_prompt = "<DETAILED_CAPTION>"
        inputs_caption = florence_processor(text=caption_prompt, images=image_florence, return_tensors="pt")
        inputs_caption = prepare_inputs(inputs_caption)
        
        with torch.no_grad():
            generated_ids = florence_model.generate(
                input_ids=inputs_caption["input_ids"],
                pixel_values=inputs_caption["pixel_values"],
                max_new_tokens=256,
                num_beams=3,
                use_cache=False
            )
        
        decoded_caption = florence_processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed_caption = florence_processor.post_process_generation(
            decoded_caption, 
            task=caption_prompt, 
            image_size=(image.width, image.height)
        )
        detailed_caption = parsed_caption.get(caption_prompt, "Photo").strip()

        # Object Detection (OD) for tag generation
        od_prompt = "<OD>"
        inputs_od = florence_processor(text=od_prompt, images=image_florence, return_tensors="pt")
        inputs_od = prepare_inputs(inputs_od)
        
        with torch.no_grad():
            generated_ids_od = florence_model.generate(
                input_ids=inputs_od["input_ids"],
                pixel_values=inputs_od["pixel_values"],
                max_new_tokens=256,
                num_beams=3,
                use_cache=False
            )
        
        decoded_od = florence_processor.batch_decode(generated_ids_od, skip_special_tokens=False)[0]
        parsed_od = florence_processor.post_process_generation(
            decoded_od, 
            task=od_prompt, 
            image_size=(image.width, image.height)
        )
        od_result = parsed_od.get(od_prompt, {})
        labels = od_result.get("labels", [])
        
        # Clean and compile final tags
        tags = clean_tags(labels, detailed_caption)

        # ── Part 2: SigLIP 2 Embedding Generation ───────────────────
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
