from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_
from app.db import get_db
from app.models import Photo, Album
from app.api.albums.utils import photo_to_dict
from pydantic import BaseModel
import json

router = APIRouter()

@router.get("/")
async def list_places(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Album)
        .where(Album.type == "places")
        .order_by(Album.photo_count.desc())
    )
    albums = result.scalars().all()

    if not albums:
        from app.services.place_service import sync_all_places
        await sync_all_places()
        result = await db.execute(
            select(Album)
            .where(Album.type == "places")
            .order_by(Album.photo_count.desc())
        )
        albums = result.scalars().all()
    
    results = []
    for album in albums:
        results.append({
            "id": album.id,
            "name": album.name,
            "type": "places",
            "photo_count": album.photo_count,
            "cover_url": album.cover_url,
            "metadata": json.loads(album.metadata_json) if album.metadata_json else {}
        })
    return results

@router.get("/photos")
async def get_place_photos(
    city: str | None = None,
    state: str | None = None,
    country: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    from app.services.sync_service import sync_service
    active_mounts = list(sync_service.active_mounts)

    q = select(Photo).where(
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    )
    if city:
        q = q.where(Photo.city == city)
    if state:
        q = q.where(Photo.state == state)
    if country:
        q = q.where(Photo.country == country)
    result = await db.execute(q.order_by(Photo.date_taken.desc()).limit(limit).offset(offset))
    photos = result.scalars().all()
    return [photo_to_dict(p) for p in photos]

class RenameRequest(BaseModel):
    name: str

@router.post("/{album_id}/rename")
async def rename_place(album_id: int, req: RenameRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Album).where(Album.id == album_id, Album.type == "places"))
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Place not found")
    
    album.name = req.name
    await db.commit()
    return {"status": "success", "name": album.name}
