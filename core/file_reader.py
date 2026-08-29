"""
Smart file reader for real-world bank/gateway exports.

Handles the four messiest problems with real CSV exports:
  1. Encoding  — banks often export Windows-1252 / latin-1, not UTF-8
  2. Junk rows — ICICI, Axis etc. add 3–8 metadata lines before the actual header
  3. Separator — some exports use tabs, semicolons, or pipes instead of commas
  4. Format    — XLSX/XLS is common from older banking portals

None of these are the user's fault; we deal with them silently and just read the data.
"""

import io
import re
import pandas as pd


# ---------------------------------------------------------------------------
# Encoding detection
# ---------------------------------------------------------------------------

_ENCODING_CANDIDATES = ("utf-8-sig", "utf-8", "latin-1", "cp1252", "iso-8859-1")


def _detect_encoding(raw: bytes) -> str:
    for enc in _ENCODING_CANDIDATES:
        try:
            raw.decode(enc)
            return enc
        except (UnicodeDecodeError, LookupError):
            continue
    return "latin-1"  # last resort — always works, may have ??? for exotic chars


# ---------------------------------------------------------------------------
# Header-row detection
# ---------------------------------------------------------------------------

def _looks_numeric(s: str) -> bool:
    """Return True if the string is a plain number, date-like, or pure whitespace."""
    s = s.strip()
    if not s:
        return True
    # pure number (possibly with commas, currency symbols, sign)
    if re.fullmatch(r"[\d,.\-\+\s₹$€£¥%]+", s):
        return True
    # common date patterns  01-08-2026  2026/08/01  01 Aug 2026
    if re.fullmatch(
        r"\d{1,4}[\-/\.]\w{1,4}[\-/\.]\d{2,4}"
        r"|\d{1,2}\s+\w{3,9}\s+\d{2,4}",
        s,
    ):
        return True
    return False


def _header_score(parts: list[str]) -> float:
    """
    Score a candidate header row. Higher = more header-like.
    A real header row should have mostly short, non-numeric text labels.
    """
    if len(parts) < 2:
        return 0.0
    str_count = sum(
        1 for p in parts
        if p.strip() and not _looks_numeric(p) and len(p.strip()) < 60
    )
    return str_count / len(parts)


def _find_header_row_csv(raw: bytes, encoding: str, sep: str, max_scan: int = 25) -> int:
    """
    Return the 0-based line index of the most likely header row in a CSV.
    Uses a sliding-window heuristic: header rows are all-string with the
    most columns; data rows have numbers.
    """
    text = raw.decode(encoding, errors="replace")
    lines = text.splitlines()

    best_row = 0
    best_score = -1.0
    best_col_count = 0

    for i, line in enumerate(lines[:max_scan]):
        parts = [p.strip().strip('"') for p in line.split(sep)]
        non_empty = [p for p in parts if p]
        if len(non_empty) < 2:
            continue
        score = _header_score(non_empty)
        # Prefer rows that have more columns AND higher string-label ratio
        combined = score + (len(non_empty) / 100)  # tiny tiebreaker for column count
        if combined > best_score:
            best_score = combined
            best_row = i
            best_col_count = len(non_empty)

    return best_row


def _find_header_row_excel(df_no_header: pd.DataFrame) -> int:
    """Find the header row index inside a DataFrame read without a header."""
    best_row = 0
    best_score = -1.0

    for i, row in df_no_header.iterrows():
        parts = [str(v).strip() for v in row if pd.notna(v) and str(v).strip() != "nan"]
        if len(parts) < 2:
            continue
        score = _header_score(parts) + len(parts) / 100
        if score > best_score:
            best_score = score
            best_row = i

    return int(best_row)


# ---------------------------------------------------------------------------
# Separator sniffing
# ---------------------------------------------------------------------------

def _sniff_separator(raw: bytes, encoding: str) -> str:
    """Return the most likely field separator for this file."""
    text = raw.decode(encoding, errors="replace")
    first_lines = text.splitlines()[:5]
    sample = "\n".join(first_lines)

    counts = {
        ",":  sample.count(","),
        "\t": sample.count("\t"),
        ";":  sample.count(";"),
        "|":  sample.count("|"),
    }
    return max(counts, key=counts.get)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def read_file(file_obj) -> pd.DataFrame:
    """
    Read a CSV, TSV, or Excel file from a Streamlit UploadedFile (or any
    file-like with a .name attribute).  Returns a clean DataFrame with
    all-empty rows dropped.

    Raises ValueError with a human-readable message if the file cannot be
    parsed into at least 2 columns.
    """
    name = getattr(file_obj, "name", "").lower()

    if name.endswith((".xlsx", ".xls")):
        return _read_excel(file_obj)
    else:
        return _read_csv_smart(file_obj)


def _read_csv_smart(file_obj) -> pd.DataFrame:
    raw = file_obj.read()

    encoding = _detect_encoding(raw)
    sep = _sniff_separator(raw, encoding)
    header_row = _find_header_row_csv(raw, encoding, sep)

    try:
        df = pd.read_csv(
            io.BytesIO(raw),
            encoding=encoding,
            sep=sep,
            skiprows=header_row,
            on_bad_lines="warn",
            dtype=str,           # read everything as str first; types normalised later
        )
        if len(df.columns) >= 2:
            return df.dropna(how="all").reset_index(drop=True)
    except Exception as parse_err:
        pass  # fall through to the bare fallback below

    # Bare fallback — just try comma + UTF-8
    try:
        df = pd.read_csv(io.BytesIO(raw), encoding="latin-1", on_bad_lines="warn", dtype=str)
        return df.dropna(how="all").reset_index(drop=True)
    except Exception as e:
        raise ValueError(f"Could not parse file as CSV: {e}") from e


def _read_excel(file_obj) -> pd.DataFrame:
    # First pass: read without header to find where the real header is
    try:
        raw_df = pd.read_excel(file_obj, header=None, nrows=30, dtype=str)
        header_row = _find_header_row_excel(raw_df)
    except Exception:
        header_row = 0

    try:
        file_obj.seek(0)
    except Exception:
        pass  # BytesIO already supports seek; UploadedFile may too

    try:
        df = pd.read_excel(file_obj, skiprows=header_row, dtype=str)
        return df.dropna(how="all").reset_index(drop=True)
    except Exception as e:
        raise ValueError(f"Could not parse Excel file: {e}") from e
