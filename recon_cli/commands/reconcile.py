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
                "ai_provider": ai_provider,
                "amount_tolerance": amount_tolerance,
                "date_window_days": date_window
            }
            if mapping_id:
                data["mapping_id"] = mapping_id

            if not is_json:
                with console.status("[bold cyan]Reconciling files... This may take a moment.[/bold cyan]"):
                    result = api_post("/reconcile/", data=data, files=files, timeout=300.0)
            else:
                result = api_post("/reconcile/", data=data, files=files, timeout=300.0)

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
    print_success(f"Reconciliation Run Completed (ID: {result.get('id', 'N/A')})")
    
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
