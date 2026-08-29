import os
import json
import keyring
import stat
from typing import Optional
from pathlib import Path
from recon_cli.config import CREDENTIALS_FILE, CONFIG_DIR

SERVICE_NAME = "recon-agent"
TOKEN_KEY = "pat"

def _is_keyring_available() -> bool:
    try:
        # Check if the active keyring is just the failing ChrootKeyring or similar empty ones
        kr = keyring.get_keyring()
        # Non-viable keyrings typically have "fail" in their name or class name, or it throws on get/set
        if "fail" in str(kr).lower():
            return False
        return True
    except Exception:
        return False

def _read_fallback_token() -> Optional[str]:
    if not CREDENTIALS_FILE.exists():
        return None
    try:
        # Ensure strict permissions before trusting it
        st = os.stat(CREDENTIALS_FILE)
        if st.st_mode & stat.S_IRWXO or st.st_mode & stat.S_IRWXG:
            # File is accessible to group or others, which is insecure
            print("Warning: ~/.recon/credentials.json has insecure permissions. It should be 600.")
        
        with open(CREDENTIALS_FILE, "r") as f:
            data = json.load(f)
            return data.get(TOKEN_KEY)
    except Exception:
        return None

def _write_fallback_token(token: str):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    # Touch the file securely if it doesn't exist
    if not CREDENTIALS_FILE.exists():
        open(CREDENTIALS_FILE, 'w').close()
        
    # Force 600 permissions
    os.chmod(CREDENTIALS_FILE, stat.S_IRUSR | stat.S_IWUSR)
    
    data = {}
    if CREDENTIALS_FILE.exists() and os.path.getsize(CREDENTIALS_FILE) > 0:
        try:
            with open(CREDENTIALS_FILE, "r") as f:
                data = json.load(f)
        except Exception:
            pass
            
    data[TOKEN_KEY] = token
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(data, f)

def _delete_fallback_token():
    if not CREDENTIALS_FILE.exists():
        return
    try:
        with open(CREDENTIALS_FILE, "r") as f:
            data = json.load(f)
        if TOKEN_KEY in data:
            del data[TOKEN_KEY]
        with open(CREDENTIALS_FILE, "w") as f:
            json.dump(data, f)
    except Exception:
        pass

def get_token() -> Optional[str]:
    """
    Get the Personal Access Token.
    Checks environment variable first, then keyring, then fallback file.
    """
    # 1. Environment Variable
    env_token = os.environ.get("RECON_API_TOKEN")
    if env_token:
        return env_token

    # 2. Keyring
    if _is_keyring_available():
        try:
            token = keyring.get_password(SERVICE_NAME, "default_user")
            if token:
                return token
        except Exception:
            pass

    # 3. Fallback file
    return _read_fallback_token()

def save_token(token: str) -> bool:
    """
    Save the Personal Access Token.
    Prefers keyring, falls back to secure file.
    Returns True if keyring was used, False if fallback was used.
    """
    if _is_keyring_available():
        try:
            keyring.set_password(SERVICE_NAME, "default_user", token)
            # Make sure we clean up the fallback file if we successfully used keyring
            _delete_fallback_token()
            return True
        except Exception:
            pass
            
    # Fallback
    _write_fallback_token(token)
    return False

def clear_token():
    """
    Clear the saved Personal Access Token.
    """
    if _is_keyring_available():
        try:
            keyring.delete_password(SERVICE_NAME, "default_user")
        except keyring.errors.PasswordDeleteError:
            pass
        except Exception:
            pass
            
    _delete_fallback_token()
