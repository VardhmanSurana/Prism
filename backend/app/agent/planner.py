import json
import logging

from app.agent.llm import LlamaManager
from app.agent.utils.cache import LRUCache


logger = logging.getLogger(__name__)


class Planner:
    def __init__(self, llm_manager: LlamaManager | None = None):
        self.llm_manager = llm_manager or LlamaManager()
        self._planner_cache: LRUCache = LRUCache(maxsize=512)

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
            
        raw_intent = str(data.get("intent", "photo_search")).lower()
        if any(w in raw_intent for w in ["analyze", "analyse", "describe", "inspect", "detail"]):
            intent = "analyze_photo"
        elif any(w in raw_intent for w in ["count", "how_many"]):
            intent = "count_photos"
        else:
            intent = "photo_search"

        cleaned = {
            "intent": intent,
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

        pid = raw_entities.get("photo_id") or data.get("photo_id")
        if pid is not None:
            try:
                cleaned_entities["photo_id"] = int(pid)
                cleaned["intent"] = "analyze_photo"
            except (ValueError, TypeError):
                cleaned_entities["photo_id"] = None
        else:
            cleaned_entities["photo_id"] = None
            
        cleaned["entities"] = cleaned_entities

        raw_constraints = data.get("constraints") or {}
        if not isinstance(raw_constraints, dict):
            raw_constraints = {}
            
        cleaned_constraints = {}
        valid_entity_keys = {"people", "locations", "events", "objects", "time_range", "photo_id"}
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
        import re
        msg_lower = message.lower()

        photo_id = None
        id_match = re.search(r'\b(?:id|photo_id|photo|image)\D*(\d+)\b', message, re.IGNORECASE)
        if not id_match:
            id_match = re.search(r'\(id:\s*(\d+)\)', message, re.IGNORECASE)
        if id_match:
            try:
                photo_id = int(id_match.group(1))
            except ValueError:
                photo_id = None

        analyze_terms = ["analyze", "analyse", "describe", "description", "inspect", "details", "detail", "explain"]
        is_analyze = any(w in msg_lower for w in analyze_terms)
        is_count = "how many" in msg_lower or "count" in msg_lower or "total number of" in msg_lower

        intent = "analyze_photo" if (is_analyze or photo_id is not None) else ("count_photos" if is_count else "photo_search")

        stop_words = {
            "show", "me", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some", "analyze", "analyse", "analysis", "describe", "details", "explain",
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
            "intent": intent,
            "is_locked": is_locked,
            "refine_previous": refine_previous,
            "entities": {
                "people": [],
                "locations": [search_terms[0]] if search_terms else [],
                "events": [],
                "objects": search_terms,
                "time_range": year,
                "photo_id": photo_id
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

    def extract_search_parameters(self, message: str, allowed_tools: list[str] = None, max_steps: int = 5, history: list = None) -> dict:
        """Query Planner: Convert natural language query and context into a structured JSON search plan."""
        allowed_tools = allowed_tools or []
        history_fingerprint = tuple((h.get("role"), h.get("content")) for h in history) if history else ()
        cache_key = (message.strip().lower(), history_fingerprint, tuple(allowed_tools))
        cached = self._planner_cache.get(cache_key)
        if cached is not None:
            logger.info(f"Planner cache hit for key: {cache_key}")
            return cached

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
                f"Allowed tools: {', '.join(allowed_tools)}\n"
                f"Maximum steps allowed: {max_steps}\n\n"
                "Output JSON schema:\n"
                "{\n"
                "  \"steps\": [\n"
                "    {\n"
                "      \"tool_name\": \"string\",\n"
                "      \"arguments\": { \"key\": \"value\" },\n"
                "      \"depends_on\": [0],\n"
                "      \"purpose\": \"string\"\n"
                "    }\n"
                "  ],\n"
                "  \"final_response_mode\": \"answer\" | \"action_result\" | \"clarification\"\n"
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

            self._planner_cache.put(cache_key, data)
            return data
        except Exception as e:
            logger.info(f"Falling back to heuristic query planner: {e}")
            fallback_plan = self.heuristic_fallback(message)
            self._planner_cache.put(cache_key, fallback_plan)
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

    def reformulate_search(self, query: str, previous_plan: dict, allowed_tools: list[str] = None, max_steps: int = 5, history: list = None) -> dict:
        """Reformulate search plan using Gemma to try finding matches with synonyms or broader terms."""
        allowed_tools = allowed_tools or []
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
                f"Allowed tools: {', '.join(allowed_tools)}\n"
                f"Maximum steps allowed: {max_steps}\n\n"
                "You must output ONLY a valid raw JSON object matching the planner schema. Do not include explanations or markdown wrappers:\n"
                "{\n"
                "  \"steps\": [\n"
                "    {\n"
                "      \"tool_name\": \"string\",\n"
                "      \"arguments\": { \"key\": \"value\" },\n"
                "      \"depends_on\": [0],\n"
                "      \"purpose\": \"string\"\n"
                "    }\n"
                "  ],\n"
                "  \"final_response_mode\": \"answer\" | \"action_result\" | \"clarification\"\n"
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

    def generate_photo_analysis_response(self, message: str, photo) -> str:
        """Generate a detailed, insightful analysis of a single photo based on its metadata and user prompt."""
        try:
            llm = self.llm_manager.get_llm()
            
            details = []
            details.append(f"Filename: {photo.filename}")
            details.append(f"Photo ID: {photo.id}")
            if photo.date_taken:
                try:
                    details.append(f"Date Taken: {photo.date_taken.strftime('%B %d, %Y at %I:%M %p')}")
                except Exception:
                    details.append(f"Date Taken: {photo.date_taken}")
            
            loc_parts = [p for p in [photo.city, photo.state, photo.country] if p]
            if loc_parts:
                details.append(f"Location: {', '.join(loc_parts)}")
            elif photo.location:
                details.append(f"Location: {photo.location}")
            if photo.latitude and photo.longitude:
                details.append(f"GPS Coordinates: ({photo.latitude:.4f}, {photo.longitude:.4f})")
                
            exif_parts = []
            if photo.exif_make or photo.exif_model:
                exif_parts.append(f"Camera: {' '.join(filter(None, [photo.exif_make, photo.exif_model]))}")
            if photo.exif_focal_length:
                exif_parts.append(f"Focal Length: {photo.exif_focal_length}mm")
            if photo.exif_iso:
                exif_parts.append(f"ISO: {photo.exif_iso}")
            if exif_parts:
                details.append(f"Camera Details: {', '.join(exif_parts)}")

            if photo.width and photo.height:
                details.append(f"Dimensions: {photo.width}x{photo.height}")
            if photo.file_size:
                size_mb = photo.file_size / (1024 * 1024)
                details.append(f"File Size: {size_mb:.2f} MB")
            if photo.blur_score:
                details.append(f"Blur/Sharpness Score: {photo.blur_score:.1f}")

            people_names = []
            try:
                if photo.people:
                    for pp in photo.people:
                        if pp.person and pp.person.name:
                            people_names.append(pp.person.name)
            except Exception:
                pass
            if people_names:
                details.append(f"Identified People: {', '.join(set(people_names))}")

            if photo.caption:
                details.append(f"Caption: {photo.caption}")
            if photo.ai_summary:
                details.append(f"AI Description: {photo.ai_summary}")
            if photo.ocr_text:
                details.append(f"OCR Text inside image: {photo.ocr_text}")
                
            photo_metadata_str = "\n".join(f"- {d}" for d in details)

            import os
            # If the photo file exists on disk, use multimodal vision analysis so Gemma can visually see the image!
            if photo.path and os.path.exists(photo.path):
                try:
                    messages = [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": (
                                        "You are Prism, a friendly and intelligent local AI photo assistant.\n"
                                        f"The user asked: \"{message}\"\n\n"
                                        f"Here is the database metadata for this photo:\n{photo_metadata_str}\n\n"
                                        "Look at the provided image and describe what you visually see (subjects, colors, scenery, objects, lighting, and composition), "
                                        "combining your visual observation with the photo's metadata (date, location, camera details, people). "
                                        "Provide a warm, descriptive response (2-4 sentences)."
                                    )
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": f"file://{photo.path}"}
                                }
                            ]
                        }
                    ]
                    chat_res = self.llm_manager.query_chat_server(messages=messages, max_tokens=350)
                    content = chat_res["choices"][0]["message"]["content"].strip()
                    if content:
                        return content
                except Exception as ve:
                    logger.warning(f"Multimodal image vision query failed or not supported, falling back to text prompt: {ve}")

            prompt = (
                "<start_of_turn>user\n"
                "You are Prism, a friendly and intelligent local AI photo assistant.\n"
                f"The user asked: \"{message}\"\n\n"
                "Here is the complete metadata for the requested photo:\n"
                f"{photo_metadata_str}\n\n"
                "Analyze and describe this photo for the user, answering their specific questions about date, location, camera details, people, or image content. "
                "Keep your response informative, engaging, and clear (2-4 sentences). Do not invent details not present in the metadata.\n"
                "<end_of_turn>\n"
                "<start_of_turn>model\n"
            )
            res = llm(
                prompt,
                max_tokens=250,
                temperature=0.7,
                top_p=0.95,
                top_k=64,
                stop=["<end_of_turn>"],
            )
            return res["choices"][0]["text"].strip()
        except Exception as e:
            logger.error(f"Error generating photo analysis response: {e}")
            loc = f" in {photo.city}" if photo.city else ""
            date_str = f" taken on {photo.date_taken.strftime('%Y-%m-%d')}" if (photo.date_taken and hasattr(photo.date_taken, 'strftime')) else ""
            return f"Photo {photo.filename} (ID: {photo.id}){date_str}{loc}. Dimensions: {photo.width}x{photo.height}."
