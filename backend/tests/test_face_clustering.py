import json
import asyncio
import unittest.mock
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import numpy as np
from sqlalchemy import select

from app.models import BackgroundJob, Photo, Person, PhotoPerson
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
async def test_sequential_import_queue(db_session):
    """Verify that enqueuing triggers the background worker loop sequentially."""
    # Pre-insert both the Photo and a pending BackgroundJob directly via db_session.
    # This avoids the asyncio.create_task() timing race in ProcessingQueue.enqueue().
    photo = Photo(
        id=999,
        filename="test_img.jpg",
        path="/test_img.jpg",
        width=800,
        height=800,
        aspect_ratio=1.0
    )
    db_session.add(photo)
    bg_job = BackgroundJob(photo_id=999, job_type="sequential_analysis", status="pending")
    db_session.add(bg_job)
    await db_session.commit()

    mock_extract = MagicMock(return_value={
        "detailed_caption": "A visual description",
        "caption": "A visual description",
        "tags": ["tag1"],
        "embedding": [0.1] * 768
    })
    mock_face_scan = AsyncMock(return_value=1)

    # Patch active analysis pipelines + file open so the worker doesn't fail
    # trying to read /test_img.jpg from disk (encryption header check).
    # Also force ENABLE_AI_CLIP=True so the worker exercises the full pipeline
    # path (the test verifies queue wiring, not the AI-disabled skip logic).
    mock_file_data = b"\x00" * 13  # Non-encrypted header bytes
    with patch("app.services.processing_queue.extract_features_and_tags", mock_extract), \
         patch.object(face_service, "scan_and_cluster_face", mock_face_scan), \
         patch("builtins.open", unittest.mock.mock_open(read_data=mock_file_data)), \
         patch("app.services.processing_queue.settings") as mock_settings:

        mock_settings.ENABLE_AI_CLIP = True

        # Start the worker and signal it that a job is ready immediately.
        # The worker uses its own async_session() which reads from the shared
        # file-based test database — it will see the committed records above.
        processing_queue.start()
        processing_queue._wakeup_event.set()

        # Wait long enough for the worker to: wake up → fetch job → run pipelines
        # → update job status. The mocks are synchronous so this should be fast.
        await asyncio.sleep(2.0)

        # Stop worker
        await processing_queue.shutdown()

        # Assert pipelines were executed exactly once
        assert mock_extract.call_count == 1
        assert mock_face_scan.call_count == 1


@pytest.mark.asyncio
async def test_face_service_clustering_uncertain_and_feedback(db_session):
    """
    Verify that an uncertain face match creates a PendingFaceAssignment,
    and resolving it via API updates correctly.
    """
    from app.models import PendingFaceAssignment
    
    # 1. Insert dummy photo records in the DB
    photo1 = Photo(filename="p1.jpg", path="/p1.jpg", url="local:///p1.jpg", width=800, height=800, aspect_ratio=1.0)
    photo2 = Photo(filename="p2.jpg", path="/p2.jpg", url="local:///p2.jpg", width=800, height=800, aspect_ratio=1.0)
    db_session.add_all([photo1, photo2])
    await db_session.flush()

    # Create a dummy person profile
    person = Person(
        name="Person 1",
        cover_face_thumbnail="thumbnails/Face_Thumbnail/test_face.jpg",
        face_embedding=json.dumps([0.1] * 512)
    )
    db_session.add(person)
    await db_session.flush()

    # Mock OpenCV and InspireFace calls
    mock_cv2_imread = MagicMock(return_value=np.zeros((800, 800, 3), dtype=np.uint8))
    mock_cv2_imwrite = MagicMock(return_value=True)
    mock_exists = MagicMock(return_value=True)

    # Face mock matching setup
    mock_face = MagicMock()
    mock_face.location = (100, 100, 200, 200)
    mock_face.detection_confidence = 0.88

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
        face_service._face_sdk._session.face_feature_extract.return_value = np.array([0.1] * 512, dtype=np.float32)

        # Set match score to 0.35, which is between FACE_UNCERTAIN_MATCH_THRESHOLD (0.33) and FACE_MATCH_THRESHOLD (0.41)
        mock_comp.return_value = 0.35

        # Scan should run and classify as uncertain (score 0.35)
        res_count = await face_service.scan_and_cluster_face(photo2.id, "/p2.jpg", db_session)
        assert res_count == 1

        # Check that no PhotoPerson mapping was immediately created
        assoc_check = await db_session.execute(select(PhotoPerson).where(PhotoPerson.photo_id == photo2.id))
        assert assoc_check.scalar_one_or_none() is None

        # Verify a PendingFaceAssignment was created
        pending_check = await db_session.execute(select(PendingFaceAssignment).where(PendingFaceAssignment.photo_id == photo2.id))
        pending = pending_check.scalar_one_or_none()
        assert pending is not None
        assert pending.candidate_person_id == person.id
        assert pending.best_score == 0.35


def test_weighted_average_calculation():
    """Verify that compute_face_weight and update_running_average perform correct arithmetic."""
    recognizer = face_service._recognizer
    
    # 1. Test weight calculation
    # Base weight is confidence
    w1 = recognizer.compute_face_weight(0.9, None)
    assert w1 == 0.9

    # Large face bbox area -> larger weight (area = 200 * 200 = 40000 px -> multiplier capped at 2.0)
    w2 = recognizer.compute_face_weight(0.9, json.dumps({"x": 0, "y": 0, "w": 200, "h": 200}))
    assert w2 == 1.8

    # Small face bbox area -> smaller weight (area = 20 * 20 = 400 px -> multiplier 0.5)
    w3 = recognizer.compute_face_weight(0.8, json.dumps({"x": 0, "y": 0, "w": 20, "h": 20}))
    assert w3 == 0.4
    
    # 2. Test weighted centroid update
    emb1 = np.array([1.0, 0.0], dtype=np.float32)
    emb2 = np.array([0.0, 1.0], dtype=np.float32)
    
    # Update with equal weight -> should be 45-degree angle normalized (approx [0.707, 0.707])
    new_emb = recognizer.update_running_average(emb1, emb2, 1.0, 1.0)
    assert np.allclose(new_emb, [0.70710678, 0.70710678], atol=1e-3)

    # Update with custom weights (weight 2 for emb1, weight 1 for emb2)
    new_emb_weighted = recognizer.update_running_average(emb1, emb2, 2.0, 1.0)
    expected = (2.0 * emb1 + 1.0 * emb2) / 3.0
    expected = expected / np.linalg.norm(expected)
    assert np.allclose(new_emb_weighted, expected)


