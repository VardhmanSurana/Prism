import logging

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.middleware.logging import setup_logging_filter
from app.middleware.security import verify_api_key
from app.lifespan import lifespan
from app.routes.media import serve_local_file, serve_transcoded_video
from app.routes.hls import serve_hls_playlist, serve_hls_segment
from app.routes.photos import serve_photo_thumbnail
from app.routes.system import root, health_check
from app.api import (
    photos,
    settings as settings_api,
    albums as albums_api,
    agent as agent_api,
    people as people_api,
    utilities as utilities_api,
    summaries as summaries_api,
    explore as explore_api,
    video as video_api,
    nle as nle_api,
    lan_sync as lan_sync_api,
)
from app.api.photos import inpaint as inpaint_api
from app.services.sync_service import sync_service

setup_logging_filter()

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "tauri://localhost",
        "http://tauri.localhost",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_api_route("/local", serve_local_file, methods=["GET", "HEAD"])
app.add_api_route("/transcode", serve_transcoded_video, methods=["GET", "HEAD"])
app.add_api_route("/hls/playlist", serve_hls_playlist, methods=["GET"])
app.add_api_route("/hls/segment", serve_hls_segment, methods=["GET"])

app.add_api_route(
    "/api/v1/photos/{photo_id}/thumbnail",
    serve_photo_thumbnail,
    methods=["GET"],
)

app.mount("/uploads", StaticFiles(directory=str(settings.UPLOAD_DIR)), name="uploads")
app.mount("/thumbnails", StaticFiles(directory=str(settings.THUMBNAILS_DIR)), name="thumbnails")

logger.debug(f"Adding metadata router: {photos.metadata_router.routes}")
app.include_router(photos.listing_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.directory_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.upload_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.metadata_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.lock_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.favorite_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(photos.trash_router, prefix=f"{settings.API_V1_STR}/photos", tags=["photos"], dependencies=[Depends(verify_api_key)])
app.include_router(inpaint_api.router, tags=["inpaint"], dependencies=[Depends(verify_api_key)])
app.include_router(settings_api.router, prefix=f"{settings.API_V1_STR}/settings", tags=["settings"], dependencies=[Depends(verify_api_key)])
app.include_router(albums_api.router, prefix=f"{settings.API_V1_STR}/albums", tags=["albums"], dependencies=[Depends(verify_api_key)])
app.include_router(agent_api.router, prefix=f"{settings.API_V1_STR}/agent", tags=["agent"], dependencies=[Depends(verify_api_key)])
app.include_router(people_api.router, prefix=f"{settings.API_V1_STR}/people", tags=["people"], dependencies=[Depends(verify_api_key)])
app.include_router(utilities_api.router, prefix=f"{settings.API_V1_STR}/utilities", tags=["utilities"], dependencies=[Depends(verify_api_key)])
app.include_router(summaries_api.router, prefix=f"{settings.API_V1_STR}/photos", tags=["summaries"], dependencies=[Depends(verify_api_key)])
app.include_router(explore_api.router, prefix=f"{settings.API_V1_STR}/explore", tags=["explore"], dependencies=[Depends(verify_api_key)])
app.include_router(video_api.router, prefix=f"{settings.API_V1_STR}", tags=["video"], dependencies=[Depends(verify_api_key)])
app.include_router(nle_api.router, prefix=f"{settings.API_V1_STR}", tags=["nle"], dependencies=[Depends(verify_api_key)])

from app.api.photos import ocr as ocr_api
app.include_router(ocr_api.router, prefix=f"{settings.API_V1_STR}/photos", tags=["ocr"], dependencies=[Depends(verify_api_key)])

from app.api.photos import xmp as xmp_api
app.include_router(xmp_api.router, prefix=f"{settings.API_V1_STR}/photos", tags=["xmp"], dependencies=[Depends(verify_api_key)])

from app.api import stories as stories_api
app.include_router(stories_api.router, prefix=f"{settings.API_V1_STR}/stories", tags=["stories"], dependencies=[Depends(verify_api_key)])

from app.api import privacy as privacy_api
app.include_router(privacy_api.router, prefix=f"{settings.API_V1_STR}/privacy", tags=["privacy"], dependencies=[Depends(verify_api_key)])

app.include_router(lan_sync_api.router, prefix=f"{settings.API_V1_STR}/lan", tags=["lan-sync"], dependencies=[Depends(verify_api_key)])

app.get("/")(root)
app.get("/health")(health_check)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8269, reload=True)
