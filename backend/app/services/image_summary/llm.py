"""Local GGUF vision client for image summarization using Gemma 4 E2B."""

import json
import logging
import httpx
import base64
from pathlib import Path
from app.services.ai_orchestrator import AIOrchestrator
from app.config import settings

logger = logging.getLogger(__name__)

class VisionManager:
    _model_path = Path(settings.BASE_DIR) / "models" / "gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf"

    @classmethod
    def get_llm(cls):
        """Ensures the Vision server is running and returns a client interface."""
        if AIOrchestrator.start_server('vision'):
            return cls.query_server
        return None

    @classmethod
    def query_server(cls, messages: list, **kwargs):
        """Sends a multimodal chat completion request to the active llama-server."""
        url = f"{AIOrchestrator.get_api_url()}/chat/completions"
        
        # Mapping for llama-server chat format
        # The messages already come in with file:// urls which llama-server handles or we can convert to b64
        processed_messages = []
        for msg in messages:
            content = msg.get("content", [])
            new_content = []
            if isinstance(content, str):
                new_content = content
            else:
                for part in content:
                    if part["type"] == "image_url":
                        img_path = part["image_url"]["url"].replace("file://", "")
                        with open(img_path, "rb") as f:
                            img_b64 = base64.b64encode(f.read()).decode("utf-8")
                        new_content.append({
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}
                        })
                    else:
                        new_content.append(part)
            processed_messages.append({"role": msg["role"], "content": new_content})

        payload = {
            "messages": processed_messages,
            "max_tokens": kwargs.get("max_tokens", 500),
            "temperature": kwargs.get("temperature", 0.1),
            "top_p": kwargs.get("top_p", 0.95),
            "top_k": kwargs.get("top_k", 64),
            "response_format": kwargs.get("response_format")
        }
        
        try:
            with httpx.Client(timeout=180.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Error querying vision llama-server: {e}")
            raise e

    @classmethod
    def unload_vision(cls):
        """Stops the llama-server to release VRAM."""
        AIOrchestrator.stop_server()

def generate_ollama_summary(image_path: str) -> str:
    """Generate image summary using local llama-server (Synchronous)."""
    try:
        llm_func = VisionManager.get_llm()
        if not llm_func:
            return "Vision model failed to start."

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image in a single concise sentence focusing on the main subjects and setting."},
                    {"type": "image_url", "image_url": {"url": f"file://{image_path}"}}
                ]
            }
        ]
        
        response = llm_func(messages=messages)
        message = response["choices"][0]["message"]
        summary = message.get("content", "").strip()
        
        if not summary and message.get("reasoning_content"):
            summary = message["reasoning_content"].strip()

        logger.info(f"Generated GGUF server summary for {image_path}: {summary[:100]}...")
        return summary
    except Exception as e:
        logger.error(f"Server vision generation failed: {e}")
        raise RuntimeError(str(e))

def generate_tags_json(image_path: str) -> list[str]:
    """Extract descriptive tags using local llama-server in JSON format (Synchronous)."""
    try:
        llm_func = VisionManager.get_llm()
        if not llm_func:
            return []
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract 15 descriptive tags for this image as a JSON list of strings. Key: \"tags\". Return ONLY the JSON object."},
                    {"type": "image_url", "image_url": {"url": f"file://{image_path}"}}
                ]
            }
        ]
        
        response = llm_func(
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        message = response["choices"][0]["message"]
        content = message.get("content", "").strip()
        
        if not content and message.get("reasoning_content"):
            content = message["reasoning_content"].strip()
        
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        data = json.loads(content)
        tags = data.get("tags", [])
        return tags
    except Exception as e:
        logger.error(f"Server tag extraction failed: {e}")
        return []

def check_ollama_available() -> bool:
    return VisionManager._model_path.exists()
