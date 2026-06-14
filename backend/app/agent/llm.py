import logging
import httpx
from app.services.ai_orchestrator import AIOrchestrator

logger = logging.getLogger(__name__)

class LlamaManager:
    @classmethod
    def get_llm(cls):
        """Ensures the Agent server is running and returns a client interface."""
        if AIOrchestrator.start_server('agent'):
            # Return a proxy object that mimics the llama-cpp-python 'llm' call
            return cls.query_server
        return None

    @classmethod
    def query_server(cls, prompt: str, **kwargs):
        """Sends a completion request to the active llama-server."""
        url = f"{AIOrchestrator.get_api_url()}/completions"
        
        # Map llama-cpp-python args to OpenAI API format
        payload = {
            "prompt": prompt,
            "max_tokens": kwargs.get("max_tokens", 250),
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
    def unload_llm(cls):
        """Stops the llama-server to release VRAM."""
        AIOrchestrator.stop_server()
