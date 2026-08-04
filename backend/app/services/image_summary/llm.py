"""Local GGUF vision client for image summarization using Gemma 4 E2B."""

import json
import logging
import re
import httpx
import base64
from typing import Optional
from pathlib import Path
from app.services.ai_orchestrator import AIOrchestrator
from app.config import settings

logger = logging.getLogger(__name__)

class VisionManager:
    _model_path = Path(settings.BASE_DIR) / "models" / "llm" / "gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf"

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

def generate_ollama_summary(image_path: str) -> Optional[str]:
    """Generate image summary using local llama-server (Synchronous).
    
    Returns:
        Summary string on success, None on failure (allows caller to handle gracefully).
    """
    try:
        llm_func = VisionManager.get_llm()
        if not llm_func:
            logger.warning("Vision model failed to start for summary generation")
            return None

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

        if not summary:
            logger.warning(f"Empty summary response for {image_path}")
            return None
            
        logger.info(f"Generated GGUF server summary for {image_path}: {summary[:100]}...")
        return summary
    except Exception as e:
        logger.error(f"Server vision generation failed: {e}")
        return None

def generate_tags_json(image_path: str) -> Optional[list[str]]:
    """Extract descriptive tags using local llama-server in JSON format (Synchronous).
    
    Returns:
        List of tag strings on success, None on failure (allows caller to distinguish
        empty result from error condition).
    """
    content = None
    try:
        llm_func = VisionManager.get_llm()
        if not llm_func:
            logger.warning("Vision manager not available for tag extraction")
            return None
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract 15 descriptive tags from this image. Return ONLY a JSON object with a single key \"tags\" containing an array of tag strings. Example: {\"tags\": [\"person\", \"outdoor\", \"sunset\"]}"},
                    {"type": "image_url", "image_url": {"url": f"file://{image_path}"}}
                ]
            }
        ]
        
        response = llm_func(
            messages=messages,
            temperature=0.1,
            max_tokens=800
        )
        
        message = response["choices"][0]["message"]
        content = message.get("content", "").strip()
        
        if not content and message.get("reasoning_content"):
            content = message["reasoning_content"].strip()
        
        if not content:
            logger.warning("Vision server returned empty content for tag extraction.")
            return None
        
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
        
        if not content.strip():
            logger.warning("Vision server returned empty content after code-fence stripping.")
            return None
        
        if not content.lstrip().startswith("{"):
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            if match:
                content = match.group(0).strip()
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            match = re.findall(r'\[.*?\]', content, re.DOTALL)
            if match:
                try:
                    data = {"tags": json.loads(match[-1])}
                except json.JSONDecodeError:
                    logger.warning(f"Could not decode JSON tags from: {content[:200]}")
                    return None
            else:
                logger.warning(f"No JSON found in vision response: {content[:200]}")
                return None
        
        tags = data.get("tags", [])
        if not isinstance(tags, list):
            logger.warning("Vision response tags field is not a list.")
            return None
        
        return [t for t in tags if isinstance(t, str)][:20]
    except Exception as e:
        logger.error(f"Server tag extraction failed: {e}")
        if content:
            logger.debug(f"Raw content on error: {content[:500]}")
        return None

def check_ollama_available() -> bool:
    return VisionManager._model_path.exists()
