from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SubtitleRequest(BaseModel):
    photo_id: int


class SubtitleSegment(BaseModel):
    start: float
    end: float
    text: str


class SubtitleResponse(BaseModel):
    subtitles: list[SubtitleSegment]


@router.post("/subtitles/generate", response_model=SubtitleResponse)
async def generate_subtitles(req: SubtitleRequest):
    from app.config import settings
    if not settings.ENABLE_AI_SUBTITLES:
        raise HTTPException(status_code=400, detail="AI subtitle generation is not enabled")

    from app.db import async_session
    from app.models import Photo
    from app.services.subtitle_gen import subtitle_generator

    async with async_session() as db:
        photo = await db.get(Photo, req.photo_id)
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found")
        if photo.file_type != "video":
            raise HTTPException(status_code=400, detail="Photo is not a video")

        try:
            segments = await subtitle_generator.generate_from_video(photo.path)
            return SubtitleResponse(subtitles=[
                SubtitleSegment(start=s["start"], end=s["end"], text=s["text"])
                for s in segments
            ])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Subtitle generation failed: {str(e)}")
