import logging
import hashlib
import json
import numpy as np

import uuid
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.albums.utils import photo_to_dict
from app.db import async_session
from app.models import Photo, PhotoPerson, Person

from app.agent.planner import Planner
from app.agent.search_tools import SearchTools
from app.agent.utils.cache import LRUCache
from app.agent.router.classifier import AgentRouter
from app.agent.router.types import AgentContext, Intent
from app.agent.executor import ToolExecutionMiddleware


logger = logging.getLogger(__name__)


class AgentOrchestrator:
    def __init__(self, planner: Planner, search_tools: SearchTools):
        self.planner = planner
        self.search_tools = search_tools
        self.session_cache: LRUCache = LRUCache(maxsize=64)
        self.router = AgentRouter(llm_manager=planner.llm_manager)
        self.executor = ToolExecutionMiddleware(search_tools=search_tools)

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

        # Get or initialize the session state
        if session_key not in self.session_cache:
            base_query = history[0].get("content", message) if history else message
            self.session_cache[session_key] = {
                "base_query": base_query,
                "filters": [],
                "photo_ids": set()
            }

        # Stage 1: Router Classification
        yield {
            "type": "progress",
            "state": "routing",
            "detail": "Classifying intent and analyzing tool requirements..."
        }

        route_decision = self.router.route_request(message, history=history)

        # Emit routing telemetry logs
        telemetry = {
            "request_id": str(uuid.uuid4()),
            "intent": route_decision.intent.value,
            "confidence": route_decision.confidence,
            "needs_tools": route_decision.needs_tools,
            "allowed_tools": route_decision.selected_tool_names,
            "rationale": route_decision.rationale
        }
        logger.info(f"Routing Telemetry: {json.dumps(telemetry)}")

        import re
        id_match = re.search(r'\b(?:id|photo_id|photo|image)\D*(\d+)\b', message, re.IGNORECASE)
        if not id_match:
            id_match = re.search(r'\(id:\s*(\d+)\)', message, re.IGNORECASE)

        photo_id_param = None
        if id_match:
            try:
                photo_id_param = int(id_match.group(1))
            except ValueError:
                pass

        is_analyze_intent = route_decision.intent == Intent.PHOTO_METADATA or "analyze" in message.lower()

        # Context resolution: If no photo_id in query, check session_cache or fallback to latest photo in library
        if is_analyze_intent and not photo_id_param:
            cached_ids = self.session_cache.get(session_key, {}).get("photo_ids")
            if cached_ids:
                photo_id_param = next(iter(cached_ids), None)

        if is_analyze_intent and not photo_id_param:
            async with async_session() as db:
                stmt = (
                    select(Photo.id)
                    .where(Photo.is_trash == False, Photo.is_locked == False) # Default to false for lock state if unspecified
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

        # Initialize Agent Context
        agent_context = AgentContext(
            request_id=telemetry["request_id"],
            intent=route_decision.intent,
            allowed_tool_names=set(route_decision.selected_tool_names),
            tool_calls_used=0,
            max_tool_calls=route_decision.max_steps,
            confirmed_actions=set(),
            known_asset_ids=set(),
            cancellation_token=None,
            route=route_decision
        )

        # Gate 1: Direct Response without Tools
        if not route_decision.needs_tools:
            yield {
                "type": "progress",
                "state": "generating_response",
                "detail": "Generating direct response...",
            }
            try:
                llm = self.planner.llm_manager.get_llm()
                prompt = (
                    "<start_of_turn>user\n"
                    f"You are Prism, a helpful local AI photo assistant.\nUser asked: \"{message}\"\n"
                    "Provide a warm, concise conversational response.\n<end_of_turn>\n<start_of_turn>model\n"
                )
                res = llm(prompt, max_tokens=150, temperature=0.7, stop=["<end_of_turn>"])
                text = res["choices"][0]["text"].strip()
                yield {"type": "result", "text": text, "photos": []}
                return
            except Exception as e:
                logger.error(f"Error generating direct response: {e}")
                yield {"type": "result", "text": "I'm here to help with your photos. How can I assist?", "photos": []}
                return

        # Stage 2: Planning with restricted tools
        executed_tools = []
        combined_ids = set()

        for attempt in range(1, 4):
            yield {
                "type": "progress",
                "state": "planning",
                "detail": f"Formulating constrained search strategy (attempt {attempt}/3)..."
            }

            if attempt == 1:
                plan = self.planner.extract_search_parameters(
                    message,
                    allowed_tools=route_decision.selected_tool_names,
                    max_steps=route_decision.max_steps,
                    history=history
                )
            else:
                plan = self.planner.reformulate_search(
                    message,
                    last_plan,
                    allowed_tools=route_decision.selected_tool_names,
                    max_steps=route_decision.max_steps,
                    history=history
                )

            # Redundancy check across attempts
            if attempt > 1 and plan.get("steps") == last_plan.get("steps"):
                logger.info("Redundant plan formulation; stopping early.")
                break

            last_plan = plan
            steps = plan.get("steps") or []

            if not steps:
                logger.info("Planner returned empty step plan.")
                continue

            yield {
                "type": "progress",
                "state": "running_tools",
                "detail": f"Executing {len(steps)} plan steps via middleware...",
                "plan": plan,
                "tools": list(executed_tools)
            }

            soft_results = []
            strict_results = []

            async with async_session() as db:
                for step in steps:
                    tool_name = step.get("tool_name")
                    arguments = step.get("arguments") or {}

                    try:
                        res_ids = await self.executor.execute_tool(db, tool_name, arguments, agent_context)
                        res_set = set(res_ids)
                        
                        executed_tools.append({
                            "name": tool_name,
                            "params": arguments,
                            "count": len(res_set)
                        })
                        
                        # Apply naive strict/soft constraint classification based on tool types
                        # In the new architecture, we treat metadata/people as strict if they filter heavily,
                        # and text/visual scans as soft union.
                        if tool_name in ["search_metadata", "search_people"]:
                            strict_results.append(res_set)
                        else:
                            soft_results.append(res_set)

                    except Exception as tool_err:
                        logger.error(f"Tool {tool_name} failed: {tool_err}")

                strict_ids = None
                if strict_results:
                    strict_ids = set.intersection(*strict_results)

                soft_ids = None
                if soft_results:
                    soft_ids = set.union(*soft_results)

                if strict_ids is not None and soft_ids is not None:
                    combined_ids = strict_ids.intersection(soft_ids)
                    if not combined_ids:
                        combined_ids = strict_ids
                elif strict_ids is not None:
                    combined_ids = strict_ids
                elif soft_ids is not None:
                    combined_ids = soft_ids

                yield {
                    "type": "progress",
                    "state": "running_tools",
                    "detail": f"Fused tool results. Total candidates: {len(combined_ids)}",
                    "plan": plan,
                    "tools": list(executed_tools),
                    "total_candidates": len(combined_ids)
                }

                if combined_ids:
                    stmt = select(Photo).where(
                        Photo.id.in_(combined_ids),
                        Photo.is_trash == False
                    ).options(
                        selectinload(Photo.people).selectinload(PhotoPerson.person)
                    ).order_by(Photo.date_taken.desc()).limit(100)

                    res = await db.execute(stmt)
                    candidate_photos = res.scalars().all()
                else:
                    candidate_photos = []

            if not candidate_photos:
                logger.info(f"No candidate photos found in database for attempt {attempt}. Continuing loop.")
                continue

            yield {
                "type": "progress",
                "state": "verifying",
                "detail": f"Reranking {len(candidate_photos)} candidate photos...",
                "plan": plan,
                "tools": list(executed_tools),
                "total_candidates": len(combined_ids)
            }

            ranked_photos = self.rerank_and_explain(message, candidate_photos, plan)
            verified_photos = ranked_photos[:10]

            if verified_photos:
                break

        yield {
            "type": "progress",
            "state": "generating_response",
            "detail": "Summarizing outcomes...",
            "plan": last_plan,
            "tools": list(executed_tools),
            "total_candidates": len(combined_ids)
        }

        # Store the returned photo IDs in the session cache to enable future refinements
        if verified_photos:
            final_ids = {p.id for p in verified_photos}
            if session_key in self.session_cache:
                self.session_cache[session_key]["photo_ids"] = final_ids

                # We do not have refine_previous from planner schema anymore, so we simulate it by unconditionally storing the filter context
                if message not in self.session_cache[session_key]["filters"]:
                    self.session_cache[session_key]["filters"].append(message)

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
            response_text = f'I\'m sorry, but I couldn\'t find any photos matching "{message}".'
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
