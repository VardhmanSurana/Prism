import time
from collections import defaultdict

from fastapi import Request, HTTPException

_buckets: dict[str, list[float]] = defaultdict(list)


def rate_limit(request: Request, max_requests: int = 20, window_seconds: int = 60):
    """Simple per-IP sliding window rate limiter."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    key = f"{client_ip}:{request.url.path}"
    _buckets[key] = [t for t in _buckets[key] if now - t < window_seconds]
    if len(_buckets[key]) >= max_requests:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    _buckets[key].append(now)
