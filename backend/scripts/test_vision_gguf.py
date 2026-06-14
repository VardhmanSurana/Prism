
import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to sys.path so we can import app
sys.path.append(str(Path(__file__).parent.parent))

from app.services.image_summary.llm import generate_ollama_summary

async def main():
    # Use the absolute path for the image
    image_path = str(Path(__file__).parent.parent / "uploads" / "edit_10_1780802837.jpg")
    
    print(f"Testing GGUF Vision with image: {image_path}")
    
    if not os.path.exists(image_path):
        print(f"ERROR: Image not found at {image_path}")
        return

    try:
        # This will trigger the loading of the E2B model on GPU
        summary = await generate_ollama_summary(image_path)
        print("\n--- GENERATED SUMMARY ---")
        print(summary)
        print("--------------------------\n")
    except Exception as e:
        print(f"ERROR during generation: {e}")

if __name__ == "__main__":
    asyncio.run(main())
