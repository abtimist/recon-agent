"""
CLI usage:
    python cli.py source.csv target.csv [options]

Options:
    --provider  gemini | groq | openai | ollama | none   (default: groq)
    --api-key   your API key (or set GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)
    --model     override the default model for the chosen provider
    --base-url  override base URL (useful for custom Ollama or self-hosted endpoints)
    --no-ai     skip AI resolution entirely (same as --provider none)
    --out       path for the exception report CSV (default: exception_report.csv)

Supports CSV, TSV, XLSX, and XLS input files.
Handles encoding detection and junk header rows automatically.
"""

import argparse
import os
import sys

import pandas as pd

from core.ai_resolver import PROVIDERS, resolve_all
from core.column_mapper import ALL_FIELDS, _NO_PARTY, suggest_mapping, apply_mapping
from core.file_reader import read_file
from core.matcher import exact_match, fuzzy_match


# ---------------------------------------------------------------------------
# Interactive mapping prompt
# ---------------------------------------------------------------------------

def _ask_mapping(df: pd.DataFrame, label: str) -> tuple[dict, str]:
    """
    Interactively ask the user to confirm/correct column mappings for one file.
    Returns (mapping_dict, amount_mode).
    """
    columns    = list(df.columns)
    suggestions = suggest_mapping(columns)

    print(f"\nColumns in {label}:")
    for i, col in enumerate(columns):
        print(f"  [{i}] {col}")

    mapping = {}
    print(f"\nMap columns for {label} (press Enter to accept suggestion):\n")

    # --- id ---
    _ask_field(mapping, "id", columns, suggestions)

    # --- party (optional) ---
    print("  party / merchant name  [optional — press Enter to skip]: ", end="")
    raw = input().strip()
    if raw == "":
        suggestion = suggestions.get("party")
        if suggestion and suggestion in columns:
            print(f"    → using suggested: {suggestion}")
            mapping["party"] = suggestion
        else:
            mapping["party"] = _NO_PARTY
    elif raw in columns:
        mapping["party"] = raw
    else:
        print(f"    '{raw}' not found — skipping party")
        mapping["party"] = _NO_PARTY

    # --- amount mode ---
    print("\n  Amount format:")
    print("    [1] Single amount column (default)")
    print("    [2] Separate Debit / Credit columns")
    choice = input("  Choose [1/2]: ").strip()
    if choice == "2":
        amount_mode = "debit_credit"
        _ask_field(mapping, "debit_col",  columns, suggestions, label="debit column")
        _ask_field(mapping, "credit_col", columns, suggestions, label="credit column")
    else:
        amount_mode = "single"
        _ask_field(mapping, "amount", columns, suggestions)

    # --- date ---
    _ask_field(mapping, "date", columns, suggestions)

    return mapping, amount_mode


def _ask_field(mapping: dict, field: str, columns: list, suggestions: dict,
               label: str | None = None) -> None:
    """Prompt for one field, looping until a valid column name is entered."""
    display    = label or field
    suggestion = suggestions.get(field)
    hint       = f" [{suggestion}]" if suggestion else ""

    while True:
        print(f"  {display}{hint}: ", end="")
        raw = input().strip()
        chosen = raw if raw else suggestion

        if chosen and chosen in columns:
            mapping[field] = chosen
            if not raw and suggestion:
                print(f"    → using suggested: {suggestion}")
            return
        elif not chosen:
            print(f"    No suggestion available — please type the column name.")
        else:
            print(f"    '{chosen}' is not a column in this file. "
                  f"Available: {columns}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(args: argparse.Namespace) -> None:
    # --- load files ---
    print(f"\nReading source file: {args.source}")
    with open(args.source, "rb") as f:
        # Monkey-patch a .name attribute so read_file can detect extension
        f.name = args.source  # type: ignore[attr-defined]  # works on real files
        source_df_raw = read_file(f)

    print(f"Reading target file: {args.target}")
    with open(args.target, "rb") as f:
        f.name = args.target  # type: ignore[attr-defined]
        target_df_raw = read_file(f)

    print(f"Source: {len(source_df_raw)} rows, {len(source_df_raw.columns)} columns")
    print(f"Target: {len(target_df_raw)} rows, {len(target_df_raw.columns)} columns")

    # --- column mapping ---
    source_mapping, source_mode = _ask_mapping(source_df_raw, "source file")
    target_mapping, target_mode = _ask_mapping(target_df_raw, "target file")

    try:
        source_df, src_bad = apply_mapping(source_df_raw, source_mapping, amount_mode=source_mode)
        target_df, tgt_bad = apply_mapping(target_df_raw, target_mapping, amount_mode=target_mode)
    except ValueError as e:
        print(f"\nError in column mapping: {e}")
        sys.exit(1)

    if src_bad or tgt_bad:
        print(f"\nWarning: skipped {src_bad} source row(s) and {tgt_bad} target row(s) "
              f"with unparseable amount/date values.")

    total_source = len(source_df)
    print(f"\nSource after mapping: {total_source} rows")
    print(f"Target after mapping: {len(target_df)} rows")

    # --- matching ---
    print("\nRunning exact + fuzzy matching…")
    exact_m, unmatched_src, unmatched_tgt = exact_match(source_df, target_df)
    fuzzy_m, still_src, still_tgt, ambiguous = fuzzy_match(unmatched_src, unmatched_tgt)

    print(f"  Exact ID matches:        {len(exact_m)}")
    print(f"  Fuzzy matches:           {len(fuzzy_m)}")
    print(f"  Ambiguous (for AI):      {len(ambiguous)}")

    # --- AI resolution ---
    ai_config = _build_ai_config(args)

    ai_results = []
    if ambiguous:
        provider_label = PROVIDERS.get(ai_config["provider"], {}).get("label", ai_config["provider"])
        print(f"\nResolving {len(ambiguous)} ambiguous pair(s) with {provider_label}…")
        ai_results = resolve_all(ambiguous, ai_config=ai_config)

    ai_confirmed = [r for r in ai_results if r["decision"]["is_match"]]
    ai_rejected  = [r for r in ai_results if not r["decision"]["is_match"]]
    print(f"  AI confirmed:            {len(ai_confirmed)}")
    print(f"  AI rejected (exception): {len(ai_rejected)}")

    # --- summary ---
    total_matched = len(exact_m) + len(fuzzy_m) + len(ai_confirmed)
    accuracy      = round(100 * total_matched / total_source, 2) if total_source else 0.0
    print(f"\n{'─' * 40}")
    print(f"Total source records:  {total_source}")
    print(f"Matched:               {total_matched}")
    print(f"Match rate:            {accuracy}%")
    print(f"Exceptions:            {total_source - total_matched + len(still_tgt)}")
    print(f"{'─' * 40}")

    # --- exception report ---
    exceptions = []
    for _, row in still_src.iterrows():
        exceptions.append({
            "type":   "missing_target_record",
            "id":     row["id"],
            "party":  row.get("party", ""),
            "amount": row["amount"],
            "reason": "No plausible match found within tolerance/date window",
        })
    for r in ai_rejected:
        exceptions.append({
            "type":   "ai_rejected_ambiguous_match",
            "id":     r["source_row"]["id"],
            "party":  r["source_row"].get("party", ""),
            "amount": r["source_row"]["amount"],
            "reason": r["decision"]["reason"],
        })
    for _, row in still_tgt.iterrows():
        exceptions.append({
            "type":   "stray_target_record",
            "id":     row["id"],
            "party":  row.get("party", ""),
            "amount": row["amount"],
            "reason": "Target record with no corresponding source record",
        })

    out_path = args.out
    pd.DataFrame(exceptions).to_csv(out_path, index=False)
    print(f"\nException report written → {out_path}  ({len(exceptions)} rows)")


def _build_ai_config(args: argparse.Namespace) -> dict:
    """Build the ai_config dict from CLI args + env vars."""
    provider = "none" if args.no_ai else args.provider
    meta     = PROVIDERS.get(provider, PROVIDERS["groq"])

    api_key = args.api_key or (
        os.environ.get(meta["key_env"] or "", "") if meta["key_env"] else ""
    )
    base_url = args.base_url or meta["base_url"]
    model    = args.model    or meta["model"]

    return {
        "provider": provider,
        "api_key":  api_key,
        "model":    model,
        "base_url": base_url,
    }


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reconcile two transaction files (CSV / TSV / XLSX).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("source", help="Source file path (CSV/XLSX)")
    parser.add_argument("target", help="Target file path (CSV/XLSX)")

    ai_group = parser.add_argument_group("AI resolver")
    ai_group.add_argument(
        "--provider",
        choices=list(PROVIDERS.keys()),
        default="groq",
        help="AI provider to use for ambiguous cases (default: groq)",
    )
    ai_group.add_argument(
        "--api-key",
        default="",
        help="API key (alternative: set GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY env var)",
    )
    ai_group.add_argument(
        "--model",
        default="",
        help="Override the default model for the chosen provider",
    )
    ai_group.add_argument(
        "--base-url",
        default="",
        help="Override provider base URL (useful for custom Ollama or self-hosted endpoints)",
    )
    ai_group.add_argument(
        "--no-ai",
        action="store_true",
        help="Skip AI resolution; flag all ambiguous cases as exceptions",
    )

    parser.add_argument(
        "--out",
        default="exception_report.csv",
        help="Output path for the exception report (default: exception_report.csv)",
    )

    args = parser.parse_args()
    run_pipeline(args)


if __name__ == "__main__":
    main()
