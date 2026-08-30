"""
Supabase client — single async client reused across the application.

Uses the SERVICE KEY (bypasses RLS) because all access control is handled
at the application layer (we verify the Clerk JWT first, then enforce
org scoping in every query manually). This is safer than relying solely
on RLS for a server-side API.
"""

import os
from supabase import create_client, Client
import redis

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
REDIS_URL            = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_client: Client | None = None
_redis: redis.Redis | None = None

def get_db() -> Client:
    """Return the shared Supabase client (initialized once)."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment."
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client

def get_redis() -> redis.Redis:
    """Return the shared Redis client (initialized once)."""
    global _redis
    if _redis is None:
        _redis = redis.from_url(REDIS_URL)
    return _redis
