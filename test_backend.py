import pandas as pd
from core.reconciliation_service import reconcile_pair
import json

s_df = pd.read_csv("sample_data/batch_source_1.csv")
t_df = pd.read_csv("sample_data/batch_target_1.csv")

res = reconcile_pair(s_df, t_df, "s.csv", "t.csv", 20.0, 5, {})
print("TOP MERCHANTS:", res["summary"]["top_exception_merchants"])
print("BY DATE:", res["summary"]["exceptions_by_date"])
