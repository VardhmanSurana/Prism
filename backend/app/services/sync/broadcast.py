import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .core import SyncService


class BroadcastMixin:
    """Handles SSE client subscription and event broadcasting."""

    async def subscribe(self: "SyncService") -> asyncio.Queue:
        q = asyncio.Queue()
        self.clients.add(q)
        return q

    async def unsubscribe(self: "SyncService", q: asyncio.Queue):
        if q in self.clients:
            self.clients.remove(q)

    def broadcast(self: "SyncService", event: dict):
        for q in list(self.clients):
            try:
                q.put_nowait(event)
            except Exception:
                pass
