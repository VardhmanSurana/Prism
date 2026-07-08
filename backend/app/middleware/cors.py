from fastapi import Request

_CORS_ALLOWED_ORIGINS = {
    "tauri://localhost",
    "http://tauri.localhost",
    "http://localhost:3005",
    "http://127.0.0.1:3005",
}


def get_cors_headers(request: Request) -> dict:
    """Return CORS headers for the given request origin, if allowed.

    NOTE: Do NOT add 'Vary: Origin' here — FastAPI's CORSMiddleware already injects
    it at the middleware layer for every response. Adding it in the dict too produces
    a duplicate 'Vary: Origin, Origin' header that WebKitGTK 2.52 rejects on media
    responses, causing video playback to silently fail.
    """
    origin = request.headers.get("origin", "")
    allowed_origin = origin if origin in _CORS_ALLOWED_ORIGINS else "http://localhost:3005"
    return {
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    }
