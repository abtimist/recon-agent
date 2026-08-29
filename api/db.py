"""
Supabase client — single async client reused across the application.

Uses the SERVICE KEY (bypasses RLS) because all access control is handled
at the application layer (we verify the Clerk JWT first, then enforce
org scoping in every query manually). This is safer than relying solely
on RLS for a server-side API.
"""

import os
from supabase import create_client, Client

SUPABASE_URL         = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

_client: Client | None = None


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
