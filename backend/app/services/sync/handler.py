import os
import asyncio
from watchdog.events import FileSystemEventHandler

SUPPORTED_EXTENSIONS = (
    '.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif', '.dng', '.tiff', '.tif', '.bmp', '.gif',
    '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp',
)

VIDEO_EXTENSIONS = ('.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.3gp')

def is_video_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in VIDEO_EXTENSIONS

def get_file_type(path: str) -> str:
    return 'video' if is_video_file(path) else 'image'

class PhotoEventHandler(FileSystemEventHandler):
    def __init__(self, service, loop):
        self.service = service
        self.loop = loop

    def on_created(self, event):
        if not event.is_directory:
            ext = os.path.splitext(event.src_path)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                asyncio.run_coroutine_threadsafe(self.service.process_file_sync(event.src_path), self.loop)

    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(self.service.delete_photo_by_path(event.src_path), self.loop)

    def on_moved(self, event):
        if not event.is_directory:
            # Delete the old path
            asyncio.run_coroutine_threadsafe(self.service.delete_photo_by_path(event.src_path), self.loop)
            # Add the new path if it's a supported extension
            ext = os.path.splitext(event.dest_path)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                asyncio.run_coroutine_threadsafe(self.service.process_file_sync(event.dest_path), self.loop)
