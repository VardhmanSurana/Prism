from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db import get_db
from app.models import Person, PhotoPerson, Photo
from app.api.albums.utils import photo_to_dict

router = APIRouter()

class RenameRequest(BaseModel):
    name: str

@router.get("/")
async def list_people(db: AsyncSession = Depends(get_db)):
    """
    Get a list of all registered clustered people,
    including their unique face thumbnails, names, and total photo counts.
    """
    # Query people with the count of associated photos
    stmt = (
        select(
            Person.id,
            Person.name,
            Person.cover_face_thumbnail,
            func.count(PhotoPerson.photo_id).label("photo_count")
        )
        .outerjoin(PhotoPerson, Person.id == PhotoPerson.person_id)
        .group_by(Person.id)
        .order_by(Person.name)
    )
    
    result = await db.execute(stmt)
    people_list = []
    
    for row in result.all():
        people_list.append({
            "id": row.id,
            "name": row.name,
            "cover_face_thumbnail": row.cover_face_thumbnail,
            "photo_count": row.photo_count
        })
        
    return people_list

@router.get("/{person_id}/photos")
async def get_person_photos(person_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get all photos containing the specified person_id.
    """
    # Verify person exists
    stmt_check = select(Person).where(Person.id == person_id)
    res_check = await db.execute(stmt_check)
    person = res_check.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Fetch all photos joined on PhotoPerson relation
    stmt_photos = (
        select(Photo, PhotoPerson.face_box_json)
        .join(PhotoPerson, Photo.id == PhotoPerson.photo_id)
        .where(PhotoPerson.person_id == person_id)
        .order_by(Photo.date.desc())
    )
    
    result = await db.execute(stmt_photos)
    photos_list = []
    
    for photo, face_box_json in result.all():
        pd = photo_to_dict(photo)
        pd["face_box"] = face_box_json
        photos_list.append(pd)
        
    return {
        "person": {
            "id": person.id,
            "name": person.name,
            "cover_face_thumbnail": person.cover_face_thumbnail
        },
        "photos": photos_list
    }

@router.put("/{person_id}/name")
async def rename_person(person_id: int, req: RenameRequest, db: AsyncSession = Depends(get_db)):
    """
    Rename a registered person.
    """
    stmt = select(Person).where(Person.id == person_id)
    res = await db.execute(stmt)
    person = res.scalar_one_or_none()
    
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
        
    person.name = req.name.strip()
    await db.commit()
    
    return {"status": "success", "id": person.id, "name": person.name}
