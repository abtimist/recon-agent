import requests
import json

with open("sample_data/batch_source_1.csv", "rb") as f_src, open("sample_data/batch_target_1.csv", "rb") as f_tgt:
    res = requests.post(
        "http://localhost:8000/reconcile", 
        files={"source_file": f_src, "target_file": f_tgt},
        data={"amount_tolerance": "20", "date_window_days": "5", "ai_provider": "none"}
    )
    data = res.json()
    if res.status_code == 200:
        print("SUMMARY KEYS:", data.get("summary", {}).keys())
        print("TOP MERCHANTS:", data.get("summary", {}).get("top_exception_merchants"))
    else:
        print("ERROR:", res.status_code, data)
