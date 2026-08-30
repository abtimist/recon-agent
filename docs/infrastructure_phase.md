# Advanced Infrastructure Phase

The Recon Agent backend was recently upgraded to include several advanced infrastructure concepts, ensuring high scalability and production-readiness.

## 1. Dockerization & CI/CD
To ensure identical environments across local development and production, the backend is now fully dockerized.
- **Dockerfile**: A multi-stage build that uses `uv` for lightning-fast dependency resolution.
- **Docker Compose**: A `docker-compose.yml` file allows engineers to spin up the API, Worker, and a local Redis instance simultaneously with `docker compose up`.
- **CI Pipeline**: A GitHub Actions workflow (`.github/workflows/ci.yml`) runs the full `pytest` suite automatically on every push or PR.

## 2. Observability (Sentry)
Observability is critical for distributed systems. Sentry SDK was integrated into both the `api` and `worker` layers.
- **Error Tracking**: Any unhandled exceptions (e.g. database connection drops, invalid JSON) are automatically aggregated in the Sentry dashboard.
- **Performance Tracing**: Configured with a 100% sample rate, enabling deep tracing of exactly how many milliseconds the worker spends inside the reconciliation engine versus waiting on database queries.

## 3. Message Broker (Redis)
The application originally polled PostgreSQL for queued jobs using `SELECT FOR UPDATE SKIP LOCKED`. To scale the worker layer horizontally:
- **Redis Queue**: The API now pushes job IDs (`recon_queue`, `explain_queue`) directly into Upstash Redis.
- **Instant Consumption**: The worker uses `BRPOP` (blocking right pop) to consume jobs instantaneously, eliminating database polling overhead and reducing latency to zero.

## 4. Sophisticated Concurrency
The fuzzy matching engine uses a hybrid sequential/parallel approach depending on payload size.
- **Small Datasets (<= 1000 rows)**: Runs a highly-optimized vectorized sequential loop to guarantee O(N*K) matching parity.
- **Large Datasets (> 1000 rows)**: Switches to a Map-Reduce concurrency model. The `ProcessPoolExecutor` parallelizes string similarity computation (`rapidfuzz.process.extractOne`) across all available CPU cores. 
- **Conflict Resolution**: The parallel threads map best candidate matches, and the reduce phase aggressively sorts by confidence score, greedily claiming target rows to prevent double-spending.

This hybrid approach ensures lightning-fast processing for huge files while maintaining strict accuracy for small files.
