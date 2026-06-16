import logging
from sqlalchemy import func, select, delete
from app.db import async_session
from app.models import Photo, Album
import json

logger = logging.getLogger(__name__)

async def sync_all_places():
    """
    Scans the Photo table for unique city/state/country combinations
    and synchronizes them with the Album table (type='places').
    """
    logger.info("[PLACES] Starting place synchronization...")
    
    from app.services.sync_service import sync_service
    from sqlalchemy import or_
    active_mounts = list(sync_service.active_mounts)
    
    async with async_session() as db:
        # 1. Get unique locations from Photo table
        result = await db.execute(
            select(
                Photo.city,
                Photo.state,
                Photo.country,
                func.count(Photo.id).label("photo_count"),
                func.max(Photo.url).label("cover_url"),
            )
            .where(Photo.city.isnot(None))
            .where(Photo.is_trash == False)
            .where(
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            )
            .group_by(Photo.city, Photo.state, Photo.country)
        )
        current_locations = result.all()

        # 2. Get existing place albums
        result = await db.execute(select(Album).where(Album.type == "places"))
        existing_albums = result.scalars().all()
        
        # Create a lookup map by their metadata (as a string for hashing)
        def get_meta_key(city, state, country):
            return f"{city or ''}|{state or ''}|{country or ''}"

        album_map = {}
        for album in existing_albums:
            try:
                meta = json.loads(album.metadata_json) if album.metadata_json else {}
                key = get_meta_key(meta.get("city"), meta.get("state"), meta.get("country"))
                album_map[key] = album
            except Exception:
                continue

        # 3. Upsert albums
        active_keys = set()
        for loc in current_locations:
            key = get_meta_key(loc.city, loc.state, loc.country)
            active_keys.add(key)
            
            parts = [p for p in [loc.city, loc.state, loc.country] if p]
            default_name = ", ".join(parts)
            
            meta_json = json.dumps({
                "city": loc.city,
                "state": loc.state,
                "country": loc.country
            })

            if key in album_map:
                album = album_map[key]
                # Update counts and default cover if not manually set
                album.photo_count = loc.photo_count
                if not album.cover_url:
                    album.cover_url = loc.cover_url
            else:
                # Create new album
                new_album = Album(
                    name=default_name,
                    type="places",
                    cover_url=loc.cover_url,
                    photo_count=loc.photo_count,
                    metadata_json=meta_json
                )
                db.add(new_album)

        # 4. Remove stale albums
        for key, album in album_map.items():
            if key not in active_keys:
                await db.delete(album)

        await db.commit()
        logger.info(f"[PLACES] Synchronized {len(active_keys)} place albums.")

        # Broadcast update via sync service
        from app.services.sync_service import sync_service
        sync_service.broadcast({"type": "places_updated"})
