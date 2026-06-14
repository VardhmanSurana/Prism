import json
import logging

from app.agent.llm import LlamaManager


logger = logging.getLogger(__name__)


class Planner:
    def __init__(self, llm_manager: LlamaManager | None = None):
        self.llm_manager = llm_manager or LlamaManager()

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

        year = None
        for w in words:
            w_clean = w.strip("?,.!")
            if w_clean.isdigit() and len(w_clean) == 4:
                year = int(w_clean)
                break

        return {
            "is_favorite": is_favorite,
            "is_locked": is_locked,
            "year": year,
            "search_terms": search_terms,
            "limit": None,
        }

    def extract_search_parameters(self, message: str, history: list = None) -> dict:
        """Query Planner: Convert natural language query and context into a structured JSON search plan."""
        try:
            llm = self.llm_manager.get_llm()

            history_context = ""
            if history:
                history_context = "Previous conversation turns for reference context:\n"
                for h in history[-4:]:
                    role = "User" if h.get("role") == "user" else "Assistant"
                    history_context += f"- {role}: {h.get('content')}\n"
                history_context += "\n"

            prompt = (
                "<start_of_turn>user\n"
                "You are the query planner assistant for Prism Photos. Your job is to convert the user's request into a structured JSON query plan.\n"
                "Resolve any reference pronouns using the conversation history context and place resolved values in the filters.\n"
                "Available tools: search_metadata, search_people, search_captions, semantic_search, search_albums, search_ocr, similar_image.\n\n"
                f"{history_context}"
                "Output JSON schema:\n"
                "{\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"tools\": [\"tool_name_1\", \"tool_name_2\"],\n"
                "  \"filters\": {\n"
                "    \"location\": string or null,\n"
                "    \"year\": integer or null,\n"
                "    \"favorites\": boolean or null,\n"
                "    \"is_locked\": boolean or null,\n"
                "    \"names\": [string],\n"
                "    \"query\": string (search text description),\n"
                "    \"photo_id\": integer or null,\n"
                "    \"limit\": integer,\n"
                "    \"sort_order\": \"asc\" | \"desc\"\n"
                "  }\n"
                "}\n\n"
                "Examples:\n"
                "User: Show family trips to Goa during sunset.\n"
                "Response: {\"intent\": \"photo_search\", \"tools\": [\"search_metadata\", \"semantic_search\", \"search_people\"], \"filters\": {\"location\": \"Goa\", \"query\": \"sunset\", \"names\": [\"family\"], \"limit\": 30, \"sort_order\": \"desc\"}}\n\n"
                "User: show the first image of yelagiri\n"
                "Response: {\"intent\": \"photo_search\", \"tools\": [\"search_metadata\", \"semantic_search\"], \"filters\": {\"location\": \"yelagiri\", \"limit\": 1, \"sort_order\": \"asc\"}}\n\n"
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

            if output_text.startswith("```"):
                lines = output_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                output_text = "\n".join(lines).strip()

            data = json.loads(output_text)
            return data
        except Exception as e:
            logger.error(f"Error during Gemma query planning: {e}. Falling back to heuristics.")
            fallback_params = self.heuristic_fallback(message)
            return {
                "intent": "photo_search",
                "tools": ["search_metadata", "search_captions"],
                "tool_arguments": {
                    "search_metadata": {
                        "location": fallback_params.get("search_terms")[0] if fallback_params.get("search_terms") else None,
                        "year": fallback_params.get("year"),
                        "favorites": fallback_params.get("is_favorite"),
                        "is_locked": fallback_params.get("is_locked"),
                    },
                    "search_captions": {
                        "query": " ".join(fallback_params.get("search_terms")) if fallback_params.get("search_terms") else ""
                    },
                },
                "limit": 30,
            }

    def verify_photos_match(self, query: str, photos_metadata: list) -> list:
        """Ask Gemma to verify which photos strictly match the user's query intent."""
        try:
            llm = self.llm_manager.get_llm()
            photo_context = ""
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
                photo_context += f"- ID: {p.id} | Filename: {p.filename} | Details: {'; '.join(details)}\n"

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

            if output_text.startswith("```"):
                lines = output_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                output_text = "\n".join(lines).strip()

            data = json.loads(output_text)
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
                history_context = "Previous conversation turns for reference context:\n"
                for h in history[-4:]:
                    role = "User" if h.get("role") == "user" else "Assistant"
                    history_context += f"- {role}: {h.get('content')}\n"
                history_context += "\n"

            prompt = (
                "<start_of_turn>user\n"
                "You are the query planner reformulation assistant for Prism Photos. "
                f"The user wants: \"{query}\"\n"
                f"We previously executed search plan: {json.dumps(previous_plan)} but found no matching images.\n"
                f"{history_context}"
                "Please reformulate the search plan using broader filters, synonyms, or different tools (e.g. using semantic_search instead of search_captions) to locate the user's photos. "
                "You must output ONLY a valid raw JSON object matching the planner schema. Do not include explanations or markdown wrappers:\n"
                "{\n"
                "  \"intent\": \"photo_search\",\n"
                "  \"tools\": [\"tool_name_1\", \"tool_name_2\"],\n"
                "  \"filters\": {\n"
                "    \"location\": string or null,\n"
                "    \"year\": integer or null,\n"
                "    \"favorites\": boolean or null,\n"
                "    \"is_locked\": boolean or null,\n"
                "    \"names\": [string],\n"
                "    \"query\": string,\n"
                "    \"photo_id\": integer or null,\n"
                "    \"limit\": integer,\n"
                "    \"sort_order\": \"asc\" | \"desc\"\n"
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

            if output_text.startswith("```"):
                lines = output_text.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].startswith("```"):
                    lines = lines[:-1]
                output_text = "\n".join(lines).strip()

            data = json.loads(output_text)
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
