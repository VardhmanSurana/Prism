import os
import logging
from pathlib import Path
from watchdog.observers import Observer
from typing import TYPE_CHECKING

from app.services.sync.handler import PhotoEventHandler

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class ObserverMixin:
    """Handles file system observer setup and management."""

    def start_observer(self: "SyncService"):
        if self.observer:
            try:
                self.observer.stop()
            except Exception:
                pass

        self.observer = Observer()
        handler = PhotoEventHandler(self, self.loop)

        pictures_path = Path.home() / "Pictures"
        if pictures_path.exists():
            self.observer.schedule(handler, str(pictures_path), recursive=True)
            logger.info(f"Watching for changes in {pictures_path}")

        if os.name == 'posix':
            media_path = "/media" if os.path.exists("/media") else "/Volumes"
            if os.path.exists(media_path):
                self.observer.schedule(handler, media_path, recursive=False)

        self.observer.start()
