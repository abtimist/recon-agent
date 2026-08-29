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

from api.routes import reconcile, history, mappings, settings, explain, reports

app = FastAPI(
    title="Recon Agent API",
    description="Multi-tenant financial reconciliation backend",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow the Next.js frontend (and local dev) to call the API
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",          # local Next.js dev
        "https://recon-agent.vercel.app", # replace with your production domain
    ],
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
app.include_router(explain.router,   prefix="/explain",   tags=["explain"])
app.include_router(reports.router,   prefix="/export",    tags=["export"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
