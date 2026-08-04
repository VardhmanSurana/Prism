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
                except Exception as e:
                    logger.warning(f"Failed to load embedding for person {p.id}: {e}")

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
        if feat is None:
            logger.warning(f"Face SDK returned None embedding for face")
            return None
        if feat.shape != (512,):
            logger.warning(f"Face embedding has unexpected shape {feat.shape}, expected (512,)")
            return None
        return feat

    def find_best_match(self, feat, existing_people, embedding_cache, top_k=5):
        """
        Find the best matching person for a face embedding using a two-stage approach:
        Stage A (Fast Shortlist): Vectorized cosine similarity using numpy dot products.
        Stage B (Accurate Scoring): Exact comparison using the SDK on the top-K shortlist.

        Args:
            feat: Face embedding numpy array
            existing_people: List of Person objects
            embedding_cache: Dict of person_id -> embedding array
            top_k: Number of candidate matches to shortlist in Stage A

        Returns:
            tuple: (best_match_person, best_score) or (None, -1.0)
        """
        if not existing_people or not embedding_cache:
            return None, -1.0

        # Stage A: Vectorized Cosine Similarity Shortlist
        person_ids = []
        embeddings_list = []
        for person in existing_people:
            if person.id in embedding_cache:
                person_ids.append(person.id)
                embeddings_list.append(embedding_cache[person.id])

        if not embeddings_list:
            return None, -1.0

        # Stack into matrix of shape (N, 512) and compute dot products (cosine similarity since normalized)
        matrix = np.vstack(embeddings_list)
        scores = np.dot(matrix, feat)

        # Get indices of top_k highest scores
        top_indices = np.argsort(scores)[::-1][:top_k]

        # Stage B: Accurate Scoring on Shortlist only
        best_match_person = None
        best_score = -1.0
        person_map = {p.id: p for p in existing_people}

        for idx in top_indices:
            pid = person_ids[idx]
            person = person_map.get(pid)
            if not person:
                continue
            try:
                ref_embedding = embedding_cache[pid]
                score = self._face_sdk.compare_features(feat, ref_embedding)
                if score > best_score:
                    best_score = score
                    best_match_person = person
            except Exception:
                continue

        return best_match_person, best_score

    def is_match(self, best_score):
        """Check if a similarity score exceeds the match threshold."""
        return best_score > settings.FACE_MATCH_THRESHOLD

    def compute_face_weight(self, confidence: float, face_box_json: str) -> float:
        """
        Compute quality weight of a face based on detection confidence and bounding box area.

        Args:
            confidence: Face detection confidence score (0.0 to 1.0)
            face_box_json: JSON string of face bounding box coordinates

        Returns:
            float: Quality weight
        """
        weight = confidence
        if face_box_json:
            try:
                box = json.loads(face_box_json)
                w = box.get("w", 0)
                h = box.get("h", 0)
                area = w * h
                # Base scale: 100x100 face (10000 px area) gets size multiplier 1.0
                size_mult = min(2.0, max(0.5, area / 10000.0))
                weight *= size_mult
            except Exception:
                pass
        return weight

    def update_running_average(self, current_emb, new_emb, cumulative_weight, new_weight):
        """
        Update running average (centroid) face embedding using quality weights.

        Args:
            current_emb: Current average embedding
            new_emb: New embedding to incorporate
            cumulative_weight: Combined quality weight of existing face mappings
            new_weight: Quality weight of the new face mapping

        Returns:
            numpy array: Updated average embedding (normalized)
        """
        new_avg = (cumulative_weight * current_emb + new_weight * new_emb) / (cumulative_weight + new_weight)
        # Re-normalize to unit sphere
        new_avg = new_avg / (np.linalg.norm(new_avg) + 1e-10)
        return new_avg
