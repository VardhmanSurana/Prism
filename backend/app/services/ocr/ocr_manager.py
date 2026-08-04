import base64
import logging
import httpx
from app.services.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)


class OCRManager:
    @classmethod
    def get_ocr(cls):
        if AIOrchestrator.start_server('ocr'):
            return cls.query_server
        return None

    @classmethod
    def query_server(cls, image_path: str) -> str | None:
        url = f"{AIOrchestrator.get_api_url()}/chat/completions"
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        payload = {
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all visible text from this image. Return only the extracted text, preserving line breaks. If no text is visible, return an empty string."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                ]
            }],
            "max_tokens": 2000,
            "temperature": 0.1,
        }
        try:
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"].get("content", "").strip()
                return content if content else None
        except Exception as e:
            logger.error(f"OCR query failed: {e}")
            return None

    @classmethod
    def unload(cls):
        AIOrchestrator.stop_server()
