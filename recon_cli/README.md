# Recon Agent - CLI

The Command Line Interface (CLI) is a first-class citizen of the Recon Agent platform. It allows engineers and operators to automate reconciliations, view history, and extract AI explanations directly from the terminal without ever opening a web browser.

It is built using Python's `Typer` (for robust CLI arguments) and `Rich` (for beautiful terminal UI, tables, and colors).

## Tech Stack
- **CLI Framework:** Typer
- **Terminal UI:** Rich
- **Data Handling:** Pandas

## Commands

| Command | Description |
|---------|-------------|
| `recon login` | Prompts for a Personal Access Token (PAT) generated from the Web UI. |
| `recon reconcile <source> <target>` | Uploads two files, streams them to the API, and outputs an interactive match summary. |
| `recon history` | Displays a beautiful table of all historical reconciliation runs for your organization. |
| `recon history --json` | Outputs the history in pure JSON format, perfect for piping into `jq` or other CI/CD scripts. |
| `recon explain <run_id>` | Uses AI to generate a detailed, readable explanation of why specific transactions failed to match. |
| `recon export <run_id> --format pdf` | Downloads the CFO report for a specific run. |

## Automation & CI/CD
Because the CLI supports `--json` flags and headless execution, it is designed to be integrated directly into automated pipelines or cron jobs, enabling true "Reconciliation as Code".
