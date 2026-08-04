import logging

from app.config import settings
from app.agent.utils.cache import LRUCache


logger = logging.getLogger(__name__)


class EmbeddingClient:
    def __init__(self):
        self._embedding_cache: LRUCache = LRUCache(maxsize=1024)

    def get_query_embedding(self, query: str) -> list[float] | None:
        """Encode natural language query using SigLIP model for semantic search."""
        if not settings.ENABLE_AI_CLIP:
            return None

        q_clean = query.strip().lower()
        cached = self._embedding_cache.get(q_clean)
        if cached is not None:
            return cached

        try:
            from app.services.vision_pipeline import _get_siglip, DEVICE, DTYPE
            import torch

            siglip_model, siglip_processor = _get_siglip()
            inputs = siglip_processor(text=[query], padding="max_length", return_tensors="pt")

            inputs = {
                k: v.to(DEVICE).to(dtype=DTYPE) if v.is_floating_point() else v.to(DEVICE)
                for k, v in inputs.items()
            }

            with torch.no_grad():
                text_outputs = siglip_model.get_text_features(**inputs)
                if hasattr(text_outputs, "pooler_output") and text_outputs.pooler_output is not None:
                    text_features = text_outputs.pooler_output
                elif isinstance(text_outputs, torch.Tensor):
                    text_features = text_outputs
                else:
                    try:
                        text_features = text_outputs[0]
                    except Exception:
                        text_features = text_outputs

                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                res = text_features[0].cpu().numpy().tolist()
                
                self._embedding_cache.put(q_clean, res)
                return res
        except Exception as e:
            logger.error(f"Failed to generate SigLIP query embedding: {e}")
            return None

    def get_image_embedding(self, image_path: str) -> list[float] | None:
        """Encode image file using SigLIP model for visual similarity search."""
        if not settings.ENABLE_AI_CLIP:
            return None

        try:
            import os
            from PIL import Image
            from app.services.vision_pipeline import _get_siglip, DEVICE, DTYPE
            import torch

            if not image_path or not os.path.exists(image_path):
                return None

            image = Image.open(image_path).convert("RGB")
            siglip_model, siglip_processor = _get_siglip()
            inputs_siglip = siglip_processor(images=image, return_tensors="pt")

            inputs_siglip = {
                k: v.to(DEVICE).to(dtype=DTYPE) if v.is_floating_point() else v.to(DEVICE)
                for k, v in inputs_siglip.items()
            }

            with torch.no_grad():
                image_features = siglip_model.get_image_features(**inputs_siglip)
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                return image_features[0].cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"Failed to generate SigLIP image embedding for {image_path}: {e}")
            return None
