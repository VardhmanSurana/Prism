from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, extract, and_, func
from app.db import get_db
from app.models import Album, Photo, PhotoAlbum
from app.api.albums.utils import photo_to_dict
from typing import List
from datetime import datetime, timezone

router = APIRouter()


@router.get("/memories/highlights")
async def get_memories_highlights(db: AsyncSession = Depends(get_db)):
    """
    Returns curated highlight groups for the Memories Carousel:
      - "on_this_day": photos taken on today's month+day in past years (one highlight per year)
      - "location": top locations with enough photos (one highlight per city/country)
    Returns up to 5 highlights total. Each highlight contains up to 20 preview photos.
    """
    today = datetime.now(timezone.utc)
    highlights = []

    # ── 1. On This Day ────────────────────────────────────────────────────────
    stmt_otd = (
        select(Photo)
        .where(
            and_(
                Photo.is_trash == False,
                extract("month", Photo.date_taken) == today.month,
                extract("day", Photo.date_taken) == today.day,
                extract("year", Photo.date_taken) < today.year,
            )
        )
        .order_by(Photo.date_taken.desc())
    )
    result_otd = await db.execute(stmt_otd)
    otd_photos = result_otd.scalars().all()

    # Group by year
    by_year: dict[int, list[Photo]] = {}
    for p in otd_photos:
        yr = (p.date_taken or p.date).year
        by_year.setdefault(yr, []).append(p)

    for year, photos in sorted(by_year.items(), reverse=True):
        if len(photos) < 1:
            continue
        cover = photos[0]
        highlights.append({
            "id": f"otd_{year}",
            "title": f"{today.strftime('%B')} {today.day}, {year}",
            "subtitle": f"{len(photos)} photo{'s' if len(photos) != 1 else ''} from {year}",
            "type": "on_this_day",
            "photo_count": len(photos),
            "cover_url": f"/api/v1/photos/{cover.id}/thumbnail",
            "photos": [photo_to_dict(p) for p in photos[:20]],
        })
        if len(highlights) >= 3:
            break

    # ── 2. Top Locations ──────────────────────────────────────────────────────
    # Group by city (fall back to country) — pick top locations by photo count
    stmt_loc = (
        select(Photo)
        .where(
            and_(
                Photo.is_trash == False,
                Photo.city != None,
            )
        )
        .order_by(Photo.date_taken.desc())
    )
    result_loc = await db.execute(stmt_loc)
    loc_photos = result_loc.scalars().all()

    by_location: dict[str, list[Photo]] = {}
    for p in loc_photos:
        key = p.city or p.country
        if key:
            by_location.setdefault(key, []).append(p)

    # Sort by count desc, pick top 2
    for loc_name, photos in sorted(by_location.items(), key=lambda x: len(x[1]), reverse=True)[:2]:
        if len(photos) < 3:
            continue
        cover = photos[0]
        parts = [p for p in [photos[0].city, photos[0].country] if p]
        subtitle = ", ".join(parts) if parts else loc_name
        highlights.append({
            "id": f"loc_{loc_name.lower().replace(' ', '_')}",
            "title": loc_name,
            "subtitle": f"{len(photos)} photos • {subtitle}",
            "type": "location",
            "photo_count": len(photos),
            "cover_url": f"/api/v1/photos/{cover.id}/thumbnail",
            "photos": [photo_to_dict(p) for p in photos[:20]],
        })

    return highlights[:5]

@router.get("/")
async def list_albums(db: AsyncSession = Depends(get_db)):
    stmt = select(Album).where(Album.type == "custom")
    result = await db.execute(stmt)
    albums = result.scalars().all()
    return albums

@router.post("/")
async def create_album(name: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    album = Album(name=name, type="custom", photo_count=0)
    db.add(album)
    await db.commit()
    await db.refresh(album)
    return album

@router.delete("/{album_id}")
async def delete_album(album_id: int, db: AsyncSession = Depends(get_db)):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")
    await db.delete(album)
    await db.commit()
    return {"status": "success"}

@router.post("/{album_id}/rename")
async def rename_album(album_id: int, name: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")
    album.name = name
    await db.commit()
    await db.refresh(album)
    return album

@router.get("/{album_id}/photos")
async def get_album_photos(album_id: int, db: AsyncSession = Depends(get_db)):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")
    stmt = select(Photo).join(PhotoAlbum).where(PhotoAlbum.album_id == album_id).order_by(Photo.date_taken.desc())
    result = await db.execute(stmt)
    photos = result.scalars().all()
    return [photo_to_dict(p) for p in photos]

@router.post("/{album_id}/add-photos")
async def add_photos_to_album(
    album_id: int, 
    photo_ids: List[int] = Body(..., embed=True), 
    db: AsyncSession = Depends(get_db)
):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Deduplicate and check existing
    stmt_exist = select(PhotoAlbum.photo_id).where(PhotoAlbum.album_id == album_id)
    res_exist = await db.execute(stmt_exist)
    existing_ids = set(res_exist.scalars().all())

    added_count = 0
    latest_photo = None

    for pid in photo_ids:
        if pid in existing_ids:
            continue
        photo = await db.get(Photo, pid)
        if not photo:
            continue
        
        link = PhotoAlbum(photo_id=pid, album_id=album_id)
        db.add(link)
        added_count += 1
        latest_photo = photo

    if added_count > 0:
        await db.flush()
        # Recalculate count
        stmt_count = select(PhotoAlbum.photo_id).where(PhotoAlbum.album_id == album_id)
        res_count = await db.execute(stmt_count)
        album.photo_count = len(res_count.scalars().all())
        
        # Auto update cover to the latest photo's thumbnail if cover was empty or not manually locked
        if latest_photo and (not album.cover_url or album.cover_url.startswith("/thumbnails/")):
            album.cover_url = f"/api/v1/photos/{latest_photo.id}/thumbnail"
        
        await db.commit()
        await db.refresh(album)

    return album

@router.post("/{album_id}/remove-photos")
async def remove_photos_from_album(
    album_id: int, 
    photo_ids: List[int] = Body(..., embed=True), 
    db: AsyncSession = Depends(get_db)
):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")

    stmt_del = delete(PhotoAlbum).where(
        PhotoAlbum.album_id == album_id, 
        PhotoAlbum.photo_id.in_(photo_ids)
    )
    await db.execute(stmt_del)
    await db.flush()

    # Recalculate count
    stmt_count = select(PhotoAlbum.photo_id).where(PhotoAlbum.album_id == album_id)
    res_count = await db.execute(stmt_count)
    album.photo_count = len(res_count.scalars().all())

    # Check cover URL
    if album.cover_url:
        # If we removed the cover, find the next latest photo
        stmt_photos = select(Photo).join(PhotoAlbum).where(PhotoAlbum.album_id == album_id).order_by(Photo.date_taken.desc())
        res_photos = await db.execute(stmt_photos)
        remaining = res_photos.scalars().all()
        if remaining:
            album.cover_url = f"/api/v1/photos/{remaining[0].id}/thumbnail"
        else:
            album.cover_url = None

    await db.commit()
    await db.refresh(album)
    return album

@router.post("/{album_id}/set-cover")
async def set_album_cover(
    album_id: int,
    photo_id: int = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    album = await db.get(Album, album_id)
    if not album or album.type != "custom":
        raise HTTPException(status_code=404, detail="Album not found")
    
    photo = await db.get(Photo, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    album.cover_url = f"/api/v1/photos/{photo.id}/thumbnail"
    await db.commit()
    await db.refresh(album)
    return album
