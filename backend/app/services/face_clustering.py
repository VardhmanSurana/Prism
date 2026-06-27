"""Face clustering orchestration - main entry point for face processing pipeline."""

import json
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models import Photo, Person, PhotoPerson, PendingFaceAssignment
from app.services.face_sdk import face_sdk
from app.services.face_detection import FaceDetector
from app.services.face_recognition import FaceRecognizer
from app.services.face_utils import (
    ensure_face_thumbnail_dir,
    crop_face_thumbnail,
    save_face_thumbnail,
    format_face_box_json,
    free_image_memory,
    load_image,
)

logger = logging.getLogger(__name__)


class FaceClusteringService:
    """
    Orchestrates the complete face detection, recognition, and clustering pipeline.
    """

    def __init__(self):
        self._face_sdk = face_sdk
        self._detector = FaceDetector(face_sdk)
        self._recognizer = FaceRecognizer(face_sdk)

    def shutdown(self):
        """Release SDK resources on app shutdown."""
        self._face_sdk.shutdown()

    async def scan_and_cluster_face(self, photo_id: int, photo_path: str, db: AsyncSession) -> int:
        """
        Scan a photo for faces, extract embeddings, match them against existing database profiles,
        crop new faces to thumbnails, and register relationships.

        Args:
            photo_id: The ID of the parent Photo in the database.
            photo_path: The absolute path of the image file on disk.
            db: The active database session.

        Returns:
            The number of faces detected and processed in this photo.
        """
        # Skip already-processed photos before any resource allocations or reads
        existing_check = await db.execute(
            select(func.count()).select_from(PhotoPerson).where(PhotoPerson.photo_id == photo_id)
        )
        if (existing_check.scalar() or 0) > 0:
            return 0

        # Load image
        img = load_image(photo_path)
        if img is None:
            return 0

        # Detect faces
        faces, detect_img, scale, stream = self._detector.detect_faces(img)
        if not faces:
            return 0

        # Ensure thumbnail directory exists
        face_thumb_dir = ensure_face_thumbnail_dir()

        # Load existing people and build embedding cache
        embedding_cache, existing_people = await self._recognizer.load_embedding_cache(db)

        faces_count = 0
        face_results = []

        # --- LOOP 1: Core Face Detection, Cropping & Matching (Heavy Image/CPU Work) ---
        for idx, face in enumerate(faces):
            try:
                # Apply quality & pose thresholds
                if not self._detector.is_quality_face(face):
                    continue

                # Extract embedding
                feat = self._recognizer.extract_embedding(stream, face)
                if feat is None:
                    logger.warning(f"Failed to extract embedding for face {idx} in photo {photo_id} ({photo_path})")
                    continue

                # Find best matching person
                best_match_person, best_score = self._recognizer.find_best_match(
                    feat, existing_people, embedding_cache
                )

                # Determine if this is a match or uncertain or no match
                matched_person = None
                uncertain_person = None
                if best_match_person:
                    if best_score > settings.FACE_MATCH_THRESHOLD:
                        matched_person = best_match_person
                    elif best_score > settings.FACE_UNCERTAIN_MATCH_THRESHOLD:
                        uncertain_person = best_match_person

                # Get scaled coordinates and crop thumbnail
                x1, y1, x2, y2 = self._detector.get_face_location_scaled(face, scale)
                cropped_img = crop_face_thumbnail(img, x1, y1, x2, y2)
                thumb_filename = save_face_thumbnail(cropped_img, photo_id, face_thumb_dir)

                # Format bounding box JSON
                box_json = format_face_box_json(x1, y1, x2, y2)

                face_results.append({
                    "matched_person": matched_person,
                    "uncertain_person": uncertain_person,
                    "best_score": float(best_score),
                    "embedding": feat,
                    "box_json": box_json,
                    "confidence": float(face.detection_confidence),
                    "thumb_filename": thumb_filename
                })
                faces_count += 1

            except Exception as e:
                logger.exception(f"Failed to process face index {idx} in {photo_path}: {e}")
                continue

        # Free heavy image memory before DB work
        free_image_memory(detect_img, img, stream)

        # --- LOOP 2: Database Writes & Commits (Zero Image Memory / Async DB Work) ---
        # Wrap all DB operations in a transaction for atomicity
        try:
            person_cumulative_weight_cache = {}
            created_person_assocs = set()

            for res in face_results:
                matched_person = res["matched_person"]
                uncertain_person = res["uncertain_person"]
                best_score = res["best_score"]
                feat = res["embedding"]
                box_json = res["box_json"]
                conf = res["confidence"]
                thumb_filename = res["thumb_filename"]

                if matched_person:
                    assoc_key = (photo_id, matched_person.id)
                    if assoc_key not in created_person_assocs:
                        association = PhotoPerson(
                            photo_id=photo_id,
                            person_id=matched_person.id,
                            confidence=conf,
                            face_box_json=box_json
                        )
                        db.add(association)
                        created_person_assocs.add(assoc_key)

                    # Update running average face embedding
                    try:
                        if matched_person.id not in person_cumulative_weight_cache:
                            assoc_stmt = select(PhotoPerson).where(PhotoPerson.person_id == matched_person.id)
                            assoc_res = await db.execute(assoc_stmt)
                            associations = assoc_res.scalars().all()

                            cumulative_weight = sum(
                                self._recognizer.compute_face_weight(a.confidence, a.face_box_json)
                                for a in associations
                            )
                            if cumulative_weight == 0:
                                cumulative_weight = float(len(associations)) or 1.0
                            person_cumulative_weight_cache[matched_person.id] = cumulative_weight

                        cumulative_weight = person_cumulative_weight_cache[matched_person.id]
                        new_weight = self._recognizer.compute_face_weight(conf, box_json)

                        if matched_person.id in embedding_cache:
                            current_emb = embedding_cache[matched_person.id]
                            new_emb = self._recognizer.update_running_average(
                                current_emb, feat, cumulative_weight, new_weight
                            )

                            matched_person.face_embedding = json.dumps(new_emb.tolist())
                            embedding_cache[matched_person.id] = new_emb
                    except Exception as e:
                        logger.exception(f"Failed to update running face centroid: {e}")
                elif uncertain_person:
                    # Insert into PendingFaceAssignment
                    pending = PendingFaceAssignment(
                        photo_id=photo_id,
                        candidate_person_id=uncertain_person.id,
                        best_score=best_score,
                        face_box_json=box_json,
                        thumb_filename=thumb_filename,
                        face_embedding=json.dumps(feat.tolist())
                    )
                    db.add(pending)
                else:
                    # Create a new person profile
                    count_stmt = select(func.count()).select_from(Person)
                    current_count = (await db.execute(count_stmt)).scalar() or 0
                    person_name = f"Person {current_count + 1}"

                    new_person = Person(
                        name=person_name,
                        cover_face_thumbnail=f"/thumbnails/Face_Thumbnail/{thumb_filename}",
                        face_embedding=json.dumps(feat.tolist())
                    )
                    db.add(new_person)
                    await db.flush()  # Populates new_person.id

                    # Update caches for subsequent faces in this photo
                    existing_people.append(new_person)
                    embedding_cache[new_person.id] = feat

                    # Link the photo to the new person
                    association = PhotoPerson(
                        photo_id=photo_id,
                        person_id=new_person.id,
                        confidence=conf,
                        face_box_json=box_json
                    )
                    db.add(association)

            # Commit all DB records atomically
            await db.commit()
            logger.info(f"Successfully committed {len(face_results)} face records for photo {photo_id}")

        except Exception as e:
            await db.rollback()
            logger.error(f"Transaction failed for photo {photo_id}, rolled back: {e}")
            raise

        return faces_count


face_service = FaceClusteringService()
