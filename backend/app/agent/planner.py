import json
import logging

from app.agent.llm import LlamaManager


logger = logging.getLogger(__name__)


class Planner:
    def __init__(self, llm_manager: LlamaManager | None = None):
        self.llm_manager = llm_manager or LlamaManager()
        self._planner_cache = {}

    def _parse_json_robustly(self, output_text: str) -> dict:
        text = output_text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()
        
        try:
            return json.loads(text)
        except Exception:
            pass
            
        try:
            start_idx = text.find("{")
            end_idx = text.rfind("}")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                candidate = text[start_idx:end_idx + 1]
                return json.loads(candidate)
        except Exception:
            pass
            
        raise ValueError("Could not parse valid JSON from LLM output")

    def _validate_and_clean_planner_schema(self, data: dict) -> dict:
        if not isinstance(data, dict):
            raise ValueError("Parsed LLM output is not a JSON object")
            
        cleaned = {
            "intent": str(data.get("intent", "photo_search")),
            "is_locked": False,
            "refine_previous": False,
            "entities": {},
            "constraints": {},
            "ranking": {}
        }
        
        locked = data.get("is_locked")
        if locked is not None:
            if isinstance(locked, str):
                cleaned["is_locked"] = locked.lower() in ("true", "1", "yes")
            else:
                cleaned["is_locked"] = bool(locked)
                
        refine = data.get("refine_previous")
        if refine is not None:
            if isinstance(refine, str):
                cleaned["refine_previous"] = refine.lower() in ("true", "1", "yes")
            else:
                cleaned["refine_previous"] = bool(refine)
                
        raw_entities = data.get("entities") or {}
        if not isinstance(raw_entities, dict):
            raw_entities = {}
            
        cleaned_entities = {}
        for key in ["people", "locations", "events", "objects"]:
            val = raw_entities.get(key) or []
            if isinstance(val, str):
                val = [val]
            cleaned_entities[key] = [str(v) for v in val if v]
            
        tr = raw_entities.get("time_range")
        if tr is not None:
            if isinstance(tr, (int, float)):
                cleaned_entities["time_range"] = int(tr)
            elif isinstance(tr, str):
                if tr.isdigit():
                    cleaned_entities["time_range"] = int(tr)
                else:
                    cleaned_entities["time_range"] = tr
            else:
                cleaned_entities["time_range"] = None
        else:
            cleaned_entities["time_range"] = None
            
        cleaned["entities"] = cleaned_entities

        raw_constraints = data.get("constraints") or {}
        if not isinstance(raw_constraints, dict):
            raw_constraints = {}
            
        cleaned_constraints = {}
        valid_entity_keys = {"people", "locations", "events", "objects", "time_range"}
        for key in ["must_match", "soft_match"]:
            val = raw_constraints.get(key) or []
            if isinstance(val, str):
                val = [val]
            cleaned_constraints[key] = [str(v) for v in val if v in valid_entity_keys]
            
        cleaned["constraints"] = cleaned_constraints

        raw_ranking = data.get("ranking") or {}
        if not isinstance(raw_ranking, dict):
            raw_ranking = {}
            
        cleaned_ranking = {
            "prefer_favorites": False,
            "prefer_recent": True
        }
        
        pref_fav = raw_ranking.get("prefer_favorites")
        if pref_fav is not None:
            if isinstance(pref_fav, str):
                cleaned_ranking["prefer_favorites"] = pref_fav.lower() in ("true", "1", "yes")
            else:
                cleaned_ranking["prefer_favorites"] = bool(pref_fav)
                
        pref_recent = raw_ranking.get("prefer_recent")
        if pref_recent is not None:
            if isinstance(pref_recent, str):
                cleaned_ranking["prefer_recent"] = pref_recent.lower() in ("true", "1", "yes")
            else:
                cleaned_ranking["prefer_recent"] = bool(pref_recent)
                
        cleaned["ranking"] = cleaned_ranking
        cleaned["limit"] = raw_entities.get("limit") or data.get("limit") or 30

        return cleaned

    def heuristic_fallback(self, message: str) -> dict:
        """Previous keyword-based heuristic parsing used as a robust fallback."""
        msg_lower = message.lower()
        stop_words = {
            "show", "me", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some",
        }
        words = msg_lower.split()
        search_terms = [w.strip("?,.!") for w in words if w.strip("?,.!") not in stop_words]

        is_favorite = "favorite" in msg_lower or "starred" in msg_lower or "loved" in msg_lower
        is_locked = "locked" in msg_lower or "encrypted" in msg_lower or "private" in msg_lower
        refine_keywords = {"only", "just", "now", "with", "without", "refine", "filter"}
        refine_previous = any(w in refine_keywords for w in words)

        year = None
        for w in words:
            w_clean = w.strip("?,.!")
            if w_clean.isdigit() and len(w_clean) == 4:
                year = int(w_clean)
                break

        return {
            "intent": "photo_search",
            "is_locked": is_locked,
            "refine_previous": refine_previous,
            "entities": {
                "people": [],
                "locations": [search_terms[0]] if search_terms else [],
                "events": [],
                "objects": search_terms,
                "time_range": year
            },
            "constraints": {
                "must_match": ["locations"] if search_terms else [],
                "soft_match": ["objects"]
            },
            "ranking": {
                "prefer_favorites": is_favorite,
                "prefer_recent": True
            }
        }

    def extract_search_parameters(self, message: str, history: list = None) -> dict:
        """Query Planner: Convert natural language query and context into a structured JSON search plan."""
        history_fingerprint = tuple((h.get("role"), h.get("content")) for h in history) if history else ()
        cache_key = (message.strip().lower(), history_fingerprint)
        if cache_key in self._planner_cache:
            logger.info(f"Planner cache hit for key: {cache_key}")
            return self._planner_cache[cache_key]

        try:
            llm = self.llm_manager.get_llm()

            history_context = ""
            if history:
                history_lines = ["Previous conversation turns for reference context:"]
                for h in history[-4:]:
                    role = "User" if h.get("role") == "user" else "Assistant"
                    history_lines.append(f"- {role}: {h.get('content')}")
                history_context = "\n".join(history_lines) + "\n\n"

            prompt = (
                "<start_of_turn>user\n"
                "You are the query planner assistant for Prism Photos. Your job is to convert the user's request into a structured JSON query plan.\n"
                "Resolve any reference pronouns using the conversation history context and place resolved values in the entities.\n\n"
                f"{history_context}"
                "Output JSON schema:\n"
                "{\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"is_locked\": boolean,\n"
                "  \"refine_previous\": boolean (true if this request is a refinement/filter on the previous search results like 'only those with Rahul' or 'now show sunset shots'),\n"
                "  \"entities\": {\n"
                "    \"people\": [string] (names of people to search),\n"
                "    \"locations\": [string] (places, cities, countries),\n"
                "    \"events\": [string] (activities, holidays, occasions),\n"
                "    \"objects\": [string] (objects, animals, elements like sunset, beach, car, dog),\n"
                "    \"time_range\": string or integer or null (specific year, month, or relative date description)\n"
                "  },\n"
                "  \"constraints\": {\n"
                "    \"must_match\": [string] (list of entity types that must strictly match, chosen from 'people', 'locations', 'time_range'),\n"
                "    \"soft_match\": [string] (list of entity types that can match softly, chosen from 'events', 'objects')\n"
                "  },\n"
                "  \"ranking\": {\n"
                "    \"prefer_favorites\": boolean,\n"
                "    \"prefer_recent\": boolean (true for newest first, false for oldest/first photos)\n"
                "  }\n"
                "}\n\n"
                "Examples:\n"
                "User: Show family trips to Goa during sunset.\n"
                "Response: {\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"is_locked\": false,\n"
                "  \"refine_previous\": false,\n"
                "  \"entities\": {\n"
                "    \"people\": [\"family\"],\n"
                "    \"locations\": [\"Goa\"],\n"
                "    \"events\": [\"trip\"],\n"
                "    \"objects\": [\"sunset\"],\n"
                "    \"time_range\": null\n"
                "  },\n"
                "  \"constraints\": {\n"
                "    \"must_match\": [\"locations\"],\n"
                "    \"soft_match\": [\"people\", \"events\", \"objects\"]\n"
                "  },\n"
                "  \"ranking\": {\n"
                "    \"prefer_favorites\": false,\n"
                "    \"prefer_recent\": true\n"
                "  }\n"
                "}\n\n"
                "User: show the first locked image of a dog\n"
                "Response: {\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"is_locked\": true,\n"
                "  \"refine_previous\": false,\n"
                "  \"entities\": {\n"
                "    \"people\": [],\n"
                "    \"locations\": [],\n"
                "    \"events\": [],\n"
                "    \"objects\": [\"dog\"],\n"
                "    \"time_range\": null\n"
                "  },\n"
                "  \"constraints\": {\n"
                "    \"must_match\": [],\n"
                "    \"soft_match\": [\"objects\"]\n"
                "  },\n"
                "  \"ranking\": {\n"
                "    \"prefer_favorites\": false,\n"
                "    \"prefer_recent\": false\n"
                "  }\n"
                "}\n\n"
                "User: Only the ones with Rahul\n"
                "Response: {\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"is_locked\": false,\n"
                "  \"refine_previous\": true,\n"
                "  \"entities\": {\n"
                "    \"people\": [\"Rahul\"],\n"
                "    \"locations\": [],\n"
                "    \"events\": [],\n"
                "    \"objects\": [],\n"
                "    \"time_range\": null\n"
                "  },\n"
                "  \"constraints\": {\n"
                "    \"must_match\": [\"people\"],\n"
                "    \"soft_match\": []\n"
                "  },\n"
                "  \"ranking\": {\n"
                "    \"prefer_favorites\": false,\n"
                "    \"prefer_recent\": true\n"
                "  }\n"
                "}\n\n"
                "You must output ONLY a valid raw JSON object. Do not include markdown code block formatting (like ```json), explanations, or trailing text.\n\n"
                f"User request: \"{message}\"\n\n"
                "JSON response:\n"
                "<end_of_turn>\n"
                "<start_of_turn>model\n"
            )

            res = llm(
                prompt,
                max_tokens=250,
                temperature=0.1,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            output_text = res["choices"][0]["text"].strip()
            logger.info(f"Gemma query planner plan: {output_text}")

            raw_data = self._parse_json_robustly(output_text)
            data = self._validate_and_clean_planner_schema(raw_data)

            if len(self._planner_cache) >= 500:
                self._planner_cache.clear()
            self._planner_cache[cache_key] = data
            return data
        except Exception as e:
            logger.error(f"Error during Gemma query planning: {e}. Falling back to heuristics.")
            fallback_plan = self.heuristic_fallback(message)
            self._planner_cache[cache_key] = fallback_plan
            return fallback_plan

    def verify_photos_match(self, query: str, photos_metadata: list) -> list:
        """Ask Gemma to verify which photos strictly match the user's query intent."""
        try:
            llm = self.llm_manager.get_llm()
            photo_lines = []
            for p in photos_metadata:
                details = []
                if p.caption:
                    details.append(f"Caption: {p.caption}")
                if p.city or p.country:
                    details.append(f"Location: {', '.join(filter(None, [p.city, p.country]))}")
                if p.date_taken:
                    details.append(f"Date: {p.date_taken}")
                if p.ai_summary:
                    details.append(f"AI description: {p.ai_summary}")
                photo_lines.append(f"- ID: {p.id} | Filename: {p.filename} | Details: {'; '.join(details)}")
            photo_context = "\n".join(photo_lines)

            prompt = (
                "<start_of_turn>user\n"
                "You are the photo verification assistant for Prism. Your job is to verify if the retrieved photos match the user's query.\n"
                f"User query: \"{query}\"\n\n"
                "Here is the metadata of the retrieved photos:\n"
                f"{photo_context}\n"
                "Decide which photo IDs strictly match the user's intent. "
                "You must output ONLY a valid raw JSON object. Do not include markdown code block formatting (like ```json), explanations, or trailing text.\n\n"
                "Format:\n"
                "{\n"
                "  \"matching_ids\": [list of integer IDs that match]\n"
                "}\n"
                "<end_of_turn>\n"
                "<start_of_turn>model\n"
            )
            res = llm(
                prompt,
                max_tokens=100,
                temperature=0.1,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            output_text = res["choices"][0]["text"].strip()

            data = self._parse_json_robustly(output_text)
            return data.get("matching_ids") or []
        except Exception as e:
            logger.error(f"Error during Gemma photo verification: {e}. Defaulting to allowing all matches.")
            return [p.id for p in photos_metadata]

    def reformulate_search(self, query: str, previous_plan: dict, history: list = None) -> dict:
        """Reformulate search plan using Gemma to try finding matches with synonyms or broader terms."""
        try:
            llm = self.llm_manager.get_llm()
            history_context = ""
            if history:
                history_lines = ["Previous conversation turns for reference context:"]
                for h in history[-4:]:
                    role = "User" if h.get("role") == "user" else "Assistant"
                    history_lines.append(f"- {role}: {h.get('content')}")
                history_context = "\n".join(history_lines) + "\n\n"

            prompt = (
                "<start_of_turn>user\n"
                "You are the query planner reformulation assistant for Prism Photos. "
                f"The user wants: \"{query}\"\n"
                f"We previously executed search plan: {json.dumps(previous_plan)} but found no matching images.\n"
                f"{history_context}"
                "Please reformulate the search plan using broader constraints, broader entities, or synonyms to locate the user's photos.\n"
                "You must output ONLY a valid raw JSON object matching the planner schema. Do not include explanations or markdown wrappers:\n"
                "{\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"is_locked\": boolean,\n"
                "  \"refine_previous\": boolean,\n"
                "  \"entities\": {\n"
                "    \"people\": [string],\n"
                "    \"locations\": [string],\n"
                "    \"events\": [string],\n"
                "    \"objects\": [string],\n"
                "    \"time_range\": string or integer or null\n"
                "  },\n"
                "  \"constraints\": {\n"
                "    \"must_match\": [string],\n"
                "    \"soft_match\": [string]\n"
                "  },\n"
                "  \"ranking\": {\n"
                "    \"prefer_favorites\": boolean,\n"
                "    \"prefer_recent\": boolean\n"
                "  }\n"
                "}\n"
                "<end_of_turn>\n"
                "<start_of_turn>model\n"
            )
            res = llm(
                prompt,
                max_tokens=250,
                temperature=0.3,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            output_text = res["choices"][0]["text"].strip()

            raw_data = self._parse_json_robustly(output_text)
            data = self._validate_and_clean_planner_schema(raw_data)
            return data
        except Exception as e:
            logger.error(f"Error during Gemma query planner reformulation: {e}")
            return previous_plan

    def generate_chat_response(self, message: str, photos: list) -> str:
        """Generate a natural language friendly summary of search results using Gemma."""
        if not photos:
            try:
                llm = self.llm_manager.get_llm()
                prompt = (
                    "<start_of_turn>user\n"
                    f"The user asked to find photos matching: \"{message}\". However, we couldn't find any matches in the database.\n"
                    "Write a warm, helpful response (1 sentence) expressing that you couldn't find any matching photos, and invite them to try searching for another memory.\n"
                    "<end_of_turn>\n"
                    "<start_of_turn>model\n"
                )
                res = llm(
                    prompt,
                    max_tokens=60,
                    temperature=1.0,
                    top_p=0.95,
                    top_k=64,
                    stop=["<end_of_turn>"],
                )
                return res["choices"][0]["text"].strip()
            except Exception:
                return f"I couldn't find any photos in your library matching '{message}'."

        try:
            llm = self.llm_manager.get_llm()
            photo_summaries = []
            for p in photos[:5]:
                details = []
                if p.caption:
                    details.append(f"Caption: {p.caption}")
                if p.city or p.country:
                    details.append(f"Location: {', '.join(filter(None, [p.city, p.country]))}")
                if p.date_taken:
                    details.append(f"Date: {p.date_taken}")
                if p.ai_summary:
                    details.append(f"AI description: {p.ai_summary}")
                photo_summaries.append(f"- {p.filename or 'photo'} ({'; '.join(details)})")

            photos_context = "\n".join(photo_summaries)
            prompt = (
                "<start_of_turn>user\n"
                "You are Prism, a friendly and helpful local AI photo assistant. "
                f"The user asked: \"{message}\"\n"
                f"We found {len(photos)} photos matching their query. Here is metadata for the top matches:\n"
                f"{photos_context}\n\n"
                "Write a short, engaging response (1-2 sentences) summarizing what you found and letting the user know they can click on any photo to view it in full screen. "
                "Be warm and direct. Do not include markdown headers or lists.\n"
                "<end_of_turn>\n"
                "<start_of_turn>model\n"
            )
            res = llm(
                prompt,
                max_tokens=100,
                temperature=1.0,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            return res["choices"][0]["text"].strip()
        except Exception as e:
            logger.error(f"Error during Gemma chat response generation: {e}")
            return f"I found {len(photos)} photo{'s' if len(photos) > 1 else ''} matching your query! Click on any of them to view them in full screen."
