import logging
import hashlib
import json
import numpy as np

from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.albums.utils import photo_to_dict
from app.db import async_session
from app.models import Photo, PhotoPerson, Person

from app.agent.planner import Planner
from app.agent.search_tools import SearchTools
from app.agent.utils.cache import LRUCache


logger = logging.getLogger(__name__)


class AgentOrchestrator:
    def __init__(self, planner: Planner, search_tools: SearchTools):
        self.planner = planner
        self.search_tools = search_tools
        self.session_cache: LRUCache = LRUCache(maxsize=64)

    def _get_session_key(self, history: list, current_message: str) -> str:
        if not history:
            return hashlib.md5(current_message.strip().lower().encode("utf-8")).hexdigest()
        # Find the first user message in history to keep a stable session key for the conversation thread
        first_user_msg = ""
        for h in history:
            if h.get("role") == "user":
                first_user_msg = h.get("content", "")
                break
        if not first_user_msg:
            first_user_msg = history[0].get("content", "")
        return hashlib.md5(first_user_msg.strip().lower().encode("utf-8")).hexdigest()

    def rerank_and_explain(self, query: str, photos: list, plan: dict) -> list:
        """Score and rank candidates using exact metadata matching, face detections, FTS captions, and SigLIP cosine similarity."""
        entities = plan.get("entities") or {}
        
        # Clean and split the query into lowercase keywords for overlap checks
        keywords = [w.strip("?,.!\"'").lower() for w in query.split()]
        keywords = [w for w in keywords if w and w not in {
            "show", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some", "and", "or"
        }]

        # Pre-load or fetch query embedding for semantic cosine similarity
        query_emb = None
        try:
            query_emb = self.search_tools.embedding_client.get_query_embedding(query)
            if query_emb:
                query_emb = np.array(query_emb, dtype=np.float32)
        except Exception as e:
            logger.error(f"Failed to generate query embedding in reranker: {e}")

        scored_photos = []
        for p in photos:
            score = 0.0
            matched = []

            # 1. Year Match
            years_in_query = [int(w) for w in keywords if w.isdigit() and len(w) == 4]
            if years_in_query and p.date_taken:
                photo_year = p.date_taken.year
                if photo_year in years_in_query:
                    score += 3.0
                    matched.append(f"Year {photo_year}")

            # 2. Favorites Match
            is_fav_query = any(w in ["favorite", "starred", "loved", "stars", "heart"] for w in keywords)
            if is_fav_query and p.is_favorite:
                score += 2.0
                matched.append("Favorite")

            # 3. Location Matches
            matched_locations = set()
            for kw in keywords:
                if p.city and kw in p.city.lower():
                    matched_locations.add(p.city)
                if p.state and kw in p.state.lower():
                    matched_locations.add(p.state)
                if p.country and kw in p.country.lower():
                    matched_locations.add(p.country)
                if p.location and kw in p.location.lower():
                    matched_locations.add(p.location)
            
            for loc in matched_locations:
                score += 2.0
                matched.append(loc)

            # 4. People Detections
            try:
                if p.people:
                    for pp in p.people:
                        if pp.person and pp.person.name:
                            name_lower = pp.person.name.lower()
                            people_entities = [n.lower() for n in entities.get("people", [])]
                            if any(kw in name_lower for kw in keywords) or any(name_lower in pe for pe in people_entities):
                                confidence = pp.confidence if pp.confidence is not None else 1.0
                                score += confidence * 2.0
                                matched.append(f"{pp.person.name} detected")
            except Exception as e:
                logger.error(f"Error accessing photo people in reranker: {e}")

            # 5. Caption Matches
            matched_caption_terms = []
            if p.caption:
                caption_lower = p.caption.lower()
                for kw in keywords:
                    if kw in caption_lower:
                        matched_caption_terms.append(kw)
            if matched_caption_terms:
                score += 1.5 * len(matched_caption_terms)
                matched.append(", ".join(matched_caption_terms))

            # 6. AI Description / Tags Matches
            matched_tags = []
            if p.auto_tags:
                tags_lower = p.auto_tags.lower()
                for kw in keywords:
                    if kw in tags_lower:
                        matched_tags.append(kw)
            if p.ai_summary:
                summary_lower = p.ai_summary.lower()
                for kw in keywords:
                    if kw in summary_lower and kw not in matched_tags:
                        matched_tags.append(kw)
            if matched_tags:
                score += 1.0 * len(matched_tags)
                matched.append(", ".join(matched_tags))

            # 7. Filename Match
            if p.filename:
                fn_lower = p.filename.lower()
                matched_fn = [kw for kw in keywords if kw in fn_lower]
                if matched_fn:
                    score += 0.5 * len(matched_fn)
                    matched.append(matched_fn[0])

            # 8. Semantic similarity
            if query_emb is not None and p.embedding:
                try:
                    p_emb = np.array(json.loads(p.embedding), dtype=np.float32)
                    if len(p_emb) == len(query_emb):
                        sim = float(np.dot(p_emb, query_emb))
                        if sim >= 0.15:
                            score += sim * 10.0
                            matched.append("AI Visual Match")
                except Exception:
                    pass

            # Unique values only for the UI display checklist
            unique_matched = []
            for item in matched:
                item_title = item.title() if len(item) > 3 else item
                if item_title not in unique_matched:
                    unique_matched.append(item_title)

            p.search_explanation = {
                "score": round(score, 2),
                "matched": unique_matched
            }
            scored_photos.append((score, p))

        scored_photos.sort(key=lambda x: x[0], reverse=True)
        return [p for _, p in scored_photos]

    def heuristic_score_photos(self, query: str, photos: list) -> list:
        """Legacy scoring fallback."""
        return self.rerank_and_explain(query, photos, {})

    async def chat_stream(self, message: str, history: list = None, image_path: str = None):
        logger.info(f"Received agent chat message for streaming: {message} (image_path: {image_path})")

        import os
        if image_path and os.path.exists(image_path):
            msg_lower = (message or "").lower()
            is_similar = any(w in msg_lower for w in ["similar", "photos like", "image like", "look like", "matching", "search similar"]) or not (message or "").strip()

            if is_similar:
                yield {
                    "type": "progress",
                    "state": "running_tools",
                    "detail": "Extracting visual features and searching for similar photos...",
                }

                query_emb = self.search_tools.embedding_client.get_image_embedding(image_path)
                if query_emb:
                    async with async_session() as db:
                        similar_ids = await self.search_tools.search_similar_by_embedding(db, query_emb, top_k=30)

                        if similar_ids:
                            stmt = select(Photo).where(Photo.id.in_(similar_ids)).options(
                                selectinload(Photo.people).selectinload(PhotoPerson.person)
                            )
                            res = await db.execute(stmt)
                            found_photos = res.scalars().all()

                            photo_map = {p.id: p for p in found_photos}
                            ordered_photos = [photo_map[pid] for pid in similar_ids if pid in photo_map]

                            verified_photos = ordered_photos[:15]
                            photos_out = []
                            for p in verified_photos:
                                pd = photo_to_dict(p)
                                pd["search_explanation"] = {"score": 1.0, "matched": ["Visual Similarity Match"]}
                                photos_out.append(pd)

                            yield {
                                "type": "progress",
                                "state": "generating_response",
                                "detail": "Formulating summary of similar photos...",
                            }

                            yield {
                                "type": "result",
                                "text": f"Found {len(verified_photos)} photo{'s' if len(verified_photos) > 1 else ''} in your library visually similar to your uploaded image!",
                                "photos": photos_out
                            }
                            return

                yield {
                    "type": "result",
                    "text": "I searched your library using your uploaded image, but couldn't find any close visual matches.",
                    "photos": []
                }
                return

            else:
                yield {
                    "type": "progress",
                    "state": "analyzing_photo",
                    "detail": "Analyzing uploaded image visual content with Gemma AI...",
                }

                try:
                    multimodal_msgs = [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        "You are Prism, a friendly and intelligent local AI photo assistant.\n"
                                        f"The user uploaded an image and asked: \"{message}\"\n\n"
                                        "Please inspect the attached image closely and answer their question or describe the image in detail (2-4 sentences)."
                                    )
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"file://{image_path}"}
                                }
                            ]
                        }
                    ]
                    chat_res = self.planner.llm_manager.query_chat_server(messages=multimodal_msgs, max_tokens=350)
                    answer_text = chat_res["choices"][0]["message"]["content"].strip()

                    yield {
                        "type": "result",
                        "text": answer_text,
                        "photos": []
                    }
                    return
                except Exception as err:
                    logger.error(f"Failed multimodal analysis of uploaded image: {err}")

        verified_photos = []
        last_plan = {}
        session_key = self._get_session_key(history, message)
        logger.info(f"Session key for conversational memory: {session_key}")

        # Get or initialize the session state featuring a conversational refinement filter stack
        if session_key not in self.session_cache:
            base_query = history[0].get("content", message) if history else message
            self.session_cache[session_key] = {
                "base_query": base_query,
                "filters": [],
                "photo_ids": set()
            }

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

            # Yield plan details
            yield {
                "type": "progress",
                "state": "planning",
                "detail": "Search strategy formulated.",
                "plan": plan
            }

            intent = plan.get("intent") or "photo_search"
            is_locked = plan.get("is_locked") or False
            entities = plan.get("entities") or {}
            photo_id_param = entities.get("photo_id")

            analyze_terms = ["analyze", "analyse", "describe", "description", "inspect", "detail", "details", "metadata", "explain"]
            is_analyze_intent = (intent == "analyze_photo") or any(w in message.lower() for w in analyze_terms)

            if not photo_id_param:
                import re
                id_match = re.search(r'\b(?:id|photo_id|photo|image)\D*(\d+)\b', message, re.IGNORECASE)
                if not id_match:
                    id_match = re.search(r'\(id:\s*(\d+)\)', message, re.IGNORECASE)
                if id_match:
                    try:
                        photo_id_param = int(id_match.group(1))
                    except ValueError:
                        photo_id_param = None

            # Context resolution: If no photo_id in query, check session_cache or fallback to latest photo in library
            if is_analyze_intent and not photo_id_param:
                cached_ids = self.session_cache.get(session_key, {}).get("photo_ids")
                if cached_ids:
                    photo_id_param = next(iter(cached_ids), None)

            if is_analyze_intent and not photo_id_param:
                async with async_session() as db:
                    stmt = (
                        select(Photo.id)
                        .where(Photo.is_trash == False, Photo.is_locked == is_locked)
                        .order_by(Photo.date_taken.desc(), Photo.id.desc())
                        .limit(1)
                    )
                    res = await db.execute(stmt)
                    latest_id = res.scalar_one_or_none()
                    if latest_id:
                        photo_id_param = latest_id

            if is_analyze_intent:
                yield {
                    "type": "progress",
                    "state": "analyzing_photo",
                    "detail": f"Inspecting metadata & details for photo #{photo_id_param}..." if photo_id_param else "Analyzing photo details...",
                    "plan": plan
                }

                target_photo = None
                if photo_id_param:
                    async with async_session() as db:
                        stmt = select(Photo).where(Photo.id == photo_id_param).options(
                            selectinload(Photo.people).selectinload(PhotoPerson.person)
                        )
                        res = await db.execute(stmt)
                        target_photo = res.scalar_one_or_none()

                if target_photo:
                    analysis_text = self.planner.generate_photo_analysis_response(message, target_photo)
                    pd = photo_to_dict(target_photo)
                    pd["search_explanation"] = {"score": 1.0, "matched": ["Photo ID Match", "Metadata Analysis"]}

                    yield {
                        "type": "progress",
                        "state": "generating_response",
                        "detail": "Formulating analysis response...",
                        "plan": plan
                    }

                    yield {
                        "type": "result",
                        "text": analysis_text,
                        "photos": [pd]
                    }
                    return
                else:
                    yield {
                        "type": "result",
                        "text": "To analyze or describe a photo, please select **'✨ Ask AI About Photo'** on an image in your gallery, upload an image using the **'Upload Image'** button below, or specify a photo ID (e.g., *'Analyze photo 12'*).",
                        "photos": []
                    }
                    return
            constraints = plan.get("constraints") or {}
            ranking = plan.get("ranking") or {}

            is_locked = plan.get("is_locked") or False
            prefer_favorites = ranking.get("prefer_favorites") or False
            prefer_recent = ranking.get("prefer_recent") or True
            must_match = constraints.get("must_match") or []
            refine_previous = plan.get("refine_previous") or False

            # Parse time range year and month
            time_range = entities.get("time_range")
            year_param = None
            month_param = None
            if time_range is not None:
                import re
                if isinstance(time_range, (int, float)):
                    year_param = int(time_range)
                elif isinstance(time_range, str):
                    time_range_str = time_range.strip().lower()
                    if time_range_str.isdigit():
                        year_param = int(time_range_str)
                    else:
                        months = {
                            "january": 1, "jan": 1,
                            "february": 2, "feb": 2,
                            "march": 3, "mar": 3,
                            "april": 4, "apr": 4,
                            "may": 5,
                            "june": 6, "jun": 6,
                            "july": 7, "jul": 7,
                            "august": 8, "aug": 8,
                            "september": 9, "sep": 9, "sept": 9,
                            "october": 10, "oct": 10,
                            "november": 11, "nov": 11,
                            "december": 12, "dec": 12
                        }
                        for m_name, m_val in months.items():
                            if re.search(r'\b' + re.escape(m_name) + r'\b', time_range_str):
                                month_param = m_val
                                break
                        year_match = re.search(r'\b(20\d{2}|19\d{2})\b', time_range_str)
                        if year_match:
                            year_param = int(year_match.group(1))

            raw_limit = plan.get("limit") or 30
            try:
                query_limit = int(raw_limit)
                if query_limit <= 0:
                    query_limit = 30
            except (ValueError, TypeError):
                query_limit = 30

            executed_tools = []

            # Yield progress state: running tools
            yield {
                "type": "progress",
                "state": "running_tools",
                "detail": "Scanning indexes dynamically...",
                "plan": plan,
                "tools": list(executed_tools)
            }

            async with async_session() as db:
                strict_results = []
                soft_results = []

                # 1. Metadata Search
                locations = entities.get("locations") or []
                if locations or year_param or month_param or prefer_favorites:
                    location_val = locations[0] if locations else None
                    try:
                        res_set = await self.search_tools.search_metadata(
                            db,
                            location=location_val,
                            favorites=prefer_favorites,
                            year=year_param,
                            month=month_param,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_metadata returned {len(res_set)} IDs.")
                        
                        executed_tools.append({
                            "name": "search_metadata",
                            "params": {
                                "location": location_val,
                                "favorites": prefer_favorites,
                                "year": year_param,
                                "month": month_param,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning metadata indexes...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

                        is_strict = False
                        if "locations" in must_match and locations:
                            is_strict = True
                        if "time_range" in must_match and (year_param or month_param):
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
                        
                        executed_tools.append({
                            "name": "search_people",
                            "params": {
                                "names": people,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning identified faces...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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
                    # search_events
                    try:
                        res_set = await self.search_tools.search_events(
                            db,
                            query=text_query,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_events returned {len(res_set)} IDs.")
                        
                        executed_tools.append({
                            "name": "search_events",
                            "params": {
                                "query": text_query,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning events and dates...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

                        soft_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running search_events: {err}")

                    # search_captions
                    try:
                        res_set = await self.search_tools.search_captions(
                            db,
                            query=text_query,
                            is_locked=is_locked,
                        )
                        logger.info(f"Tool search_captions returned {len(res_set)} IDs.")
                        
                        executed_tools.append({
                            "name": "search_captions",
                            "params": {
                                "query": text_query,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning captions database...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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
                        
                        executed_tools.append({
                            "name": "semantic_search",
                            "params": {
                                "query": text_query,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Performing AI visual search...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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
                        
                        executed_tools.append({
                            "name": "search_albums",
                            "params": {
                                "query": text_query,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning albums...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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
                        
                        executed_tools.append({
                            "name": "search_ocr",
                            "params": {
                                "query": text_query,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Scanning OCR text in images...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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
                        
                        executed_tools.append({
                            "name": "similar_image",
                            "params": {
                                "photo_id": photo_id_param,
                                "is_locked": is_locked
                            },
                            "count": len(res_set)
                        })
                        yield {
                            "type": "progress",
                            "state": "running_tools",
                            "detail": "Finding visually similar images...",
                            "plan": plan,
                            "tools": list(executed_tools)
                        }

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

                logger.info(f"Initial combined IDs count: {len(combined_ids)} (mode: {combination_mode})")

                # Apply conversational memory refinement if applicable using the session filter stack
                if refine_previous and session_key in self.session_cache:
                    session_state = self.session_cache[session_key]
                    last_photo_ids = session_state.get("photo_ids")
                    
                    if message not in session_state["filters"]:
                        session_state["filters"].append(message)
                        
                    logger.info(f"Refining search. Current stack: base='{session_state['base_query']}', filters={session_state['filters']}")
                    
                    if last_photo_ids:
                        if combined_ids:
                            combined_ids = combined_ids.intersection(last_photo_ids)
                        else:
                            combined_ids = last_photo_ids
                        logger.info(f"After refinement intersection: {len(combined_ids)} IDs.")

                yield {
                    "type": "progress",
                    "state": "running_tools",
                    "detail": f"Fused results (Mode: {combination_mode}). Total: {len(combined_ids)} candidates.",
                    "plan": plan,
                    "tools": list(executed_tools),
                    "total_candidates": len(combined_ids)
                }

                if combined_ids:
                    if prefer_recent:
                        order_clause = Photo.date_taken.desc()
                    else:
                        order_clause = Photo.date_taken.asc()

                    # Query up to 100 candidate photos loading people associations to prevent N+1 queries in local reranker
                    stmt = select(Photo).where(
                        Photo.id.in_(combined_ids),
                        Photo.is_trash == False,
                        Photo.is_locked == (True if is_locked else False),
                    ).options(
                        selectinload(Photo.people).selectinload(PhotoPerson.person)
                    ).order_by(order_clause).limit(max(query_limit, 100))

                    res = await db.execute(stmt)
                    candidate_photos = res.scalars().all()
                else:
                    candidate_photos = []

            if not candidate_photos:
                logger.info(f"No candidate photos found in database for attempt {attempt}. Continuing loop.")
                continue

            # Yield progress state: reranking/verifying
            yield {
                "type": "progress",
                "state": "verifying",
                "detail": f"Reranking {len(candidate_photos)} candidate photos using local neural scorer...",
                "plan": plan,
                "tools": list(executed_tools),
                "total_candidates": len(combined_ids)
            }

            logger.info(f"Database returned {len(candidate_photos)} candidate photos. Reranking...")
            ranked_photos = self.rerank_and_explain(message, candidate_photos, plan)
            
            # Slice top 10 as verified photos
            verified_photos = ranked_photos[:10]
            logger.info(f"Reranking chose top {len(verified_photos)} photos.")

            if verified_photos:
                logger.info(f"Found {len(verified_photos)} verified photo matches on attempt {attempt}. Ending loop.")
                break
            else:
                logger.info(f"Attempt {attempt} reranking returned no matches. Continuing loop.")

        # Yield progress state: generating response
        yield {
            "type": "progress",
            "state": "generating_response",
            "detail": "Summarizing search outcomes...",
            "plan": plan,
            "tools": list(executed_tools),
            "total_candidates": len(combined_ids)
        }

        # Store the returned photo IDs in the session cache to enable future refinements
        if verified_photos:
            final_ids = {p.id for p in verified_photos}
            if session_key in self.session_cache:
                self.session_cache[session_key]["photo_ids"] = final_ids
                logger.info(
                    f"Saved {len(final_ids)} photo IDs to session cache for key: {session_key}. "
                    f"Current filters: {self.session_cache[session_key]['filters']}"
                )

            response_text = self.planner.generate_chat_response(message, verified_photos)
            photo_dicts = []
            for p in verified_photos:
                pd = photo_to_dict(p)
                pd["search_explanation"] = getattr(p, "search_explanation", {"score": 0.0, "matched": []})
                photo_dicts.append(pd)
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
