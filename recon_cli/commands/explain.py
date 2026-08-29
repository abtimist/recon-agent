import typer
from recon_cli.client import api_post, ReconAPIError
from recon_cli.output import print_error, print_json, print_markdown, console

app = typer.Typer(help="Generate an AI-powered CFO Explanation for a reconciliation result.")

@app.callback(invoke_without_command=True)
def explain(
    ctx: typer.Context,
    run_id: str = typer.Argument(..., help="Run ID to explain")
):
    is_json = ctx.obj.get("json", False)
    
    try:
        from recon_cli.client import api_get
        import time

        if not is_json:
            console.print(f"Fetching run {run_id} details...")
            
        run_data = api_get(f"/runs/{run_id}")
        
        payload = {
            "type": "single",
            "result": run_data
        }
        
        if not is_json:
            with console.status("[bold cyan]Requesting CFO Explanation...[/bold cyan]") as status:
                job_accepted = api_post("/explain/", json=payload, timeout=120.0)
                job_id = job_accepted.get("job_id")
                
                status.update("[bold cyan]Job queued. Waiting for worker to process...[/bold cyan]")
                
                while True:
                    time.sleep(2)
                    job_status = api_get(f"/explain/{job_id}/status")
                    s = job_status.get("status")
                    
                    if s == "processing":
                        status.update("[bold cyan]Worker is processing the job...[/bold cyan]")
                    elif s == "completed":
                        status.update("[bold cyan]Explanation generated![/bold cyan]")
                        data = job_status.get("response_data")
                        break
                    elif s == "failed":
                        raise ReconAPIError(500, job_status.get("error_message") or "Explain job failed")
        else:
            job_accepted = api_post("/explain/", json=payload, timeout=120.0)
            job_id = job_accepted.get("job_id")
            while True:
                time.sleep(2)
                job_status = api_get(f"/explain/{job_id}/status")
                s = job_status.get("status")
                if s == "completed":
                    data = job_status.get("response_data")
                    break
                elif s == "failed":
                    raise ReconAPIError(500, job_status.get("error_message") or "Explain job failed")
        
        if is_json:
            print_json(data)
            return
            
        # Format the markdown output
        md = f"""# {data.get('headline')}

**Status:** {data.get('status')}

## Summary
{data.get('summary')}

## Key Findings
"""
        for finding in data.get('key_findings', []):
            md += f"- {finding}\n"
            
        md += f"\n## Financial Impact\n{data.get('financial_impact')}\n"
        
        md += "\n## Attention Items\n"
        for item in data.get('attention_items', []):
            md += f"- {item}\n"
            
        md += "\n## Recommended Actions\n"
        for action in data.get('recommended_actions', []):
            md += f"- {action}\n"
            
        print_markdown(md)
        
    except ReconAPIError as e:
        if is_json:
            print_json({"error": str(e)})
        else:
            print_error(str(e))
        raise typer.Exit(1)
    except Exception as e:
        if is_json:
            print_json({"error": str(e)})
        else:
            print_error(f"Failed to generate explanation: {e}")
        raise typer.Exit(1)
