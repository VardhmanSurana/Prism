from app.services.sync.service import sync_service, SyncService
from app.services.sync.handler import PhotoEventHandler, SUPPORTED_EXTENSIONS
from app.services.sync.tasks import (
    process_image_task as _process_image_task
)
from app.utils.image import ImageOps, ImageProcessor

# Backward compatibility exports
__all__ = [
    'sync_service', 
    'SyncService', 
    'PhotoEventHandler', 
    'SUPPORTED_EXTENSIONS', 
    '_process_image_task', 
    'ImageProcessor'
]
