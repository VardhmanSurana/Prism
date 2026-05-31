"""
AI Image Summary Service — Ollama Vision analysis.

Vision: Send actual image pixels to Ollama vision model 
        for visual analysis and description generation.

Metadata is stored as-is in the database while the AI summary provides semantic understanding.
"""

from .service import generate_image_summary
from .llm import generate_ollama_summary, check_ollama_available

__all__ = ["generate_image_summary", "generate_ollama_summary", "check_ollama_available"]
