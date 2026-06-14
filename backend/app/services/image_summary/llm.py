"""Local GGUF vision client for image summarization using Gemma 4 E2B."""

import logging
import threading
from pathlib import Path
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Gemma4ChatHandler

from app.config import settings

logger = logging.getLogger(__name__)

class VisionManager:
    _llm = None
    _lock = threading.Lock()
    _model_path = Path(settings.BASE_DIR) / "models" / "gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf"
    _mmproj_path = Path(settings.BASE_DIR) / "models" / "mmproj-BF16.gguf"

    @classmethod
    def get_llm(cls) -> Llama:
        """Lazily initialize the vision model with mutual exclusion."""
        if cls._llm is not None:
            return cls._llm
            
        with cls._lock:
            if cls._llm is not None:
                return cls._llm
                
            # Mutual Exclusion: Unload other models before loading Vision LLM
            try:
                from app.agent.service import PrismAgent
                from app.services.vision_pipeline import unload_models
                from app.services.face_sdk import face_sdk
                PrismAgent.unload_llm()
                unload_models()
                face_sdk.shutdown()
            except ImportError:
                pass

            if not cls._model_path.exists():
                logger.error(f"Vision model not found at {cls._model_path}")
                raise FileNotFoundError(f"Model file not found: {cls._model_path}")
            
            if not cls._mmproj_path.exists():
                logger.error(f"Vision projector not found at {cls._mmproj_path}")
                raise FileNotFoundError(f"Projector file not found: {cls._mmproj_path}")
                
            try:
                logger.info(f"Loading Gemma 4 E2B Vision model: {cls._model_path}")

                # Gemma 4 uses Gemma4ChatHandler which requires the mmproj (clip) path
                chat_handler = Gemma4ChatHandler(clip_model_path=str(cls._mmproj_path))

                cls._llm = Llama(
                    model_path=str(cls._model_path),
                    chat_handler=chat_handler,
                    n_ctx=2048,
                    n_threads=4,
                    n_gpu_layers=-1, # Force to GPU
                    flash_attn=True,
                    verbose=False
                )
                logger.info("Vision model loaded successfully on GPU.")
                return cls._llm

            except Exception as e:
                logger.error(f"Failed to load Vision model on GPU: {e}")
                # Fallback to CPU if GPU fails
                try:
                    cls._llm = Llama(
                        model_path=str(cls._model_path),
                        chat_handler=chat_handler,
                        n_ctx=2048,
                        n_threads=4,
                        n_gpu_layers=0,
                        verbose=False
                    )
                    logger.info("Vision model loaded in CPU fallback mode.")
                    return cls._llm
                except Exception as ex:
                    logger.critical(f"Critical failure loading Vision model: {ex}")
                    raise ex

    @classmethod
    def unload_vision(cls):
        """Release Vision VRAM."""
        with cls._lock:
            if cls._llm is not None:
                logger.info("Unloading Vision LLM from VRAM...")
                cls._llm = None
                import gc
                gc.collect()
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()

async def generate_ollama_summary(image_path: str) -> str:
    """
    Generate image summary using local Gemma 4 E2B vision model.
    (Kept same function name for minimal disruption to service.py)
    """
    try:
        llm = VisionManager.get_llm()
        
        # In llama-cpp-python vision, we pass the path in a specific chat message format
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in a single concise sentence focusing on the main subjects and setting."},
                    {"type": "image_url", "image_url": {"url": f"file://{image_path}"}}
                ]
            }
        ]
        
        # Note: llama-cpp-python handles the image loading/processing via the chat_handler
        response = llm.create_chat_completion(
            messages=messages,
            max_tokens=150,
            temperature=1.0, # Recommended for Gemma 4
            top_p=0.95,      # Recommended for Gemma 4
            top_k=64         # Recommended for Gemma 4
        )
        
        summary = response["choices"][0]["message"]["content"].strip()
        logger.info(f"Generated GGUF summary for {image_path}: {summary[:100]}...")
        return summary

    except Exception as e:
        logger.error(f"Local vision generation failed: {e}")
        raise RuntimeError(f"Vision model error: {e}")

def check_ollama_available() -> bool:
    """Check if local vision model file is available."""
    return VisionManager._model_path.exists()
