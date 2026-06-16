import logging

from sqlalchemy.future import select

from app.api.albums.utils import photo_to_dict
from app.db import async_session
from app.models import Photo

from app.agent.planner import Planner
from app.agent.search_tools import SearchTools


logger = logging.getLogger(__name__)


class AgentOrchestrator:
    def __init__(self, planner: Planner, search_tools: SearchTools):
        self.planner = planner
        self.search_tools = search_tools

    def heuristic_score_photos(self, query: str, photos: list) -> list:
        """Score and rank candidate photos based on query term overlap with metadata."""
        # Clean and split the query into lowercase keywords
        keywords = [w.strip("?,.!\"'").lower() for w in query.split()]
        keywords = [w for w in keywords if w and w not in {
            "show", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some", "and", "or"
        }]
        
        scored_candidates = []
        for p in photos:
            score = 0.0
            
            # Exact year match
            years_in_query = [int(w) for w in keywords if w.isdigit() and len(w) == 4]
            if years_in_query and p.date_taken:
                photo_year = p.date_taken.year
                if photo_year in years_in_query:
                    score += 3.0
                    
            # Favorites match
            is_fav_query = any(w in ["favorite", "starred", "loved", "stars", "heart"] for w in keywords)
            if is_fav_query and p.is_favorite:
                score += 2.0
                
            # Metadata text match
            for kw in keywords:
                if p.city and kw in p.city.lower():
                    score += 2.0
                if p.state and kw in p.state.lower():
                    score += 2.0
                if p.country and kw in p.country.lower():
                    score += 2.0
                if p.location and kw in p.location.lower():
                    score += 2.0
                if p.caption and kw in p.caption.lower():
                    score += 1.5
                if p.ai_summary and kw in p.ai_summary.lower():
                    score += 1.0
                if p.auto_tags and kw in p.auto_tags.lower():
                    score += 1.0
                if p.filename and kw in p.filename.lower():
                    score += 0.5
                    
            scored_candidates.append((score, p))
            
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored_candidates]

    async def chat_stream(self, message: str, history: list = None):
        logger.info(f"Received agent chat message for streaming: {message}")

        verified_photos = []
        last_plan = {}

        for attempt in range(1, 4):
            # Yield progress state: planning
            yield {
                "type": "progress",
                "state": "planning",
                "detail": f"Formulating search strategy (attempt {attempt}/3)..."
            }
            
            logger.info(f"Starting agent query planner attempt {attempt}/3")
            if attempt == 1:
                plan = self.planner.extract_search_parameters(message, history=history)
            else:
                plan = self.planner.reformulate_search(message, last_plan, history=history)

            # Redundancy guard: if reformulation produces an equivalent plan, stop early.
            if attempt > 1:
                prev_plan = last_plan or {}
                prev_signature = {
                    "entities": prev_plan.get("entities") or {},
                    "constraints": prev_plan.get("constraints") or {},
                    "ranking": prev_plan.get("ranking") or {},
                    "is_locked": prev_plan.get("is_locked") or False,
                }
                curr_signature = {
                    "entities": plan.get("entities") or {},
                    "constraints": plan.get("constraints") or {},
                    "ranking": plan.get("ranking") or {},
                    "is_locked": plan.get("is_locked") or False,
                }

                if prev_signature == curr_signature:
                    logger.info(
                        f"Attempt {attempt} produced a redundant search plan; stopping early to avoid repeated identical work."
                    )
                    break

            last_plan = plan
            logger.info(f"Attempt {attempt} search plan: {plan}")

            entities = plan.get("entities") or {}
            constraints = plan.get("constraints") or {}
            ranking = plan.get("ranking") or {}

            is_locked = plan.get("is_locked") or False
            prefer_favorites = ranking.get("prefer_favorites") or False
            prefer_recent = ranking.get("prefer_recent") or True
            must_match = constraints.get("must_match") or []

            # Parse time range year
            time_range = entities.get("time_range")
            year_param = None
            if isinstance(time_range, int):
                year_param = time_range
            elif isinstance(time_range, str) and time_range.isdigit():
                year_param = int(time_range)

            raw_limit = plan.get("limit") or 30
            try:
                query_limit = int(raw_limit)
                if query_limit <= 0:
                    query_limit = 30
            except (ValueError, TypeError):
                query_limit = 30

            # Yield progress state: running tools
            yield {
                "type": "progress",
                "state": "running_tools",
                "detail": f"Scanning indexes dynamically..."
            }

            async with async_session() as db:
                strict_results = []
                soft_results = []

                # 1. Metadata Search
                locations = entities.get("locations") or []
                if locations or year_param or prefer_favorites:
                    location_val = locations[0] if locations else None
                    try:
                        res_set = await self.search_tools.search_metadata(
                            db,
                            location=location_val,
                            favorites=prefer_favorites,
                            year=year_param,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_metadata returned {len(res_set)} IDs.")
                        
                        is_strict = False
                        if "locations" in must_match and locations:
                            is_strict = True
                        if "time_range" in must_match and year_param:
                            is_strict = True
                            
                        if is_strict:
                            strict_results.append(res_set)
                        else:
                            soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_metadata: {err}")

                # 2. People Search
                people = entities.get("people") or []
                if people:
                    try:
                        res_set = await self.search_tools.search_people(
                            db,
                            names=people,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_people returned {len(res_set)} IDs.")
                        
                        if "people" in must_match:
                            strict_results.append(res_set)
                        else:
                            soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_people: {err}")

                # 3. Soft text-based searches
                events = entities.get("events") or []
                objects = entities.get("objects") or []
                text_query_parts = events + objects
                if not text_query_parts and not locations:
                    text_query = message
                else:
                    text_query = " ".join(text_query_parts + locations)

                if text_query:
                    # search_captions
                    try:
                        res_set = await self.search_tools.search_captions(
                            db,
                            query=text_query,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_captions returned {len(res_set)} IDs.")
                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_captions: {err}")

                    # semantic_search
                    try:
                        res_set = await self.search_tools.semantic_search(
                            db,
                            text_query=text_query,
                            top_k=query_limit,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool semantic_search returned {len(res_set)} IDs.")
                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running semantic_search: {err}")

                    # search_albums
                    try:
                        res_set = await self.search_tools.search_albums(
                            db,
                            query=text_query,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_albums returned {len(res_set)} IDs.")
                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_albums: {err}")

                    # search_ocr
                    try:
                        res_set = await self.search_tools.search_ocr(
                            db,
                            query=text_query,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_ocr returned {len(res_set)} IDs.")
                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_ocr: {err}")

                # 4. Similar image search
                photo_id_param = entities.get("photo_id") or plan.get("filters", {}).get("photo_id")
                if photo_id_param:
                    try:
                        res_set = await self.search_tools.similar_image(
                            db,
                            photo_id=photo_id_param,
                            top_k=query_limit,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool similar_image returned {len(res_set)} IDs.")
                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running similar_image: {err}")

                strict_ids = None
                if strict_results:
                    strict_ids = set.intersection(*strict_results)
                    logger.info(f"Intersection of strict tools: {len(strict_ids)} IDs.")

                soft_ids = None
                if soft_results:
                    soft_ids = set.union(*soft_results)
                    logger.info(f"Union of soft tools: {len(soft_ids)} IDs.")

                combined_ids = set()
                combination_mode = "none"
                if strict_ids is not None and soft_ids is not None:
                    combined_ids = strict_ids.intersection(soft_ids)
                    combination_mode = "strict_intersection_with_soft_union"
                    if not combined_ids:
                        combined_ids = strict_ids
                        combination_mode = "fallback_to_strict_only"
                elif strict_ids is not None:
                    combined_ids = strict_ids
                    combination_mode = "strict_only"
                elif soft_ids is not None:
                    combined_ids = soft_ids
                    combination_mode = "soft_only"

                logger.info(f"Combined IDs count: {len(combined_ids)} (mode: {combination_mode})")

                if combined_ids:
                    if prefer_recent:
                        order_clause = Photo.date_taken.desc()
                    else:
                        order_clause = Photo.date_taken.asc()

                    stmt = select(Photo).where(
                        Photo.id.in_(combined_ids),
                        Photo.is_trash == False,
                        Photo.is_locked == (True if is_locked else False),
                    ).order_by(order_clause).limit(query_limit)
                    res = await db.execute(stmt)
                    candidate_photos = res.scalars().all()
                    
                    # Rank candidates using heuristic scoring
                    candidate_photos = self.heuristic_score_photos(message, candidate_photos)
                else:
                    candidate_photos = []

            if not candidate_photos:
                logger.info(f"No candidate photos found in database for attempt {attempt}. Continuing loop.")
                continue

            max_verify_candidates = 10
            candidates_for_verification = candidate_photos[:max_verify_candidates]

            # Yield progress state: verifying matches
            yield {
                "type": "progress",
                "state": "verifying",
                "detail": f"Verifying top {len(candidates_for_verification)} candidate photo matches..."
            }

            logger.info(f"Database returned {len(candidate_photos)} candidate photos.")
            logger.info(f"Sent {len(candidates_for_verification)} candidates for verification.")

            matching_ids = self.planner.verify_photos_match(message, candidates_for_verification)
            logger.info(f"Attempt {attempt} verification matched photo IDs: {matching_ids}")

            verified_photos = [p for p in candidates_for_verification if p.id in matching_ids]
            logger.info(f"Verified count: {len(verified_photos)}")

            if verified_photos:
                logger.info(f"Found {len(verified_photos)} verified photo matches on attempt {attempt}. Ending loop.")
                break
            else:
                logger.info(f"Attempt {attempt} verification returned no matches. Continuing loop.")

        # Yield progress state: generating response
        yield {
            "type": "progress",
            "state": "generating_response",
            "detail": "Summarizing search outcomes..."
        }

        if verified_photos:
            response_text = self.planner.generate_chat_response(message, verified_photos)
            photo_dicts = [photo_to_dict(p) for p in verified_photos]
        else:
            response_text = f'I\'m sorry, but I couldn\'t find any photos matching "{message}," so please try searching for a different memory!'
            photo_dicts = []

        yield {
            "type": "result",
            "text": response_text,
            "photos": photo_dicts
        }

    async def chat(self, message: str, history: list = None):
        logger.info(f"Received agent chat message (dict fallback): {message}")
        final_res = {}
        async for event in self.chat_stream(message, history=history):
            if event.get("type") == "result":
                final_res = {
                    "text": event.get("text"),
                    "photos": event.get("photos", [])
                }
        return final_res
