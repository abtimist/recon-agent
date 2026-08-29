import typer
from pathlib import Path
from recon_cli.client import api_post, ReconAPIError
from recon_cli.output import print_error, print_success, print_info, print_json, print_table, console

app = typer.Typer(help="Execute reconciliation between source and target datasets.")

@app.command("run")
def run_reconcile(
    ctx: typer.Context,
    source: Path = typer.Argument(..., help="Path to the source CSV/XLSX file", exists=True, dir_okay=False),
    target: Path = typer.Argument(..., help="Path to the target CSV/XLSX file", exists=True, dir_okay=False),
    amount_tolerance: float = typer.Option(0.0, "--tolerance", "-t", help="Allowable difference in amounts"),
    date_window: int = typer.Option(0, "--date-window", "-d", help="Allowable difference in days for dates"),
    ai_provider: str = typer.Option("none", "--provider", help="AI provider for fuzzy matching (groq, openai, none)"),
    mapping_id: str = typer.Option(None, "--mapping", "-m", help="Mapping preset ID to use"),
):
    """
    Reconcile two files against each other.
    """
    is_json = ctx.obj.get("json", False)

    try:
        with open(source, "rb") as s_file, open(target, "rb") as t_file:
            files = {
                "source_file": (source.name, s_file),
                "target_file": (target.name, t_file),
            }
            data = {
                "source_mapping_json": "{}",
                "target_mapping_json": "{}",
                "source_amount_mode": "single",
                "target_amount_mode": "single",
                "amount_tolerance": amount_tolerance,
                "date_window_days": date_window
            }

            from recon_cli.client import api_get
            import time

            if not is_json:
                with console.status("[bold cyan]Uploading and queueing reconciliation job...[/bold cyan]") as status:
                    job_accepted = api_post("/reconcile/", data=data, files=files, timeout=300.0)
                    run_id = job_accepted.get("run_id")
                    
                    if not run_id:
                        raise ReconAPIError("Failed to get run_id from API", status_code=500)
                        
                    status.update("[bold cyan]Job queued. Waiting for worker to process...[/bold cyan]")
                    
                    # Poll for completion
                    while True:
                        time.sleep(2)
                        job_status = api_get(f"/runs/{run_id}/status")
                        s = job_status.get("status")
                        
                        if s == "processing":
                            status.update("[bold cyan]Worker is processing the job...[/bold cyan]")
                        elif s == "completed":
                            status.update("[bold cyan]Job completed! Fetching results...[/bold cyan]")
                            break
                        elif s == "failed":
                            raise ReconAPIError(job_status.get("error_message") or "Job failed", status_code=500)
                    
                    result = api_get(f"/runs/{run_id}")
            else:
                job_accepted = api_post("/reconcile/", data=data, files=files, timeout=300.0)
                run_id = job_accepted.get("run_id")
                while True:
                    time.sleep(2)
                    job_status = api_get(f"/runs/{run_id}/status")
                    if job_status.get("status") in ("completed", "failed"):
                        if job_status.get("status") == "failed":
                            raise ReconAPIError(job_status.get("error_message") or "Job failed", status_code=500)
                        break
                result = api_get(f"/runs/{run_id}")

    except ReconAPIError as e:
        if is_json:
            print_json({"error": str(e), "status_code": e.status_code})
        else:
            print_error(str(e))
        raise typer.Exit(1)
    except Exception as e:
        if is_json:
            print_json({"error": str(e)})
        else:
            print_error(f"Failed to upload and reconcile: {e}")
        raise typer.Exit(1)

    if is_json:
        print_json(result)
        return

    # Render summary nicely
    print_success(f"Reconciliation Run Completed (ID: {result.get('run_id', 'N/A')})")
    
    summary = result.get("summary", {})
    
    table = [
        ["Total Source Rows", str(result.get("total_source_rows", 0))],
        ["Matched Rows", str(result.get("total_matched", 0))],
        ["Match Rate", f"{result.get('match_rate', 0)}%"],
        ["Exceptions", str(result.get("exceptions_count", 0))],
    ]
    
    print_table("Reconciliation Summary", ["Metric", "Value"], table)
    
    matches = [
        ["Exact Matches", str(result.get("exact_matches", 0))],
        ["Fuzzy Matches", str(result.get("fuzzy_matches", 0))],
        ["AI Matches", str(result.get("ai_matches", 0))],
    ]
    
    print_table("Match Breakdown", ["Type", "Count"], matches)

@app.callback(invoke_without_command=True)
def default_reconcile(
    ctx: typer.Context,
    source: Path = typer.Argument(..., help="Path to the source CSV/XLSX file", exists=True, dir_okay=False),
    target: Path = typer.Argument(..., help="Path to the target CSV/XLSX file", exists=True, dir_okay=False),
    amount_tolerance: float = typer.Option(0.0, "--tolerance", "-t", help="Allowable difference in amounts"),
    date_window: int = typer.Option(0, "--date-window", "-d", help="Allowable difference in days for dates"),
    ai_provider: str = typer.Option("none", "--provider", help="AI provider for fuzzy matching (groq, openai, none)"),
    mapping_id: str = typer.Option(None, "--mapping", "-m", help="Mapping preset ID to use"),
):
    if ctx.invoked_subcommand is None:
        # Pass directly to run
        run_reconcile(ctx, source, target, amount_tolerance, date_window, ai_provider, mapping_id)
