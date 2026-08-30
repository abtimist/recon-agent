# Recon Agent 

An AI-powered financial reconciliation platform built as a multi-tenant SaaS. Recon Agent automates the tedious process of matching source and target financial records using deterministic matching algorithms and advanced AI for resolving complex exceptions.

This project was built to demonstrate modern full-stack development, system architecture, API design, and applied AI in a FinOps context.

## 🚀 Key Features

* **Multi-Interface Architecture:** Access the powerful reconciliation engine via a modern Web Dashboard, a dedicated Command Line Interface (CLI), or directly through the REST API.
* **Bring Your Own Model (BYOM):** Flexible AI integration. Plug in your own OpenAI API key, or run models locally via Ollama for maximum data privacy.
* **Transparent AI Resolution:** No black-box magic. The AI explicitly outputs its confidence score and reasoning for every fuzzy match it makes.
* **Exception Handling:** Unmatched transactions are cleanly isolated into an Exceptions queue for manual review.
* **Enterprise-Grade Security:** Full tenant isolation using Supabase RLS (Row Level Security), role-based access control, and AES-256-GCM encryption for API keys at rest.
* **First-Class CLI (`recon`):** Automate reconciliations, view history, and generate AI explanations straight from the terminal using Personal Access Tokens (PATs).
* **Analytics Dashboard:** Monitor match rates, exception counts, and historical run data visually.

## 💡 Our Motivation & Challenges

**Why we built this:**
Financial reconciliation is traditionally a manual, error-prone process involving endless spreadsheets and VLOOKUPs. We wanted to tackle a real-world B2B (Business-to-Business) problem and solve it using modern software engineering and Applied AI. Our goal was to build a system that not only automates deterministic matching but also intelligently handles fuzzy, unstructured data using Large Language Models.

**Challenges we faced:**
* **Trust & Hallucinations:** You cannot have an AI "guess" with financial data. We had to build a strict deterministic engine first, and only use AI as a fallback, ensuring it always outputs a confidence score and never forces a match silently.
* **Architecture Design:** Designing a system that can be securely accessed via a Web App, a CLI, and a REST API simultaneously required careful decoupling of the frontend, backend, and the core reconciliation engine.
* **Multi-Tenancy:** Ensuring absolute data isolation between different organizations was difficult. We had to leverage PostgreSQL Row Level Security (RLS) and strict JWT validation to guarantee zero data leakage between users.

## 🤝 Our Work vs. Third-Party Integrations

To build a production-grade application, we focused our engineering efforts on the core problem and leveraged industry-standard third-party tools for the rest. We believe in transparency regarding what we built from scratch versus what we integrated:

**What We Built (Our Core Engineering):**
* **The Reconciliation Engine (`core/`):** The entire logic for parsing, normalizing, deterministic matching, and AI prompt engineering is 100% our own code.
* **The Backend API:** The FastAPI server, routing, batch job processing, and database schemas were designed and written by us.
* **The Command Line Interface (CLI):** We built the `recon` CLI tool from scratch using Python's Typer and Rich libraries.
* **The Web Dashboard:** All React/Next.js components, layouts, and charting logic were developed by us.

**What We Integrated (Third-Party Services):**
* **Clerk (Authentication):** We did *not* build our own login system. We use Clerk to handle user authentication and multi-tenant organization switching securely.
* **Supabase (Database & Storage):** We rely on Supabase for managed PostgreSQL hosting and file storage. We wrote the SQL schema and RLS policies, but Supabase handles the infrastructure.
* **OpenAI / Ollama (The AI Models):** We did not train our own Large Language Models. We use OpenAI's models (via API) or local Ollama models to perform the semantic matching.
* **UptimeRobot:** Used purely as an external ping service to keep our free-tier hosting from spinning down.

## 🛠️ Tech Stack

* **Frontend:** Next.js 16 (App Router), React, TailwindCSS, Framer Motion, Recharts
* **Backend:** FastAPI (Python)
* **Core Engine:** Pure Python reconciliation logic (`core/`)
* **Database:** Supabase (PostgreSQL) with Row Level Security (RLS)
* **Authentication:** Clerk (Multi-tenant B2B Organizations & Personal Workspaces)
* **Storage:** Supabase Storage (CSV/XLSX file handling)
* **CLI:** Typer, Rich (Python)

## 🏗️ Architecture & How It Works

The architecture flows strictly in a unidirectional manner to ensure security and decoupling:

`Web UI / CLI → FastAPI REST API → Core Engine → Database`

1. **Upload:** A user uploads a source ledger and a target bank statement via the Web UI or CLI.
2. **Deterministic Matching:** The engine first runs a strict rule-based pass (exact amounts, IDs, dates within a tolerance window) to instantly clear the bulk of the transactions.
3. **AI Resolution:** The remaining unmatched records are passed to the AI model (OpenAI or Local Ollama) to identify fuzzy matches (e.g., "Stripe Payout" vs "STRIPE INC Payout ID: 1234").
4. **Exceptions & CFO Report:** Anything the AI cannot confidently match is flagged as an exception. The user can then generate an AI "CFO Report" explaining the anomalies.

## ⚡ Quick Start

### 1. Backend (FastAPI)
Ensure you have `uv` or `pip` installed.
```bash
cd /home/abhishek/PROJECTS/recon-agent
uv sync
.venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
Health check: `curl http://localhost:8000/health`

### 2. Frontend (Next.js)
```bash
cd /home/abhishek/PROJECTS/recon-agent/web
npm install
npm run dev
```

## 💻 Command Line Interface (CLI)

Recon Agent includes a powerful CLI available via PyPI (local installation).

### Installation
```bash
pip install -e .
# or if using uv
uv pip install -e .
```

### Usage
1. **Login**: Generate a Personal Access Token in the Web UI (Developer Settings), then run:
   ```bash
   recon login
   ```
2. **Reconcile**:
   ```bash
   recon reconcile source.csv target.csv
   ```
3. **History**:
   ```bash
   recon history
   ```
4. **AI Explanations**:
   ```bash
   recon explain <run_id>
   ```

## 🔌 Environment Variables

Create `.env` (root) and `web/.env.local` with these values.

**Root `.env`**
```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role JWT> 
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER=https://<your-app>.clerk.accounts.dev
ENCRYPTION_KEY=<base64 32 bytes>
```

**`web/.env.local`**
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## ⏱️ Keeping the Server Awake (Uptime Hack)

If the backend or frontend is deployed on a free-tier service (like Render or Heroku), it may go to sleep after 15 minutes of inactivity. To prevent cold starts:

1. Create a free account on [UptimeRobot](https://uptimerobot.com/).
2. Create an `HTTP(s)` monitor pointing to your public URL.
3. Set the interval to **5 or 10 minutes**.

This automated ping prevents the server from spinning down, keeping the application lightning fast at all times.

## 🔮 Future Work

While the automated pipeline is robust, future development will focus on empowering human operators:

* **Manual Reconciliation Workspace:** A dedicated UI allowing accountants to manually drag, drop, and force-match records that the AI flagged as exceptions directly through the platform.
* **Custom Rules Engine:** Tools and interfaces to customize pre-filtering rules (e.g. IF amount matches AND date is within 3 days) manually before transactions even reach the AI.
* **Visualization of Manual Interventions:** Dashboards and audit trails that visually track how many exceptions were manually resolved, who resolved them, and the common reasons why, creating a continuous feedback loop for the AI.

## 📚 Documentation
- [Platform Integration Audit](docs/platform-integration-audit.md)
- [Phase 2: Platform Foundations](docs/phase-2-foundations-report.md)
- [Phase 3: API Authentication](docs/api-authentication.md)
- [Phase 4: CLI Documentation](docs/cli.md)
- [Phase 5: Tiers and Roles](docs/tiers-and-roles.md)
