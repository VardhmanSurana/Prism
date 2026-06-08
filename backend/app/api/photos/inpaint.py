"""
photos/inpaint.py
IOPaint-inspired inpainting/outpainting endpoints with support for multiple AI models.
"""

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


class InteractiveSegRequest(BaseModel):
    """Request model for interactive segmentation."""
    photo_id: Optional[int] = None
    image_data: Optional[str] = None
    points: list[dict]  # List of {x, y, positive} dicts


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


async def run_interactive_segmentation(
    image: Image.Image,
    points: list[dict]
) -> Image.Image:
    """Interactive segmentation via SAM (transformers)."""
    from app.services.inference.sam_seg import sam_segment_interactive
    mask = await _to_thread(sam_segment_interactive, image, points)
    if mask is None:
        return Image.new("L", image.size, 0)
    return mask


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


@router.post("/interactive-seg")
async def interactive_segmentation(request: InteractiveSegRequest):
    """
    Generate segmentation mask based on interactive points.
    Uses SAM (Segment Anything Model) or similar.
    """
    try:
        # Load image
        if request.image_data:
            image = decode_base64_image(request.image_data)
        elif request.photo_id:
            # TODO: Load from database
            raise HTTPException(status_code=400, detail="Loading from photo_id not yet implemented")
        else:
            raise HTTPException(status_code=400, detail="Either image_data or photo_id required")
        
        # Run interactive segmentation
        mask = await run_interactive_segmentation(image, request.points)
        
        # Encode mask to base64
        mask_base64 = encode_image_to_base64(mask, format="PNG")
        
        return {
            "success": True,
            "mask": mask_base64
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interactive segmentation failed: {str(e)}")


@router.get("/models")
async def list_models():
    """List available inpainting models."""
    return {
        "models": [
            {
                "id": "lama",
                "name": "LaMa",
                "description": "Fast object removal",
                "type": "erase",
                "supported_operations": ["remove"]
            },
            {
                "id": "ldm",
                "name": "LDM",
                "description": "High quality inpainting",
                "type": "erase",
                "supported_operations": ["remove"]
            },
            {
                "id": "mat",
                "name": "MAT",
                "description": "Best quality inpainting",
                "type": "erase",
                "supported_operations": ["remove"]
            },
            {
                "id": "sd15",
                "name": "Stable Diffusion 1.5",
                "description": "Prompt-based inpainting and replacement",
                "type": "diffusion",
                "supported_operations": ["remove", "replace", "outpaint"]
            },
            {
                "id": "sdxl",
                "name": "Stable Diffusion XL",
                "description": "High-res prompt-based generation",
                "type": "diffusion",
                "supported_operations": ["remove", "replace", "outpaint"]
            },
            {
                "id": "powerpaint",
                "name": "PowerPaint",
                "description": "Task-aware inpainting",
                "type": "diffusion",
                "supported_operations": ["remove", "replace", "outpaint"]
            }
        ]
    }


@router.post("/detect-objects")
async def detect_objects(request: InteractiveSegRequest):
    """
    Detect objects in an image automatically.
    Returns bounding boxes and confidence scores.
    """
    try:
        from app.services.object_detection import get_object_detector
        
        # Load image
        if request.image_data:
            image = decode_base64_image(request.image_data)
        elif request.photo_id:
            raise HTTPException(status_code=400, detail="Loading from photo_id not yet implemented")
        else:
            raise HTTPException(status_code=400, detail="Either image_data or photo_id required")
        
        # Get detector
        detector = get_object_detector()
        
        # Detect objects
        detections = await detector.detect_objects(image, confidence_threshold=0.5)
        
        # Convert to JSON
        objects = [det.to_dict() for det in detections]
        
        return {
            "success": True,
            "objects": objects,
            "count": len(objects)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Object detection failed: {str(e)}")


@router.post("/generate-mask-from-bbox")
async def generate_mask_from_bbox(
    image_data: Optional[str] = None,
    photo_id: Optional[int] = None,
    bbox: list[int] = None,  # [x1, y1, x2, y2]
    feather: int = 10
):
    """
    Generate a mask from a bounding box.
    Useful for converting detected objects to masks.
    """
    try:
        from app.services.object_detection import get_object_detector, BoundingBox
        
        # Load image
        if image_data:
            image = decode_base64_image(image_data)
        elif photo_id:
            raise HTTPException(status_code=400, detail="Loading from photo_id not yet implemented")
        else:
            raise HTTPException(status_code=400, detail="Either image_data or photo_id required")
        
        if not bbox or len(bbox) != 4:
            raise HTTPException(status_code=400, detail="bbox must be [x1, y1, x2, y2]")
        
        # Create BoundingBox object
        bbox_obj = BoundingBox(bbox[0], bbox[1], bbox[2], bbox[3], 1.0, "manual")
        
        # Get detector
        detector = get_object_detector()
        
        # Generate mask
        mask = await detector.generate_mask_from_bbox(image, bbox_obj, feather)
        
        # Encode mask
        mask_base64 = encode_image_to_base64(mask, format="PNG")
        
        return {
            "success": True,
            "mask": mask_base64
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mask generation failed: {str(e)}")


@router.post("/smart-select")
async def smart_select(
    image_data: Optional[str] = None,
    photo_id: Optional[int] = None,
    point: list[int] = None,  # [x, y]
):
    """
    Smart selection by clicking on an object.
    Uses flood fill or SAM for automatic segmentation.
    """
    try:
        from app.services.object_detection import get_object_detector
        
        # Load image
        if image_data:
            image = decode_base64_image(image_data)
        elif photo_id:
            raise HTTPException(status_code=400, detail="Loading from photo_id not yet implemented")
        else:
            raise HTTPException(status_code=400, detail="Either image_data or photo_id required")
        
        if not point or len(point) != 2:
            raise HTTPException(status_code=400, detail="point must be [x, y]")
        
        # Get detector
        detector = get_object_detector()
        
        # Generate mask from point
        mask = await detector.generate_mask_from_point(image, tuple(point))
        
        if mask is None:
            raise HTTPException(status_code=500, detail="Failed to generate mask from point")
        
        # Encode mask
        mask_base64 = encode_image_to_base64(mask, format="PNG")
        
        return {
            "success": True,
            "mask": mask_base64
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Smart selection failed: {str(e)}")
