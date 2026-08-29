import typer
from recon_cli.client import api_get, ReconAPIError
from recon_cli.output import print_error, print_json, print_table, print_panel, console

app = typer.Typer(help="View past reconciliation runs.")

@app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    run_id: str = typer.Argument(None, help="Specific Run ID to fetch details for"),
    limit: int = typer.Option(20, help="Number of recent runs to show when listing")
):
    if ctx.invoked_subcommand is not None:
        return
        
    is_json = ctx.obj.get("json", False)

    if run_id:
        # Fetch specific run
        try:
            # First try as a single run
            try:
                data = api_get(f"/runs/{run_id}")
            except ReconAPIError as e:
                if e.status_code == 404:
                    # Maybe it's a batch run?
                    data = api_get(f"/runs/batch/{run_id}")
                else:
                    raise e
                    
            if is_json:
                print_json(data)
                return
                
            # Formatting details
            if not data.get("is_batch", False) and "files" not in data:
                # Single run
                print_panel(
                    f"ID: {data.get('id') or data.get('run_id')}\n"
                    f"Status: {data.get('status')}\n"
                    f"Match Rate: {data.get('match_rate', 0)}%\n"
                    f"Exceptions: {data.get('exceptions_count', 0)}\n"
                    f"Completed: {data.get('completed_at')}",
                    title="Single Run Details"
                )
            else:
                # Batch run
                print_panel(
                    f"Batch ID: {data.get('batch_id')}\n"
                    f"Status: {data.get('status')}\n"
                    f"Total Match Rate: {data.get('overall_match_rate', 0)}%\n"
                    f"Total Exceptions: {data.get('total_exceptions', 0)}\n"
                    f"Files processed: {len(data.get('files', []))}",
                    title="Batch Run Details"
                )
                
        except ReconAPIError as e:
            if is_json:
                print_json({"error": str(e)})
            else:
                print_error(str(e))
            raise typer.Exit(1)
            
    else:
        # List runs
        try:
            data = api_get("/runs/", params={"limit": limit})
            if is_json:
                print_json(data)
                return
                
            if not data:
                console.print("No history found.")
                return
                
            rows = []
            for item in data:
                run_type = item.get("type", "single")
                run_ident = item.get("id") or item.get("batch_id")
                completed = item.get("completed_at", "N/A")
                if completed != "N/A":
                    completed = completed[:16].replace("T", " ")
                    
                if run_type == "single":
                    rate = f"{item.get('match_rate', 0)}%"
                    exc = str(item.get('exceptions_count', 0))
                else:
                    rate = f"{item.get('overall_match_rate', 0)}%"
                    exc = str(item.get('total_exceptions', 0))
                    
                rows.append([
                    run_type.upper(),
                    run_ident,
                    item.get("status", ""),
                    rate,
                    exc,
                    completed
                ])
                
            print_table(
                title=f"Recent Runs (Showing up to {limit})",
                columns=["Type", "ID", "Status", "Match Rate", "Exceptions", "Completed"],
                rows=rows
            )
            console.print("\nRun [cyan]recon history <id>[/cyan] to see details.")
            
        except ReconAPIError as e:
            if is_json:
                print_json({"error": str(e)})
            else:
                print_error(str(e))
            raise typer.Exit(1)
