from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_
import os
import cv2
from typing import List

from app.db import get_db
from app.models import Photo
from app.api.albums.utils import photo_to_dict
from app.services.sync_service import sync_service

router = APIRouter()

@router.get("/blurry")
async def get_blurry_photos(db: AsyncSession = Depends(get_db)):
    # Query database directly for photos with blur_score below threshold (100.0)
    active_mounts = list(sync_service.active_mounts)
    stmt = select(Photo).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.blur_score.isnot(None),
        Photo.blur_score < 100.0,
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ).order_by(Photo.blur_score.asc()).limit(100)
    
    result = await db.execute(stmt)
    photos = result.scalars().all()
    
    blurry_photos = []
    for photo in photos:
        p_dict = photo_to_dict(photo)
        p_dict["blur_score"] = round(photo.blur_score, 2)
        blurry_photos.append(p_dict)
            
    return blurry_photos

@router.get("/duplicates")
async def get_duplicate_photos(db: AsyncSession = Depends(get_db)):
    # Finds duplicate clusters based on matching file content hash
    active_mounts = list(sync_service.active_mounts)
    
    # Query photos grouped by hash having count > 1
    stmt = select(
        Photo.hash,
        func.count(Photo.id).label("match_count")
    ).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        Photo.hash.isnot(None),
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        )
    ).group_by(Photo.hash).having(func.count(Photo.id) > 1)
    
    result = await db.execute(stmt)
    hash_groups = result.all()
    
    duplicate_clusters = []
    for group in hash_groups:
        stmt_photos = select(Photo).where(
            Photo.is_locked == False,
            Photo.is_trash == False,
            Photo.hash == group.hash,
            or_(
                Photo.is_external == False,
                Photo.device_id.in_(active_mounts)
            )
        ).order_by(Photo.filename)
        
        res_photos = await db.execute(stmt_photos)
        photos_in_group = res_photos.scalars().all()
        
        if len(photos_in_group) > 1:
            duplicate_clusters.append({
                "key": group.hash,
                "photo_count": len(photos_in_group),
                "photos": [photo_to_dict(p) for p in photos_in_group]
            })
            
    return duplicate_clusters

@router.get("/documents")
async def get_document_photos(db: AsyncSession = Depends(get_db)):
    # Query photos whose ai_summary or caption contains document keywords
    active_mounts = list(sync_service.active_mounts)
    
    keywords = ["receipt", "document", "text", "invoice", "screenshot", "bill", "paper", "page", "license", "card"]
    keyword_clauses = [Photo.ai_summary.ilike(f"%{k}%") for k in keywords]
    keyword_clauses.append(Photo.caption.ilike("%receipt%"))
    keyword_clauses.append(Photo.caption.ilike("%screenshot%"))
    
    stmt = select(Photo).where(
        Photo.is_locked == False,
        Photo.is_trash == False,
        or_(
            Photo.is_external == False,
            Photo.device_id.in_(active_mounts)
        ),
        or_(*keyword_clauses)
    ).order_by(Photo.date_taken.desc())
    
    result = await db.execute(stmt)
    photos = result.scalars().all()
    
    return [photo_to_dict(p) for p in photos]
