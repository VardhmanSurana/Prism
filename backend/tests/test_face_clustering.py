import json
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import numpy as np
from sqlalchemy import select

from app.models import Photo, Person, PhotoPerson
from app.services.processing_queue import processing_queue
from app.services import face_service

@pytest.mark.asyncio
async def test_face_database_models(db_session):
    """Verify that Person and PhotoPerson relationships back-populate correctly."""
    # 1. Create a dummy photo
    photo = Photo(
        filename="test.jpg",
        path="/path/to/test.jpg",
        url="local:///path/to/test.jpg",
        width=1920,
        height=1080,
        aspect_ratio=1.77,
        is_favorite=False
    )
    db_session.add(photo)
    await db_session.flush()

    # 2. Create a dummy person profile
    person = Person(
        name="Person 1",
        cover_face_thumbnail="thumbnails/Face_Thumbnail/test_face.jpg",
        face_embedding=json.dumps([0.1] * 512)
    )
    db_session.add(person)
    await db_session.flush()

    # 3. Create join table mapping (face box at x=100, y=100)
    association = PhotoPerson(
        photo_id=photo.id,
        person_id=person.id,
        confidence=0.95,
        face_box_json=json.dumps({"x": 100, "y": 100, "w": 50, "h": 50})
    )
    db_session.add(association)
    await db_session.commit()

    # 4. Query and assert relationships using explicit async selects
    stmt_query_photo = select(PhotoPerson).where(PhotoPerson.photo_id == photo.id)
    res_query_photo = await db_session.execute(stmt_query_photo)
    photo_people = res_query_photo.scalars().all()
    assert len(photo_people) == 1
    assert photo_people[0].person_id == person.id
    assert photo_people[0].confidence == 0.95

    stmt_query_person = select(PhotoPerson).where(PhotoPerson.person_id == person.id)
    res_query_person = await db_session.execute(stmt_query_person)
    person_photos = res_query_person.scalars().all()
    assert len(person_photos) == 1
    assert person_photos[0].photo_id == photo.id


@pytest.mark.asyncio
async def test_face_service_clustering_new_and_match(db_session):
    """
    Test FaceService clustering pipeline under mocks.
    Verify that similar face matches are grouped, and new profiles are created otherwise.
    """
    # 1. Insert dummy photo records in the DB
    photo1 = Photo(filename="p1.jpg", path="/p1.jpg", url="local:///p1.jpg", width=800, height=800, aspect_ratio=1.0)
    photo2 = Photo(filename="p2.jpg", path="/p2.jpg", url="local:///p2.jpg", width=800, height=800, aspect_ratio=1.0)
    db_session.add_all([photo1, photo2])
    await db_session.flush()

    # 2. Mock OpenCV and InspireFace calls
    mock_cv2_imread = MagicMock(return_value=np.zeros((800, 800, 3), dtype=np.uint8))
    mock_cv2_imwrite = MagicMock(return_value=True)
    mock_exists = MagicMock(return_value=True)

    # Face mock matching setup
    mock_face = MagicMock()
    mock_face.location = (100, 100, 200, 200)
    mock_face.detection_confidence = 0.88

    # We will patch the face service ensure_launched, cv2, and inspireface calls
    with patch("os.path.exists", mock_exists), \
         patch("cv2.imread", mock_cv2_imread), \
         patch("cv2.imwrite", mock_cv2_imwrite), \
         patch.object(face_service._face_sdk, "_ensure_launched", MagicMock()), \
         patch("inspireface.ImageStream.load_from_cv_image") as mock_stream_load, \
         patch("inspireface.feature_comparison") as mock_comp:

        # Mock the image stream and session face detection returning exactly 1 face
        mock_stream = MagicMock()
        mock_stream_load.return_value = mock_stream
        face_service._face_sdk._session = MagicMock()
        face_service._face_sdk._session.face_detection.return_value = [mock_face]
        
        # Mock feature extract returning 512-dim embedding
        face_service._face_sdk._session.face_feature_extract.return_value = np.array([0.5] * 512, dtype=np.float32)

        # Run SCAN 1: Since there are no people in DB, this MUST create "Person 1"
        res_count1 = await face_service.scan_and_cluster_face(photo1.id, "/p1.jpg", db_session)
        assert res_count1 == 1

        # Query Person 1 from DB
        stmt1 = select(Person)
        res_stmt1 = await db_session.execute(stmt1)
        people1 = res_stmt1.scalars().all()
        assert len(people1) == 1
        assert people1[0].name == "Person 1"

        # Check association 1
        stmt_assoc1 = select(PhotoPerson).where(PhotoPerson.photo_id == photo1.id)
        res_assoc1 = await db_session.execute(stmt_assoc1)
        assoc1 = res_assoc1.scalar_one()
        assert assoc1.person_id == people1[0].id

        # Run SCAN 2: Similar face (similarity score = 0.9). This should match existing Person 1.
        mock_comp.return_value = 0.90
        res_count2 = await face_service.scan_and_cluster_face(photo2.id, "/p2.jpg", db_session)
        assert res_count2 == 1

        # Query People table to ensure no new Person was created
        res_stmt2 = await db_session.execute(select(Person))
        people2 = res_stmt2.scalars().all()
        assert len(people2) == 1  # Still only 1 person!

        # Check association 2 links to Person 1
        stmt_assoc2 = select(PhotoPerson).where(PhotoPerson.photo_id == photo2.id)
        res_assoc2 = await db_session.execute(stmt_assoc2)
        assoc2 = res_assoc2.scalar_one()
        assert assoc2.person_id == people2[0].id


@pytest.mark.asyncio
async def test_sequential_import_queue():
    """Verify that enqueuing triggers the background worker loop sequentially."""
    mock_summary = AsyncMock(return_value="A visual description")
    mock_face_scan = AsyncMock(return_value=1)

    # Patch active analysis pipelines
    with patch("app.services.processing_queue.generate_image_summary", mock_summary), \
         patch.object(face_service, "scan_and_cluster_face", mock_face_scan):

        # Enqueue item
        processing_queue.enqueue(999, "/test_img.jpg")
        
        # Give async loop a tiny moment to spin up and execute task
        await asyncio.sleep(0.5)

        # Stop worker
        await processing_queue.shutdown()

        # Assert pipelines were executed
        assert mock_summary.call_count == 1
        assert mock_face_scan.call_count == 1
