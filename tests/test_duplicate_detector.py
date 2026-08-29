import pandas as pd
from core.duplicate_detector import detect_duplicates

def test_no_duplicates():
    df = pd.DataFrame({
        "id": ["1", "2"],
        "amount": [10.0, 20.0],
        "party": ["A", "B"],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-02")]
    })
    res = detect_duplicates(df)
    assert len(res) == 0

def test_exact_duplicate():
    df = pd.DataFrame({
        "id": ["1", "2"],
        "amount": [10.0, 10.0],
        "party": ["A", "A"],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01")]
    })
    res = detect_duplicates(df)
    assert len(res) == 1
    assert res[0]["occurrences"] == 2
    assert res[0]["row_ids"] == ["1", "2"]
    assert res[0]["party"] == "A"

def test_three_duplicates():
    df = pd.DataFrame({
        "id": ["1", "2", "3"],
        "amount": [10.0, 10.0, 10.0],
        "party": ["A", "a", "A"], # Should be case-insensitive but preserve first case
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01")]
    })
    res = detect_duplicates(df)
    assert len(res) == 1
    assert res[0]["occurrences"] == 3
    assert res[0]["row_ids"] == ["1", "2", "3"]
    assert res[0]["party"] == "A"

def test_different_merchant():
    df = pd.DataFrame({
        "id": ["1", "2"],
        "amount": [10.0, 10.0],
        "party": ["A", "B"],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01")]
    })
    res = detect_duplicates(df)
    assert len(res) == 0

def test_different_amount():
    df = pd.DataFrame({
        "id": ["1", "2"],
        "amount": [10.0, 11.0],
        "party": ["A", "A"],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01")]
    })
    res = detect_duplicates(df)
    assert len(res) == 0

def test_different_date():
    df = pd.DataFrame({
        "id": ["1", "2"],
        "amount": [10.0, 10.0],
        "party": ["A", "A"],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-02")]
    })
    res = detect_duplicates(df)
    assert len(res) == 0

def test_missing_key_data():
    # Should exclude rows missing party, amount, or date
    df = pd.DataFrame({
        "id": ["1", "2", "3", "4", "5"],
        "amount": [10.0, 10.0, None, 10.0, 10.0],
        "party": ["A", "A", "A", "", None],
        "date": [pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01"), pd.Timestamp("2023-01-01")]
    })
    res = detect_duplicates(df)
    # Only row 1 and 2 are fully valid and identical
    assert len(res) == 1
    assert res[0]["occurrences"] == 2
    assert res[0]["row_ids"] == ["1", "2"]
