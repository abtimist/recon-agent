import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

from core.matcher import fuzzy_match
from tests.naive_matcher import naive_fuzzy_match

def generate_random_df(n_rows: int, has_party: bool = True) -> pd.DataFrame:
    base_date = datetime(2023, 1, 1)
    
    data = []
    for i in range(n_rows):
        # some random date within a 30-day window
        r_days = random.randint(0, 30)
        d = base_date + timedelta(days=r_days)
        
        amt = round(random.uniform(10.0, 1000.0), 2)
        party = f"Merchant_{random.randint(1, 20)}" if has_party else ""
        
        data.append({
            "id": f"id_{i}",
            "date": d.strftime("%Y-%m-%d"),
            "amount": amt,
            "party": party
        })
        
    return pd.DataFrame(data)

@pytest.mark.parametrize("has_party", [True, False])
def test_fuzzy_match_regression(has_party):
    """
    Generate random datasets and ensure optimized fuzzy_match 
    produces the same number of matched and ambiguous pairs as the naive approach.
    """
    random.seed(42)
    np.random.seed(42)
    
    # Generate source and target datasets
    src_df = generate_random_df(100, has_party=has_party)
    tgt_df = generate_random_df(100, has_party=has_party)
    
    # Introduce some guaranteed fuzzy matches (same amount, slightly off date, slightly off name)
    for i in range(10):
        src_df.at[i, "amount"] = 150.00
        tgt_df.at[i, "amount"] = 150.00
        
        d = datetime(2023, 1, 15)
        src_df.at[i, "date"] = d.strftime("%Y-%m-%d")
        tgt_df.at[i, "date"] = (d + timedelta(days=2)).strftime("%Y-%m-%d")
        
        if has_party:
            src_df.at[i, "party"] = f"Starbucks Store {i}"
            tgt_df.at[i, "party"] = f"Starbucks {i}"
            
    # Introduce some ambiguous matches
    for i in range(10, 15):
        src_df.at[i, "amount"] = 250.00
        tgt_df.at[i, "amount"] = 250.00
        
        d = datetime(2023, 1, 20)
        src_df.at[i, "date"] = d.strftime("%Y-%m-%d")
        tgt_df.at[i, "date"] = d.strftime("%Y-%m-%d")
        
        if has_party:
            src_df.at[i, "party"] = f"Amazon {i}"
            tgt_df.at[i, "party"] = f"Amzn Mktp {i}"  # Should score between 60-85
            
    opt_matched, opt_unmatched_src, opt_unmatched_tgt, opt_ambiguous = fuzzy_match(
        src_df.copy(), tgt_df.copy(), amount_tolerance=20.0, date_window_days=5
    )
    
    naive_matched, naive_unmatched_src, naive_unmatched_tgt, naive_ambiguous = naive_fuzzy_match(
        src_df.copy(), tgt_df.copy(), amount_tolerance=20.0, date_window_days=5
    )
    
    assert len(opt_matched) == len(naive_matched), "Mismatched length of matched rows"
    assert len(opt_ambiguous) == len(naive_ambiguous), "Mismatched length of ambiguous rows"
    assert len(opt_unmatched_src) == len(naive_unmatched_src), "Mismatched length of unmatched source"
    assert len(opt_unmatched_tgt) == len(naive_unmatched_tgt), "Mismatched length of unmatched target"

    # Further assert that exactly the same source IDs got matched
    opt_matched_src_ids = set(opt_matched["id_source"]) if not opt_matched.empty else set()
    naive_matched_src_ids = set(naive_matched["id_source"]) if not naive_matched.empty else set()
    assert opt_matched_src_ids == naive_matched_src_ids
