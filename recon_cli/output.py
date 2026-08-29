import json
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint
from rich.markdown import Markdown

# Global console instance
console = Console()

def print_error(msg: str):
    console.print(f"[bold red]Error:[/bold red] {msg}")

def print_success(msg: str):
    console.print(f"[bold green]Success:[/bold green] {msg}")

def print_info(msg: str):
    console.print(f"[cyan]{msg}[/cyan]")

def print_json(data: dict | list):
    """Prints raw JSON to stdout. Bypasses rich formatting for standard out pipes."""
    print(json.dumps(data, indent=2))

def print_table(title: str, columns: list[str], rows: list[list[str]]):
    table = Table(title=title, show_header=True, header_style="bold magenta")
    for col in columns:
        table.add_column(col)
    for row in rows:
        table.add_row(*[str(item) if item is not None else "" for item in row])
    console.print(table)

def print_panel(content: str, title: str = "", border_style: str = "blue"):
    panel = Panel(content, title=title, border_style=border_style, expand=False)
    console.print(panel)

def print_markdown(content: str):
    md = Markdown(content)
    console.print(md)
