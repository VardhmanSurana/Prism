import logging

from sqlalchemy import and_, func, or_, text
from sqlalchemy.future import select

from app.models import Album, Person, Photo, PhotoPerson

from app.agent.embeddings import EmbeddingClient


logger = logging.getLogger(__name__)


class SearchTools:
    def __init__(self, embedding_client: EmbeddingClient | None = None):
        self.embedding_client = embedding_client or EmbeddingClient()
        self._tool_cache = {}

    async def search_metadata(self, db, date_range=None, location=None, favorites=None, year=None, month=None, is_locked=False) -> set[int]:
        """Tool 1: Search metadata filters (location, year, month, favorites)."""
        cache_key = ("search_metadata", location, favorites, year, month, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

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

        if month:
            filters.append(func.strftime("%m", Photo.date_taken) == f"{int(month):02d}")

        if location:
            loc = location.replace("%", "\\%").replace("_", "\\_")[:50]
            filters.append(or_(
                Photo.city.ilike(f"%{loc}%"),
                Photo.state.ilike(f"%{loc}%"),
                Photo.country.ilike(f"%{loc}%"),
            ))

        stmt = select(Photo.id).where(and_(*filters))
        res = await db.execute(stmt)
        res_set = {row[0] for row in res.fetchall()}
        
        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = res_set
        return set(res_set)

    async def search_people(self, db, names: list[str], min_confidence=0.8, is_locked=False) -> set[int]:
        """Tool 2: Search identified clustered people by name."""
        if not names:
            return set()

        cache_key = ("search_people", tuple(sorted(names)), min_confidence, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

        people_filters = [Person.name.ilike(f"%{n}%") for n in names]
        stmt_people = select(Person.id).where(or_(*people_filters))
        res_people = await db.execute(stmt_people)
        person_ids = [row[0] for row in res_people.fetchall()]

        if not person_ids:
            logger.info(f"No people found matching names: {names}")
            return set()

        stmt_photos = select(PhotoPerson.photo_id).join(Photo, Photo.id == PhotoPerson.photo_id).where(
            PhotoPerson.person_id.in_(person_ids),
            PhotoPerson.confidence >= min_confidence,
            Photo.is_locked == is_locked,
            Photo.is_trash == False,
        )
        res_photos = await db.execute(stmt_photos)
        res_set = {row[0] for row in res_photos.fetchall()}

        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = res_set
        return set(res_set)

    async def search_captions(self, db, query: str, is_locked=False) -> set[int]:
        """Tool 3: Search text captions using SQLite FTS5 matching or fallback ILIKE."""
        if not query:
            return set()

        cache_key = ("search_captions", query, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

        clean_terms = []
        for t in query.split():
            cleaned = "".join(c for c in t if c.isalnum() or c in " -")
            if cleaned.strip():
                clean_terms.append(f'"{cleaned.strip()}*"')
        fts_query = " OR ".join(clean_terms)

        res_set = None
        if fts_query:
            try:
                fts_stmt = text(
                    "SELECT f.photo_id FROM photos_fts f "
                    "JOIN photos p ON f.photo_id = p.id "
                    "WHERE f.photos_fts MATCH :query AND p.is_locked = :is_locked AND p.is_trash = 0"
                )
                fts_res = await db.execute(fts_stmt, {"query": fts_query, "is_locked": 1 if is_locked else 0})
                res_set = {row[0] for row in fts_res.fetchall()}
            except Exception as e:
                logger.error(f"FTS5 caption search failed: {e}. Falling back to standard ILIKE.")

        if res_set is None:
            loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
            stmt = select(Photo.id).where(
                Photo.caption.ilike(f"%{loc_query}%"),
                Photo.is_trash == False,
                Photo.is_locked == is_locked
            )
            res = await db.execute(stmt)
            res_set = {row[0] for row in res.fetchall()}

        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = res_set
        return set(res_set)

    async def semantic_search(self, db, text_query: str, top_k=30, is_locked=False) -> set[int]:
        """Tool 4: Search semantic conceptual queries using SigLIP embeddings."""
        if not self.embedding_client or not text_query:
            return set()

        cache_key = ("semantic_search", text_query, top_k, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

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
            res_set = set(semantic_ids)
            
            if len(self._tool_cache) >= 1000:
                self._tool_cache.clear()
            self._tool_cache[cache_key] = res_set
            return set(res_set)
        except Exception as e:
            logger.error(f"Semantic search tool failed: {e}")
            return set()

    async def search_albums(self, db, query: str, is_locked=False) -> set[int]:
        """Tool 5: Find matching albums and retrieve photo records using parsed metadata relationships."""
        if not query:
            return set()

        cache_key = ("search_albums", query, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

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
                filters = [Photo.is_trash == False, Photo.is_locked == is_locked]
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
                        stmt_person = select(PhotoPerson.photo_id).join(Photo, Photo.id == PhotoPerson.photo_id).where(
                            PhotoPerson.person_id == person_id,
                            Photo.is_locked == is_locked,
                            Photo.is_trash == False
                        )
                        res_person = await db.execute(stmt_person)
                        photo_ids.update([row[0] for row in res_person.fetchall()])
                        continue

                if filters:
                    stmt_photos = select(Photo.id).where(and_(*filters))
                    res_photos = await db.execute(stmt_photos)
                    photo_ids.update([row[0] for row in res_photos.fetchall()])
            except Exception as e:
                logger.error(f"Error parsing album metadata: {e}")

        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = photo_ids
        return set(photo_ids)

    async def search_ocr(self, db, query: str, is_locked=False) -> set[int]:
        """Tool 6: Match text contained inside images using captions and descriptions."""
        if not query:
            return set()

        cache_key = ("search_ocr", query, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

        loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
        stmt = select(Photo.id).where(
            or_(
                Photo.filename.ilike(f"%{loc_query}%"),
                Photo.caption.ilike(f"%{loc_query}%"),
                Photo.ai_summary.ilike(f"%{loc_query}%"),
            ),
            Photo.is_trash == False,
            Photo.is_locked == is_locked,
        )
        res = await db.execute(stmt)
        res_set = {row[0] for row in res.fetchall()}

        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = res_set
        return set(res_set)

    async def similar_image(self, db, photo_id: int, top_k=30, is_locked=False) -> set[int]:
        """Tool 7: Query SigLIP embeddings of other photos to find visually matching images."""
        cache_key = ("similar_image", photo_id, top_k, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

        try:
            stmt = select(Photo.embedding).where(
                Photo.id == photo_id, 
                Photo.is_locked == is_locked,
                Photo.is_trash == False,
                Photo.embedding.isnot(None)
            )
            res = await db.execute(stmt)
            row = res.fetchone()
            if not row:
                return set()

            import json

            query_emb = json.loads(row[0])
            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.id != photo_id,
                Photo.is_locked == is_locked,
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
            res_set = set(similar_ids)

            if len(self._tool_cache) >= 1000:
                self._tool_cache.clear()
            self._tool_cache[cache_key] = res_set
            return set(res_set)
        except Exception as e:
            logger.error(f"Similar image search tool failed: {e}")
            return set()

    async def search_events(self, db, query: str, is_locked=False) -> set[int]:
        """Tool 8: Find matching events (e.g., Goa Trip 2025, Rahul Birthday) and retrieve associated photos."""
        if not query:
            return set()

        cache_key = ("search_events", query, is_locked)
        if cache_key in self._tool_cache:
            return set(self._tool_cache[cache_key])

        from app.models import Event

        terms = [t.strip("?,.!") for t in query.split()]
        filters = []
        for t in terms:
            if len(t) > 2:
                filters.append(or_(
                    Event.title.ilike(f"%{t}%"),
                    Event.location.ilike(f"%{t}%"),
                    Event.summary.ilike(f"%{t}%")
                ))
        
        res_set = set()
        if filters:
            stmt = select(Event).where(or_(*filters))
            res = await db.execute(stmt)
            matched_events = res.scalars().all()

            for ev in matched_events:
                # 1. Direct photo links
                direct_stmt = select(Photo.id).where(
                    Photo.event_id == ev.id,
                    Photo.is_trash == False,
                    Photo.is_locked == is_locked
                )
                direct_res = await db.execute(direct_stmt)
                res_set.update(row[0] for row in direct_res.fetchall())

                # 2. Heuristic overlap: date/location fallback
                fallback_filters = [
                    Photo.is_trash == False,
                    Photo.is_locked == is_locked
                ]
                has_criteria = False
                if ev.location:
                    loc_clean = ev.location.replace("%", "\\%").replace("_", "\\_")[:50]
                    fallback_filters.append(or_(
                        Photo.city.ilike(f"%{loc_clean}%"),
                        Photo.state.ilike(f"%{loc_clean}%"),
                        Photo.country.ilike(f"%{loc_clean}%")
                    ))
                    has_criteria = True
                if ev.start_date:
                    fallback_filters.append(Photo.date_taken >= ev.start_date)
                    has_criteria = True
                if ev.end_date:
                    fallback_filters.append(Photo.date_taken <= ev.end_date)
                    has_criteria = True
                
                if has_criteria:
                    fallback_stmt = select(Photo.id).where(and_(*fallback_filters))
                    fallback_res = await db.execute(fallback_stmt)
                    res_set.update(row[0] for row in fallback_res.fetchall())

        if len(self._tool_cache) >= 1000:
            self._tool_cache.clear()
        self._tool_cache[cache_key] = res_set
        return set(res_set)

