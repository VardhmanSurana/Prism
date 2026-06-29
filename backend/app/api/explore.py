from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
import json
import logging

from app.db import get_db
from app.models import Photo, Event
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service
from app.services.locked_service import locked_service

logger = logging.getLogger(__name__)

router = APIRouter()

SEASON_MAP = {
    3: "spring", 4: "spring", 5: "spring",
    6: "summer", 7: "summer", 8: "summer",
    9: "autumn", 10: "autumn", 11: "autumn",
    12: "winter", 1: "winter", 2: "winter",
}

SEASON_ORDER = {"winter": 0, "spring": 1, "summer": 2, "autumn": 3}

SEASON_LABELS = {
    "spring": "Spring",
    "summer": "Summer",
    "autumn": "Autumn",
    "winter": "Winter",
}


def _base_photo_filters():
    filters = [Photo.is_trash == False]
    if not locked_service.is_authenticated:
        filters.append(Photo.is_locked == False)
    active_mounts = list(sync_service.active_mounts)
    if active_mounts:
        filters.append(
            or_(Photo.is_external == False, Photo.device_id.in_(active_mounts))
        )
    return filters


@router.get("/themes")
async def explore_themes(db: AsyncSession = Depends(get_db)):
    filters = _base_photo_filters()
    filters.append(Photo.auto_tags.isnot(None))

    stmt = select(Photo).where(and_(*filters))
    result = await db.execute(stmt)
    photos = result.scalars().all()

    tag_photos: dict[str, list[Photo]] = {}
    for photo in photos:
        try:
            tags = json.loads(photo.auto_tags)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(tags, list):
            continue
        for tag in tags:
            tag = tag.strip().lower()
            if not tag:
                continue
            tag_photos.setdefault(tag, []).append(photo)

    themes = []
    for tag, tag_photo_list in tag_photos.items():
        if len(tag_photo_list) < 3:
            continue
        tag_photo_list.sort(key=lambda p: p.date_taken or p.date or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        themes.append({
            "tag": tag,
            "count": len(tag_photo_list),
            "photos": [photo_to_dict(p) for p in tag_photo_list[:6]],
        })

    themes.sort(key=lambda t: t["count"], reverse=True)
    return {"themes": themes[:12]}


@router.get("/timeline")
async def explore_timeline(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Event)
        .order_by(Event.start_date.desc().nullslast())
    )
    result = await db.execute(stmt)
    events = result.scalars().unique().all()

    timeline = []
    for event in events:
        cover_photos = []
        if event.photos:
            valid_photos = [p for p in event.photos if not p.is_trash and (locked_service.is_authenticated or not p.is_locked)]
            valid_photos.sort(key=lambda p: p.date_taken or p.date or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
            cover_photos = [photo_to_dict(p) for p in valid_photos[:4]]

        timeline.append({
            "id": event.id,
            "title": event.title,
            "event_type": event.event_type,
            "start_date": event.start_date.isoformat() if event.start_date else None,
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "photo_count": len(event.photos) if event.photos else 0,
            "cover_photos": cover_photos,
            "summary": event.summary,
        })

    return {"events": timeline}


@router.get("/on-this-day")
async def explore_on_this_day(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_month = now.month
    today_day = now.day
    current_year = now.year

    filters = _base_photo_filters()
    filters.append(extract("month", Photo.date_taken) == today_month)
    filters.append(extract("day", Photo.date_taken) == today_day)
    filters.append(extract("year", Photo.date_taken) < current_year)

    stmt = (
        select(Photo)
        .where(and_(*filters))
        .order_by(Photo.date_taken.desc())
    )
    result = await db.execute(stmt)
    photos = result.scalars().all()

    year_groups: dict[int, list[Photo]] = {}
    for photo in photos:
        if photo.date_taken:
            year = photo.date_taken.year
            year_groups.setdefault(year, []).append(photo)

    on_this_day = []
    for year in sorted(year_groups.keys(), reverse=True):
        year_photos = year_groups[year]
        on_this_day.append({
            "year": year,
            "photo_count": len(year_photos),
            "photos": [photo_to_dict(p) for p in year_photos[:10]],
        })

    return {"items": on_this_day}


@router.get("/seasons")
async def explore_seasons(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    current_year = now.year

    filters = _base_photo_filters()
    filters.append(Photo.date_taken.isnot(None))

    stmt = select(Photo).where(and_(*filters))
    result = await db.execute(stmt)
    photos = result.scalars().all()

    season_buckets: dict[str, list[Photo]] = {}
    for photo in photos:
        if not photo.date_taken:
            continue
        season = SEASON_MAP.get(photo.date_taken.month)
        if not season:
            continue
        bucket_key = f"{season}_{photo.date_taken.year}"
        season_buckets.setdefault(bucket_key, []).append(photo)

    bucket_list = []
    for key, bucket_photos in season_buckets.items():
        season, year_str = key.rsplit("_", 1)
        year = int(year_str)
        bucket_photos.sort(key=lambda p: p.date_taken or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        bucket_list.append({
            "label": f"{SEASON_LABELS[season]} {year}",
            "season": season,
            "year": year,
            "photo_count": len(bucket_photos),
            "photos": [photo_to_dict(p) for p in bucket_photos[:6]],
        })

    bucket_list.sort(key=lambda b: (b["year"], SEASON_ORDER.get(b["season"], 0)), reverse=True)
    return {"seasons": bucket_list[:8]}
