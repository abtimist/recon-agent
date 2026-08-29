#!/bin/bash
# start.sh - Co-location script for $0 MVP deployment on Render

# 1. Start the background worker process and push it to the background
echo "Starting background worker..."
uv run python worker.py &

# 2. Start the FastAPI web server in the foreground
# We use $PORT provided by Render, defaulting to 8000 for local testing
echo "Starting FastAPI web server..."
uv run uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
