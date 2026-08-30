import time
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

from core.matcher import fuzzy_match, _has_party

def generate_random_df(n_rows: int) -> pd.DataFrame:
    base_date = datetime(2023, 1, 1)
    data = []
    for i in range(n_rows):
        r_days = random.randint(0, 30)
        d = base_date + timedelta(days=r_days)
        amt = round(random.uniform(10.0, 1000.0), 2)
        party = f"Merchant_{random.randint(1, 1000)}"
        data.append({
            "id": f"id_{i}",
            "date": d.strftime("%Y-%m-%d"),
            "amount": amt,
            "party": party
        })
    return pd.DataFrame(data)

def test_benchmark():
    sizes = [1000, 5000, 10000, 25000]
    
    print("Row Count | Map-Reduce (s) | Matches | Ambiguous | Unmatched")
    print("-" * 65)
    
    for size in sizes:
        src = generate_random_df(size)
        tgt = generate_random_df(size)
        
        # We need to simulate some matches otherwise it's just rejecting everything quickly
        # Let's make 20% guaranteed exact amount + date matches but fuzzy names
        for i in range(int(size * 0.2)):
            src.at[i, "amount"] = 500.00
            tgt.at[i, "amount"] = 500.00
            src.at[i, "date"] = "2023-01-15"
            tgt.at[i, "date"] = "2023-01-15"
            src.at[i, "party"] = f"Starbucks {i}"
            tgt.at[i, "party"] = f"Starbucks Store {i}"

        start = time.time()
        # fuzzy_match will automatically use sequential if <= 1000 and map-reduce if > 1000
        matched, un_src, un_tgt, ambig = fuzzy_match(
            src.copy(), tgt.copy(), amount_tolerance=20.0, date_window_days=5
        )
        end = time.time()
        
        print(f"{size:<9} | {end-start:<14.2f} | {len(matched):<7} | {len(ambig):<9} | {len(un_src)}")

if __name__ == "__main__":
    test_benchmark()
