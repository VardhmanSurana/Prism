import os
import sys
import time
import asyncio
import logging
import psutil
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class LifecycleMixin:
    """Handles service initialization, shutdown, and parent process monitoring."""

    async def initialize(self: "SyncService"):
        self.loop = asyncio.get_running_loop()
        self.db_write_semaphore = asyncio.Semaphore(1)
        await self._load_settings()

        self.update_active_mounts()
        self.mount_check_task = asyncio.create_task(self.period_mount_check())
        self.lifecycle_task = asyncio.create_task(self.check_parent_lifecycle())

        if self.is_running:
            self.start_observer()
            self.scan_task = asyncio.create_task(self.full_scan())

    async def shutdown(self: "SyncService"):
        logger.info(f"Shutting down SyncService (active_tasks: {self.active_tasks})...")

        wait_start = time.time()
        while self.active_tasks > 0 and (time.time() - wait_start < 30):
            logger.info(f"Waiting for {self.active_tasks} active tasks to finish...")
            await asyncio.sleep(1)

        if self.observer:
            try:
                self.observer.stop()
                self.observer.join()
            except Exception as e:
                logger.error(f"Error stopping observer: {e}")

        if self.scan_task:
            self.scan_task.cancel()

        if self.mount_check_task:
            self.mount_check_task.cancel()

        if self.lifecycle_task:
            self.lifecycle_task.cancel()

        try:
            self.process_pool.shutdown(wait=True)
        except Exception as e:
            logger.error(f"Error shutting down process pool: {e}")

        logger.info("SyncService shutdown complete.")

    async def check_parent_lifecycle(self: "SyncService"):
        while True:
            if not psutil.pid_exists(self.parent_pid):
                if not self.is_scanning and self.active_tasks <= 0:
                    logger.info("Parent process died and service is idle. Shutting down sidecar...")
                    await self.shutdown()
                    sys.exit(0)
            await asyncio.sleep(5)
