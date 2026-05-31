import asyncio
import logging
import traceback
from app.utils.image import generate_thumbnail

logger = logging.getLogger(__name__)

def process_image_task(file_path: str, thumb_dir: str):
    """
    Runs in a separate process. 
    Uses the utility function to generate thumbnail and extract metadata.
    """
    return generate_thumbnail(file_path, thumb_dir)
