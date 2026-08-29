import typer

app = typer.Typer(
    name="recon",
    help="Recon Agent CLI - Multi-tenant financial reconciliation from your terminal.",
    no_args_is_help=True,
    add_completion=False,
)

from recon_cli.commands import auth, reconcile, history, export, explain

app.add_typer(auth.app, name="auth")
app.add_typer(reconcile.app, name="reconcile")
app.add_typer(history.app, name="history")
app.add_typer(export.app, name="export")
app.add_typer(explain.app, name="explain")

# Add some top-level aliases for convenience
app.command(name="login")(auth.login)
app.command(name="logout")(auth.logout)
app.command(name="whoami")(auth.whoami)

@app.callback()
def main(
    ctx: typer.Context,
    json: bool = typer.Option(False, "--json", help="Output machine-readable JSON instead of human-readable text"),
    debug: bool = typer.Option(False, "--debug", help="Enable debug mode with full tracebacks"),
):
    """
    Global options for Recon Agent CLI.
    """
    ctx.ensure_object(dict)
    ctx.obj["json"] = json
    ctx.obj["debug"] = debug

if __name__ == "__main__":
    app()
