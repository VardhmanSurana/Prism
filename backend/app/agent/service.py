import logging
import json
import threading
from pathlib import Path
from sqlalchemy.future import select
from sqlalchemy import or_, and_, func, text
from llama_cpp import Llama, LlamaDraftModel

from app.db import async_session
from app.models import Photo, Person, PhotoPerson, Album
from app.api.albums.utils import photo_to_dict

logger = logging.getLogger(__name__)

class PrismAgent:
    _llm = None
    _lock = threading.Lock()

    def get_llm(self) -> Llama:
        """Lazily initialize the Llama model with thread-safe lock and optimized parameters."""
        if PrismAgent._llm is not None:
            return PrismAgent._llm
            
        with PrismAgent._lock:
            if PrismAgent._llm is not None:
                return PrismAgent._llm
                
            # Mutual Exclusion: Unload Vision, Face, and Summary models before loading LLM
            try:
                from app.services.vision_pipeline import unload_models
                from app.services.face_sdk import face_sdk
                from app.services.image_summary.llm import VisionManager
                unload_models()
                face_sdk.shutdown()
                VisionManager.unload_vision()
            except ImportError:
                pass

            model_dir = Path(__file__).parents[2] / "models"
            model_path = model_dir / "gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf"

            if not model_path.exists():
                logger.error(f"Gemma model not found at {model_path}")
                raise FileNotFoundError(f"Model file not found: {model_path}")
                
            try:
                logger.info(f"Attempting to load Gemma model with GPU offloading: {model_path}")
                # Try loading with GPU and flash attention
                PrismAgent._llm = Llama(
                    model_path=str(model_path),
                    n_ctx=2048,
                    n_threads=4,
                    flash_attn=True,
                    n_gpu_layers=-1,
                    use_mmap=True,
                    verbose=False
                )
                logger.info("Successfully loaded model with GPU acceleration and Flash Attention.")
            except Exception as e:
                logger.warning(f"Failed to load model with GPU/FlashAttn ({e}). Trying GPU without Flash Attention...")
                try:
                    PrismAgent._llm = Llama(
                        model_path=str(model_path),
                        n_ctx=2048,
                        n_threads=4,
                        flash_attn=False,
                        n_gpu_layers=-1,
                        use_mmap=True,
                        verbose=False
                    )
                    logger.info("Successfully loaded model with GPU acceleration (Flash Attention disabled).")
                except Exception as e2:
                    logger.warning(f"Failed to load model with GPU offloading ({e2}). Falling back to CPU mode.")
                    try:
                        PrismAgent._llm = Llama(
                            model_path=str(model_path),
                            n_ctx=2048,
                            # When falling back to CPU, use more threads for speed
                            n_threads=os.cpu_count() or 4,
                            flash_attn=False,
                            n_gpu_layers=0,
                            use_mmap=True,
                            verbose=False
                        )
                        logger.info("Successfully loaded model in CPU-only mode.")
                    except Exception as ex:
                        logger.critical(f"Critical failure loading model in CPU fallback: {ex}")
                        raise ex
            return PrismAgent._llm

    @classmethod
    def unload_llm(cls):
        """Releases the LLM from GPU VRAM."""
        with cls._lock:
            if cls._llm is not None:
                logger.info("Unloading Gemma LLM from VRAM...")
                # llama-cpp-python doesn't have a direct 'close', so we delete and collect
                cls._llm = None
                import gc
                gc.collect()
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                logger.info("Gemma LLM successfully unloaded.")

    def heuristic_fallback(self, message: str) -> dict:
        """Previous keyword-based heuristic parsing used as a robust fallback."""
        msg_lower = message.lower()
        stop_words = {
            "show", "me", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some"
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
            "limit": None
        }

    # ─── Specialized Search Tools ─────────────────────────────────────────────

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
                Photo.country.ilike(f"%{loc}%")
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
            PhotoPerson.confidence >= min_confidence
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
        from app.config import settings
        if not settings.ENABLE_AI_CLIP or not text_query:
            return set()
        
        try:
            query_emb = self.get_query_embedding(text_query)
            if not query_emb:
                return set()
                
            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.is_locked == (True if is_locked else False),
                Photo.embedding.isnot(None)
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
                meta = json.loads(alb.metadata_json)
                filters = [Photo.is_trash == False]
                if alb.type == "places":
                    city = meta.get("city")
                    state = meta.get("state")
                    country = meta.get("country")
                    if city: filters.append(Photo.city == city)
                    if state: filters.append(Photo.state == state)
                    if country: filters.append(Photo.country == country)
                elif alb.type == "memories":
                    year = meta.get("year")
                    month = meta.get("month")
                    if year: filters.append(func.strftime("%Y", Photo.date_taken) == str(year))
                    if month: filters.append(func.strftime("%m", Photo.date_taken) == f"{int(month):02d}")
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
                Photo.ai_summary.ilike(f"%{loc_query}%")
            ),
            Photo.is_trash == False
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
                
            query_emb = json.loads(row[0])
            stmt_embs = select(Photo.id, Photo.embedding).where(
                Photo.is_trash == False,
                Photo.id != photo_id,
                Photo.embedding.isnot(None)
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

    # ─── Query Planning & Verification ────────────────────────────────────────

    def extract_search_parameters(self, message: str, history: list = None) -> dict:
        """Query Planner: Convert natural language query and context into a structured JSON search plan."""
        try:
            llm = self.get_llm()
            
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
                stop=["<end_of_turn>"]
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
                        "is_locked": fallback_params.get("is_locked")
                    },
                    "search_captions": {
                        "query": " ".join(fallback_params.get("search_terms")) if fallback_params.get("search_terms") else ""
                    }
                },
                "limit": 30
            }

    def verify_photos_match(self, query: str, photos_metadata: list) -> list:
        """Ask Gemma to verify which photos strictly match the user's query intent."""
        try:
            llm = self.get_llm()
            photo_context = ""
            for p in photos_metadata:
                details = []
                if p.caption: details.append(f"Caption: {p.caption}")
                if p.city or p.country: details.append(f"Location: {', '.join(filter(None, [p.city, p.country]))}")
                if p.date_taken: details.append(f"Date: {p.date_taken}")
                if p.ai_summary: details.append(f"AI description: {p.ai_summary}")
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
                stop=["<end_of_turn>"]
            )
            output_text = res["choices"][0]["text"].strip()
            
            # Clean potential markdown block wrappers
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
            llm = self.get_llm()
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
                stop=["<end_of_turn>"]
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
                llm = self.get_llm()
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
                    stop=["<end_of_turn>"]
                )
                return res["choices"][0]["text"].strip()
            except Exception:
                return f"I couldn't find any photos in your library matching '{message}'."

        try:
            llm = self.get_llm()
            photo_summaries = []
            for p in photos[:5]:
                details = []
                if p.caption: details.append(f"Caption: {p.caption}")
                if p.city or p.country: details.append(f"Location: {', '.join(filter(None, [p.city, p.country]))}")
                if p.date_taken: details.append(f"Date: {p.date_taken}")
                if p.ai_summary: details.append(f"AI description: {p.ai_summary}")
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
                stop=["<end_of_turn>"]
            )
            return res["choices"][0]["text"].strip()
        except Exception as e:
            logger.error(f"Error during Gemma chat response generation: {e}")
            return f"I found {len(photos)} photo{'s' if len(photos) > 1 else ''} matching your query! Click on any of them to view them in full screen."

    def get_query_embedding(self, query: str) -> list[float] | None:
        """Encode natural language query using SigLIP model for semantic search."""
        from app.config import settings
        if not settings.ENABLE_AI_CLIP:
            return None
        try:
            from app.services.vision_pipeline import _get_siglip, DEVICE, DTYPE
            import torch
            
            siglip_model, siglip_processor = _get_siglip()
            inputs = siglip_processor(text=[query], padding="max_length", return_tensors="pt")
            
            inputs = {
                k: v.to(DEVICE).to(dtype=DTYPE) if v.is_floating_point() else v.to(DEVICE)
                for k, v in inputs.items()
            }
            
            with torch.no_grad():
                text_outputs = siglip_model.get_text_features(**inputs)
                text_features = text_outputs / text_outputs.norm(dim=-1, keepdim=True)
                return text_features[0].cpu().numpy().tolist()
        except Exception as e:
            logger.error(f"Failed to generate SigLIP query embedding: {e}")
            return None

    async def chat(self, message: str, history: list = None):
        logger.info(f"Received agent chat message: {message}")
        
        verified_photos = []
        last_plan = {}
        
        for attempt in range(1, 4):
            logger.info(f"Starting agent query planner attempt {attempt}/3")
            if attempt == 1:
                plan = self.extract_search_parameters(message, history=history)
            else:
                plan = self.reformulate_search(message, last_plan, history=history)
                
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
            
            # Execute DB tools inside transactional context
            async with async_session() as db:
                tool_results = []
                
                # Check is_locked filter in search_metadata or filters if present
                meta_args = tool_args.get("search_metadata") or {}
                is_locked = meta_args.get("is_locked") or filters.get("is_locked") or False

                for tool_name in tools_to_run:
                    # Fallback to filters if tool-specific args are missing
                    args = tool_args.get(tool_name) or filters
                    try:
                        if tool_name == "search_metadata":
                            res_set = await self.search_metadata(
                                db,
                                location=args.get("location"),
                                favorites=args.get("favorites"),
                                year=args.get("year"),
                                is_locked=is_locked
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_people":
                            names = args.get("names") or args.get("people") or args.get("person") or []
                            if isinstance(names, str):
                                names = [names]
                            res_set = await self.search_people(
                                db,
                                names=names
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_captions":
                            res_set = await self.search_captions(
                                db,
                                query=args.get("query") or args.get("text_query") or args.get("location") or message
                            )
                            tool_results.append(res_set)
                        elif tool_name == "semantic_search":
                            res_set = await self.semantic_search(
                                db,
                                text_query=args.get("text_query") or args.get("query") or args.get("location") or message,
                                top_k=query_limit,
                                is_locked=is_locked
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_albums":
                            res_set = await self.search_albums(
                                db,
                                query=args.get("query") or args.get("location") or message
                            )
                            tool_results.append(res_set)
                        elif tool_name == "search_ocr":
                            res_set = await self.search_ocr(
                                db,
                                query=args.get("query") or args.get("location") or message
                            )
                            tool_results.append(res_set)
                        elif tool_name == "similar_image":
                            res_set = await self.similar_image(
                                db,
                                photo_id=args.get("photo_id") or args.get("similar_photo_id"),
                                top_k=query_limit
                            )
                            tool_results.append(res_set)
                    except Exception as err:
                        logger.error(f"Error running tool {tool_name}: {err}")
                
                # Intersect / Rank / Union
                combined_ids = set()
                if tool_results:
                    non_empty_results = [r for r in tool_results if r]
                    if non_empty_results:
                        combined_ids = set.intersection(*non_empty_results)
                        if not combined_ids:
                            # Fallback to union if strict intersection is empty
                            combined_ids = set.union(*non_empty_results)
                    else:
                        combined_ids = set()
                
                # Fetch matching photos
                if combined_ids:
                    sort_order = plan.get("sort_order", "desc")
                    if sort_order == "asc":
                        order_clause = Photo.date_taken.asc()
                    else:
                        order_clause = Photo.date_taken.desc()

                    stmt = select(Photo).where(
                        Photo.id.in_(combined_ids),
                        Photo.is_trash == False,
                        Photo.is_locked == (True if is_locked else False)
                    ).order_by(order_clause).limit(query_limit)
                    res = await db.execute(stmt)
                    candidate_photos = res.scalars().all()
                else:
                    candidate_photos = []

            if not candidate_photos:
                logger.info(f"No candidate photos found in database for attempt {attempt}. Continuing loop.")
                continue

            # Verify matches using Gemma
            matching_ids = self.verify_photos_match(message, candidate_photos)
            logger.info(f"Attempt {attempt} verification matched photo IDs: {matching_ids}")
            
            verified_photos = [p for p in candidate_photos if p.id in matching_ids]
            
            if verified_photos:
                logger.info(f"Found {len(verified_photos)} verified photo matches on attempt {attempt}. Ending loop.")
                break
            else:
                logger.info(f"Attempt {attempt} verification returned no matches. Continuing loop.")
                
        # 3. Format dynamic chat response using Gemma LLM or return not found text
        if verified_photos:
            response_text = self.generate_chat_response(message, verified_photos)
            photo_dicts = [photo_to_dict(p) for p in verified_photos]
        else:
            response_text = f'I\'m sorry, but I couldn\'t find any photos matching "{message}," so please try searching for a different memory!'
            photo_dicts = []
            
        return {
            "text": response_text,
            "photos": photo_dicts
        }

Prism_agent = PrismAgent()
