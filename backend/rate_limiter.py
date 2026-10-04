import time
from collections import defaultdict
from fastapi import Request, status
from fastapi.responses import JSONResponse
from typing import Dict, List, Tuple, Optional
import logging

logger = logging.getLogger("argus.ratelimit")

# In-memory store: mapping client_ip -> list of timestamps
_RATE_LIMIT_STORE: Dict[str, List[float]] = defaultdict(list)

# Route-specific rate limits: (max_requests, window_seconds)
ROUTE_LIMITS: Dict[str, Tuple[int, int]] = {
    "/api/auth/login": (10, 60),          # 10 attempts per minute
    "/api/auth/send-otp": (4, 60),        # 4 OTP sends per minute
    "/api/auth/register-verified": (6, 60),# 6 registrations per minute
    "/api/ai/query": (35, 60),            # 35 queries per minute
    "/api/ai/summarize": (30, 60),        # 30 summaries per minute
    "/api/upload": (20, 60),              # 20 uploads per minute
}

DEFAULT_LIMIT: Tuple[int, int] = (150, 60) # 150 general requests per minute

def check_rate_limit(request: Request) -> Optional[JSONResponse]:
    """
    Evaluates client IP against sliding-window threshold.
    Returns HTTP 429 JSONResponse if rate exceeded, else None.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # Check for forwarded headers if behind proxy
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    path = request.url.path
    now = time.time()

    # Determine matched limit
    matched_limit = DEFAULT_LIMIT
    for prefix, limit_rule in ROUTE_LIMITS.items():
        if path.startswith(prefix):
            matched_limit = limit_rule
            break

    max_reqs, window_sec = matched_limit
    key = f"{client_ip}:{path}"

    # Filter timestamps within window
    timestamps = _RATE_LIMIT_STORE[key]
    cutoff = now - window_sec
    _RATE_LIMIT_STORE[key] = [t for t in timestamps if t > cutoff]

    if len(_RATE_LIMIT_STORE[key]) >= max_reqs:
        retry_after = int(window_sec - (now - _RATE_LIMIT_STORE[key][0]))
        retry_after = max(1, retry_after)
        logger.warning("Rate limit exceeded for %s on %s (%d reqs in %ds)", client_ip, path, max_reqs, window_sec)
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": f"Rate limit exceeded. Please wait {retry_after} seconds before trying again."},
            headers={"Retry-After": str(retry_after)}
        )

    _RATE_LIMIT_STORE[key].append(now)
    return None
