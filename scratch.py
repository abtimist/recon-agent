import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from api.db import get_db

db = get_db()
print("Connected to Supabase")

res = db.table("api_tokens").select("id, scopes").execute()
for row in res.data:
    db.table("api_tokens").update({"revoked_at": None}).eq("id", row["id"]).execute()
print("Unrevoked all tokens.")

# 2. Add 'explain' to scopes for all tokens
for row in res.data:
    scopes = row.get("scopes", [])
    if "explain" not in scopes:
        scopes.append("explain")
        db.table("api_tokens").update({"scopes": scopes}).eq("id", row["id"]).execute()
print("Added 'explain' scope to all tokens.")
