import pandas as pd
from core.reconciliation_service import reconcile_pair

def test_reconcile_pair_integration():
    # Provide mapped data that already contains 'id', 'amount', 'date' columns
    # which is what reconcile_pair expects.
    s_df = pd.DataFrame({
        "id": ["S1", "S2"],
        "date": ["2026-08-20", "2026-08-21"],
        "amount": [100.0, 200.0],
        "party": ["Merchant A", "Merchant B"],
        "__source_row_index": [0, 1]
    })
    
    t_df = pd.DataFrame({
        "id": ["T1", "T2"],
        "date": ["2026-08-20", "2026-08-21"],
        "amount": [100.0, 200.0],
        "party": ["Merchant A", "Merchant B"],
        "__source_row_index": [0, 1]
    })

    # Call the reconciliation engine with mocked DataFrames and 'none' AI provider
    res = reconcile_pair(s_df, t_df, "source_mapped.csv", "target_mapped.csv", amount_tolerance=0.0, date_window_days=0, ai_config={"provider": "none"})
    
    # Assert expected output structure
    assert "summary" in res
    assert "exceptions_by_date" in res["summary"]
    assert "top_exception_merchants" in res["summary"]
    assert res["total_source_rows"] == 2
    assert res["total_matched"] == 2
    assert res["exceptions_count"] == 0
