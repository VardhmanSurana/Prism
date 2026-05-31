"""GGUF model management — singleton pattern for lazy loading."""

import logging
from pathlib import Path

from llama_cpp import Llama
from app.config import settings

logger = logging.getLogger(__name__)

# Model Singleton State
_llama_model = None


def get_llama_model() -> Llama:
    """Lazily load the GGUF model into memory once and keep it cached as a singleton."""
    global _llama_model
    if _llama_model is None:
        try:
            # Resolve model path from config
            model_file_path = settings.LLM_MODEL_DIR / settings.LLM_MODEL_FILENAME

            # Check if model exists
            if not model_file_path.exists():
                raise FileNotFoundError(
                    f"GGUF model file not found: {model_file_path}. "
                    f"Please ensure the model file exists in {settings.LLM_MODEL_DIR}"
                )

            logger.info(f"Loading GGUF model into memory from local path: {model_file_path}")

            # Initialize Llama model with settings from config
            _llama_model = Llama(
                model_path=str(model_file_path),
                n_ctx=settings.LLM_CONTEXT_SIZE,
                n_threads=settings.LLM_THREADS,
                n_gpu_layers=-1,  # offload all layers to GPU if active (automatic fallback to CPU)
                verbose=False
            )
            logger.info("Local GGUF model successfully loaded into memory.")
        except Exception as e:
            logger.error(f"Failed to load GGUF model: {e}")
            raise e
    return _llama_model
