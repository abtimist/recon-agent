"""
Real-world CSVs from different gateways/banks never use the same column
names (one might call it "txn_id", another "Reference Number", another
"Transaction Ref"). There's no universal standard, so this module lets a
user map their own columns to a fixed internal schema, with best-effort
auto-suggestions so most of the time they don't have to think about it.

Internal standard schema used everywhere else in the pipeline:
    id       - unique transaction/reference identifier
    party    - merchant / payee / counterparty name  (OPTIONAL — can be None)
    amount   - the money value (may be derived from debit/credit column pair)
    date     - the relevant date (transaction date or settlement date)

Amount modes
------------
  "single"       — one column already has the signed net amount
  "debit_credit" — two separate Debit / Credit columns; amount = credit − debit

Party is optional because some bank statement formats carry no useful
counterparty label; in that case we fall back to amount+date matching only.
"""

import pandas as pd

# Fields the rest of the pipeline always expects to see in the DataFrame
REQUIRED_FIELDS = ["id", "amount", "date"]
OPTIONAL_FIELDS = ["party"]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

# best-effort keyword hints for auto-suggesting a mapping, checked in order
FIELD_HINTS = {
    "id": [
        "transaction_id", "txn_id", "reference", "ref_no", "ref",
        "utr", "rrn", "order_id", "payment_id", "id",
    ],
    "party": [
        "merchant", "payee", "party", "name", "vendor",
        "counterparty", "beneficiary", "narration", "description", "particulars",
    ],
    "amount": [
        "amount", "credited", "credit", "net_amount", "value",
        "sum", "total", "transaction_amount",
    ],
    "date": [
        "date", "settlement", "timestamp", "time", "txn_date",
        "transaction_date", "created_at", "settled_at",
    ],
    # debit/credit split — only used in "debit_credit" amount mode
    "debit_col":  ["debit", "dr", "withdrawal", "withdraw", "paid_out"],
    "credit_col": ["credit", "cr", "deposit",   "deposited", "paid_in"],
}

# Sentinel value the UI uses to mean "user didn't choose anything"
_NO_SELECT = "-- select column --"
_NO_PARTY  = "-- none (match without party) --"


def suggest_mapping(columns: list) -> dict:
    """
    Given a list of raw column names from an uploaded CSV, guess which
    column corresponds to each required field.  Returns {field: column_name
    or None}.  This is just a starting point for the user to confirm/correct
    — never trusted blindly.
    """
    suggestions: dict[str, str | None] = {}
    lowered = {c: c.lower().replace(" ", "_").replace("-", "_") for c in columns}

    for field, hints in FIELD_HINTS.items():
        match = None
        for col, low in lowered.items():
            if any(hint in low for hint in hints):
                match = col
                break
        suggestions[field] = match

    return suggestions


def apply_mapping(
    df: pd.DataFrame,
    mapping: dict,
    amount_mode: str = "single",
) -> tuple[pd.DataFrame, int]:
    """
    Rename / compute columns according to the user-confirmed mapping and
    return (standardized_df, n_bad_rows_dropped).

    amount_mode:
        "single"       — mapping["amount"] points to the net amount column
        "debit_credit" — mapping["debit_col"] and mapping["credit_col"] are
                         combined as (credit − debit) → amount

    The party field is optional.  Pass mapping["party"] = None or omit it
    to get a "party" column filled with empty strings (the matcher handles
    that gracefully by skipping name-similarity scoring).

    Raises ValueError if any required field (id, date, amount/debit+credit)
    is missing from the mapping.
    """
    df = df.copy()

    # -----------------------------------------------------------------------
    # Amount column resolution
    # -----------------------------------------------------------------------
    if amount_mode == "debit_credit":
        debit_col  = mapping.get("debit_col")
        credit_col = mapping.get("credit_col")
        if not debit_col or not credit_col:
            raise ValueError(
                "Amount mode is 'Debit / Credit columns' but debit or credit "
                "column was not selected."
            )
        debit  = _to_numeric(df[debit_col]).fillna(0)
        credit = _to_numeric(df[credit_col]).fillna(0)
        df["_computed_amount"] = credit - debit
        amount_src = "_computed_amount"
    else:
        amount_src = mapping.get("amount")
        if not amount_src or amount_src == _NO_SELECT:
            raise ValueError("Missing required column mapping for: amount")

    # -----------------------------------------------------------------------
    # Required fields check
    # -----------------------------------------------------------------------
    missing = []
    if not mapping.get("id") or mapping["id"] == _NO_SELECT:
        missing.append("id")
    if not mapping.get("date") or mapping["date"] == _NO_SELECT:
        missing.append("date")
    if missing:
        raise ValueError(f"Missing required column mapping for: {', '.join(missing)}")

    # -----------------------------------------------------------------------
    # Build standardized DataFrame
    # -----------------------------------------------------------------------
    party_col = mapping.get("party")
    has_party = party_col and party_col not in (_NO_SELECT, _NO_PARTY, None)

    col_map = {
        mapping["id"]:   "id",
        mapping["date"]: "date",
        amount_src:      "amount",
    }
    if has_party:
        col_map[party_col] = "party"

    standardized = df.rename(columns=col_map)[list(col_map.values())].copy()

    if "party" not in standardized.columns:
        standardized["party"] = ""   # empty → matcher skips name scoring

    # Reorder to canonical order
    standardized = standardized[["id", "party", "amount", "date"]]

    # -----------------------------------------------------------------------
    # Type normalisation — real-world CSVs are messy
    # -----------------------------------------------------------------------
    standardized["amount"] = _to_numeric(standardized["amount"])
    standardized["date"]   = pd.to_datetime(standardized["date"], errors="coerce")
    standardized["id"]     = standardized["id"].astype(str).str.strip()
    standardized["party"]  = standardized["party"].astype(str).str.strip()

    bad_rows = standardized[standardized["amount"].isna() | standardized["date"].isna()]
    n_bad = len(bad_rows)
    if n_bad:
        standardized = standardized.dropna(subset=["amount", "date"])

    return standardized.reset_index(drop=True), n_bad


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _to_numeric(series: pd.Series) -> pd.Series:
    """Strip currency symbols, spaces, commas etc. then coerce to float."""
    return pd.to_numeric(
        series.astype(str).str.replace(r"[^\d.\-]", "", regex=True),
        errors="coerce",
    )
