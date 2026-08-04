import asyncio
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService

logger = logging.getLogger(__name__)


class BroadcastMixin:
    """Handles SSE client subscription and event broadcasting."""

    async def subscribe(self: "SyncService") -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self.clients.add(q)
        return q

    async def unsubscribe(self: "SyncService", q: asyncio.Queue):
        if q in self.clients:
            self.clients.remove(q)

    def broadcast(self: "SyncService", event: dict):
        stale = []
        for q in list(self.clients):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                stale.append(q)
            except Exception:
                stale.append(q)
        for q in stale:
            self.clients.discard(q)

    async def start_heartbeat(self: "SyncService", interval: float = 30.0):
        """Periodically prune stale client queues that fill up or never drain."""
        while True:
            await asyncio.sleep(interval)
            stale = []
            for q in list(self.clients):
                try:
                    q.put_nowait({"type": "heartbeat"})
                except asyncio.QueueFull:
                    stale.append(q)
                except Exception:
                    stale.append(q)
            for q in stale:
                self.clients.discard(q)
                logger.debug("Pruned stale SSE client queue")
