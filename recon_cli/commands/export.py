import typer
import httpx
from pathlib import Path
from recon_cli.client import get_client, get_api_url, _get_headers
from recon_cli.output import print_error, print_success, print_json, console

app = typer.Typer(help="Export reconciliation results to a file.")

@app.callback(invoke_without_command=True)
def export(
    ctx: typer.Context,
    run_id: str = typer.Argument(..., help="Run ID or Batch ID to export"),
    format: str = typer.Option("excel", "--format", "-f", help="Format to export (excel or pdf)"),
    out: Path = typer.Option(None, "--out", "-o", help="Output file path")
):
    if format not in ["excel", "pdf"]:
        print_error("Format must be 'excel' or 'pdf'.")
        raise typer.Exit(1)
        
    is_json = ctx.obj.get("json", False)
    
    # First we need to know if it's a batch or single. We can just try one, then the other,
    # or just assume it's single first. Let's try single.
    
    base_url = get_api_url()
    try:
        headers = _get_headers()
    except Exception as e:
        if is_json:
            print_json({"error": str(e)})
        else:
            print_error(str(e))
        raise typer.Exit(1)
        
    payload = {"run_id": run_id}
    endpoint = f"{base_url}/export/single/{format}"
    
    # Try single first
    try:
        with httpx.Client(headers=headers, timeout=60.0) as client:
            if not is_json:
                console.print(f"Requesting {format.upper()} export for run {run_id}...")
            
            response = client.post(endpoint, json=payload)
            
            if response.status_code == 404:
                # Try batch
                payload = {"batch_id": run_id}
                endpoint = f"{base_url}/export/batch/{format}"
                response = client.post(endpoint, json=payload)
                
            response.raise_for_status()
            
            # Determine output filename if not provided
            if not out:
                content_disp = response.headers.get("Content-Disposition", "")
                if "filename=" in content_disp:
                    filename = content_disp.split("filename=")[-1].strip('"\'')
                else:
                    ext = "xlsx" if format == "excel" else "pdf"
                    filename = f"recon_export_{run_id}.{ext}"
                out = Path(filename)
            
            with open(out, "wb") as f:
                f.write(response.content)
                
            if is_json:
                print_json({"success": True, "file": str(out.absolute())})
            else:
                print_success(f"Export saved to [bold]{out}[/bold]")
                
    except httpx.HTTPStatusError as e:
        detail = "Unknown error"
        try:
            detail = e.response.json().get("detail", detail)
        except:
            pass
        err_msg = f"API Error ({e.response.status_code}): {detail}"
        if is_json:
            print_json({"error": err_msg})
        else:
            print_error(err_msg)
        raise typer.Exit(1)
    except Exception as e:
        if is_json:
            print_json({"error": str(e)})
        else:
            print_error(f"Failed to export: {e}")
        raise typer.Exit(1)
