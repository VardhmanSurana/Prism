"""Face recognition, embedding extraction, and matching logic."""

import json
import logging
import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Person
from app.config import settings

logger = logging.getLogger(__name__)


class FaceRecognizer:
    """Handles face embedding extraction and person matching."""

    def __init__(self, face_sdk):
        self._face_sdk = face_sdk

    async def load_embedding_cache(self, db: AsyncSession) -> dict:
        """
        Load all existing person embeddings into memory cache.

        Args:
            db: Database session

        Returns:
            dict: Mapping of person_id -> numpy embedding array
        """
        stmt = select(Person).where(Person.face_embedding.isnot(None))
        result = await db.execute(stmt)
        existing_people = list(result.scalars().all())

        embedding_cache = {}
        for p in existing_people:
            if p.face_embedding:
                try:
                    embedding_cache[p.id] = np.array(json.loads(p.face_embedding), dtype=np.float32)
                except Exception:
                    pass

        return embedding_cache, existing_people

    def extract_embedding(self, stream, face):
        """
        Extract 512-dimensional face embedding.

        Args:
            stream: InspireFace image stream
            face: Detected face object

        Returns:
            numpy array or None if extraction fails
        """
        feat = self._face_sdk.extract_feature(stream, face)
        if feat is None or feat.shape != (512,):
            return None
        return feat

    def find_best_match(self, feat, existing_people, embedding_cache):
        """
        Find the best matching person for a face embedding.

        Args:
            feat: Face embedding numpy array
            existing_people: List of Person objects
            embedding_cache: Dict of person_id -> embedding array

        Returns:
            tuple: (best_match_person, best_score) or (None, -1.0)
        """
        best_match_person = None
        best_score = -1.0

        for person in existing_people:
            if person.id not in embedding_cache:
                continue
            try:
                ref_embedding = embedding_cache[person.id]
                score = self._face_sdk.compare_features(feat, ref_embedding)
                if score > best_score:
                    best_score = score
                    best_match_person = person

                    # Early exit on high-confidence match
                    if best_score > settings.FACE_EARLY_EXIT_SCORE:
                        break
            except Exception:
                continue

        return best_match_person, best_score

    def is_match(self, best_score):
        """Check if a similarity score exceeds the match threshold."""
        return best_score > settings.FACE_MATCH_THRESHOLD

    def update_running_average(self, current_emb, new_emb, n_current):
        """
        Update running average (centroid) face embedding.

        Args:
            current_emb: Current average embedding
            new_emb: New embedding to incorporate
            n_current: Current count of faces for this person

        Returns:
            numpy array: Updated average embedding (normalized)
        """
        new_avg = (n_current * current_emb + new_emb) / (n_current + 1)
        # Re-normalize to unit sphere
        new_avg = new_avg / (np.linalg.norm(new_avg) + 1e-10)
        return new_avg
