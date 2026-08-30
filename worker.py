import os
import json
import time
import io
import uuid
from datetime import datetime, timezone
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

import sentry_sdk
sentry_dsn = os.environ.get("SENTRY_DSN")
if sentry_dsn:
    sentry_sdk.init(
        dsn=sentry_dsn,
        traces_sample_rate=1.0,
    )

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# We need the direct Postgres connection string to use SKIP LOCKED.
# For Supabase, this is typically available as DATABASE_URL.
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY or not DATABASE_URL:
    raise RuntimeError("Worker requires SUPABASE_URL, SUPABASE_SERVICE_KEY, and DATABASE_URL")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

from core.file_reader import read_file
from core.column_mapper import apply_mapping
from core.reconciliation_service import reconcile_pair

def process_reconciliation(run: dict, db_conn):
    print(f"Processing run {run['id']}...")
    try:
        # Load config
        org_id = run['org_id']
        ai_config_res = supabase.table("org_ai_config").select("*").eq("org_id", org_id).maybe_single().execute()
        ai_config = {"provider": "none"}
        if ai_config_res and getattr(ai_config_res, "data", None):
            row = ai_config_res.data
            provider = row.get("provider", "none")
            from core.ai_resolver import PROVIDERS
            meta = PROVIDERS.get(provider, {})
            api_key = ""
            if row.get("encrypted_api_key"):
                from api.crypto import decrypt
                try:
                    api_key = decrypt(row["encrypted_api_key"])
                except Exception:
                    pass
            ai_config = {
                "provider": provider,
                "api_key": api_key,
                "model": row.get("model_override") or meta.get("model", ""),
                "base_url": row.get("base_url_override") or meta.get("base_url"),
            }

        # Download files from Supabase Storage
        storage_path_src = run.get('source_file_url')
        storage_path_tgt = run.get('target_file_url')

        if not storage_path_src or not storage_path_tgt:
            raise ValueError("Missing storage paths for source/target files")

        src_res = supabase.storage.from_("recon_files").download(storage_path_src)
        tgt_res = supabase.storage.from_("recon_files").download(storage_path_tgt)

        src_io = io.BytesIO(src_res)
        src_io.name = run['source_filename']
        tgt_io = io.BytesIO(tgt_res)
        tgt_io.name = run['target_filename']

        src_raw = read_file(src_io)
        tgt_raw = read_file(tgt_io)

        # Apply mappings
        config = run.get('config', {})
        source_mapping = config.get('source_mapping', {})
        target_mapping = config.get('target_mapping', {})
        source_amount_mode = config.get('source_amount_mode', 'single')
        target_amount_mode = config.get('target_amount_mode', 'single')
        amount_tolerance = config.get('amount_tolerance', 20.0)
        date_window_days = config.get('date_window_days', 5)

        src_df, _ = apply_mapping(src_raw, source_mapping, amount_mode=source_amount_mode)
        tgt_df, _ = apply_mapping(tgt_raw, target_mapping, amount_mode=target_amount_mode)

        pair_result = reconcile_pair(
            src_df=src_df,
            tgt_df=tgt_df,
            source_filename=run['source_filename'],
            target_filename=run['target_filename'],
            amount_tolerance=amount_tolerance,
            date_window_days=date_window_days,
            ai_config=ai_config
        )

        # Update run in DB via regular API (or psycopg2)
        supabase.table("recon_runs").update({
            "status": "completed",
            "total_source_rows": pair_result["total_source_rows"],
            "total_matched": pair_result["total_matched"],
            "match_rate": pair_result["match_rate"],
            "exact_matches": pair_result["exact_matches"],
            "fuzzy_matches": pair_result["fuzzy_matches"],
            "ai_matches": pair_result["ai_matches"],
            "exceptions_count": pair_result["exceptions_count"],
            "exception_report": pair_result["exception_report"],
            "amount_tolerance": amount_tolerance,
            "date_window_days": date_window_days,
            "duplicates": pair_result["duplicates"],
            "summary": pair_result["summary"],
            "ai_provider": ai_config.get("provider", "none"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run['id']).execute()

        print(f"Run {run['id']} completed successfully.")

        # Cleanup storage files
        supabase.storage.from_("recon_files").remove([storage_path_src, storage_path_tgt])

    except Exception as e:
        print(f"Error processing run {run['id']}: {e}")
        supabase.table("recon_runs").update({
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run['id']).execute()


def process_explain_job(job: dict, conn):
    print(f"Processing explain job {job['id']}...")
    try:
        org_id = job['org_id']
        ai_config_res = supabase.table("org_ai_config").select("*").eq("org_id", org_id).maybe_single().execute()
        ai_config = {"provider": "none"}
        if ai_config_res and getattr(ai_config_res, "data", None):
            row = ai_config_res.data
            provider = row.get("provider", "none")
            from core.ai_resolver import PROVIDERS
            meta = PROVIDERS.get(provider, {})
            api_key = ""
            if row.get("encrypted_api_key"):
                from api.crypto import decrypt
                try:
                    api_key = decrypt(row["encrypted_api_key"])
                except Exception:
                    pass
            ai_config = {
                "provider": provider,
                "api_key": api_key,
                "model": row.get("model_override") or meta.get("model", ""),
                "base_url": row.get("base_url_override") or meta.get("base_url"),
            }

        from core.explanation_service import explain_single_result, explain_batch_result
        if job['job_type'] == 'single':
            explanation = explain_single_result(job['request_data'], ai_config)
        else:
            explanation = explain_batch_result(job['request_data'], ai_config)

        # Update job
        supabase.table("explain_jobs").update({
            "status": "completed",
            "response_data": explanation.model_dump(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job['id']).execute()

        print(f"Explain job {job['id']} completed successfully.")

    except Exception as e:
        print(f"Error processing explain job {job['id']}: {e}")
        supabase.table("explain_jobs").update({
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job['id']).execute()


def update_batch_if_done(batch_id: str):
    if not batch_id:
        return
    
    # Check if any runs in the batch are still queued or processing
    runs_res = supabase.table("recon_runs").select("status").eq("batch_id", batch_id).execute()
    if not runs_res or not runs_res.data:
        return
        
    runs = runs_res.data
    in_progress = [r for r in runs if r["status"] in ("queued", "processing")]
    
    if len(in_progress) == 0:
        # All runs are completed or failed, mark batch as completed
        supabase.table("recon_batches").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", batch_id).execute()
        print(f"Batch {batch_id} marked as completed.")


import redis
from psycopg2.extras import RealDictCursor

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL)

def poll_queue():
    print(f"Worker started. Connected to Redis at {REDIS_URL}. Waiting for jobs...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True

    while True:
        try:
            # Block until a job is available in either queue (timeout 5s to allow graceful shutdown)
            result = redis_client.brpop(["recon_queue", "explain_queue"], timeout=5)
            
            if not result:
                continue
                
            queue_name, job_id_bytes = result
            queue_name = queue_name.decode("utf-8")
            job_id = job_id_bytes.decode("utf-8")
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                if queue_name == "recon_queue":
                    # Mark processing and fetch job
                    cur.execute("""
                        UPDATE recon_runs
                        SET status = 'processing'
                        WHERE id = %s AND status = 'queued'
                        RETURNING *;
                    """, (job_id,))
                    run = cur.fetchone()
                    
                    if run:
                        process_reconciliation(run, conn)
                        update_batch_if_done(run.get("batch_id"))
                    else:
                        print(f"Recon job {job_id} not found or already processing.")
                        
                elif queue_name == "explain_queue":
                    # Mark processing and fetch job
                    cur.execute("""
                        UPDATE explain_jobs
                        SET status = 'processing'
                        WHERE id = %s AND status = 'queued'
                        RETURNING *;
                    """, (job_id,))
                    explain_job = cur.fetchone()
                    
                    if explain_job:
                        process_explain_job(explain_job, conn)
                    else:
                        print(f"Explain job {job_id} not found or already processing.")

        except Exception as e:
            print(f"Worker processing error: {e}")
            import traceback
            traceback.print_exc()
            try:
                # If connection is closed or broken, try to reconnect
                if conn.closed != 0:
                    print("Database connection closed. Reconnecting...")
                    conn = psycopg2.connect(DATABASE_URL)
                    conn.autocommit = True
            except Exception as reconnect_error:
                print(f"Reconnection failed: {reconnect_error}")
            time.sleep(5)

if __name__ == "__main__":
    poll_queue()

