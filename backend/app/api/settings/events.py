"""SSE event stream endpoint."""
import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services.sync_service import sync_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/events")
async def sse_events():
    async def event_generator():
        q = await sync_service.subscribe()
        try:
            last_status = None
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=2.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    pass

                current_status = sync_service.get_status()
                if current_status != last_status:
                    last_status = current_status
                    yield f"data: {json.dumps({'type': 'status', 'data': current_status})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            await sync_service.unsubscribe(q)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
