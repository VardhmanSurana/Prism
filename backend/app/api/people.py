from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import json
import numpy as np

from app.db import get_db
from app.models import Person, PhotoPerson, Photo, PendingFaceAssignment
from app.api.albums.utils import photo_to_dict
from app.services.face_clustering import face_service

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
async def get_person_photos(
    person_id: int,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
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
        .limit(limit)
        .offset(offset)
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


class FeedbackRequest(BaseModel):
    decision: str  # "same" | "different"


@router.get("/{person_id}/pending-faces")
async def get_pending_faces(person_id: int, db: AsyncSession = Depends(get_db)):
    """
    Get all pending face assignments where this person is the candidate.
    """
    stmt = select(PendingFaceAssignment).where(PendingFaceAssignment.candidate_person_id == person_id)
    res = await db.execute(stmt)
    pending_items = res.scalars().all()
    
    return [
        {
            "id": p.id,
            "photo_id": p.photo_id,
            "candidate_person_id": p.candidate_person_id,
            "best_score": p.best_score,
            "face_box_json": p.face_box_json,
            "thumb_filename": p.thumb_filename,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in pending_items
    ]


@router.post("/pending-faces/{pending_id}/feedback")
async def submit_feedback(pending_id: int, req: FeedbackRequest, db: AsyncSession = Depends(get_db)):
    """
    Submit user feedback on a pending face assignment.
    """
    stmt = select(PendingFaceAssignment).where(PendingFaceAssignment.id == pending_id)
    res = await db.execute(stmt)
    pending = res.scalar_one_or_none()
    
    if not pending:
        raise HTTPException(status_code=404, detail="Pending face assignment not found")
        
    if req.decision not in ("same", "different"):
        raise HTTPException(status_code=400, detail="Invalid decision. Must be 'same' or 'different'")
        
    if req.decision == "same":
        # Check if target person exists
        p_stmt = select(Person).where(Person.id == pending.candidate_person_id)
        p_res = await db.execute(p_stmt)
        person = p_res.scalar_one_or_none()
        if not person:
            raise HTTPException(status_code=404, detail="Candidate person not found")
            
        # Create PhotoPerson mapping
        assoc = PhotoPerson(
            photo_id=pending.photo_id,
            person_id=person.id,
            confidence=pending.best_score,
            face_box_json=pending.face_box_json
        )
        db.add(assoc)
        
        # Update centroid embedding
        try:
            # Load all existing associations to calculate cumulative weight
            assoc_stmt = select(PhotoPerson).where(PhotoPerson.person_id == person.id)
            assoc_res = await db.execute(assoc_stmt)
            associations = assoc_res.scalars().all()

            cumulative_weight = sum(
                face_service._recognizer.compute_face_weight(a.confidence, a.face_box_json)
                for a in associations
            )
            if cumulative_weight == 0:
                cumulative_weight = float(len(associations)) or 1.0

            new_weight = face_service._recognizer.compute_face_weight(pending.best_score, pending.face_box_json)

            if len(associations) > 0 and person.face_embedding and pending.face_embedding:
                current_emb = np.array(json.loads(person.face_embedding), dtype=np.float32)
                feat = np.array(json.loads(pending.face_embedding), dtype=np.float32)
                new_emb = face_service._recognizer.update_running_average(
                    current_emb, feat, cumulative_weight, new_weight
                )
                person.face_embedding = json.dumps(new_emb.tolist())
        except Exception:
            # We don't fail the transaction if updating the embedding fails
            pass
            
        # Delete pending assignment
        await db.delete(pending)
        await db.commit()
        
        return {"status": "success", "resolved_id": pending_id, "action": "same"}
        
    else:  # different
        # Create a new person profile
        count_stmt = select(func.count()).select_from(Person)
        current_count = (await db.execute(count_stmt)).scalar() or 0
        person_name = f"Person {current_count + 1}"
        
        new_person = Person(
            name=person_name,
            cover_face_thumbnail=f"/thumbnails/Face_Thumbnail/{pending.thumb_filename}",
            face_embedding=pending.face_embedding
        )
        db.add(new_person)
        await db.flush()
        
        # Link the photo to the new person
        assoc = PhotoPerson(
            photo_id=pending.photo_id,
            person_id=new_person.id,
            confidence=pending.best_score,
            face_box_json=pending.face_box_json
        )
        db.add(assoc)
        
        # Delete pending assignment
        await db.delete(pending)
        await db.commit()
        
        return {"status": "success", "resolved_id": pending_id, "action": "different", "new_person_id": new_person.id}

