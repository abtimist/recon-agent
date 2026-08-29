# Phase 4 — CLI Implementation Report

Phase 4 establishes the Recon Agent CLI as a professional, installable Python package built on Typer. It replaces the legacy, disconnected script with a first-class API client that rigorously enforces the "API as the single source of truth" architectural constraint.

## CLI Architecture

The CLI is structured within a dedicated `recon_cli` package:
- `main.py`: The Typer application entrypoint and global `--json` context.
- `client.py`: An `httpx`-based API client that automatically handles timeouts, error formatting, and Bearer token injection.
- `auth.py`: Token management interacting with the OS keychain (`keyring`) or a secure fallback file.
- `config.py`: Local configuration state.
- `output.py`: Terminal UX module utilizing `rich` for tables, panels, and markdown formatting.
- `commands/`: Submodules for `auth`, `reconcile`, `history`, `export`, and `explain`.

## Installation Method
The package utilizes the existing `pyproject.toml` (via `hatchling` backend).
Installing it via:
```bash
pip install -e .
# or
uv pip install -e .
```
exposes the `recon` binary globally.

## Authentication Flow
`recon login` securely accepts a generated Personal Access Token (PAT).
1. It attempts to store the token in the OS keychain using `keyring`.
2. If `keyring` is unavailable or fails, it falls back to `~/.recon/credentials.json`.
3. The fallback file is strictly constrained via `os.chmod` to `600` permissions (read/write by owner only).
4. Environment variables (`RECON_API_TOKEN` and `RECON_API_URL`) natively override local config, allowing seamless CI/CD automation without login.

## Commands Implemented and API Endpoints Consumed

| CLI Command | API Endpoint Consumed | Description |
|---|---|---|
| `recon login` / `logout` | (Local Only) | Manage local session. |
| `recon whoami` | `GET /auth/status` | Validate token and fetch associated `CurrentIdentity`. |
| `recon reconcile <src> <tgt>` | `POST /reconcile/` | Upload files and execute matching via the core engine. |
| `recon history` | `GET /runs/` | List past runs. |
| `recon history <id>` | `GET /runs/<id>` or `/runs/batch/<id>` | Fetch single or batch run details. |
| `recon export <id>` | `POST /export/single/<fmt>` | Request PDF/Excel export and download it to disk. |
| `recon explain <id>` | `POST /explain/` | Generate AI-driven CFO summary, rendered via `rich` Markdown. |

## Terminal UX
The CLI leverages `rich` to provide clean, readable tables and highlighted markdown. Every command supports the `--json` global flag (`recon --json history`), which entirely bypasses terminal formatting to emit strict JSON strings for machine-parsing and jq pipelines.

## Security Considerations
- PATs are **never** logged to terminal stdout, except during the initial prompt.
- The `recon whoami` command successfully checks authentication status over the network but intentionally avoids returning the token itself.
- Fallback token storage is strictly isolated to the user (`600` permission bit).
- Legacy disconnected `cli.py` was removed, preventing any direct unauthenticated import of `core/` logic.

## Verification & Testing
- Developed `tests/test_cli.py` leveraging `respx` to mock HTTP API interactions.
- Validated command parsing, missing credentials rejection, and JSON output formatting.
- The full backend `pytest` suite and `web` frontend build process were run successfully, confirming zero regressions.

## Exact Next Recommended Phase
With the CLI client successfully integrated into the platform stack, the infrastructure is solid.
**Next Recommended Step**: Proceed to **Phase 5: Feature 8**, which introduces the final advanced logic (e.g., automated learning from manual mappings, or batch orchestration).
