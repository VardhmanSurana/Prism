"""Story recap endpoints — local LLM-generated summaries for events and clusters."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db import get_db
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class StoryRequest(BaseModel):
    event_id: int | None = None
    photo_ids: list[int] | None = None
    title: str = ""


@router.post("/generate")
async def generate_story(
    request: StoryRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a local LLM story recap for an event or photo cluster.

    Runs 100% offline via the local llama-server agent model.
    Only metadata (tags, names, locations, dates) is sent to the model — never images.
    """
    if not settings.ENABLE_AI_STORY:
        raise HTTPException(
            status_code=400,
            detail="Story generation is disabled. Set ENABLE_AI_STORY=True in your .env file."
        )

    if not request.event_id and not request.photo_ids:
        raise HTTPException(
            status_code=400,
            detail="Provide either event_id or photo_ids"
        )

    from app.services.story_service import generate_event_story, generate_cluster_story

    if request.event_id:
        story = await generate_event_story(request.event_id, db)
        if not story:
            raise HTTPException(status_code=500, detail="Failed to generate story")
        return {
            "story": story,
            "source": "event",
            "event_id": request.event_id,
        }
    else:
        story = await generate_cluster_story(
            request.photo_ids, request.title, db
        )
        if not story:
            raise HTTPException(status_code=500, detail="Failed to generate story")
        return {
            "story": story,
            "source": "cluster",
            "photo_count": len(request.photo_ids),
        }


@router.get("/event/{event_id}")
async def get_event_story(
    event_id: int,
    regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Get the story for an event. Generates one if it doesn't exist or regenerate=true."""
    from app.models import Event

    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.summary and not regenerate:
        return {
            "story": event.summary,
            "source": "cached",
            "event_id": event_id,
        }

    if not settings.ENABLE_AI_STORY:
        if event.summary:
            return {
                "story": event.summary,
                "source": "cached",
                "event_id": event_id,
            }
        raise HTTPException(
            status_code=400,
            detail="Story generation is disabled. Set ENABLE_AI_STORY=True."
        )

    from app.services.story_service import generate_event_story
    story = await generate_event_story(event_id, db)
    if not story:
        raise HTTPException(status_code=500, detail="Failed to generate story")

    return {
        "story": story,
        "source": "generated",
        "event_id": event_id,
    }
