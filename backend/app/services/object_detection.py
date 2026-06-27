"""
object_detection.py
Automatic object detection for inpainting mask generation.
Uses SAM (Segment Anything Model) for point/bbox mask generation,
falls back to OpenCV blob detection and flood fill.
"""

from PIL import Image
import numpy as np
import asyncio
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class BoundingBox:
    """Represents a detected object bounding box."""
    
    def __init__(self, x1: int, y1: int, x2: int, y2: int, confidence: float, class_name: str):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.confidence = confidence
        self.class_name = class_name
    
    @property
    def center(self) -> Tuple[int, int]:
        """Get center point of bounding box."""
        return ((self.x1 + self.x2) // 2, (self.y1 + self.y2) // 2)
    
    @property
    def area(self) -> int:
        """Get area of bounding box."""
        return (self.x2 - self.x1) * (self.y2 - self.y1)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "bbox": [self.x1, self.y1, self.x2, self.y2],
            "confidence": self.confidence,
            "class": self.class_name,
            "center": self.center,
        }


class ObjectDetector:
    """
    Object detection service for automatic mask generation.
    
    Supports multiple backends:
    - YOLO (You Only Look Once) for general object detection
    - SAM (Segment Anything Model) for precise segmentation
    - Simple blob detection as fallback
    """
    
    def __init__(self):
        self.model = None
        self.model_type = "simple"  # simple, yolo, sam
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize the object detection model."""
        import torch
        self.model_type = "sam"
        logger.info("Object detector initialized in SAM mode (lazy-loaded)")
    
    async def detect_objects(
        self,
        image: Image.Image,
        confidence_threshold: float = 0.5,
        classes: Optional[List[str]] = None
    ) -> List[BoundingBox]:
        """
        Detect objects in an image.
        
        Args:
            image: PIL Image to process
            confidence_threshold: Minimum confidence for detections
            classes: Optional list of class names to filter
            
        Returns:
            List of BoundingBox objects
        """
        if self.model_type == "yolo":
            return await self._detect_yolo(image, confidence_threshold, classes)
        elif self.model_type == "sam":
            return await self._detect_sam(image)
        else:
            return await self._detect_simple(image)
    
    async def _detect_yolo(
        self,
        image: Image.Image,
        confidence_threshold: float,
        classes: Optional[List[str]]
    ) -> List[BoundingBox]:
        """Detect objects using YOLO model."""
        # TODO: Implement YOLO detection
        # results = self.model(image)
        # detections = []
        # for result in results[0].boxes.data:
        #     x1, y1, x2, y2, conf, cls = result
        #     class_name = self.model.names[int(cls)]
        #     if conf >= confidence_threshold:
        #         if classes is None or class_name in classes:
        #             detections.append(BoundingBox(
        #                 int(x1), int(y1), int(x2), int(y2),
        #                 float(conf), class_name
        #             ))
        # return detections
        return []
    
    async def _detect_sam(self, image: Image.Image) -> List[BoundingBox]:
        """Detect objects using Segment Anything Model."""
        # TODO: Implement SAM detection
        # from segment_anything import sam_model_registry, SamAutomaticMaskGenerator
        # mask_generator = SamAutomaticMaskGenerator(sam)
        # masks = mask_generator.generate(np.array(image))
        return []
    
    async def _detect_simple(self, image: Image.Image) -> List[BoundingBox]:
        """
        Simple blob detection using image processing.
        This is a fallback when no ML models are available.
        """
        import cv2
        
        # Convert PIL to OpenCV
        img_array = np.array(image.convert('RGB'))
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Edge detection
        edges = cv2.Canny(blurred, 50, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detections = []
        min_area = (image.width * image.height) * 0.01  # At least 1% of image
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area < min_area:
                continue
            
            # Get bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate confidence based on contour properties
            perimeter = cv2.arcLength(contour, True)
            if perimeter > 0:
                circularity = 4 * np.pi * area / (perimeter ** 2)
                confidence = min(0.95, circularity)
            else:
                confidence = 0.5
            
            detections.append(BoundingBox(
                x, y, x + w, y + h,
                confidence,
                f"object_{i}"
            ))
        
        # Sort by area (largest first)
        detections.sort(key=lambda d: d.area, reverse=True)
        
        # Return top 10 detections
        return detections[:10]
    
    async def generate_mask_from_bbox(
        self,
        image: Image.Image,
        bbox: BoundingBox,
        feather: int = 10
    ) -> Image.Image:
        """
        Generate a mask image from a bounding box with feathered edges.
        
        Args:
            image: Source image (for dimensions)
            bbox: Bounding box to convert to mask
            feather: Feather radius for soft edges
            
        Returns:
            PIL Image mask (grayscale)
        """
        from PIL import ImageDraw, ImageFilter
        
        # Create mask
        mask = Image.new('L', image.size, 0)
        draw = ImageDraw.Draw(mask)
        
        # Draw filled rectangle
        draw.rectangle([bbox.x1, bbox.y1, bbox.x2, bbox.y2], fill=255)
        
        # Apply feathering (blur edges)
        if feather > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(radius=feather))
        
        return mask
    
    async def generate_mask_from_point(
        self,
        image: Image.Image,
        point: Tuple[int, int],
        use_sam: bool = False
    ) -> Optional[Image.Image]:
        """
        Generate a mask by clicking on an object.
        Uses SAM if available, otherwise flood fill.
        """
        if use_sam and self.model_type == "sam":
            from app.services.inference.sam_seg import sam_segment_smart_select
            try:
                mask = await asyncio.get_running_loop().run_in_executor(
                    None, sam_segment_smart_select, image, point
                )
                if mask is not None:
                    return mask
            except Exception as e:
                logger.warning(f"SAM point segmentation failed, falling back: {e}")

        # Fallback: Use flood fill
        import cv2
        
        img_array = np.array(image.convert('RGB'))
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        # Create mask for flood fill
        h, w = img_cv.shape[:2]
        mask = np.zeros((h + 2, w + 2), np.uint8)
        
        # Get seed point color
        seed_point = (point[0], point[1])
        
        # Flood fill with tolerance
        tolerance = 30
        flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
        
        try:
            cv2.floodFill(
                img_cv,
                mask,
                seed_point,
                (255, 255, 255),
                (tolerance,) * 3,
                (tolerance,) * 3,
                flags
            )
            
            # Extract the mask (remove border pixels)
            result_mask = mask[1:-1, 1:-1]
            
            # Convert to PIL Image
            return Image.fromarray(result_mask, mode='L')
        except Exception as e:
            logger.error(f"Flood fill failed: {e}")
            return None


# Global detector instance
_detector: Optional[ObjectDetector] = None


def get_object_detector() -> ObjectDetector:
    """Get or create the global object detector instance."""
    global _detector
    if _detector is None:
        _detector = ObjectDetector()
    return _detector
