"""
SAM (Segment Anything Model) via HuggingFace transformers.

Uses facebook/sam-vit-base (ViT-B, 358MB, transformers-native).
Supports point-prompted segmentation for interactive and smart-select flows.
"""
import logging
from typing import List, Tuple, Optional

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

_model = None
_processor = None
_device = "cuda" if torch.cuda.is_available() else "cpu"


def _get_sam():
    global _model, _processor
    if _model is None:
        from transformers import SamModel, SamProcessor
        logger.info("Loading SAM ViT-B via transformers...")
        _processor = SamProcessor.from_pretrained("facebook/sam-vit-base")
        _model = SamModel.from_pretrained("facebook/sam-vit-base").to(_device)
        _model.eval()
        logger.info(f"SAM loaded on {_device}")
    return _model, _processor


def sam_segment_from_points(
    image: Image.Image,
    points: List[Tuple[int, int]],
    positive: bool = True,
) -> Optional[Image.Image]:
    """
    Run SAM point-prompted segmentation.
    points: list of (x, y) in image coordinates.
    positive: True if all points are foreground, False if background.
    Returns a binary mask (white=object) or None if no valid mask.
    """
    model, processor = _get_sam()
    if not points:
        return None

    input_points = [[list(p) for p in points]]
    input_labels = [[1 if positive else 0] * len(points)]

    inputs = processor(
        image.convert("RGB"),
        input_points=input_points,
        input_labels=input_labels,
        return_tensors="pt",
    ).to(_device)

    with torch.inference_mode():
        outputs = model(**inputs, multimask_output=False)

    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu(),
    )

    if not masks or len(masks[0]) == 0:
        return None
    mask_tensor = masks[0][0]
    if mask_tensor.dim() == 3:
        mask_tensor = mask_tensor[0]
    mask_np = mask_tensor.numpy().astype(np.uint8) * 255
    return Image.fromarray(mask_np, mode="L")


def sam_segment_interactive(
    image: Image.Image,
    points: List[dict],
) -> Optional[Image.Image]:
    """
    Run interactive segmentation with mixed positive/negative points.
    points: list of {x, y, positive} dicts.
    Groups points into a single prompt. Positive/negative are mixed via labels.
    """
    model, processor = _get_sam()
    if not points:
        return None

    coords = [[int(p["x"]), int(p["y"])] for p in points]
    labels = [1 if p.get("positive", True) else 0 for p in points]

    if all(l == 1 for l in labels):
        return sam_segment_from_points(image, [tuple(c) for c in coords], positive=True)
    if all(l == 0 for l in labels):
        return sam_segment_from_points(image, [tuple(c) for c in coords], positive=False)

    input_points = [coords]
    input_labels = [labels]

    inputs = processor(
        image.convert("RGB"),
        input_points=input_points,
        input_labels=input_labels,
        return_tensors="pt",
    ).to(_device)

    with torch.inference_mode():
        outputs = model(**inputs, multimask_output=False)

    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu(),
    )
    if not masks or len(masks[0]) == 0:
        return None
    mask_tensor = masks[0][0]
    if mask_tensor.dim() == 3:
        mask_tensor = mask_tensor[0]
    mask_np = mask_tensor.numpy().astype(np.uint8) * 255
    return Image.fromarray(mask_np, mode="L")


def sam_segment_smart_select(
    image: Image.Image,
    point: Tuple[int, int],
) -> Optional[Image.Image]:
    """
    Click an object; SAM segments the object under the cursor.
    """
    return sam_segment_from_points(image, [point], positive=True)
