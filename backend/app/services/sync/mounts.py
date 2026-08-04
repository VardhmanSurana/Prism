import os
import asyncio
import psutil
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class MountMixin:
    """Handles mount point detection and monitoring."""

    def update_active_mounts(self: "SyncService"):
        self.active_mounts = {p.mountpoint for p in psutil.disk_partitions(all=False)}

    async def period_mount_check(self: "SyncService"):
        while True:
            old_mounts = self.active_mounts.copy()
            self.update_active_mounts()
            if old_mounts != self.active_mounts:
                pass
            await asyncio.sleep(5)

    def get_mount_point(self: "SyncService", path: str) -> str:
        path = os.path.abspath(path)
        while not os.path.ismount(path):
            parent = os.path.dirname(path)
            if parent == path:
                break
            path = parent
        return path
