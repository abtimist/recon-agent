import json
import os
from pathlib import Path

# The base configuration path
CONFIG_DIR = Path.home() / ".recon"
CONFIG_FILE = CONFIG_DIR / "config.json"
CREDENTIALS_FILE = CONFIG_DIR / "credentials.json"

DEFAULT_CONFIG = {
    "api_base_url": "https://recon-agent-i8mo.onrender.com"
}

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r") as f:
            data = json.load(f)
            # Merge with defaults
            return {**DEFAULT_CONFIG, **data}
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_config(config: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

def get_api_url() -> str:
    """Return the API URL, allowing env var override."""
    env_url = os.environ.get("RECON_API_URL")
    if env_url:
        return env_url.rstrip("/")
    return load_config().get("api_base_url", DEFAULT_CONFIG["api_base_url"]).rstrip("/")
