"""Photo listing endpoints."""

import os
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_

from app.db import get_db
from app.models import Photo, Person, PhotoPerson, Album
from app.services.sync_service import sync_service
from app.services.locked_service import locked_service
from app.api.albums.utils import photo_to_dict

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def list_photos(
    limit: int = 50, 
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    # Get active mount points
    active_mounts = list(sync_service.active_mounts)
    
    # Query photos that are either:
    # 1. Internal (no device_id or starts with home)
    # 2. External but their device_id (mount point) is currently active
    # Filter out locked photos if the Locked Folder is not authenticated
    # ALWAYS filter out trashed photos
    if locked_service.is_authenticated:
        stmt = select(Photo).where(
            and_(
                Photo.is_trash == False,
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                )
            )
        ).order_by(Photo.upload_date.desc()).limit(limit).offset(offset)
    else:
        stmt = select(Photo).where(
            and_(
                Photo.is_trash == False,
                or_(
                    Photo.is_external == False,
                    Photo.device_id.in_(active_mounts)
                ),
                Photo.is_locked == False
            )
        ).order_by(Photo.upload_date.desc()).limit(limit).offset(offset)
    
    result = await db.execute(stmt)
    photos = result.scalars().all()
    
    return [photo_to_dict(p) for p in photos]


@router.get("/stats")
async def get_photo_stats(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import func

    active_mounts = list(sync_service.active_mounts)
    
    # 1. Total Photos: visible active photos (not locked if unauthenticated, not in trash, in active mounts)
    if locked_service.is_authenticated:
        total_stmt = select(func.count(Photo.id)).where(
            Photo.is_trash == False,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        )
    else:
        total_stmt = select(func.count(Photo.id)).where(
            Photo.is_trash == False,
            Photo.is_locked == False,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        )
    res_total = await db.execute(total_stmt)
    total_photos = res_total.scalar() or 0
    
    # 2. People Found: only count people who have ≥1 accessible (active mount) photo
    people_filters = [
        Photo.is_trash == False,
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ]
    if not locked_service.is_authenticated:
        people_filters.append(Photo.is_locked == False)

    people_stmt = (
        select(func.count(func.distinct(Person.id)))
        .join(PhotoPerson, Person.id == PhotoPerson.person_id)
        .join(Photo, PhotoPerson.photo_id == Photo.id)
        .where(and_(*people_filters))
    )
    res_people = await db.execute(people_stmt)
    people_found = res_people.scalar() or 0
    
    # 3. Albums: count entries in Album table directly
    albums_stmt = select(func.count(Album.id))
    res_albums = await db.execute(albums_stmt)
    albums_count = res_albums.scalar() or 0
    
    # 4. Locked & Encrypted count
    locked_stmt = select(func.count(Photo.id)).where(
        Photo.is_locked == True,
        Photo.is_trash == False
    )
    res_locked = await db.execute(locked_stmt)
    locked_count = res_locked.scalar() or 0

    # 5. Total media size (sum of file_size for all active photos)
    if locked_service.is_authenticated:
        size_stmt = select(func.coalesce(func.sum(Photo.file_size), 0)).where(
            Photo.is_trash == False,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        )
    else:
        size_stmt = select(func.coalesce(func.sum(Photo.file_size), 0)).where(
            Photo.is_trash == False,
            Photo.is_locked == False,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        )
    res_size = await db.execute(size_stmt)
    total_size_bytes = res_size.scalar() or 0

    return {
        "total_photos": total_photos,
        "people_found": people_found,
        "albums": albums_count,
        "locked_encrypted": locked_count,
        "total_size_bytes": total_size_bytes,
    }

