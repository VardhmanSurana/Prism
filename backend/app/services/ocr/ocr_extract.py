import logging
from app.services.ocr.ocr_manager import OCRManager

logger = logging.getLogger(__name__)


def extract_ocr_text(image_path: str) -> str | None:
    ocr_func = OCRManager.get_ocr()
    if not ocr_func:
        logger.warning("OCR server failed to start")
        return None
    try:
        result = ocr_func(image_path)
        if result:
            logger.info(f"OCR extracted {len(result)} chars from {image_path}")
        return result
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return None
