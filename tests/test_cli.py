import pytest
from typer.testing import CliRunner
import respx
import httpx
from recon_cli.main import app

runner = CliRunner()

def test_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Recon Agent CLI" in result.stdout

@respx.mock
def test_whoami_unauthenticated(monkeypatch):
    # clear env and token
    monkeypatch.delenv("RECON_API_TOKEN", raising=False)
    from recon_cli.auth import _delete_fallback_token
    _delete_fallback_token()
    
    # Mock keyring to not work/be empty
    monkeypatch.setattr("keyring.get_password", lambda s, u: None)

    result = runner.invoke(app, ["whoami"])
    assert result.exit_code == 1
    assert "Not logged in" in result.stdout

@respx.mock
def test_whoami_authenticated(monkeypatch):
    monkeypatch.setenv("RECON_API_TOKEN", "ra_live_test_token")
    monkeypatch.setenv("RECON_API_URL", "http://testserver")

    # Mock the /auth/status endpoint
    respx.get("http://testserver/auth/status").mock(
        return_value=httpx.Response(200, json={
            "clerk_user_id": "user_test",
            "org_id": "org_test",
            "is_pat": True,
            "scopes": ["reconcile"]
        })
    )

    result = runner.invoke(app, ["whoami"])
    assert result.exit_code == 0
    assert "User ID: user_test" in result.stdout
    assert "Organization ID: org_test" in result.stdout

@respx.mock
def test_history_list(monkeypatch):
    monkeypatch.setenv("RECON_API_TOKEN", "ra_live_test_token")
    monkeypatch.setenv("RECON_API_URL", "http://testserver")

    respx.get("http://testserver/runs/?limit=20").mock(
        return_value=httpx.Response(200, json=[
            {
                "id": "run-12345",
                "type": "single",
                "status": "completed",
                "match_rate": 95.5,
                "exceptions_count": 5,
                "completed_at": "2024-01-01T12:00:00Z"
            }
        ])
    )

    result = runner.invoke(app, ["history"])
    assert result.exit_code == 0
    assert "run-1234" in result.stdout
    assert "95.5%" in result.stdout
    
@respx.mock
def test_history_json(monkeypatch):
    monkeypatch.setenv("RECON_API_TOKEN", "ra_live_test_token")
    monkeypatch.setenv("RECON_API_URL", "http://testserver")

    respx.get("http://testserver/runs/?limit=20").mock(
        return_value=httpx.Response(200, json=[{"id": "run-json"}])
    )

    result = runner.invoke(app, ["--json", "history"])
    assert result.exit_code == 0
    import json
    data = json.loads(result.stdout)
    assert data[0]["id"] == "run-json"

@respx.mock
def test_explain(monkeypatch):
    monkeypatch.setenv("RECON_API_TOKEN", "ra_live_test_token")
    monkeypatch.setenv("RECON_API_URL", "http://testserver")

    respx.get("http://testserver/runs/run-123").mock(
        return_value=httpx.Response(200, json={"id": "run-123", "status": "completed"})
    )

    respx.post("http://testserver/explain/").mock(
        return_value=httpx.Response(200, json={"job_id": "job-123"})
    )
    
    respx.get("http://testserver/explain/job-123/status").mock(
        return_value=httpx.Response(200, json={
            "status": "completed",
            "response_data": {
                "headline": "Test Explanation",
                "status": "OK",
                "summary": "This is a summary",
                "key_findings": ["Finding 1"],
                "financial_impact": "None",
                "attention_items": [],
                "recommended_actions": []
            }
        })
    )

    result = runner.invoke(app, ["explain", "run-123"])
    assert result.exit_code == 0
    assert "Test Explanation" in result.stdout
    assert "Finding 1" in result.stdout
