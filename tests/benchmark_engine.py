import time
import os
import psutil
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

from core.matcher import fuzzy_match

def get_memory_usage():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / 1024 / 1024  # in MB

def generate_scenario_df(n_rows: int, scenario: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generates a source and target dataframe of size n_rows based on the scenario.
    """
    base_date = datetime(2023, 1, 1)
    
    src_data = []
    tgt_data = []
    
    for i in range(n_rows):
        r_days = random.randint(0, 30)
        d = base_date + timedelta(days=r_days)
        amt = round(random.uniform(10.0, 1000.0), 2)
        party_base = f"Merchant_{random.randint(1, 1000)}"
        
        # Source Row
        src_row = {
            "id": f"src_{i}",
            "date": d.strftime("%Y-%m-%d"),
            "amount": amt,
            "party": party_base
        }
        
        # Target Row depends on scenario
        if scenario == "exact":
            tgt_row = {
                "id": f"tgt_{i}", # ID is different so exact match fails, forces fuzzy
                "date": d.strftime("%Y-%m-%d"),
                "amount": amt,
                "party": party_base
            }
        elif scenario == "unmatched":
            # completely different amount and date
            tgt_row = {
                "id": f"tgt_{i}",
                "date": (d + timedelta(days=100)).strftime("%Y-%m-%d"),
                "amount": amt + 5000.0,
                "party": party_base + "_different"
            }
        elif scenario == "fuzzy":
            # slight variation in amount, date, and party
            tgt_row = {
                "id": f"tgt_{i}",
                "date": (d + timedelta(days=random.randint(1, 4))).strftime("%Y-%m-%d"),
                "amount": amt + round(random.uniform(-5.0, 5.0), 2),
                "party": party_base[:len(party_base)-2] + " Inc"
            }
        elif scenario == "duplicates":
            # many rows with the exact same amount and date
            d = base_date
            amt = 50.00
            src_row["date"] = d.strftime("%Y-%m-%d")
            src_row["amount"] = amt
            tgt_row = {
                "id": f"tgt_{i}",
                "date": d.strftime("%Y-%m-%d"),
                "amount": amt,
                "party": party_base
            }
        else:
            tgt_row = src_row.copy()
            
        src_data.append(src_row)
        tgt_data.append(tgt_row)
        
    # shuffle target data so they aren't in the same order
    random.shuffle(tgt_data)
    
    return pd.DataFrame(src_data), pd.DataFrame(tgt_data)

def run_benchmark(n_rows: int, scenario: str, tolerance: float = 20.0, window: int = 5):
    print(f"Benchmarking scenario: {scenario}, Rows: {n_rows}")
    src_df, tgt_df = generate_scenario_df(n_rows, scenario)
    
    mem_before = get_memory_usage()
    start_time = time.time()
    
    matched, un_src, un_tgt, ambiguous = fuzzy_match(
        src_df, tgt_df, amount_tolerance=tolerance, date_window_days=window
    )
    
    duration = time.time() - start_time
    mem_after = get_memory_usage()
    
    print(f"  Duration: {duration:.4f}s")
    print(f"  Memory increase: {mem_after - mem_before:.2f} MB")
    print(f"  Matched: {len(matched)}, Ambiguous: {len(ambiguous)}, Unmatched Src: {len(un_src)}")
    return duration

if __name__ == "__main__":
    random.seed(42)
    np.random.seed(42)
    
    print("=== SCALABILITY BENCHMARK ===")
    sizes = [1_000, 5_000, 10_000, 50_000, 100_000]
    for size in sizes:
        run_benchmark(size, "fuzzy")
        
    print("\n=== SCENARIO BENCHMARK (10k rows) ===")
    scenarios = ["exact", "unmatched", "fuzzy", "duplicates"]
    for s in scenarios:
        run_benchmark(10_000, s)
        
    print("\n=== TOLERANCE BENCHMARK (10k rows, fuzzy scenario) ===")
    print("Testing wider amount tolerance (100.0) and date window (15 days)")
    run_benchmark(10_000, "fuzzy", tolerance=100.0, window=15)
