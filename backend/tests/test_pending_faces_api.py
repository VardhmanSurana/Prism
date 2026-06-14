import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models import Photo, Person, PendingFaceAssignment, PhotoPerson
from sqlalchemy import select
import json


@pytest.mark.asyncio
async def test_pending_faces_and_feedback_api(db_session):
    # 1. Create a photo, person, and pending face assignment
    photo = Photo(filename="test.jpg", path="/test.jpg", url="local:///test.jpg", width=800, height=800, aspect_ratio=1.0)
    person = Person(
        name="Candidate Person",
        cover_face_thumbnail="thumbnails/Face_Thumbnail/test_face.jpg",
        face_embedding=json.dumps([0.1] * 512)
    )
    db_session.add_all([photo, person])
    await db_session.flush()

    pending = PendingFaceAssignment(
        photo_id=photo.id,
        candidate_person_id=person.id,
        best_score=0.35,
        face_box_json=json.dumps({"x": 10, "y": 20, "w": 30, "h": 40}),
        thumb_filename="pending_thumb.jpg",
        face_embedding=json.dumps([0.15] * 512)
    )
    db_session.add(pending)
    await db_session.commit()

    # 2. Query GET /api/v1/people/{person_id}/pending-faces
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET request
        response = await client.get(f"/api/v1/people/{person.id}/pending-faces")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == pending.id
        assert data[0]["thumb_filename"] == "pending_thumb.jpg"
        assert data[0]["best_score"] == 0.35

        # POST request - Feedback "same"
        feedback_response = await client.post(
            f"/api/v1/people/pending-faces/{pending.id}/feedback",
            json={"decision": "same"}
        )
        assert feedback_response.status_code == 200
        res_data = feedback_response.json()
        assert res_data["status"] == "success"
        assert res_data["action"] == "same"

        # Verify DB changes
        # Pending should be deleted
        stmt = select(PendingFaceAssignment).where(PendingFaceAssignment.id == pending.id)
        res = await db_session.execute(stmt)
        assert res.scalar_one_or_none() is None

        # PhotoPerson link should be created
        stmt_assoc = select(PhotoPerson).where(PhotoPerson.photo_id == photo.id)
        res_assoc = await db_session.execute(stmt_assoc)
        assoc = res_assoc.scalar_one()
        assert assoc.person_id == person.id
        assert assoc.confidence == 0.35
        assert assoc.face_box_json == pending.face_box_json


@pytest.mark.asyncio
async def test_pending_faces_feedback_different(db_session):
    # 1. Create a photo, person, and pending face assignment
    photo = Photo(filename="test.jpg", path="/test.jpg", url="local:///test.jpg", width=800, height=800, aspect_ratio=1.0)
    person = Person(
        name="Candidate Person",
        cover_face_thumbnail="thumbnails/Face_Thumbnail/test_face.jpg",
        face_embedding=json.dumps([0.1] * 512)
    )
    db_session.add_all([photo, person])
    await db_session.flush()

    pending = PendingFaceAssignment(
        photo_id=photo.id,
        candidate_person_id=person.id,
        best_score=0.35,
        face_box_json=json.dumps({"x": 10, "y": 20, "w": 30, "h": 40}),
        thumb_filename="pending_thumb.jpg",
        face_embedding=json.dumps([0.15] * 512)
    )
    db_session.add(pending)
    await db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # POST request - Feedback "different"
        feedback_response = await client.post(
            f"/api/v1/people/pending-faces/{pending.id}/feedback",
            json={"decision": "different"}
        )
        assert feedback_response.status_code == 200
        res_data = feedback_response.json()
        assert res_data["status"] == "success"
        assert res_data["action"] == "different"
        new_person_id = res_data["new_person_id"]

        # Verify a new person is created
        p_stmt = select(Person).where(Person.id == new_person_id)
        p_res = await db_session.execute(p_stmt)
        new_p = p_res.scalar_one()
        assert new_p.name.startswith("Person")
        assert new_p.cover_face_thumbnail == "/thumbnails/Face_Thumbnail/pending_thumb.jpg"
        assert json.loads(new_p.face_embedding) == [0.15] * 512

        # Link should be created for this new person
        stmt_assoc = select(PhotoPerson).where(PhotoPerson.photo_id == photo.id)
        res_assoc = await db_session.execute(stmt_assoc)
        assoc = res_assoc.scalar_one()
        assert assoc.person_id == new_person_id
        assert assoc.confidence == 0.35
