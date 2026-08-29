# Recon Agent CLI

Recon Agent includes a powerful Command Line Interface (CLI) that allows you to integrate financial reconciliation workflows into your terminal and automated scripts.

The CLI communicates directly with the Recon Agent FastAPI backend as a first-class API client. It does not contain a separate reconciliation engine. 

## Installation

You can install the CLI from the repository root:

```bash
pip install -e .
```

This will make the `recon` command available globally in your environment.

## Authentication

The CLI requires a Personal Access Token (PAT). You can generate a PAT in the Recon Agent web application (Settings > Personal Access Tokens).

### Interactive Login

```bash
recon login
```
You will be prompted for your API Base URL (e.g. `http://127.0.0.1:8000`) and your token (`ra_live_...`).

The CLI stores the Base URL in `~/.recon/config.json` and attempts to securely store your token in your operating system's keychain. If the OS keychain is unavailable, it will fall back to securely storing it in `~/.recon/credentials.json` (chmod 600).

### Check Status

```bash
recon whoami
# or
recon auth status
```

### Logout

```bash
recon logout
```

## Global Options

- `--json`: Outputs machine-readable JSON instead of formatted text/tables.
- `--debug`: Enable full tracebacks for errors.

## Commands

### 1. Reconcile

Reconcile two files (source and target).

```bash
recon reconcile source.csv target.csv
```

**Options:**
- `--tolerance`, `-t`: Allowable difference in amounts (default: `0.0`).
- `--date-window`, `-d`: Allowable difference in days for dates (default: `0`).
- `--provider`: AI provider for fuzzy matching (`groq`, `openai`, `none`) (default: `none`).
- `--mapping`, `-m`: Use a specific Mapping Preset ID.

### 2. History

View past reconciliation runs.

**List recent runs:**
```bash
recon history
```

**View specific run details:**
```bash
recon history <run-id>
```

### 3. Export

Export the results of a past run.

```bash
recon export <run-id> --format excel
```

**Options:**
- `--format`, `-f`: `excel` or `pdf` (default: `excel`).
- `--out`, `-o`: Specific output path for the exported file.

### 4. CFO Explanation

Generate an AI-powered executive summary of a reconciliation run.

```bash
recon explain <run-id>
```
Displays a clean markdown report of the explanation right in your terminal.

## Environment Variables

For automated scripts, you can completely bypass `recon login` by providing environment variables:

```bash
export RECON_API_TOKEN="ra_live_xxx..."
export RECON_API_URL="https://api.your-recon-instance.com"

recon history --json
```

Secrets provided via environment variables are never printed or saved to disk by the CLI.

## Troubleshooting

- **"Not authenticated"**: Ensure you have run `recon login` or set `RECON_API_TOKEN`.
- **"Authentication failed (401)"**: Your token was revoked or is invalid. Create a new one in the Web Dashboard.
- **"Connection failed"**: The CLI cannot reach the API. Check your Base URL and ensure the API server is running.
