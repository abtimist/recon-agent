import pandas as pd

def detect_duplicates(df: pd.DataFrame) -> list[dict]:
    """
    Find duplicate groups within a normalized DataFrame.
    A row is only considered if it has valid values for amount, date, and party.
    Returns a list of dicts describing the duplicates.
    """
    if df.empty:
        return []

    # Make a copy to avoid mutating the original
    working_df = df.copy()

    # Ensure correct types and handle missing values
    # Missing date/amount are dropped.
    working_df = working_df.dropna(subset=['amount', 'date'])
    
    # Missing or empty party strings -> drop
    working_df['party'] = working_df['party'].astype(str).str.strip()
    working_df = working_df[working_df['party'] != ""]

    if working_df.empty:
        return []

    # Convert party to lowercase for insensitive grouping
    working_df['party_lower'] = working_df['party'].str.lower()
    
    # We group by the tuple (amount, party_lower, date)
    grouped = working_df.groupby(["amount", "party_lower", "date"])
    
    duplicates = []
    for (amount, party_lower, date_val), group in grouped:
        if len(group) > 1:
            # We want to use the original casing for presentation, so grab the first one
            display_party = group.iloc[0]['party']
            duplicates.append({
                "amount": float(amount),
                "party": display_party,
                "date": str(date_val.date()) if hasattr(date_val, "date") else str(date_val),
                "occurrences": len(group),
                "row_ids": group["id"].tolist()
            })
            
    return duplicates
