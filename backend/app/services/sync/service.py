"""
Sync Service - Re-export from modular components.

This module re-exports the main SyncService class and singleton instance
from the modular submodules for backward compatibility.

The service has been decomposed into:
- core.py: Main SyncService class (composes all mixins)
- lifecycle.py: Initialization, shutdown, parent process monitoring
- config.py: Settings persistence and configuration updates
- broadcast.py: SSE client subscription and event broadcasting
- mounts.py: Mount point detection and monitoring
- observer.py: File system watcher setup
- scanning.py: File system scanning and cleanup
- ingestion.py: Photo ingestion and duplicate detection
"""

from .core import SyncService, sync_service

__all__ = ["SyncService", "sync_service"]
