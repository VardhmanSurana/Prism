"""
sd_inpaint.py
Stable Diffusion 1.5 inpainting pipeline wrapper.
Lazy-loads the diffusers pipeline, supports remove/replace/outpaint operations.
Optimized for 4GB VRAM GPUs (enables model CPU offloading) and includes automatic CPU fallback.
"""

import logging
from typing import Optional

import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)

# Workaround for PyTorch 2.11+cu130 + RTX 2050 cuBLAS Lt bug:
# cuDNN's heuristic tries to dispatch to cuBLAS Lt and crashes.
# Disable cuDNN to force the cuBLAS path which works.
if torch.cuda.is_available():
    torch.backends.cudnn.enabled = False
    logger.info("cuDNN disabled (workaround for cuBLAS Lt bug on RTX 2050)")

_pipes = {}


def _get_pipe(device: str = "cuda"):
    global _pipes
    if device not in _pipes:
        from diffusers import StableDiffusionInpaintPipeline
        logger.info(f"Loading SD 1.5 inpainting pipeline on {device}...")
        
        # Load parameters based on hardware device
        kwargs = {}
        if device == "cuda":
            kwargs["torch_dtype"] = torch.float16
            kwargs["variant"] = "fp16"
        else:
            kwargs["torch_dtype"] = torch.float32
            
        pipe = StableDiffusionInpaintPipeline.from_pretrained(
            "sd-legacy/stable-diffusion-inpainting",
            safety_checker=None,
            requires_safety_checker=False,
            **kwargs
        )
        
        # GPU Optimizations
        if device == "cuda":
            try:
                # Enable model CPU offloading to save a massive amount of VRAM (maps layers to CPU)
                # Keep total VRAM overhead under ~800MB instead of ~2.5GB.
                pipe.enable_model_cpu_offload()
                logger.info("SD 1.5: Enabled model CPU offloading")
            except Exception as e:
                logger.warning(f"Failed to enable model CPU offloading: {e}. Falling back to standard pipeline.to('cuda')")
                pipe.to("cuda")
            
            try:
                pipe.enable_xformers_memory_efficient_attention()
            except Exception:
                pass
            
            pipe.enable_attention_slicing(1)
            try:
                pipe.enable_vae_tiling()
            except Exception:
                pass
            try:
                pipe.enable_vae_slicing()
            except Exception:
                pass
        else:
            pipe.to("cpu")
            
        _pipes[device] = pipe
        
    return _pipes[device]


def run_pipeline_with_fallback(fn, *args, **kwargs):
    """Executes a diffusers inpainting function on the GPU first (if available), with automatic CPU fallback on OOM."""
    global _pipes
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    if device == "cuda":
        try:
            pipe = _get_pipe("cuda")
            return fn(pipe, "cuda")
        except Exception as e:
            err_str = str(e).lower()
            if "out of memory" in err_str or "oom" in err_str or "cuda error" in err_str:
                logger.warning(f"Stable Diffusion inference on GPU failed with OutOfMemory: {e}. Falling back to CPU...")
                # Evict the GPU pipeline to release VRAM
                if "cuda" in _pipes:
                    del _pipes["cuda"]
                import gc
                gc.collect()
                torch.cuda.empty_cache()
            else:
                # Re-raise non-OOM errors
                raise
                
    # Fallback/Default CPU execution
    pipe = _get_pipe("cpu")
    return fn(pipe, "cpu")


def sd15_remove(
    image: Image.Image,
    mask: Image.Image,
    num_steps: int = 20,
) -> Image.Image:
    """Object removal using SD 1.5 inpainting (no prompt, fill naturally)."""
    w, h = image.size
    side = 8
    new_w = ((w + side - 1) // side) * side
    new_h = ((h + side - 1) // side) * side
    if (new_w, new_h) != (w, h):
        image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        mask = mask.resize((new_w, new_h), Image.Resampling.LANCZOS)

    def _infer(pipe, device):
        return pipe(
            prompt="",
            negative_prompt="blurry, artifacts, text, watermark, person, object",
            image=image.convert("RGB"),
            mask_image=mask.convert("L"),
            num_inference_steps=num_steps,
            guidance_scale=7.5,
        ).images[0]

    result = run_pipeline_with_fallback(_infer)

    if (new_w, new_h) != (w, h):
        result = result.resize((w, h), Image.Resampling.LANCZOS)
    return result


def sd15_replace(
    image: Image.Image,
    mask: Image.Image,
    prompt: str,
    guidance_scale: float = 7.5,
    num_steps: int = 30,
) -> Image.Image:
    """Prompt-guided replacement using SD 1.5 inpainting."""
    w, h = image.size
    side = 8
    new_w = ((w + side - 1) // side) * side
    new_h = ((h + side - 1) // side) * side
    if (new_w, new_h) != (w, h):
        image = image.resize((new_w, new_h), Image.Resampling.LANCZOS)
        mask = mask.resize((new_w, new_h), Image.Resampling.LANCZOS)

    def _infer(pipe, device):
        return pipe(
            prompt=prompt,
            negative_prompt="blurry, artifacts, text, watermark, low quality",
            image=image.convert("RGB"),
            mask_image=mask.convert("L"),
            num_inference_steps=num_steps,
            guidance_scale=guidance_scale,
        ).images[0]

    result = run_pipeline_with_fallback(_infer)

    if (new_w, new_h) != (w, h):
        result = result.resize((w, h), Image.Resampling.LANCZOS)
    return result


def sd15_outpaint(
    image: Image.Image,
    expand_pixels: int,
    prompt: Optional[str] = None,
    num_steps: int = 30,
) -> Image.Image:
    """Outpaint by expanding canvas and inpainting the new border region."""
    w, h = image.size
    new_w = w + 2 * expand_pixels
    new_h = h + 2 * expand_pixels
    side = 8
    new_w = ((new_w + side - 1) // side) * side
    new_h = ((new_h + side - 1) // side) * side

    expanded = Image.new("RGB", (new_w, new_h), color=(128, 128, 128))
    expanded.paste(image, ((new_w - w) // 2, (new_h - h) // 2))

    mask = Image.new("L", (new_w, new_h), color=255)
    mask.paste(0, ((new_w - w) // 2, (new_h - h) // 2, (new_w + w) // 2, (new_h + h) // 2))

    effective_prompt = prompt or "seamless natural background continuation, photograph, detailed"
    return sd15_replace(
        expanded,
        mask,
        effective_prompt,
        guidance_scale=7.5,
        num_steps=num_steps,
    ).crop(((new_w - w) // 2, (new_h - h) // 2, (new_w + w) // 2, (new_h + h) // 2))
