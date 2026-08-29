import typer
import httpx
from rich.prompt import Prompt
from recon_cli.auth import save_token, clear_token, get_token
from recon_cli.config import save_config, get_api_url
from recon_cli.client import ReconAPIError, api_get
from recon_cli.output import print_error, print_success, print_info, print_json

app = typer.Typer(help="Authentication and session management.")

@app.command()
def login(
    base_url: str = typer.Option(None, "--url", help="API Base URL"),
    token: str = typer.Option(None, "--token", help="Personal Access Token")
):
    """
    Log in to a Recon Agent instance using a Personal Access Token.
    """
    if not base_url:
        current_url = get_api_url()
        base_url = Prompt.ask("API Base URL", default=current_url)
    
    if not token:
        token = Prompt.ask("Personal Access Token (ra_live_...)", password=True)

    if not token.startswith("ra_live_"):
        print_error("Invalid token format. It should start with 'ra_live_'")
        raise typer.Exit(1)

    # Save the config
    save_config({"api_base_url": base_url.rstrip("/")})
    
    # Save the token
    used_keyring = save_token(token)
    
    if used_keyring:
        print_info("Token saved securely in OS keychain.")
    else:
        print_info("Token saved in ~/.recon/credentials.json (OS keychain unavailable).")

    # Validate the token
    try:
        response = api_get("/auth/status")
        print_success(f"Logged in successfully as {response.get('clerk_user_id', 'unknown')}")
    except ReconAPIError as e:
        print_error(f"Login failed: {e}")
        clear_token()
        raise typer.Exit(1)
    except Exception as e:
        print_error(f"Connection failed: {e}")
        clear_token()
        raise typer.Exit(1)


@app.command()
def logout():
    """
    Log out and clear the stored token.
    """
    clear_token()
    print_success("Logged out successfully.")

@app.command()
def whoami(
    ctx: typer.Context,
):
    """
    Check current authentication status.
    """
    token = get_token()
    if not token:
        if ctx.obj.get("json", False):
            print_json({"authenticated": False, "error": "No token found"})
        else:
            print_error("Not logged in. Run 'recon auth login' first.")
        raise typer.Exit(1)

    try:
        data = api_get("/auth/status")
        if ctx.obj.get("json", False):
            print_json({"authenticated": True, "data": data})
        else:
            print_info(f"Authenticated as User ID: {data.get('clerk_user_id')}")
            if data.get("org_id"):
                print_info(f"Organization ID: {data.get('org_id')}")
            print_info(f"Scopes: {', '.join(data.get('scopes', []))}")
            if not data.get("is_pat"):
                print_info("Note: Authenticated via Clerk JWT (browser token) instead of PAT.")
    except ReconAPIError as e:
        if ctx.obj.get("json", False):
            print_json({"authenticated": False, "error": str(e)})
        else:
            print_error(f"Authentication check failed: {e}")
        raise typer.Exit(1)

# Alias status to whoami
@app.command()
def status(ctx: typer.Context):
    """Alias for whoami."""
    whoami(ctx)
