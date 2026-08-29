import httpx
from typing import Optional, Any, Dict
from recon_cli.config import get_api_url
from recon_cli.auth import get_token

class ReconAPIError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, data: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.data = data

def _get_headers() -> Dict[str, str]:
    token = get_token()
    if not token:
        raise ReconAPIError("Not authenticated. Please run 'recon login' first.")
    return {
        "Authorization": f"Bearer {token}"
    }

def _handle_response(response: httpx.Response) -> Any:
    try:
        response.raise_for_status()
        if response.status_code == 204:
            return None
        return response.json()
    except httpx.HTTPStatusError as e:
        detail = "Unknown error"
        try:
            data = e.response.json()
            if isinstance(data, dict) and "detail" in data:
                detail = data["detail"]
        except Exception:
            detail = e.response.text
            
        if e.response.status_code == 401:
            raise ReconAPIError(
                f"Authentication failed (401). Your token may be invalid or revoked. Detail: {detail}",
                status_code=401
            )
        elif e.response.status_code == 403:
            raise ReconAPIError(
                f"Permission denied (403). You do not have access to this resource. Detail: {detail}",
                status_code=403
            )
        elif e.response.status_code == 404:
            raise ReconAPIError(
                f"Not found (404). Detail: {detail}",
                status_code=404
            )
        else:
            raise ReconAPIError(
                f"API Error ({e.response.status_code}): {detail}",
                status_code=e.response.status_code
            )
    except httpx.RequestError as e:
        raise ReconAPIError(f"Network error while connecting to API: {str(e)}")

def get_client() -> httpx.Client:
    """Returns an authenticated httpx client configured with the base URL."""
    base_url = get_api_url()
    try:
        headers = _get_headers()
    except ReconAPIError:
        # If we just want a client without auth (e.g. for login check), 
        # we can handle that separately, but for now most commands need auth.
        headers = {}
    
    return httpx.Client(
        base_url=base_url,
        headers=headers,
        timeout=30.0
    )

def api_get(endpoint: str, params: Optional[Dict] = None) -> Any:
    base_url = get_api_url()
    headers = _get_headers()
    try:
        with httpx.Client(base_url=base_url, headers=headers, timeout=30.0) as client:
            response = client.get(endpoint, params=params)
            return _handle_response(response)
    except httpx.RequestError as e:
        raise ReconAPIError(f"Network error while connecting to API: {str(e)}")

def api_post(endpoint: str, json: Optional[Dict] = None, data: Optional[Dict] = None, files: Optional[Dict] = None, timeout: float = 30.0) -> Any:
    base_url = get_api_url()
    headers = _get_headers()
    try:
        with httpx.Client(base_url=base_url, headers=headers, timeout=timeout) as client:
            response = client.post(endpoint, json=json, data=data, files=files)
            return _handle_response(response)
    except httpx.RequestError as e:
        raise ReconAPIError(f"Network error while connecting to API: {str(e)}")

def api_delete(endpoint: str) -> Any:
    base_url = get_api_url()
    headers = _get_headers()
    try:
        with httpx.Client(base_url=base_url, headers=headers, timeout=30.0) as client:
            response = client.delete(endpoint)
            return _handle_response(response)
    except httpx.RequestError as e:
        raise ReconAPIError(f"Network error while connecting to API: {str(e)}")
