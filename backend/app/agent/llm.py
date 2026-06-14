import logging
import os
import threading
from pathlib import Path

from llama_cpp import Llama


logger = logging.getLogger(__name__)


class LlamaManager:
    _llm = None
    _lock = threading.Lock()

    def get_llm(self) -> Llama:
        """Lazily initialize the Llama model with thread-safe lock and optimized parameters."""
        if LlamaManager._llm is not None:
            return LlamaManager._llm

        with LlamaManager._lock:
            if LlamaManager._llm is not None:
                return LlamaManager._llm

            try:
                from app.services.vision_pipeline import unload_models
                from app.services.face_sdk import face_sdk
                from app.services.image_summary.llm import VisionManager

                unload_models()
                face_sdk.shutdown()
                VisionManager.unload_vision()
            except ImportError:
                pass

            model_dir = Path(__file__).parents[2] / "models"
            model_path = model_dir / "gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf"

            if not model_path.exists():
                logger.error(f"Gemma model not found at {model_path}")
                raise FileNotFoundError(f"Model file not found: {model_path}")

            try:
                logger.info(f"Attempting to load Gemma model with GPU offloading: {model_path}")
                LlamaManager._llm = Llama(
                    model_path=str(model_path),
                    n_ctx=2048,
                    n_threads=4,
                    flash_attn=True,
                    n_gpu_layers=-1,
                    use_mmap=True,
                    type_k=8, # 8-bit KV Cache (GGML_TYPE_Q8_0)
                    type_v=8, # 8-bit KV Cache (GGML_TYPE_Q8_0)
                    verbose=False,
                )
                logger.info("Successfully loaded model with GPU acceleration, Flash Attention, and 8-bit KV Cache.")
            except Exception as e:
                logger.warning(f"Failed to load model with GPU/FlashAttn ({e}). Trying GPU without Flash Attention...")
                try:
                    LlamaManager._llm = Llama(
                        model_path=str(model_path),
                        n_ctx=2048,
                        n_threads=4,
                        flash_attn=False,
                        n_gpu_layers=-1,
                        use_mmap=True,
                        type_k=8, # 8-bit KV Cache
                        type_v=8, # 8-bit KV Cache
                        verbose=False,
                    )
                    logger.info("Successfully loaded model with GPU acceleration (Flash Attention disabled, 8-bit KV Cache).")
                except Exception as e2:
                    logger.warning(f"Failed to load model with GPU offloading ({e2}). Falling back to CPU mode.")
                    try:
                        LlamaManager._llm = Llama(
                            model_path=str(model_path),
                            n_ctx=2048,
                            n_threads=os.cpu_count() or 4,
                            flash_attn=False,
                            n_gpu_layers=0,
                            use_mmap=True,
                            verbose=False,
                        )
                        logger.info("Successfully loaded model in CPU-only mode.")
                    except Exception as ex:
                        logger.critical(f"Critical failure loading model in CPU fallback: {ex}")
                        raise ex
            return LlamaManager._llm

    @classmethod
    def unload_llm(cls):
        """Releases the LLM from GPU VRAM."""
        with cls._lock:
            if cls._llm is not None:
                logger.info("Unloading Gemma LLM from VRAM...")
                cls._llm = None
                import gc
                import torch

                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                logger.info("Gemma LLM successfully unloaded.")
