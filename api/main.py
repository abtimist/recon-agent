"""
FastAPI application entry point.

Startup:
    uvicorn api.main:app --reload --port 8000

Environment variables required (copy .env.example → .env):
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
    CLERK_SECRET_KEY
    ENCRYPTION_KEY          (32 random bytes, base64-encoded)
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import reconcile, history, mappings, settings, explain, reports, tokens, auth

app = FastAPI(
    title="Recon Agent API",
    description="Multi-tenant financial reconciliation backend",
    version="1.0.0",
)

import os
from fastapi import Request
from starlette.responses import JSONResponse

MAX_UPLOAD_SIZE = int(os.environ.get("MAX_UPLOAD_SIZE", 50 * 1024 * 1024)) # 50MB default

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "Payload too large. Maximum size is 50MB."}
            )
    return await call_next(request)

# ---------------------------------------------------------------------------
# CORS — allow the Next.js frontend (and local dev) to call the API
# ---------------------------------------------------------------------------
cors_origins_str = os.environ.get("CORS_ORIGINS", "http://localhost:3000,https://recon-agent.vercel.app")
allow_origins = [origin.strip() for origin in cors_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(reconcile.router, prefix="/reconcile", tags=["reconcile"])
app.include_router(history.router,   prefix="/runs",      tags=["history"])
app.include_router(mappings.router,  prefix="/mappings",  tags=["mappings"])
app.include_router(settings.router,  prefix="/settings",  tags=["settings"])
app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(explain.router,   prefix="/explain",   tags=["explain"])
app.include_router(reports.router,   prefix="/export",    tags=["export"])
app.include_router(tokens.router,    prefix="/api-tokens",tags=["tokens"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
