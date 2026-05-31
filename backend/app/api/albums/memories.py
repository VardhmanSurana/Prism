from fastapi import APIRouter
from sqlalchemy.future import select
from sqlalchemy import func, or_
from app.db import async_session
from app.models import Photo
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service
import calendar

router = APIRouter()

@router.get("/")
async def list_memories():
    active_mounts = list(sync_service.active_mounts)
    async with async_session() as db:
        result = await db.execute(
            select(
                func.strftime("%Y", Photo.date_taken).label("year"),
                func.strftime("%m", Photo.date_taken).label("month"),
                func.count(Photo.id).label("photo_count"),
                func.max(Photo.url).label("cover_url"),
            )
            .where(
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            )
            .group_by(
                func.strftime("%Y", Photo.date_taken),
                func.strftime("%m", Photo.date_taken),
            )
            .order_by(
                func.strftime("%Y", Photo.date_taken).desc(),
                func.strftime("%m", Photo.date_taken).desc(),
            )
        )
        rows = result.all()
        memories = []
        for i, row in enumerate(rows):
            month_name = calendar.month_name[int(row.month)] if row.month else ""
            memories.append({
                "id": i + 1,
                "name": f"{month_name} {row.year}",
                "type": "memories",
                "photo_count": row.photo_count,
                "cover_url": row.cover_url,
                "metadata": {"year": row.year, "month": row.month},
            })
        return memories

@router.get("/photos")
async def get_memory_photos(year: str, month: str):
    active_mounts = list(sync_service.active_mounts)
    async with async_session() as db:
        result = await db.execute(
            select(Photo)
            .where(
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            )
            .where(func.strftime("%Y", Photo.date_taken) == year)
            .where(func.strftime("%m", Photo.date_taken) == month)
            .order_by(Photo.date_taken.desc())
        )
        photos = result.scalars().all()
        return [photo_to_dict(p) for p in photos]


@router.get("/highlights")
async def get_memory_highlights():
    from datetime import datetime
    import calendar
    
    today = datetime.now()
    month_str = today.strftime("%m")
    day_str = today.strftime("%d")
    
    active_mounts = list(sync_service.active_mounts)
    highlights = []
    
    async with async_session() as db:
        # 1. On This Day: Photos taken on today's month & day in previous years
        stmt_otd = select(Photo).where(
            Photo.is_locked == False,
            Photo.is_trash == False,
            Photo.is_archived == False,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            ),
            func.strftime("%m", Photo.date_taken) == month_str,
            func.strftime("%d", Photo.date_taken) == day_str,
            func.strftime("%Y", Photo.date_taken) < str(today.year)
        ).order_by(Photo.date_taken.desc())
        
        result_otd = await db.execute(stmt_otd)
        photos_otd = result_otd.scalars().all()
        
        # Group OTD photos by year
        year_groups = {}
        for p in photos_otd:
            y = p.date_taken.year
            if y not in year_groups:
                year_groups[y] = []
            year_groups[y].append(p)
            
        for y, g in sorted(year_groups.items(), reverse=True):
            years_ago = today.year - y
            title = f"{years_ago} Year{'s' if years_ago > 1 else ''} Ago Today"
            month_name = calendar.month_name[today.month]
            subtitle = f"{month_name} {today.day}, {y}"
            
            highlights.append({
                "id": f"on_this_day_{y}",
                "title": title,
                "subtitle": subtitle,
                "type": "on_this_day",
                "photo_count": len(g),
                "cover_url": g[0].url,
                "photos": [photo_to_dict(p) for p in g]
            })
            
        # 2. Location Trips Fallback/Add-on: Get clusters of photos taken in unique cities
        stmt_cities = select(
            Photo.city,
            Photo.state,
            Photo.country,
            func.count(Photo.id).label("photo_count"),
            func.max(Photo.url).label("cover_url")
        ).where(
            Photo.is_locked == False,
            Photo.is_trash == False,
            Photo.is_archived == False,
            Photo.city.isnot(None),
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        ).group_by(Photo.city, Photo.state, Photo.country).having(func.count(Photo.id) >= 3).limit(5)
        
        result_cities = await db.execute(stmt_cities)
        cities = result_cities.all()
        
        for idx, city in enumerate(cities):
            # Fetch photos for this city to display in the highlight
            stmt_city_photos = select(Photo).where(
                Photo.is_locked == False,
                Photo.is_trash == False,
                Photo.is_archived == False,
                Photo.city == city.city,
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            ).order_by(Photo.date_taken.desc()).limit(15)
            
            res_city_photos = await db.execute(stmt_city_photos)
            city_photos = res_city_photos.scalars().all()
            
            parts = [p for p in [city.city, city.state] if p]
            city_name = ", ".join(parts)
            
            highlights.append({
                "id": f"trip_{city.city.lower().replace(' ', '_')}_{idx}",
                "title": f"A trip to {city_name}",
                "subtitle": "From your library",
                "type": "trip",
                "photo_count": city.photo_count,
                "cover_url": city.cover_url,
                "photos": [photo_to_dict(p) for p in city_photos]
            })
            
    return highlights

