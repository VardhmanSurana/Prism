import logging
import json
from sqlalchemy.future import select
from sqlalchemy import or_, and_, func
from app.db import async_session
from app.models import Photo
from app.api.albums.utils import photo_to_dict

logger = logging.getLogger(__name__)

class PrismAgent:
    def __init__(self):
        pass

    async def chat(self, message: str, history: list = None):
        logger.info(f"Received message: {message}")
        msg_lower = message.lower()
        
        # Stop words to clean up search terms
        stop_words = {
            "show", "me", "find", "search", "get", "photos", "photo", "images", "image", "pictures", "picture",
            "of", "in", "at", "the", "a", "an", "with", "my", "your", "our", "all", "any", "some"
        }
        
        # Split search terms
        words = msg_lower.split()
        search_terms = [w.strip("?,.!") for w in words if w.strip("?,.!") not in stop_words]
        
        # Filters
        is_favorite = "favorite" in msg_lower or "starred" in msg_lower or "loved" in msg_lower
        is_locked = "locked" in msg_lower or "encrypted" in msg_lower or "private" in msg_lower
        
        # Look for years
        year = None
        for w in words:
            w_clean = w.strip("?,.!")
            if w_clean.isdigit() and len(w_clean) == 4:
                year = w_clean
                break
                
        # Perform query
        async with async_session() as db:
            # Build filters
            filters = []
            
            # Locked state filtering
            if is_locked:
                filters.append(Photo.is_locked == True)
            else:
                filters.append(Photo.is_locked == False)
                
            filters.append(Photo.is_trash == False)
            
            if is_favorite:
                filters.append(Photo.is_favorite == True)
                
            # If search terms exist, create or clauses
            if search_terms:
                term_filters = []
                for raw_term in search_terms:
                    # Sanitize: escape SQL wildcards and limit length
                    term = raw_term.replace("%", "\\%").replace("_", "\\_")[:50]
                    if not term:
                        continue
                    # Match city, state, country, caption, summary, filename
                    term_filters.append(Photo.city.ilike(f"%{term}%"))
                    term_filters.append(Photo.state.ilike(f"%{term}%"))
                    term_filters.append(Photo.country.ilike(f"%{term}%"))
                    term_filters.append(Photo.caption.ilike(f"%{term}%"))
                    term_filters.append(Photo.ai_summary.ilike(f"%{term}%"))
                    term_filters.append(Photo.filename.ilike(f"%{term}%"))
                if term_filters:
                    filters.append(or_(*term_filters))
                
            if year:
                filters.append(func.strftime("%Y", Photo.date_taken) == year)
                
            stmt = select(Photo).where(and_(*filters)).order_by(Photo.date_taken.desc()).limit(30)
            res = await db.execute(stmt)
            photos = res.scalars().all()
            
        # Format response
        photo_dicts = [photo_to_dict(p) for p in photos]
        
        # Create descriptive response
        count = len(photos)
        if count == 0:
            text = f"I couldn't find any photos in your library matching '{message}'."
        else:
            tags = []
            if is_favorite:
                tags.append("favorite")
            if year:
                tags.append(f"taken in {year}")
            tags_str = f" ({', '.join(tags)})" if tags else ""
            
            text = f"I found {count} photo{'s' if count > 1 else ''}{tags_str} matching your query! Click on any of them to view them in full screen."
            
        return {
            "text": text,
            "photos": photo_dicts
        }

Prism_agent = PrismAgent()
