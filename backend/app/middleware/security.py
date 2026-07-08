from fastapi import Request, HTTPException
from app.config import settings


async def verify_api_key(request: Request):
    if not settings.API_KEY:
        return
    key = request.headers.get("X-API-Key")
    if key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
