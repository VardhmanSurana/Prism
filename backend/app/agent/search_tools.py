import logging

from sqlalchemy import and_, func, or_, text
from sqlalchemy.future import select

from app.models import Album, Person, Photo, PhotoPerson

from app.agent.embeddings import EmbeddingClient


logger = logging.getLogger(__name__)


class SearchTools:
    def __init__(self, embedding_client: EmbeddingClient | None = None):
        self.embedding_client = embedding_client or EmbeddingClient()

    async def search_metadata(self, db, date_range=None, location=None, favorites=None, year=None, is_locked=False) -> set[int]:
        """Tool 1: Search metadata filters (location, year, favorites)."""
        filters = []
        if is_locked:
            filters.append(Photo.is_locked == True)
        else:
            filters.append(Photo.is_locked == False)
        filters.append(Photo.is_trash == False)

        if favorites:
            filters.append(Photo.is_favorite == True)

        if year:
            filters.append(func.strftime("%Y", Photo.date_taken) == str(year))

        if location:
            loc = location.replace("%", "\\%").replace("_", "\\_")[:50]
            filters.append(or_(
                Photo.city.ilike(f"%{loc}%"),
                Photo.state.ilike(f"%{loc}%"),
                Photo.country.ilike(f"%{loc}%"),
            ))

        stmt = select(Photo.id).where(and_(*filters))
        res = await db.execute(stmt)
        return {row[0] for row in res.fetchall()}

    async def search_people(self, db, names: list[str], min_confidence=0.8) -> set[int]:
        """Tool 2: Search identified clustered people by name."""
        if not names:
            return set()

        people_filters = [Person.name.ilike(f"%{n}%") for n in names]
        stmt_people = select(Person.id).where(or_(*people_filters))
        res_people = await db.execute(stmt_people)
        person_ids = [row[0] for row in res_people.fetchall()]

        if not person_ids:
            logger.info(f"No people found matching names: {names}")
            return set()

        stmt_photos = select(PhotoPerson.photo_id).where(
            PhotoPerson.person_id.in_(person_ids),
            PhotoPerson.confidence >= min_confidence,
        )
        res_photos = await db.execute(stmt_photos)
        return {row[0] for row in res_photos.fetchall()}

    async def search_captions(self, db, query: str) -> set[int]:
        """Tool 3: Search text captions using SQLite FTS5 matching or fallback ILIKE."""
        if not query:
            return set()

        clean_terms = []
        for t in query.split():
            cleaned = "".join(c for c in t if c.isalnum() or c in " -")
            if cleaned.strip():
                clean_terms.append(f'"{cleaned.strip()}*"')
        fts_query = " OR ".join(clean_terms)

        if fts_query:
            try:
                fts_stmt = text("SELECT photo_id FROM photos_fts WHERE photos_fts MATCH :query")
                fts_res = await db.execute(fts_stmt, {"query": fts_query})
                return {row[0] for row in fts_res.fetchall()}
            except Exception as e:
                logger.error(f"FTS5 caption search failed: {e}. Falling back to standard ILIKE.")

        loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
        stmt = select(Photo.id).where(Photo.caption.ilike(f"%{loc_query}%"), Photo.is_trash == False)
        res = await db.execute(stmt)
        return {row[0] for row in res.fetchall()}

    async def semantic_search(self, db, text_query: str, top_k=30, is_locked=False) -> set[int]:
        """Tool 4: Search semantic conceptual queries using SigLIP embeddings."""
        if not self.embedding_client or not text_query:
            return set()

        try:
            query_emb = self.embedding_client.get_query_embedding(text_query)
            if not query_emb:
                return set()

            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.is_locked == (True if is_locked else False),
                Photo.embedding.isnot(None),
            )
            res_embs = await db.execute(stmt_embs)
            rows = res_embs.all()

            import numpy as np

            photo_ids = []
            embs = []
            for pid, emb_str in rows:
                try:
                    import json

                    emb = json.loads(emb_str)
                    if len(emb) == len(query_emb):
                        photo_ids.append(pid)
                        embs.append(emb)
                except Exception:
                    pass

            if not embs:
                return set()

            embs_arr = np.array(embs, dtype=np.float32)
            q_arr = np.array(query_emb, dtype=np.float32)
            sims = np.dot(embs_arr, q_arr)

            threshold = 0.15
            sorted_idx = np.argsort(sims)[::-1]
            semantic_ids = []
            for idx in sorted_idx:
                if sims[idx] >= threshold:
                    semantic_ids.append(photo_ids[idx])
                    if len(semantic_ids) >= top_k:
                        break
            return set(semantic_ids)
        except Exception as e:
            logger.error(f"Semantic search tool failed: {e}")
            return set()

    async def search_albums(self, db, query: str) -> set[int]:
        """Tool 5: Find matching albums and retrieve photo records using parsed metadata relationships."""
        if not query:
            return set()

        stmt = select(Album).where(Album.name.ilike(f"%{query}%"))
        res = await db.execute(stmt)
        albums = res.scalars().all()

        if not albums:
            return set()

        photo_ids = set()
        for alb in albums:
            if not alb.metadata_json:
                continue
            try:
                import json

                meta = json.loads(alb.metadata_json)
                filters = [Photo.is_trash == False]
                if alb.type == "places":
                    city = meta.get("city")
                    state = meta.get("state")
                    country = meta.get("country")
                    if city:
                        filters.append(Photo.city == city)
                    if state:
                        filters.append(Photo.state == state)
                    if country:
                        filters.append(Photo.country == country)
                elif alb.type == "memories":
                    year = meta.get("year")
                    month = meta.get("month")
                    if year:
                        filters.append(func.strftime("%Y", Photo.date_taken) == str(year))
                    if month:
                        filters.append(func.strftime("%m", Photo.date_taken) == f"{int(month):02d}")
                elif alb.type == "people":
                    person_id = meta.get("person_id")
                    if person_id:
                        stmt_person = select(PhotoPerson.photo_id).where(PhotoPerson.person_id == person_id)
                        res_person = await db.execute(stmt_person)
                        photo_ids.update([row[0] for row in res_person.fetchall()])
                        continue

                if filters:
                    stmt_photos = select(Photo.id).where(and_(*filters))
                    res_photos = await db.execute(stmt_photos)
                    photo_ids.update([row[0] for row in res_photos.fetchall()])
            except Exception as e:
                logger.error(f"Error parsing album metadata: {e}")

        return photo_ids

    async def search_ocr(self, db, query: str) -> set[int]:
        """Tool 6: Match text contained inside images using captions and descriptions."""
        if not query:
            return set()

        loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
        stmt = select(Photo.id).where(
            or_(
                Photo.filename.ilike(f"%{loc_query}%"),
                Photo.caption.ilike(f"%{loc_query}%"),
                Photo.ai_summary.ilike(f"%{loc_query}%"),
            ),
            Photo.is_trash == False,
        )
        res = await db.execute(stmt)
        return {row[0] for row in res.fetchall()}

    async def similar_image(self, db, photo_id: int, top_k=30) -> set[int]:
        """Tool 7: Query SigLIP embeddings of other photos to find visually matching images."""
        try:
            stmt = select(Photo.embedding).where(Photo.id == photo_id, Photo.embedding.isnot(None))
            res = await db.execute(stmt)
            row = res.fetchone()
            if not row:
                return set()

            import json

            query_emb = json.loads(row[0])
            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.id != photo_id,
                Photo.embedding.isnot(None),
            )
            res_embs = await db.execute(stmt_embs)
            rows = res_embs.all()

            import numpy as np

            photo_ids = []
            embs = []
            for pid, emb_str in rows:
                try:
                    emb = json.loads(emb_str)
                    if len(emb) == len(query_emb):
                        photo_ids.append(pid)
                        embs.append(emb)
                except Exception:
                    pass

            if not embs:
                return set()

            embs_arr = np.array(embs, dtype=np.float32)
            q_arr = np.array(query_emb, dtype=np.float32)
            sims = np.dot(embs_arr, q_arr)

            sorted_idx = np.argsort(sims)[::-1]
            similar_ids = []
            for idx in sorted_idx[:top_k]:
                similar_ids.append(photo_ids[idx])
            return set(similar_ids)
        except Exception as e:
            logger.error(f"Similar image search tool failed: {e}")
            return set()
