import logging
import os
import re
import secrets
import time
from pathlib import Path
from collections import defaultdict, deque
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from pydantic import BaseModel
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from .catalog import router as catalog_router


class HealthStatus(BaseModel):
    status: str


logger = logging.getLogger("billgenie.api")
MAX_REQUEST_BYTES = int(os.getenv("BILLGENIE_MAX_REQUEST_BYTES", "1048576"))
RATE_LIMIT = int(os.getenv("BILLGENIE_RATE_LIMIT", "120"))
RATE_WINDOW_SECONDS = 60
requests_by_client: dict[str, deque[float]] = defaultdict(deque)

app = FastAPI(title="BillGenie API", version="0.2.0", description="Read-only synthetic billing catalog and OIDC authentication foundation")
environment = os.getenv("BILLGENIE_ENVIRONMENT", "development").casefold()
state_key = os.getenv("BILLGENIE_OIDC_STATE_KEY", "")
if environment == "production" and len(state_key) < 32:
    raise RuntimeError("BILLGENIE_OIDC_STATE_KEY must contain at least 32 characters in production")
if environment == "production" and os.getenv("BILLGENIE_COOKIE_SECURE", "0") != "1":
    raise RuntimeError("Secure cookies are required in production")
if environment == "production" and not os.getenv("BILLGENIE_OIDC_STATE_KEY"):
    raise RuntimeError("BILLGENIE_OIDC_STATE_KEY is required in production")
allowed_origins = [origin.strip() for origin in os.getenv("BILLGENIE_CORS_ORIGINS", "http://127.0.0.1:3000").split(",") if origin.strip()]
app.add_middleware(CORSMiddleware, allow_origins=allowed_origins, allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["X-Request-ID", "X-CSRF-Token", "Content-Type"], max_age=600)


class RequestSafeguards(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id", "")
        if not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", request_id):
            request_id = str(uuid4())
        try:
            declared_length = int(request.headers.get("content-length", "0"))
        except ValueError:
            return self.error_response(400, "invalid_content_length", "Invalid request.", request_id)
        if declared_length < 0 or declared_length > MAX_REQUEST_BYTES:
            return self.error_response(413, "request_too_large", "Request exceeds the allowed size.", request_id)

        now = time.monotonic()
        client = request.client.host if request.client else "unknown"
        window = requests_by_client[client]
        while window and window[0] <= now - RATE_WINDOW_SECONDS:
            window.popleft()
        if len(window) >= RATE_LIMIT:
            return self.error_response(429, "rate_limited", "Too many requests. Try again shortly.", request_id, {"Retry-After": str(RATE_WINDOW_SECONDS)})
        window.append(now)

        started = time.monotonic()
        request.state.correlation_id = request_id
        response = await call_next(request)
        response.headers.update(self.security_headers(request_id))
        logger.info("request_complete request_id=%s method=%s path=%s status=%s duration_ms=%d", request_id, request.method, request.url.path, response.status_code, int((time.monotonic() - started) * 1000))
        return response

    @staticmethod
    def security_headers(request_id: str) -> dict[str, str]:
        return {
            "X-Request-ID": request_id,
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "no-referrer",
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
        }

    @classmethod
    def error_response(cls, status_code: int, code: str, message: str, request_id: str, extra_headers: dict[str, str] | None = None) -> JSONResponse:
        headers = cls.security_headers(request_id)
        headers.update(extra_headers or {})
        return JSONResponse({"error": {"code": code, "message": message}}, status_code=status_code, headers=headers)


app.add_middleware(RequestSafeguards)
app.add_middleware(
    SessionMiddleware,
    secret_key=state_key or secrets.token_urlsafe(48),
    session_cookie="__Host-bg_oidc_state" if os.getenv("BILLGENIE_COOKIE_SECURE", "0") == "1" else "bg_oidc_state",
    max_age=300,
    same_site="lax",
    https_only=os.getenv("BILLGENIE_COOKIE_SECURE", "0") == "1",
)

from .auth import router as auth_router
from .users import router as users_router

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(catalog_router)


@app.get("/health", response_model=HealthStatus)
def health() -> HealthStatus:
    return HealthStatus(status="ok")


@app.get("/ready", response_model=HealthStatus)
def ready() -> HealthStatus:
    from .database import readiness
    if not readiness():
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "degraded"})
    return HealthStatus(status="ok")
