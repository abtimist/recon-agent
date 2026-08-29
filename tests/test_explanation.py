import pytest
import json
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from api.main import app
from core.explanation_service import explain_single_result, explain_batch_result, CFOExplanationResponse

client = TestClient(app)

# Helper mock for OpenAI client
def _mock_openai_response(content: str):
    mock_choice = MagicMock()
    mock_choice.message.content = content
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]
    return mock_response

def test_explain_single_result_provider_none():
    """Test that provider = 'none' raises an immediate error."""
    import pytest
    with pytest.raises(ValueError, match="AI Explanation unavailable"):
        explain_single_result({"total_source_rows": 10}, {"provider": "none"})

@patch("openai.OpenAI")
def test_explain_single_result_valid(mock_openai):
    """Test valid single result explanation with standard metrics."""
    mock_client = mock_openai.return_value
    valid_json = '''
    {
      "headline": "Reconciliation Complete",
      "overall_status": "Healthy",
      "summary": "Everything matched perfectly.",
      "key_findings": ["100% match rate."],
      "financial_impact": "None.",
      "attention_items": [],
      "recommended_actions": []
    }
    '''
    mock_client.chat.completions.create.return_value = _mock_openai_response(valid_json)
    
    result_data = {
        "total_source_rows": 100,
        "total_matched": 95,
        "match_rate": 95.0,
        "exception_report": [
            {"id": f"ex_{i}", "amount": i} for i in range(25)
        ]
    }
    
    res = explain_single_result(result_data, {"provider": "groq", "api_key": "test"})
    assert res.overall_status == "Healthy"
    assert res.headline == "Reconciliation Complete"
    
    # Verify input was NOT mutated
    assert len(result_data["exception_report"]) == 25
    
    # Verify payload was capped (only 15 exceptions sent in the prompt)
    call_args = mock_client.chat.completions.create.call_args
    prompt_content = call_args.kwargs["messages"][1]["content"]
    payload_sent = json.loads(prompt_content.split("Reconciliation Result Payload:\n")[1].split("\n\nGenerate")[0])
    
    assert len(payload_sent["capped_exception_sample"]) == 15
    assert payload_sent["metrics"]["total_source_rows"] == 100
    # No raw CSV sent
    assert "source_csv" not in payload_sent
    assert "target_csv" not in payload_sent

@patch("openai.OpenAI")
def test_explain_batch_result_failed_runs_and_zero_tx(mock_openai):
    """Test batch explanation handles failed runs and zero transactions properly."""
    mock_client = mock_openai.return_value
    valid_json = '''
    {
      "headline": "Batch Complete",
      "overall_status": "Needs Review",
      "summary": "Some failed.",
      "key_findings": ["Failed run detected."],
      "financial_impact": "Unknown.",
      "attention_items": ["Review failed run"],
      "recommended_actions": []
    }
    '''
    mock_client.chat.completions.create.return_value = _mock_openai_response(valid_json)
    
    batch_data = {
        "summary": {"total_transactions": 0},
        "runs": [
            {"status": "failed", "error": "Bad file", "source_filename": "bad.csv"},
            {"status": "completed", "source_filename": "good.csv", "result": {"total_source_rows": 0, "exceptions_count": 0}}
        ]
    }
    
    res = explain_batch_result(batch_data, {"provider": "openai", "api_key": "test"})
    assert res.overall_status == "Needs Review"
    
    call_args = mock_client.chat.completions.create.call_args
    prompt_content = call_args.kwargs["messages"][1]["content"]
    payload_sent = json.loads(prompt_content.split("Reconciliation Result Payload:\n")[1].split("\n\nGenerate")[0])
    
    # Check that failed runs are prioritized (sorted first in the capped sample)
    assert payload_sent["notable_runs_sample"][0]["status"] == "failed"
    assert payload_sent["notable_runs_sample"][0]["source_filename"] == "bad.csv"
    assert payload_sent["notable_runs_sample"][1]["status"] == "completed"

@patch("openai.OpenAI")
def test_explain_malformed_json(mock_openai):
    """Test that malformed JSON is caught and raised as a safe ValueError."""
    mock_client = mock_openai.return_value
    # Missing quotes around Healthy
    invalid_json = '{"headline": "Test", "overall_status": Healthy}'
    mock_client.chat.completions.create.return_value = _mock_openai_response(invalid_json)
    
    import pytest
    with pytest.raises(ValueError, match="invalid JSON"):
        explain_single_result({}, {"provider": "openai", "api_key": "test"})

@patch("openai.OpenAI")
def test_explain_invalid_structure(mock_openai):
    """Test that missing required Pydantic fields throws a ValueError."""
    mock_client = mock_openai.return_value
    # Missing recommended_actions
    missing_fields_json = '''
    {
      "headline": "Test",
      "overall_status": "Healthy",
      "summary": "Summary",
      "key_findings": [],
      "financial_impact": "None",
      "attention_items": []
    }
    '''
    mock_client.chat.completions.create.return_value = _mock_openai_response(missing_fields_json)
    
    import pytest
    with pytest.raises(ValueError, match="did not match the expected CFO structure"):
        explain_single_result({}, {"provider": "openai", "api_key": "test"})

def test_explain_endpoint_auth_required():
    """Verify endpoint is protected."""
    response = client.post("/explain", json={"type": "single", "result": {}})
    # Expect 422 Unprocessable Content because get_current_user requires an Authorization header
    assert response.status_code == 422
