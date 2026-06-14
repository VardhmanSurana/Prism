import logging

from app.config import settings


logger = logging.getLogger(__name__)


class EmbeddingClient:
    def get_query_embedding(self, query: str) -> list[float] | None:
        """Encode natural language query using SigLIP model for semantic search."""
        if not settings.ENABLE_AI_CLIP:
            return None
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
                text_features = text_outputs / text_outputs.norm(dim=-1, keepdim=True)
                return text_features[0].cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"Failed to generate SigLIP query embedding: {e}")
            return None
