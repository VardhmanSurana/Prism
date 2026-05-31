import json
import logging
from pathlib import Path
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class ConfigMixin:
    """Handles settings persistence and configuration updates."""

    async def _load_settings(self: "SyncService"):
        if settings.SETTINGS_FILE.exists():
            try:
                with open(settings.SETTINGS_FILE, 'r') as f:
                    config = json.load(f)
                    sync_cfg = config.get("sync_config", {})
                    self.is_running = sync_cfg.get("is_enabled", False)
                    self.excluded_folders = sync_cfg.get("excluded_folders", [])
                    return
            except Exception as e:
                logger.error(f"Failed to load settings from JSON: {e}")
        self.is_running = False
        self.excluded_folders = []

    async def _save_settings(self: "SyncService"):
        sync_config = {"is_enabled": self.is_running, "excluded_folders": self.excluded_folders}
        try:
            config_to_save = {}
            if settings.SETTINGS_FILE.exists():
                with open(settings.SETTINGS_FILE, 'r') as f:
                    config_to_save = json.load(f)
            config_to_save["sync_config"] = sync_config
            with open(settings.SETTINGS_FILE, 'w') as f:
                json.dump(config_to_save, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save settings to JSON: {e}")

    async def update_config(self: "SyncService", is_enabled: bool, excluded_folders: list):
        self.is_running = is_enabled
        self.excluded_folders = excluded_folders
        await self._save_settings()

        if self.is_running:
            self.start_observer()
            if self.scan_task:
                self.scan_task.cancel()
            self.scan_task = asyncio.create_task(self.full_scan())
        else:
            if self.observer:
                self.observer.stop()
            if self.scan_task:
                self.scan_task.cancel()

    async def reset_scan(self: "SyncService"):
        self.is_scanning = False
        self.total_files = 0
        self.processed_files = 0

        if self.scan_task:
            self.scan_task.cancel()
            try:
                await self.scan_task
            except asyncio.CancelledError:
                pass
            self.scan_task = None

        self.broadcast({"type": "status", "data": self.get_status()})
