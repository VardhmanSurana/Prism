import mimetypes
import urllib.parse

from fastapi import APIRouter, HTTPException, Request, Response
from starlette.responses import StreamingResponse

from app.utils.security import safe_resolve_read

router = APIRouter()

CHUNK_SIZE = 1024 * 1024  # 1 MB


_CORS_ALLOWED_ORIGINS = {"tauri://localhost", "http://tauri.localhost", "http://localhost:3005", "http://127.0.0.1:3005", "http://172.17.0.1:3005"}


def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin", "")
    allowed_origin = origin if origin in _CORS_ALLOWED_ORIGINS else "http://localhost:3005"
    return {
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    }


@router.get("/stream")
async def stream_video(path: str, request: Request):
    decoded_path = urllib.parse.unquote(path)

    try:
        resolved_path = safe_resolve_read(decoded_path)
    except HTTPException:
        raise

    try:
        if not resolved_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        if not resolved_path.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")

        file_size = resolved_path.stat().st_size

        mime_type, _ = mimetypes.guess_type(str(resolved_path))
        if not mime_type:
            mime_type = "video/mp4"

        cors = _cors_headers(request)

        range_header = request.headers.get("range")

        if range_header and range_header.lower().startswith("bytes="):
            range_spec = range_header[6:]
            parts = range_spec.split("-")
            if len(parts) != 2:
                raise HTTPException(status_code=416, detail="Invalid Range header")

            start_str, end_str = parts[0].strip(), parts[1].strip()

            if start_str:
                start = int(start_str)
                end = int(end_str) if end_str else min(start + CHUNK_SIZE - 1, file_size - 1)
            elif end_str:
                suffix_length = int(end_str)
                start = max(0, file_size - suffix_length)
                end = file_size - 1
            else:
                raise HTTPException(status_code=416, detail="Invalid Range header")

            if start >= file_size or end >= file_size or start > end:
                return Response(
                    status_code=416,
                    headers={
                        "Content-Range": f"bytes */{file_size}",
                        **cors,
                    },
                )

            content_length = end - start + 1

            async def range_iterator():
                with open(str(resolved_path), "rb") as f:
                    f.seek(start)
                    remaining = content_length
                    while remaining > 0:
                        read_size = min(CHUNK_SIZE, remaining)
                        data = f.read(read_size)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            return StreamingResponse(
                range_iterator(),
                status_code=206,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(content_length),
                    "Content-Type": mime_type,
                    **cors,
                },
            )

        async def full_iterator():
            with open(str(resolved_path), "rb") as f:
                while True:
                    data = f.read(CHUNK_SIZE)
                    if not data:
                        break
                    yield data

        return StreamingResponse(
            full_iterator(),
            status_code=200,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Content-Type": mime_type,
                **cors,
            },
        )
    except OSError as e:
        raise HTTPException(status_code=404, detail="File not found or unreadable due to system error")
