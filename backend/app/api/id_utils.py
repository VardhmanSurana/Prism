"""Resolve an entity by numeric id or uuid string, mirroring the Rust backend.

Rust accepts ``id OR uuid`` in path params; Python did too, but only as int.
These helpers keep the lookup logic in one place.
"""
from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models import Photo, Album, Person, VideoProject


def _id_or_uuid_filter(model, identifier: str):
    """WHERE id = ? OR uuid = ? for a model with int id + optional uuid."""
    cond = model.uuid == identifier
    try:
        int_id = int(identifier)
    except (ValueError, TypeError):
        return cond
    return or_(model.id == int_id, cond)


async def resolve_photo(db: AsyncSession, identifier: str) -> Photo:
    result = await db.execute(select(Photo).where(_id_or_uuid_filter(Photo, identifier)))
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


async def resolve_album(db: AsyncSession, identifier: str) -> Album:
    result = await db.execute(select(Album).where(_id_or_uuid_filter(Album, identifier)))
    album = result.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


async def resolve_person(db: AsyncSession, identifier: str) -> Person:
    result = await db.execute(select(Person).where(_id_or_uuid_filter(Person, identifier)))
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


async def resolve_video_project(db: AsyncSession, identifier: str) -> VideoProject:
    result = await db.execute(select(VideoProject).where(_id_or_uuid_filter(VideoProject, identifier)))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
