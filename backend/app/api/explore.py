from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, extract
import json
import logging

from sqlalchemy.orm import selectinload

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


def _camera_label(make_value: str | None, model_value: str | None) -> str | None:
    """Return a stable, readable camera label without duplicate make names."""
    make = (make_value or "").strip()
    model = (model_value or "").strip()
    if not model:
        return make or None
    if make and model.lower().startswith(make.lower()):
        return model
    return " ".join(part for part in (make, model) if part)


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


@router.get("/insights")
async def explore_insights(db: AsyncSession = Depends(get_db)):
    """Summarise the user's visible photo metadata for the Explore dashboard."""
    stmt = select(
        Photo.exif_make,
        Photo.exif_model,
        Photo.exif_focal_length,
        Photo.exif_iso,
        Photo.city,
        Photo.country,
    ).where(and_(*_base_photo_filters()))
    result = await db.execute(stmt)
    photos = result.all()

    cameras: dict[str, int] = {}
    locations: dict[str, int] = {}
    focal_lengths: list[float] = []
    iso_values: list[int] = []

    for row in photos:
        camera = _camera_label(row.exif_make, row.exif_model)
        if camera:
            cameras[camera] = cameras.get(camera, 0) + 1

        location = (row.city or row.country or "").strip()
        if location:
            locations[location] = locations.get(location, 0) + 1

        if row.exif_focal_length and row.exif_focal_length > 0:
            focal_lengths.append(float(row.exif_focal_length))
        if row.exif_iso and row.exif_iso > 0:
            iso_values.append(int(row.exif_iso))

    focal_buckets: dict[float, int] = {}
    for focal_length in focal_lengths:
        rounded = round(focal_length, 1)
        focal_buckets[rounded] = focal_buckets.get(rounded, 0) + 1

    def ranked(items: dict[str, int], limit: int = 3) -> list[dict[str, int | str]]:
        return [
            {"label": label, "count": count}
            for label, count in sorted(items.items(), key=lambda item: (-item[1], item[0].lower()))[:limit]
        ]

    top_focal = max(focal_buckets.items(), key=lambda item: (item[1], -item[0]), default=(None, 0))
    return {
        "photo_count": len(photos),
        "cameras": ranked(cameras),
        "locations": ranked(locations),
        "average_iso": round(sum(iso_values) / len(iso_values)) if iso_values else None,
        "average_focal_length": round(sum(focal_lengths) / len(focal_lengths), 1) if focal_lengths else None,
        "favorite_focal_length": top_focal[0],
        "metadata_coverage": {
            "camera": sum(cameras.values()),
            "focal_length": len(focal_lengths),
            "iso": len(iso_values),
            "location": sum(locations.values()),
        },
    }


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
        .options(selectinload(Event.photos))
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


@router.get("/activity")
async def explore_activity(db: AsyncSession = Depends(get_db)):
    """Fetch recent activity timeline (recent imports, album creations, AI searches)."""
    filters = _base_photo_filters()
    
    # 1. Recent photo imports
    stmt_photos = select(Photo).where(and_(*filters)).order_by(Photo.id.desc()).limit(12)
    res_photos = await db.execute(stmt_photos)
    recent_photos = res_photos.scalars().all()
    
    # 2. Recent albums
    from app.models import Album, PhotoAlbum, Person, PhotoPerson, AgentSession, VideoProject
    stmt_albums = select(Album).order_by(Album.id.desc()).limit(5)
    res_albums = await db.execute(stmt_albums)
    recent_albums = res_albums.scalars().all()
    
    # 3. Recent AI agent queries
    stmt_agent = select(AgentSession).order_by(AgentSession.updated_at.desc()).limit(5)
    res_agent = await db.execute(stmt_agent)
    recent_sessions = res_agent.scalars().all()

    activities = []

    if recent_photos:
        import_photos = recent_photos[:6]
        locations = set()
        for p in import_photos:
            loc = (p.city or p.country or "").strip()
            if loc:
                locations.add(loc)
        subtitle_str = ", ".join(list(locations)[:3]) if locations else f"{len(recent_photos)} new items added"
        activities.append({
            "id": f"import-latest",
            "type": "import",
            "title": f"Imported {len(recent_photos)} photos",
            "subtitle": subtitle_str,
            "timestamp": import_photos[0].upload_date.isoformat() if import_photos[0].upload_date else datetime.now(timezone.utc).isoformat(),
            "photo_count": len(recent_photos),
            "photos": [photo_to_dict(p) for p in import_photos],
        })

    for alb in recent_albums:
        activities.append({
            "id": f"album-{alb.id}",
            "type": "album",
            "title": f"Created Album '{alb.name}'",
            "subtitle": f"{alb.type.capitalize()} Album • {alb.photo_count} photos",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "photo_count": alb.photo_count,
            "cover_url": alb.cover_url,
        })

    for sess in recent_sessions:
        if sess.title and sess.title != "New Chat":
            activities.append({
                "id": f"agent-{sess.id}",
                "type": "ai_search",
                "title": f"Searched '{sess.title}'",
                "subtitle": "AI Agent Neural Search",
                "timestamp": sess.updated_at.isoformat() if sess.updated_at else datetime.now(timezone.utc).isoformat(),
                "session_id": sess.id,
            })

    activities.sort(key=lambda a: a.get("timestamp") or "", reverse=True)
    return {"activities": activities[:10]}


@router.get("/highlights")
async def explore_highlights(db: AsyncSession = Depends(get_db)):
    """Fetch auto-generated memory highlight reels compiled from events & media clusters."""
    stmt = select(Event).options(selectinload(Event.photos)).order_by(Event.start_date.desc().nullslast()).limit(6)
    res = await db.execute(stmt)
    events = res.scalars().unique().all()

    highlights = []
    for event in events:
        valid_photos = [p for p in (event.photos or []) if not p.is_trash and (locked_service.is_authenticated or not p.is_locked)]
        if not valid_photos:
            continue

        video_count = sum(1 for p in valid_photos if p.file_type == "video" or p.mime_type.startswith("video"))
        cover_photos = [photo_to_dict(p) for p in valid_photos[:4]]
        
        # Estimate reel duration (3 seconds per photo, video duration if available)
        duration_sec = min(90, max(15, len(valid_photos) * 4))

        highlights.append({
            "id": f"highlight-event-{event.id}",
            "event_id": event.id,
            "title": f"{event.title} Highlights",
            "subtitle": f"{event.event_type.capitalize()} • {len(valid_photos)} photos ({video_count} videos)",
            "location": event.location,
            "duration_sec": duration_sec,
            "photo_count": len(valid_photos),
            "cover_photos": cover_photos,
            "summary": event.summary or f"A collection of memories from {event.title}.",
        })

    # Fallback: create seasonal highlight if no events exist yet
    if not highlights:
        filters = _base_photo_filters()
        filters.append(Photo.is_favorite == True)
        stmt_fav = select(Photo).where(and_(*filters)).order_by(Photo.date_taken.desc()).limit(8)
        res_fav = await db.execute(stmt_fav)
        fav_photos = res_fav.scalars().all()
        if fav_photos:
            highlights.append({
                "id": "highlight-favorites",
                "event_id": None,
                "title": "Favorite Memories Highlights",
                "subtitle": f"Curated Favorites • {len(fav_photos)} items",
                "location": "Library Highlights",
                "duration_sec": 30,
                "photo_count": len(fav_photos),
                "cover_photos": [photo_to_dict(p) for p in fav_photos[:4]],
                "summary": "Your top starred moments compiled into a cinematic highlight reel.",
            })

    return {"highlights": highlights}


@router.post("/highlights/generate")
async def generate_highlight_project(payload: dict, db: AsyncSession = Depends(get_db)):
    """Generate an NLE Video Editor project from an event or highlight reel."""
    event_id = payload.get("event_id")
    if not event_id:
        # Fallback to recent photos
        filters = _base_photo_filters()
        stmt = select(Photo).where(and_(*filters)).order_by(Photo.date_taken.desc()).limit(10)
        res = await db.execute(stmt)
        photos = res.scalars().all()
        project_name = "Library Highlight Reel"
    else:
        stmt_ev = select(Event).where(Event.id == event_id)
        res_ev = await db.execute(stmt_ev)
        event = res_ev.scalar_one_or_none()
        if not event:
            return {"status": "error", "message": "Event not found"}
        photos = [p for p in (event.photos or []) if not p.is_trash]
        project_name = f"{event.title} Reel"

    from app.models import VideoProject
    import json

    # Create tracks for NLE store
    video_track_clips = []
    audio_track_clips = []
    time_offset = 0.0

    for i, p in enumerate(photos[:12]):
        duration = float(p.duration) if (p.duration and p.duration > 0) else 4.0
        clip_entry = {
            "id": f"clip-hl-{p.id}-{i}",
            "photoId": p.id,
            "name": p.filename,
            "path": p.path,
            "url": p.url or f"/api/v1/photos/{p.id}/file",
            "type": "video" if (p.file_type == "video" or p.mime_type.startswith("video")) else "image",
            "startTime": round(time_offset, 2),
            "duration": round(duration, 2),
            "sourceStart": 0.0,
            "sourceDuration": round(duration, 2),
            "volume": 1.0,
            "opacity": 1.0,
            "transform": {"x": 0, "y": 0, "scale": 1, "rotation": 0},
            "transitionIn": {"type": "fade", "duration": 0.5} if i > 0 else None,
        }
        video_track_clips.append(clip_entry)
        time_offset += duration - (0.5 if i > 0 else 0.0)

    project_json = json.dumps({
        "name": project_name,
        "fps": 30,
        "width": 1920,
        "height": 1080,
        "tracks": [
            {"id": "track-video-main", "name": "Video Track 1", "type": "video", "clips": video_track_clips, "muted": False, "locked": False},
            {"id": "track-audio-bgm", "name": "Audio Track 1", "type": "audio", "clips": audio_track_clips, "muted": False, "locked": False},
        ]
    })

    vproj = VideoProject(
        name=project_name,
        width=1920,
        height=1080,
        fps=30,
        project_json=project_json,
    )
    db.add(vproj)
    await db.commit()
    await db.refresh(vproj)

    return {
        "status": "ok",
        "project_id": vproj.id,
        "name": vproj.name,
        "project_json": project_json,
    }


@router.get("/rediscover-prompts")
async def explore_rediscover_prompts(db: AsyncSession = Depends(get_db)):
    """Fetch micro-task counts and candidate samples for the 'Rediscover' dashboard section."""
    from app.models import Person, PhotoPerson, PhotoAlbum, Album

    filters = _base_photo_filters()
    
    # 1. Unnamed faces count
    stmt_unnamed = select(func.count(Person.id)).where(
        or_(
            Person.name.ilike("Person %"),
            Person.name.ilike("Unknown%"),
            Person.name == ""
        )
    )
    res_unnamed = await db.execute(stmt_unnamed)
    unnamed_faces_count = res_unnamed.scalar() or 0

    # 2. Un-albumed photos count
    stmt_albumed_ids = select(PhotoAlbum.photo_id)
    res_albumed = await db.execute(stmt_albumed_ids)
    albumed_ids = set(row[0] for row in res_albumed.fetchall())

    stmt_all_photos = select(Photo.id, Photo.filename, Photo.city, Photo.blur_score, Photo.latitude).where(and_(*filters))
    res_photos = await db.execute(stmt_all_photos)
    all_photos = res_photos.all()

    unalbumed_count = sum(1 for p in all_photos if p[0] not in albumed_ids)
    blurry_count = sum(1 for p in all_photos if p[3] is not None and p[3] < 25.0)
    missing_location_count = sum(1 for p in all_photos if p[4] is None and not p[2])

    # Sample photo for prompt cards
    stmt_sample = select(Photo).where(and_(*filters)).order_by(Photo.id.desc()).limit(4)
    res_sample = await db.execute(stmt_sample)
    sample_photos = [photo_to_dict(p) for p in res_sample.scalars().all()]

    return {
        "unnamed_faces_count": unnamed_faces_count,
        "unalbumed_count": unalbumed_count,
        "blurry_count": blurry_count,
        "missing_location_count": missing_location_count,
        "sample_photos": sample_photos,
    }

