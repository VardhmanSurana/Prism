import logging
import threading
import httpx
from app.services.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)

# Keep-alive duration (seconds) after last request before unloading LLM
KEEPALIVE_SECONDS = 30


class LlamaManager:
    _keepalive_timer: threading.Timer | None = None
    _keepalive_lock = threading.Lock()

    @classmethod
    def get_llm(cls):
        """Ensures the Agent server is running and returns a client interface."""
        cls._cancel_keepalive()
        if AIOrchestrator.start_server('agent'):
            # Return a proxy object that mimics the llama-cpp-python 'llm' call
            return cls.query_server
        return None

    @classmethod
    def _cancel_keepalive(cls):
        """Cancel the pending unload timer if one exists."""
        with cls._keepalive_lock:
            if cls._keepalive_timer is not None:
                cls._keepalive_timer.cancel()
                cls._keepalive_timer = None

    @classmethod
    def _start_keepalive(cls):
        """Start/restart the keepalive timer. After expiry, unload the LLM."""
        cls._cancel_keepalive()
        timer = threading.Timer(KEEPALIVE_SECONDS, cls._keepalive_expired)
        timer.daemon = True
        with cls._keepalive_lock:
            cls._keepalive_timer = timer
        timer.start()
        logger.debug(f"LLM keepalive timer set for {KEEPALIVE_SECONDS}s")

    @classmethod
    def _keepalive_expired(cls):
        """Called when the keepalive timer fires — unload LLM and models."""
        logger.info(f"LLM idle for {KEEPALIVE_SECONDS}s, unloading to free VRAM.")
        cls.unload_llm()
        try:
            from app.services.vision_pipeline import unload_models
            unload_models()
        except Exception as e:
            logger.warning(f"Error unloading vision models: {e}")

    @classmethod
    def schedule_unload(cls):
        """Schedule LLM unload after keepalive period. Called after each response."""
        cls._start_keepalive()

    @classmethod
    def query_server(cls, prompt: str, **kwargs):
        """Sends a completion request to the active llama-server."""
        url = f"{AIOrchestrator.get_api_url()}/completions"
        
        # Map llama-cpp-python args to OpenAI API format
        payload = {
            "prompt": prompt,
            "max_tokens": kwargs.get("max_tokens", 500),
            "temperature": kwargs.get("temperature", 0.1),
            "top_p": kwargs.get("top_p", 0.95),
            "top_k": kwargs.get("top_k", 64),
            "stop": kwargs.get("stop", [])
        }
        
        try:
            with httpx.Client(timeout=120.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Error querying agent llama-server: {e}")
            raise e

    @classmethod
    def query_chat_server(cls, messages: list, **kwargs):
        """Sends a multimodal chat completion request to the agent llama-server."""
        cls._cancel_keepalive()
        if not AIOrchestrator.start_server('agent'):
            raise RuntimeError("Failed to start agent server")

        url = f"{AIOrchestrator.get_api_url()}/chat/completions"
        
        import os
        import base64
        processed_messages = []
        for msg in messages:
            content = msg.get("content", [])
            if isinstance(content, str):
                processed_messages.append({"role": msg["role"], "content": content})
            else:
                new_content = []
                for part in content:
                    if part.get("type") == "image_url":
                        img_path = part["image_url"]["url"].replace("file://", "")
                        if os.path.exists(img_path):
                            with open(img_path, "rb") as f:
                                img_b64 = base64.b64encode(f.read()).decode("utf-8")
                            ext = os.path.splitext(img_path)[1].lower()
                            mime = "image/png" if ext in ('.png', '.webp') else "image/jpeg"
                            new_content.append({
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{img_b64}"}
                            })
                    else:
                        new_content.append(part)
                processed_messages.append({"role": msg["role"], "content": new_content})

        payload = {
            "messages": processed_messages,
            "max_tokens": kwargs.get("max_tokens", 350),
            "temperature": kwargs.get("temperature", 0.3),
            "top_p": kwargs.get("top_p", 0.95),
            "top_k": kwargs.get("top_k", 64),
        }

        try:
            with httpx.Client(timeout=180.0) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Error querying agent multimodal llama-server: {e}")
            raise e

    @classmethod
    def unload_llm(cls):
        """Stops the llama-server to release VRAM."""
        cls._cancel_keepalive()
        AIOrchestrator.stop_server()

