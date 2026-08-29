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
    
    payload = {"run_id": run_id}
    
    try:
        if not is_json:
            console.print(f"Requesting CFO Explanation for run {run_id}... (This may take a moment)")
            
        data = api_post("/explain/", json=payload, timeout=120.0)
        
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
