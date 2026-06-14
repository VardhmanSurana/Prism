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

    async def chat(self, message: str, history: list = None):
        logger.info(f"Received agent chat message: {message}")

        verified_photos = []
        last_plan = {}

        for attempt in range(1, 4):
            logger.info(f"Starting agent query planner attempt {attempt}/3")
            if attempt == 1:
                plan = self.planner.extract_search_parameters(message, history=history)
            else:
                plan = self.planner.reformulate_search(message, last_plan, history=history)

            last_plan = plan
            logger.info(f"Attempt {attempt} search plan: {plan}")

            tools_to_run = plan.get("tools") or []
            filters = plan.get("filters") or {}
            tool_args = plan.get("tool_arguments") or {}

            raw_limit = plan.get("limit") or filters.get("limit")
            try:
                query_limit = int(raw_limit) if raw_limit is not None else 30
                if query_limit <= 0:
                    query_limit = 30
            except (ValueError, TypeError):
                query_limit = 30

            async with async_session() as db:
                tool_results = []

                meta_args = tool_args.get("search_metadata") or {}
                is_locked = meta_args.get("is_locked") or filters.get("is_locked") or False

                for tool_name in tools_to_run:
                    args = tool_args.get(tool_name) or filters
                    try:
                        if tool_name == "search_metadata":
                            res_set = await self.search_tools.search_metadata(
                                db,
                                location=args.get("location"),
                                favorites=args.get("favorites"),
                                year=args.get("year"),
                                is_locked=is_locked,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_people":
                            names = args.get("names") or args.get("people") or args.get("person") or []
                            if isinstance(names, str):
                                names = [names]
                            res_set = await self.search_tools.search_people(
                                db,
                                names=names,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_captions":
                            res_set = await self.search_tools.search_captions(
                                db,
                                query=args.get("query") or args.get("text_query") or args.get("location") or message,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "semantic_search":
                            res_set = await self.search_tools.semantic_search(
                                db,
                                text_query=args.get("text_query") or args.get("query") or args.get("location") or message,
                                top_k=query_limit,
                                is_locked=is_locked,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_albums":
                            res_set = await self.search_tools.search_albums(
                                db,
                                query=args.get("query") or args.get("location") or message,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_ocr":
                            res_set = await self.search_tools.search_ocr(
                                db,
                                query=args.get("query") or args.get("location") or message,
                            )
                            tool_results.append(res_set)
                        elif tool_name == "similar_image":
                            res_set = await self.search_tools.similar_image(
                                db,
                                photo_id=args.get("photo_id") or args.get("similar_photo_id"),
                                top_k=query_limit,
                            )
                            tool_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running tool {tool_name}: {err}")

                combined_ids = set()
                if tool_results:
                    non_empty_results = [r for r in tool_results if r]
                    if non_empty_results:
                        combined_ids = set.intersection(*non_empty_results)
                        if not combined_ids:
                            combined_ids = set.union(*non_empty_results)
                    else:
                        combined_ids = set()

                if combined_ids:
                    sort_order = plan.get("sort_order", "desc")
                    if sort_order == "asc":
                        order_clause = Photo.date_taken.asc()
                    else:
                        order_clause = Photo.date_taken.desc()

                    stmt = select(Photo).where(
                        Photo.id.in_(combined_ids),
                        Photo.is_trash == False,
                        Photo.is_locked == (True if is_locked else False),
                    ).order_by(order_clause).limit(query_limit)
                    res = await db.execute(stmt)
                    candidate_photos = res.scalars().all()
                else:
                    candidate_photos = []

            if not candidate_photos:
                logger.info(f"No candidate photos found in database for attempt {attempt}. Continuing loop.")
                continue

            matching_ids = self.planner.verify_photos_match(message, candidate_photos)
            logger.info(f"Attempt {attempt} verification matched photo IDs: {matching_ids}")

            verified_photos = [p for p in candidate_photos if p.id in matching_ids]

            if verified_photos:
                logger.info(f"Found {len(verified_photos)} verified photo matches on attempt {attempt}. Ending loop.")
                break
            else:
                logger.info(f"Attempt {attempt} verification returned no matches. Continuing loop.")

        if verified_photos:
            response_text = self.planner.generate_chat_response(message, verified_photos)
            photo_dicts = [photo_to_dict(p) for p in verified_photos]
        else:
            response_text = f'I\'m sorry, but I couldn\'t find any photos matching "{message}," so please try searching for a different memory!'
            photo_dicts = []

        return {
            "text": response_text,
            "photos": photo_dicts,
        }
