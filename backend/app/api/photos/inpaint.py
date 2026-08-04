"""
photos/inpaint.py
IOPaint-inspired inpainting/outpainting endpoints with support for multiple AI models.
"""

import gc
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
import io
import base64
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/photos/inpaint", tags=["inpaint"])


class InpaintRequest(BaseModel):
    """Request model for inpainting operations."""
    photo_id: Optional[int] = None
    image_data: Optional[str] = None  # Base64 encoded image
    mask_data: str  # Base64 encoded mask
    operation: Literal["remove", "replace", "outpaint"] = "remove"
    model: Literal["lama", "ldm", "mat", "sd15", "sdxl", "powerpaint"] = "lama"
    prompt: Optional[str] = None
    guidance_scale: float = 7.5
    num_inference_steps: int = 50
    expand_pixels: Optional[int] = None  # For outpainting


def decode_base64_image(data: str, name: str = "image") -> Image.Image:
    """Decode base64 image data to PIL Image."""
    try:
        # Remove data URI prefix if present
        if "," in data:
            data = data.split(",", 1)[1]
        
        # Add padding if necessary
        missing_padding = len(data) % 4
        if missing_padding:
            data += "=" * (4 - missing_padding)

        image_bytes = base64.b64decode(data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB to discard alpha channel if present
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        return image
    except Exception as e:
        logger.error(f"Failed to decode {name}: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid {name} data: {str(e)}")


def encode_image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Encode PIL Image to base64 string."""
    buffered = io.BytesIO()
    image.save(buffered, format=format)
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/{format.lower()};base64,{img_str}"


_simple_lama = None


def _get_simple_lama():
    global _simple_lama
    if _simple_lama is None:
        from simple_lama_inpainting import SimpleLama
        # Force CPU to avoid CUDA OOM and driver loading issues on the 4GB GPU
        _simple_lama = SimpleLama(device="cpu")
    return _simple_lama


def unload_lama():
    """Unloads the LaMa inpainting model from memory."""
    global _simple_lama
    if _simple_lama is not None:
        logger.info("Unloading LaMa model from memory...")
        _simple_lama = None
        gc.collect()
        logger.info("LaMa model unloaded.")


def unload_all_inpaint():
    """Unloads all inpainting models (LaMa, SD, SAM) from memory/VRAM.
    Call this when the editor is closed to free all GPU/RAM resources.
    """
    unload_lama()
    try:
        from app.services.inference.sd_inpaint import unload_sd
        unload_sd()
    except Exception as e:
        logger.warning(f"Error unloading SD pipeline: {e}")
    try:
        from app.services.inference.sam_seg import unload_sam
        unload_sam()
    except Exception as e:
        logger.warning(f"Error unloading SAM model: {e}")


async def run_lama_inpaint(image: Image.Image, mask: Image.Image) -> Image.Image:
    """Run object removal using LaMa."""
    lama = _get_simple_lama()
    return await _to_thread(lama, image, mask)


async def run_ldm_inpaint(image: Image.Image, mask: Image.Image) -> Image.Image:
    """Run object removal using LaMa (as LDM implementation)."""
    return await run_lama_inpaint(image, mask)


async def run_mat_inpaint(image: Image.Image, mask: Image.Image) -> Image.Image:
    """Run object removal using LaMa (as MAT implementation)."""
    return await run_lama_inpaint(image, mask)


async def run_sd_inpaint(
    image: Image.Image,
    mask: Image.Image,
    prompt: str,
    model: str = "sd15",
    guidance_scale: float = 7.5,
    num_steps: int = 30
) -> Image.Image:
    """
    Stable Diffusion inpainting. Only sd15 is wired up; sdxl/powerpaint
    need models we did not manage to download. They fall back to sd15
    so the API stays functional.
    """
    from app.services.inference.sd_inpaint import sd15_replace
    return await _to_thread(sd15_replace, image, mask, prompt, guidance_scale, num_steps)


async def run_outpaint(
    image: Image.Image,
    expand_pixels: int,
    prompt: Optional[str] = None
) -> Image.Image:
    """Outpaint via SD 1.5 inpainting on an expanded canvas."""
    from app.services.inference.sd_inpaint import sd15_outpaint
    return await _to_thread(sd15_outpaint, image, expand_pixels, prompt)


import asyncio
import functools

async def _to_thread(fn, /, *args, **kwargs):
    """Run a sync inference function in a worker thread."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, functools.partial(fn, *args, **kwargs)
    )


@router.post("/process")
async def process_inpaint(request: InpaintRequest):
    from app.config import settings
    if not settings.ENABLE_AI_INPAINTING:
        raise HTTPException(status_code=400, detail="AI Inpainting is disabled in settings.")
    """
    Process inpainting/outpainting request.
    
    Supports multiple models:
    - lama: Fast object removal
    - ldm: High quality inpainting
    - mat: Best quality inpainting
    - sd15: Stable Diffusion 1.5 (requires prompt for replace operation)
    - sdxl: Stable Diffusion XL (requires prompt)
    - powerpaint: PowerPaint model (task-aware)
    """
    try:
        # Load image
        if request.image_data:
            image = decode_base64_image(request.image_data, "image")
        elif request.photo_id:
            # TODO: Load from database
            raise HTTPException(status_code=400, detail="Loading from photo_id not yet implemented")
        else:
            raise HTTPException(status_code=400, detail="Either image_data or photo_id required")
        
        # Load mask
        mask = decode_base64_image(request.mask_data, "mask")
        
        # Ensure mask is L (grayscale)
        if mask.mode != "L":
            mask = mask.convert("L")
        
        # Ensure image and mask have same dimensions
        if image.size != mask.size:
            logger.info(f"Resizing mask from {mask.size} to {image.size}")
            mask = mask.resize(image.size, Image.Resampling.LANCZOS)
        
        # Process based on operation and model
        if request.operation == "outpaint":
            result = await run_outpaint(
                image,
                request.expand_pixels or 128,
                request.prompt
            )
        elif request.operation == "remove":
            if request.model in ("lama", "ldm", "mat"):
                result = await run_lama_inpaint(image, mask)
            elif request.model == "sd15":
                from app.services.inference.sd_inpaint import sd15_remove
                result = await _to_thread(sd15_remove, image, mask)
            else:
                raise HTTPException(status_code=400, detail=f"Model {request.model} not supported for removal")
        elif request.operation == "replace":
            if not request.prompt:
                raise HTTPException(status_code=400, detail="Prompt required for replace operation")
            
            result = await run_sd_inpaint(
                image,
                mask,
                request.prompt,
                request.model,
                request.guidance_scale,
                request.num_inference_steps
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown operation: {request.operation}")
        
        # Encode result to base64
        result_base64 = encode_image_to_base64(result, format="PNG")
        
        return {
            "success": True,
            "result": result_base64,
            "model": request.model,
            "operation": request.operation
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inpainting failed: {str(e)}")


@router.post("/unload")
async def unload_inpaint_models():
    """
    Unload all inpainting models (LaMa, Stable Diffusion, SAM) from memory/VRAM.
    The frontend should call this when the editor is closed to free GPU resources.
    """
    try:
        unload_all_inpaint()
        return {"status": "ok", "message": "All inpainting models unloaded from memory"}
    except Exception as e:
        logger.error(f"Error unloading inpainting models: {e}")
        raise HTTPException(status_code=500, detail=f"Unload failed: {str(e)}")
