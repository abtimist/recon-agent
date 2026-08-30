# Recon Agent - Core Engine

This directory contains the brains of the operation: the **Reconciliation Engine**. It handles data ingestion, normalization, deterministic matching, AI fuzzy matching, and report generation in pure Python.

It is strictly decoupled from the FastAPI backend and web server logic, meaning this engine can be run independently, integrated into other workflows, or scaled horizontally.

## Key Modules

* `reconciliation_service.py` - The orchestrator. It manages the pipeline from file reading to final report generation.
* `matcher.py` - The core algorithm. It first attempts deterministic matching (exact amounts, IDs, and date tolerance). If that fails, it delegates to the AI.
* `ai_resolver.py` - The AI handler. Formats the unmatched source and target data and sends it to the LLM (OpenAI or Ollama) with strict instructions to resolve fuzzy matches and provide confidence scores.
* `column_mapper.py` - Intelligently maps user CSV/XLSX columns (e.g. `TxnDate`, `Amt`) into a standardized internal schema (`date`, `amount`, `description`, `reference`).
* `duplicate_detector.py` - Scans for identical transactions within the same file to prevent false positives and double-counting during reconciliation.
* `report_generator.py` - Generates stylized PDF and Excel summary reports for the CFO/Finance Team.

## Bring Your Own Model (BYOM)
The Core Engine is designed to be model-agnostic. While it supports OpenAI's robust GPT-4 class models, it natively supports `Ollama` for running local models (like `llama3`), ensuring maximum data privacy for sensitive financial records.
