from fastapi import APIRouter, HTTPException
from . import places, memories

router = APIRouter()

# Include sub-routers
router.include_router(places.router, prefix="/places", tags=["places"])
router.include_router(memories.router, prefix="/memories", tags=["memories"])

@router.get("/")
async def list_albums(type: str = "places"):
    if type == "places":
        return await places.list_places()
    elif type == "memories":
        return await memories.list_memories()
    raise HTTPException(status_code=400, detail="type must be places or memories")

@router.get("/{album_id}/photos")
async def get_album_photos(album_id: int, type: str = "places"):
    if type == "places":
        raise HTTPException(status_code=400, detail="Use /albums/places/photos?city=&state=&country=")
    raise HTTPException(status_code=404, detail="Not found")

