import os
import asyncio
import concurrent.futures
import logging
from pathlib import Path
from watchdog.observers import Observer

from app.config import settings

from .lifecycle import LifecycleMixin
from .config import ConfigMixin
from .broadcast import BroadcastMixin
from .mounts import MountMixin
from .observer import ObserverMixin
from .scanning import ScanningMixin
from .ingestion import IngestionMixin

logger = logging.getLogger(__name__)


class SyncService(
    LifecycleMixin,
    ConfigMixin,
    BroadcastMixin,
    MountMixin,
    ObserverMixin,
    ScanningMixin,
    IngestionMixin
):
    """
    Main sync service coordinating photo ingestion, file watching, and scanning.
    Composed from modular mixins for maintainability.
    """

    def __init__(self):
        self.is_running = False
        self.excluded_folders = []
        self.active_mounts = set()
        self.observer = None
        self.scan_task = None
        self.mount_check_task = None
        self.lifecycle_task = None
        self.parent_pid = os.getppid()
        self.loop = None
        self.active_tasks = 0

        # Process Pool for multi-core scaling
        self.process_pool = concurrent.futures.ProcessPoolExecutor(max_workers=max(1, os.cpu_count() - 1))

        # Progress Tracking
        self.total_files = 0
        self.processed_files = 0
        self.is_scanning = False
        self.clients = set()

        # Concurrency & Debounce controls
        self.db_write_semaphore = None
        self.place_sync_timer = None
        self.heartbeat_task = None


sync_service = SyncService()
