"""
Local LLM-generated story recaps for events and photo clusters.

Feeds photo metadata (tags, locations, people, dates, captions) into the
local llama-server agent model to generate short natural-language summaries.
Runs 100% offline — no external API calls.

Example output:
  "Weekend in Goa, 14 photos. Beach vibes and seafood dinners.
   Mom, Dad, and Sarah appear in several shots."
"""

import json
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models import Photo, Event, PhotoPerson, Person

logger = logging.getLogger(__name__)


def _build_event_context(photos: list, event_title: str = "") -> str:
    """Build a structured context string from photo metadata for the LLM prompt.

    This is pure text — no images are sent to the model. Only metadata
    extracted during the existing background pipeline.
    """
    lines = []

    # Event/title
    if event_title:
        lines.append(f"Event: {event_title}")

    # Photo count
    lines.append(f"Total photos: {len(photos)}")

    # Date range
    dates = [p.date_taken or p.date for p in photos if p.date_taken or p.date]
    if dates:
        earliest = min(dates)
        latest = max(dates)
        if earliest.date() == latest.date():
            lines.append(f"Date: {earliest.strftime('%B %d, %Y')}")
        else:
            lines.append(f"Dates: {earliest.strftime('%B %d')} – {latest.strftime('%B %d, %Y')}")

    # Locations
    locations = set()
    for p in photos:
        parts = [p.city, p.state, p.country]
        loc = ", ".join(part for part in parts if part)
        if loc:
            locations.add(loc)
    if locations:
        lines.append(f"Locations: {', '.join(sorted(locations))}")

    # People (from PhotoPerson relationship)
    people_names = set()
    for p in photos:
        if hasattr(p, 'people') and p.people:
            for pp in p.people:
                if pp.person and pp.person.name:
                    people_names.add(pp.person.name)
    if people_names:
        people_list = sorted(people_names)
        if len(people_list) <= 3:
            lines.append(f"People: {', '.join(people_list)}")
        else:
            lines.append(f"People: {', '.join(people_list[:3])} and {len(people_list) - 3} others")

    # Tags (aggregated)
    all_tags = {}
    for p in photos:
        if p.auto_tags:
            try:
                tags = json.loads(p.auto_tags)
                if isinstance(tags, list):
                    for tag in tags:
                        tag = tag.strip().lower()
                        if tag:
                            all_tags[tag] = all_tags.get(tag, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass
    if all_tags:
        top_tags = sorted(all_tags.items(), key=lambda x: x[1], reverse=True)[:10]
        tag_str = ", ".join(f"{tag} ({count})" for tag, count in top_tags)
        lines.append(f"Tags: {tag_str}")

    # Captions (a few representative ones)
    captions = [p.caption for p in photos if p.caption][:5]
    if captions:
        lines.append("Sample captions:")
        for cap in captions:
            lines.append(f"  - {cap[:100]}")

    # OCR text presence
    ocr_photos = [p for p in photos if p.ocr_text]
    if ocr_photos:
        lines.append(f"Photos with text: {len(ocr_photos)}")

    return "\n".join(lines)


STORY_PROMPT_TEMPLATE = """You are a concise photo storyteller. Given metadata about a collection of photos, write a short, warm, natural-language summary (2-4 sentences). 

Rules:
- Be specific: mention real names, places, dates
- Keep it under 50 words
- No bullet points, no lists — just a flowing paragraph
- If people are mentioned by name, weave them in naturally
- Match the tone: casual for trips, warm for family events
- Do NOT start with "This collection" or "These photos" — start directly with the subject

Context:
{context}

Write the story:"""


async def generate_event_story(
    event_id: int,
    db: AsyncSession,
    max_tokens: int = 150,
) -> str | None:
    """Generate a story recap for an existing event using the local LLM.

    Args:
        event_id: Event ID to generate a story for.
        db: Database session.

    Returns:
        Generated story text, or None on error.
    """
    from app.agent.llm import LlamaManager

    # Fetch event with photos
    stmt = (
        select(Event)
        .options(selectinload(Event.photos).selectinload(Photo.people).selectinload(PhotoPerson.person))
        .where(Event.id == event_id)
    )
    result = await db.execute(stmt)
    event = result.scalar_one_or_none()
    if not event:
        logger.warning(f"Event {event_id} not found")
        return None

    if not event.photos:
        logger.info(f"Event {event_id} has no photos")
        return None

    # Build context and prompt
    context = _build_event_context(event.photos, event.title)
    prompt = STORY_PROMPT_TEMPLATE.format(context=context)

    # Query local LLM
    llm = LlamaManager.get_llm()
    if not llm:
        logger.error("Failed to start agent llama-server")
        return None

    try:
        response = llm(prompt, max_tokens=max_tokens, temperature=0.3)
        story = response.get("content", "").strip()

        if story:
            # Store in event
            event.summary = story
            await db.commit()
            logger.info(f"Generated story for event {event_id}: {story[:80]}...")
            return story
        else:
            logger.warning(f"LLM returned empty story for event {event_id}")
            return None
    except Exception as e:
        logger.error(f"Failed to generate story for event {event_id}: {e}")
        return None
    finally:
        LlamaManager.unload_llm()


async def generate_cluster_story(
    photo_ids: list[int],
    title: str = "",
    db: AsyncSession = None,
    max_tokens: int = 150,
) -> str | None:
    """Generate a story recap for an arbitrary cluster of photos.

    Useful for On This Day, theme collections, or any ad-hoc grouping
    that isn't an Event.

    Args:
        photo_ids: List of photo IDs to generate a story for.
        title: Optional title for the cluster.
        db: Database session.

    Returns:
        Generated story text, or None on error.
    """
    from app.agent.llm import LlamaManager

    if not db:
        logger.error("Database session required")
        return None

    # Fetch photos with people
    stmt = (
        select(Photo)
        .options(selectinload(Photo.people).selectinload(PhotoPerson.person))
        .where(Photo.id.in_(photo_ids), Photo.is_trash == False)
    )
    result = await db.execute(stmt)
    photos = result.scalars().unique().all()

    if not photos:
        return None

    context = _build_event_context(photos, title)
    prompt = STORY_PROMPT_TEMPLATE.format(context=context)

    llm = LlamaManager.get_llm()
    if not llm:
        return None

    try:
        response = llm(prompt, max_tokens=max_tokens, temperature=0.3)
        story = response.get("content", "").strip()
        return story if story else None
    except Exception as e:
        logger.error(f"Failed to generate cluster story: {e}")
        return None
    finally:
        LlamaManager.unload_llm()
