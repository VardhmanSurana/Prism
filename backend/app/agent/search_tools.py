import logging
import re

from sqlalchemy import and_, func, or_, text
from sqlalchemy.future import select

from app.models import Album, Person, Photo, PhotoPerson

from app.agent.embeddings import EmbeddingClient
from app.agent.utils.cache import LRUCache


logger = logging.getLogger(__name__)

RRF_K = 60
RRF_SOURCE_BONUS = 0.01


def sanitize_fts5_query(query: str) -> str:
    """Escape FTS5 special characters and wrap terms in double quotes for literal matching."""
    fts5_special = re.compile(r'[*"{}]')
    clean_terms = []
    for t in query.split():
        cleaned = fts5_special.sub("", t)
        cleaned = "".join(c for c in cleaned if c.isalnum() or c in " -")
        if cleaned.strip():
            clean_terms.append(f'"{cleaned.strip()}"')
    return " OR ".join(clean_terms)


class SearchTools:
    def __init__(self, embedding_client: EmbeddingClient | None = None):
        self.embedding_client = embedding_client or EmbeddingClient()
        self._tool_cache: LRUCache = LRUCache(maxsize=2048)

    async def search_metadata(self, db, date_range=None, location=None, favorites=None, year=None, month=None, is_locked=False, ordered=False):
        """Tool 1: Search metadata filters (location, year, month, favorites)."""
        cache_key = ("search_metadata", location, favorites, year, month, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

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

        if ordered:
            stmt = select(Photo.id).where(and_(*filters)).order_by(Photo.date_taken.desc())
        else:
            stmt = select(Photo.id).where(and_(*filters))
        res = await db.execute(stmt)
        rows = [row[0] for row in res.fetchall()]

        self._tool_cache.put(cache_key, rows)
        return rows if ordered else set(rows)

    async def search_people(self, db, names: list[str], min_confidence=0.8, is_locked=False, ordered=False):
        """Tool 2: Search identified clustered people by name."""
        if not names:
            return list() if ordered else set()

        cache_key = ("search_people", tuple(sorted(names)), min_confidence, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

        people_filters = [Person.name.ilike(f"%{n}%") for n in names]
        stmt_people = select(Person.id).where(or_(*people_filters))
        res_people = await db.execute(stmt_people)
        person_ids = [row[0] for row in res_people.fetchall()]

        if not person_ids:
            logger.info(f"No people found matching names: {names}")
            return list() if ordered else set()

        if ordered:
            stmt_photos = (
                select(PhotoPerson.photo_id, PhotoPerson.confidence)
                .join(Photo, Photo.id == PhotoPerson.photo_id)
                .where(
                    PhotoPerson.person_id.in_(person_ids),
                    PhotoPerson.confidence >= min_confidence,
                    Photo.is_locked == is_locked,
                    Photo.is_trash == False,
                )
                .order_by(PhotoPerson.confidence.desc())
            )
        else:
            stmt_photos = select(PhotoPerson.photo_id).join(Photo, Photo.id == PhotoPerson.photo_id).where(
                PhotoPerson.person_id.in_(person_ids),
                PhotoPerson.confidence >= min_confidence,
                Photo.is_locked == is_locked,
                Photo.is_trash == False,
            )
        res_photos = await db.execute(stmt_photos)
        rows = [row[0] for row in res_photos.fetchall()]

        self._tool_cache.put(cache_key, rows)
        return rows if ordered else set(rows)

    async def search_captions(self, db, query: str, is_locked=False, ordered=False):
        """Tool 3: Search text captions using SQLite FTS5 matching or fallback ILIKE."""
        if not query:
            return list() if ordered else set()

        cache_key = ("search_captions", query, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

        fts_query = sanitize_fts5_query(query)

        rows = None
        if fts_query:
            try:
                if ordered:
                    fts_stmt = text(
                        "SELECT f.photo_id FROM photos_fts f "
                        "JOIN photos p ON f.photo_id = p.id "
                        "WHERE f.photos_fts MATCH :query AND p.is_locked = :is_locked AND p.is_trash = 0 "
                        "ORDER BY rank"
                    )
                else:
                    fts_stmt = text(
                        "SELECT f.photo_id FROM photos_fts f "
                        "JOIN photos p ON f.photo_id = p.id "
                        "WHERE f.photos_fts MATCH :query AND p.is_locked = :is_locked AND p.is_trash = 0"
                    )
                fts_res = await db.execute(fts_stmt, {"query": fts_query, "is_locked": 1 if is_locked else 0})
                rows = [row[0] for row in fts_res.fetchall()]
            except Exception as e:
                logger.error(f"FTS5 caption search failed: {e}. Falling back to standard ILIKE.")

        if rows is None:
            loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
            if ordered:
                stmt = select(Photo.id).where(
                    Photo.caption.ilike(f"%{loc_query}%"),
                    Photo.is_trash == False,
                    Photo.is_locked == is_locked
                ).order_by(Photo.date_taken.desc())
            else:
                stmt = select(Photo.id).where(
                    Photo.caption.ilike(f"%{loc_query}%"),
                    Photo.is_trash == False,
                    Photo.is_locked == is_locked
                )
            res = await db.execute(stmt)
            rows = [row[0] for row in res.fetchall()]

        self._tool_cache.put(cache_key, rows)
        return rows if ordered else set(rows)

    async def semantic_search(self, db, text_query: str, top_k=30, is_locked=False, ordered=False):
        """Tool 4: Search semantic conceptual queries using SigLIP embeddings."""
        if not self.embedding_client or not text_query:
            return list() if ordered else set()

        cache_key = ("semantic_search", text_query, top_k, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

        try:
            query_emb = self.embedding_client.get_query_embedding(text_query)
            if not query_emb:
                return list() if ordered else set()

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
                return list() if ordered else set()

            embs_arr = np.array(embs, dtype=np.float32)
            q_arr = np.array(query_emb, dtype=np.float32)
            sims = np.dot(embs_arr, q_arr)

            threshold = 0.15
            sorted_idx = np.argsort(sims)[::-1]
            result_ids = []
            for idx in sorted_idx:
                if sims[idx] >= threshold:
                    result_ids.append(photo_ids[idx])
                    if len(result_ids) >= top_k:
                        break

            self._tool_cache.put(cache_key, result_ids)
            return result_ids if ordered else set(result_ids)
        except Exception as e:
            logger.error(f"Semantic search tool failed: {e}")
            return list() if ordered else set()

    async def search_albums(self, db, query: str, is_locked=False, ordered=False):
        """Tool 5: Find matching albums and retrieve photo records using parsed metadata relationships."""
        if not query:
            return list() if ordered else set()

        cache_key = ("search_albums", query, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

        stmt = select(Album).where(Album.name.ilike(f"%{query}%"))
        res = await db.execute(stmt)
        albums = res.scalars().all()

        if not albums:
            return list() if ordered else set()

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

        self._tool_cache.put(cache_key, photo_ids)
        return list(photo_ids) if ordered else set(photo_ids)

    async def search_ocr(self, db, query: str, is_locked=False, ordered=False):
        """Tool 6: Match text contained inside images using captions and descriptions."""
        if not query:
            return list() if ordered else set()

        cache_key = ("search_ocr", query, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

        loc_query = query.replace("%", "\\%").replace("_", "\\_")[:50]
        if ordered:
            stmt = select(Photo.id).where(
                or_(
                    Photo.filename.ilike(f"%{loc_query}%"),
                    Photo.caption.ilike(f"%{loc_query}%"),
                    Photo.ai_summary.ilike(f"%{loc_query}%"),
                    Photo.ocr_text.ilike(f"%{loc_query}%"),
                ),
                Photo.is_trash == False,
                Photo.is_locked == is_locked,
            ).order_by(Photo.date_taken.desc())
        else:
            stmt = select(Photo.id).where(
                or_(
                    Photo.filename.ilike(f"%{loc_query}%"),
                    Photo.caption.ilike(f"%{loc_query}%"),
                    Photo.ai_summary.ilike(f"%{loc_query}%"),
                    Photo.ocr_text.ilike(f"%{loc_query}%"),
                ),
                Photo.is_trash == False,
                Photo.is_locked == is_locked,
            )
        res = await db.execute(stmt)
        rows = [row[0] for row in res.fetchall()]

        self._tool_cache.put(cache_key, rows)
        return rows if ordered else set(rows)

    async def similar_image(self, db, photo_id: int, top_k=30, is_locked=False, ordered=False):
        """Tool 7: Query SigLIP embeddings of other photos to find visually matching images."""
        cache_key = ("similar_image", photo_id, top_k, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

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
                return list() if ordered else set()

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
                return list() if ordered else set()

            embs_arr = np.array(embs, dtype=np.float32)
            q_arr = np.array(query_emb, dtype=np.float32)
            sims = np.dot(embs_arr, q_arr)

            sorted_idx = np.argsort(sims)[::-1]
            result_ids = []
            for idx in sorted_idx[:top_k]:
                result_ids.append(photo_ids[idx])

            self._tool_cache.put(cache_key, result_ids)
            return result_ids if ordered else set(result_ids)
        except Exception as e:
            logger.error(f"Similar image search tool failed: {e}")
            return list() if ordered else set()

    async def search_similar_by_embedding(self, db, query_emb: list[float], top_k=30, is_locked=False, ordered=False):
        """Find visually similar photos in the library given an embedding vector."""
        if not query_emb:
            return list() if ordered else set()

        try:
            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.is_locked == is_locked,
                Photo.embedding.isnot(None),
            )
            res_embs = await db.execute(stmt_embs)
            rows = res_embs.all()

            import json
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
                return list() if ordered else set()

            embs_arr = np.array(embs, dtype=np.float32)
            q_arr = np.array(query_emb, dtype=np.float32)
            sims = np.dot(embs_arr, q_arr)

            sorted_idx = np.argsort(sims)[::-1]
            result_ids = [photo_ids[idx] for idx in sorted_idx[:top_k]]
            return result_ids if ordered else set(result_ids)
        except Exception as e:
            logger.error(f"search_similar_by_embedding failed: {e}")
            return list() if ordered else set()

    async def search_events(self, db, query: str, is_locked=False, ordered=False):
        """Tool 8: Find matching events (e.g., Goa Trip 2025, Rahul Birthday) and retrieve associated photos."""
        if not query:
            return list() if ordered else set()

        cache_key = ("search_events", query, is_locked)
        cached = self._tool_cache.get(cache_key)
        if cached is not None:
            return list(cached) if ordered else set(cached)

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
                direct_stmt = select(Photo.id).where(
                    Photo.event_id == ev.id,
                    Photo.is_trash == False,
                    Photo.is_locked == is_locked
                )
                direct_res = await db.execute(direct_stmt)
                res_set.update(row[0] for row in direct_res.fetchall())

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

        self._tool_cache.put(cache_key, res_set)
        return list(res_set) if ordered else set(res_set)

    async def fused_search(self, db, query: str, top_k: int = 30, is_locked: bool = False) -> list[dict]:

        tool_results = {}

        try:
            res = await self.search_metadata(db, is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_metadata"] = res
        except Exception as e:
            logger.error(f"fused_search metadata failed: {e}")

        try:
            res = await self.search_captions(db, query=query, is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_captions"] = res
        except Exception as e:
            logger.error(f"fused_search captions failed: {e}")

        try:
            res = await self.semantic_search(db, text_query=query, top_k=top_k * 2, is_locked=is_locked, ordered=True)
            if res:
                tool_results["semantic_search"] = res
        except Exception as e:
            logger.error(f"fused_search semantic failed: {e}")

        try:
            res = await self.search_albums(db, query=query, is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_albums"] = res
        except Exception as e:
            logger.error(f"fused_search albums failed: {e}")

        try:
            res = await self.search_ocr(db, query=query, is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_ocr"] = res
        except Exception as e:
            logger.error(f"fused_search ocr failed: {e}")

        try:
            res = await self.search_events(db, query=query, is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_events"] = res
        except Exception as e:
            logger.error(f"fused_search events failed: {e}")

        try:
            res = await self.search_people(db, names=[query], is_locked=is_locked, ordered=True)
            if res:
                tool_results["search_people"] = res
        except Exception as e:
            logger.error(f"fused_search people failed: {e}")

        if not tool_results:
            return []

        photo_scores: dict[int, float] = {}
        photo_sources: dict[int, list[str]] = {}

        for source_name, ordered_ids in tool_results.items():
            for rank, photo_id in enumerate(ordered_ids):
                rrf_contribution = 1.0 / (RRF_K + rank + 1)
                photo_scores[photo_id] = photo_scores.get(photo_id, 0.0) + rrf_contribution
                if photo_id not in photo_sources:
                    photo_sources[photo_id] = []
                photo_sources[photo_id].append(source_name)

        for photo_id in photo_scores:
            num_sources = len(photo_sources[photo_id])
            if num_sources > 1:
                photo_scores[photo_id] += RRF_SOURCE_BONUS * (num_sources - 1)

        sorted_photos = sorted(photo_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        return [
            {
                "photo_id": photo_id,
                "rrf_score": round(score, 6),
                "sources": photo_sources[photo_id],
            }
            for photo_id, score in sorted_photos
        ]

    async def search(self, db, query: str, top_k: int = 30, is_locked: bool = False) -> list[dict]:
        return await self.fused_search(db, query, top_k, is_locked)

