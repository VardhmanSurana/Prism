from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db import get_db
from app.models import Album

router = APIRouter()

@router.get("/")
async def list_albums(db: AsyncSession = Depends(get_db)):
    # Return custom albums from database (empty list since none exist yet)
    stmt = select(Album)
    result = await db.execute(stmt)
    albums = result.scalars().all()
    return albums

@router.get("/{album_id}/photos")
async def get_album_photos(album_id: int, db: AsyncSession = Depends(get_db)):
    return []
