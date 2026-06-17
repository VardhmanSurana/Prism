import logging

from app.config import settings


logger = logging.getLogger(__name__)


class EmbeddingClient:
    def __init__(self):
        self._embedding_cache = {}

    def get_query_embedding(self, query: str) -> list[float] | None:
        """Encode natural language query using SigLIP model for semantic search."""
        if not settings.ENABLE_AI_CLIP:
            return None

        q_clean = query.strip().lower()
        if q_clean in self._embedding_cache:
            return self._embedding_cache[q_clean]

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
                
                if len(self._embedding_cache) >= 1000:
                    self._embedding_cache.clear()
                self._embedding_cache[q_clean] = res
                return res
        except Exception as e:
            logger.error(f"Failed to generate SigLIP query embedding: {e}")
            return None
