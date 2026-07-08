"""NLE Project CRUD endpoints."""

import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import VideoProject, Photo

router = APIRouter()


class ProjectCreate(BaseModel):
    name: str = "Untitled Edit"
    cover_photo_id: Optional[int] = None
    width: int = 1920
    height: int = 1080
    fps: int = 30
    project_json: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    project_json: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[int] = None


@router.post("/projects")
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = VideoProject(
        name=req.name,
        cover_photo_id=req.cover_photo_id,
        width=req.width,
        height=req.height,
        fps=req.fps,
        project_json=req.project_json,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return {
        "id": project.id,
        "name": project.name,
        "width": project.width,
        "height": project.height,
        "fps": project.fps,
        "cover_photo_id": project.cover_photo_id,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@router.get("/projects")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VideoProject).order_by(VideoProject.updated_at.desc())
    )
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "name": p.name,
            "width": p.width,
            "height": p.height,
            "fps": p.fps,
            "cover_photo_id": p.cover_photo_id,
            "created_at": p.created_at.isoformat(),
            "updated_at": p.updated_at.isoformat(),
        }
        for p in projects
    ]


@router.get("/projects/{project_id}")
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VideoProject).where(VideoProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project_data = None
    if project.project_json:
        try:
            project_data = json.loads(project.project_json)
        except json.JSONDecodeError:
            project_data = None

    return {
        "id": project.id,
        "name": project.name,
        "width": project.width,
        "height": project.height,
        "fps": project.fps,
        "cover_photo_id": project.cover_photo_id,
        "project_json": project_data,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@router.put("/projects/{project_id}")
async def update_project(project_id: int, req: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VideoProject).where(VideoProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if req.name is not None:
        project.name = req.name
    if req.project_json is not None:
        project.project_json = req.project_json
    if req.width is not None:
        project.width = req.width
    if req.height is not None:
        project.height = req.height
    if req.fps is not None:
        project.fps = req.fps
    project.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(project)
    return {"id": project.id, "updated_at": project.updated_at.isoformat()}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VideoProject).where(VideoProject.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"deleted": True}
