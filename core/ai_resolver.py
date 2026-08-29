"""
Provider-agnostic AI resolver for ambiguous reconciliation pairs.

Design principle: NO module-level clients, NO global state.
Every function is stateless — it receives a config dict at call time and
builds a short-lived client from it.  This means multiple concurrent users
can each have their own provider/key without any interference.

Supported providers
-------------------
  gemini  — Google Gemini via google-genai          (needs: google-genai)
  groq    — Groq cloud (OpenAI-compatible endpoint) (needs: openai)
  openai  — OpenAI API                              (needs: openai)
  ollama  — Local Ollama server (OpenAI-compatible) (needs: openai, Ollama running)
  none    — Skip AI resolution; treat all ambiguous cases as exceptions

Config dict schema
------------------
{
    "provider": "groq",                              # required
    "api_key":  "gsk_...",                           # required for gemini/groq/openai
    "model":    "llama-3.3-70b-versatile",           # optional; falls back to DEFAULTS
    "base_url": "https://api.groq.com/openai/v1",   # set automatically; override if needed
}

CLI usage example:
    Pass the config dict from argparse / env vars into resolve_all().

Streamlit usage:
    Build the config from st.session_state in the sidebar, pass to resolve_all().
"""

import json
import os

# ---------------------------------------------------------------------------
# Provider defaults
# ---------------------------------------------------------------------------

PROVIDERS = {
    "gemini": {
        "label":    "Google Gemini",
        "model":    "gemini-3.6-flash",
        "base_url": None,                                    # uses google-genai SDK
        "key_env":  "GEMINI_API_KEY",
    },
    "groq": {
        "label":    "Groq (Llama)",
        "model":    "llama-3.3-70b-versatile",
        "base_url": "https://api.groq.com/openai/v1",
        "key_env":  "GROQ_API_KEY",
    },
    "openai": {
        "label":    "OpenAI",
        "model":    "gpt-4o-mini",
        "base_url": "https://api.openai.com/v1",
        "key_env":  "OPENAI_API_KEY",
    },
    "ollama": {
        "label":    "Ollama (local)",
        "model":    "qwen2.5:3b",
        "base_url": "http://localhost:11434/v1",
        "key_env":  None,                                    # no key needed
    },
    "none": {
        "label":    "Skip AI (flag as exceptions)",
        "model":    None,
        "base_url": None,
        "key_env":  None,
    },
}


def default_config(provider: str = "groq") -> dict:
    """
    Return a ready-to-use config dict for the given provider.
    API key is read from the environment variable if set.
    """
    meta = PROVIDERS.get(provider, PROVIDERS["groq"])
    return {
        "provider": provider,
        "api_key":  os.environ.get(meta["key_env"] or "", "") if meta["key_env"] else "",
        "model":    meta["model"],
        "base_url": meta["base_url"],
    }


# ---------------------------------------------------------------------------
# Prompt — intentionally strict about JSON so smaller models comply
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a financial reconciliation assistant. You will receive one record
from a source file and one record from a target file, and you must decide
whether they represent the SAME underlying transaction.

Rules to apply:
- Minor amount differences (< 1%) are acceptable — they may be processing fees.
- Date differences of 1–7 days are acceptable — settlement delay is normal.
- ID formatting can differ between systems (e.g. "TXN-001" vs "txn001").
- Party names can be abbreviated or punctuation may differ.
- If two or more of: amount, date, party name agree closely, lean toward match.

RESPOND ONLY WITH VALID JSON — no markdown fences, no explanation text outside the JSON.
Use exactly this structure:
{"is_match": true, "confidence": 0.92, "reason": "one short sentence"}
"""


def _build_user_prompt(source_row: dict, target_row: dict) -> str:
    return (
        f"Source record:\n"
        f"  id:     {source_row.get('id')}\n"
        f"  party:  {source_row.get('party')}\n"
        f"  amount: {source_row.get('amount')}\n"
        f"  date:   {source_row.get('date')}\n\n"
        f"Target record:\n"
        f"  id:     {target_row.get('id')}\n"
        f"  party:  {target_row.get('party')}\n"
        f"  amount: {target_row.get('amount')}\n"
        f"  date:   {target_row.get('date')}\n\n"
        f"Are these the same transaction? Respond only with JSON."
    )


# ---------------------------------------------------------------------------
# Per-provider call implementations
# ---------------------------------------------------------------------------

def _parse_response_text(text: str) -> dict:
    """Strip markdown fences if a model adds them anyway, then parse JSON."""
    text = text.strip()
    if text.startswith("```"):
        # strip ```json ... ``` or ``` ... ```
        lines = text.splitlines()
        text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        ).strip()
    return json.loads(text)


def _call_gemini(source_row: dict, target_row: dict, config: dict) -> dict:
    from google import genai  # already in requirements.txt
    client = genai.Client(api_key=config["api_key"])
    model  = config.get("model") or PROVIDERS["gemini"]["model"]
    prompt = _SYSTEM_PROMPT + "\n\n" + _build_user_prompt(source_row, target_row)
    response = client.models.generate_content(model=model, contents=prompt)
    return _parse_response_text(response.text)


def _call_openai_compatible(source_row: dict, target_row: dict, config: dict) -> dict:
    """
    Single implementation for Groq, OpenAI, and Ollama — they all speak the
    OpenAI chat-completions protocol.  Only the base_url and api_key differ.
    """
    from openai import OpenAI
    provider  = config["provider"]
    defaults  = PROVIDERS[provider]
    api_key   = config.get("api_key") or "ollama"   # Ollama ignores the key
    base_url  = config.get("base_url") or defaults["base_url"]
    model     = config.get("model")    or defaults["model"]

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user",   "content": _build_user_prompt(source_row, target_row)},
        ],
        temperature=0.1,   # low temperature → more deterministic JSON
        max_tokens=150,
    )
    return _parse_response_text(response.choices[0].message.content)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def resolve_pair(source_row: dict, target_row: dict, ai_config: dict) -> dict:
    """
    Decide whether one ambiguous source/target pair is a match.
    Returns {"is_match": bool, "confidence": float, "reason": str}.
    """
    provider = ai_config.get("provider", "none")

    if provider == "none":
        return {
            "is_match":   False,
            "confidence": 0.0,
            "reason":     "AI resolution skipped — flagged as exception for manual review.",
        }

    try:
        if provider == "gemini":
            result = _call_gemini(source_row, target_row, ai_config)
        elif provider in ("groq", "openai", "ollama"):
            result = _call_openai_compatible(source_row, target_row, ai_config)
        else:
            raise ValueError(f"Unknown provider: '{provider}'")

        return {
            "is_match":   bool(result.get("is_match", False)),
            "confidence": float(result.get("confidence", 0.0)),
            "reason":     str(result.get("reason", "")),
        }

    except ConnectionRefusedError:
        return {
            "is_match":   False,
            "confidence": 0.0,
            "reason":     (
                "Could not connect to Ollama. "
                "Make sure Ollama is running: `ollama serve`"
            ),
        }
    except Exception as e:
        return {
            "is_match":   False,
            "confidence": 0.0,
            "reason":     f"AI resolver error ({type(e).__name__}: {e}). Kept as exception.",
        }


def resolve_all(ambiguous_pairs: list, ai_config: dict | None = None) -> list:
    """
    Resolve a list of (source_row_dict, target_row_dict) pairs.
    ai_config defaults to Groq if not provided (reads key from env).
    """
    if ai_config is None:
        ai_config = default_config("groq")

    results = []
    for source_row, target_row in ambiguous_pairs:
        decision = resolve_pair(source_row, target_row, ai_config)
        results.append({
            "source_row": source_row,
            "target_row": target_row,
            "decision":   decision,
        })
    return results
