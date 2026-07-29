# Retrospective Analytics Workbench

An analytics application for **project & task activity** datasets (e.g. exports from a
Jira/Linear/Asana-style tracker). Upload a CSV, get a data-quality report and a structural
profile, let an AI agent propose relevant retrospective analyses, approve the ones you want,
run them (all math is deterministic Python — never the LLM), and get an AI interpretation of the
already-computed numbers, classified into observations / correlations / hypotheses and traceable
back to the exact records behind them. Save sessions, edit or reject conclusions, compare periods,
upload a newer version of the dataset, and rerun old analyses to see whether earlier conclusions
still hold.

## Domain & data contract

Domain: **project and task activity** (`SCHEMA_VERSION = task-activity-v1`, defined in
`backend/app/validation.py`).

CSV columns:

| Column | Required | Type | Notes |
|---|---|---|---|
| `task_id` | yes | string | unique per row |
| `project_id` | yes | string | |
| `project_name` | yes | string | |
| `assignee` | yes | string | |
| `status` | yes | enum | `Backlog, To Do, In Progress, In Review, Done, Cancelled` |
| `created_date` | yes | date | |
| `priority` | no | enum | `Low, Medium, High, Critical` |
| `due_date` | no | date | |
| `completed_date` | no | date | required (by consistency check, not hard schema) when status = Done |
| `estimated_hours` | no | float | ≥ 0 |
| `actual_hours` | no | float | ≥ 0 |
| `tags` | no | string | free text |

Two sample files are included for a quick demo, sharing one lineage so you can exercise the
upload-new-version / rerun / staleness flow:

- `sample_data/task_activity_v1.csv` (166 rows, includes deliberately injected data-quality
  issues: an exact duplicate row, a duplicate `task_id`, an invalid status value, a missing
  required field, a `completed_date` before `created_date`, and an actual-vs-estimate outlier)
- `sample_data/task_activity_v2.csv` (206 rows — v1 plus 40 more recent tasks, simulating an
  updated export)

## Architecture

```
backend/   FastAPI + SQLAlchemy (PostgreSQL in prod, SQLite for zero-setup local/dev)
  app/
    validation.py    deterministic data-contract validation & quality-issue detection
    profiling.py      deterministic structural dataset profile (counts, distributions, coverage)
    analytics.py       deterministic calculation engine (the ONLY place numbers are computed)
    agent.py            AI agent: proposes analyses from the profile, interprets already-computed
                         results; includes a guard that flags any number the AI states that isn't
                         traceable back to computed_metrics/evidence_table
    staleness.py        deterministic rerun comparison (still_supported / changed / contradicted)
    models.py            ORM schema (Dataset, Record, ValidationIssue, AnalysisSession,
                          ProposedAnalysis, AnalysisRun, Conclusion, RerunComparison)
    routers/             datasets.py, sessions.py, analysis.py
frontend/  React (Vite) + react-router-dom + recharts
sample_data/  demo CSVs (v1 and an updated v2, same lineage)
```

### Why the "LLM never calculates" rule is structurally enforced, not just prompted

1. **Separation of concerns.** `analytics.py` never imports or calls `agent.py`. Route handlers
   always call `analytics.run_analysis(...)` first and only pass its **output** (`computed_metrics`,
   a sample of `evidence_table`) into `agent.interpret_results(...)`. The agent has no path back to
   raw records.
2. **Prompt-level instruction** telling the model never to perform arithmetic and to cite the
   exact `computed_metrics` key behind every statement.
3. **Post-hoc numeric guard** (`agent.check_for_invented_numbers`): every number token in the
   AI's text is checked against the set of numbers actually present in `computed_metrics` /
   `evidence_table`. Any number that doesn't match is flagged (`ai_flagged_invented_numbers=True`
   on the run, surfaced as a banner in the UI) so a human reviews it before trusting it. Ordinal
   references like "90th percentile" are excluded from the check since they name a metric
   rather than assert a value.
4. **Derived numbers live in `analytics.py`, not in the interpreter.** While building the
   rule-based fallback interpreter I initially had it *compute* `p90 − median` itself to describe
   the tail of a distribution — technically a calculation happening outside the deterministic
   engine. The guard I'd just built caught this immediately (see AGENT_USAGE.md). Fixed by moving
   that subtraction into `analytics._stats()` as a precomputed `p90_minus_median` field, so the
   interpretation layer only ever echoes numbers that already exist in `computed_metrics`.

### Offline-safe AI agent

`ANTHROPIC_API_KEY` is optional. If it's unset (or the call fails), both `propose_analyses()` and
`interpret_results()` fall back to a deterministic, rule-based implementation that follows the
*exact same contract* (same observation/correlation/hypothesis taxonomy, same "must cite a metric
key" rule). This means the full pipeline — upload → validate → profile → propose → approve → run →
interpret → rerun — is exercisable end-to-end without any network access, which is also how it was
tested in this submission (see "Known limitations" below).

### Analyses in the deterministic registry (`app/analytics.py`)

`cycle_time`, `throughput_trend`, `overdue_rate`, `workload_distribution`, `estimation_accuracy`,
`period_comparison` (wraps any of the above over two date windows for period-vs-period comparison).
Each returns `metrics` (for citation), `evidence_table` (drill-down rows), `evidence_record_ids`
(so every conclusion traces back to specific `Record` rows), and a `chart_spec` the frontend
renders declaratively (bar / line / scatter / grouped_bar) via `recharts`.

### Session / approval / rerun workflow

1. Upload CSV → validated, profiled, stored as a `Dataset` (v1 of a `lineage_id`).
2. Create an `AnalysisSession` against that dataset.
3. `POST /sessions/{id}/propose` → agent reads the **profile only** and returns
   `ProposedAnalysis` rows with a rationale citing specific profile facts.
4. User approves or rejects each proposal (`period_comparison` proposals let the user set the two
   date windows before approving).
5. `POST /proposals/{id}/run` (blocked unless `status == approved`) → executes the deterministic
   calculation, then the AI interpretation, and stores an `AnalysisRun` with per-statement
   `Conclusion` rows.
6. User can edit or reject any conclusion (`PATCH /conclusions/{id}`); the original AI statement
   is preserved alongside the edit for audit.
7. Upload a new CSV version against the same `lineage_id` → `POST /runs/{id}/rerun` re-executes
   the *same* analysis type + params against the new dataset and returns a per-conclusion verdict
   (`still_supported`, `changed`, `contradicted`) computed by comparing the metric keys each
   conclusion cited, with a numeric drift tolerance of 10%.

## Setup

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env        # edit DATABASE_URL / ANTHROPIC_API_KEY as needed
uvicorn app.main:app --reload --port 8000
```

Tables are created automatically on startup via `Base.metadata.create_all` (see "Known
limitations" — no Alembic migrations in this submission). Swagger docs at
`http://localhost:8000/docs`.

To point at Postgres instead of the SQLite default:

```
DATABASE_URL=postgresql+psycopg2://raw_user:yourpassword@localhost:5432/raw_db
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env           # set VITE_API_BASE_URL if not localhost:8000
npm run dev
```

Open `http://localhost:5173`.

### Try it end-to-end

1. Upload `sample_data/task_activity_v1.csv` (name it e.g. "Q1 export").
2. Review the data-quality report (six issue types are deliberately present in the sample).
3. Create a session, click "Ask AI to propose analyses", approve a few proposals, run them.
4. Review the chart, evidence table, and AI conclusions; edit or reject one.
5. Go back to Upload, check "this is an updated version", pick the same dataset, upload
   `sample_data/task_activity_v2.csv`.
6. On a run detail page, use "Rerun against an updated dataset" and pick the v2 upload to see the
   staleness verdicts.

## Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

`tests/test_validation.py` (10 cases) exercises schema errors, missing fields, duplicate
detection (both `task_id` and full-row), invalid enum values, cross-field date consistency, and
the suspicious-record heuristics. `tests/test_analytics.py` (7 cases) exercises the deterministic
calculation functions directly, including that derived stats like `p90_minus_median` are computed
by code, not narrated.

**How these were actually verified in this submission:** the sandbox this project was built in
has no network access, so `fastapi`/`sqlalchemy`/`pydantic`/`httpx` could not be installed to run
the full app or `pytest` itself. `validation.py` and `analytics.py` (the two modules with zero
framework dependencies) were verified directly with plain `python3`, and `agent.py`/`staleness.py`
were verified by stubbing their two config-related imports. All backend modules were also
`py_compile`-checked, and all frontend files were syntax-checked with `esbuild`. This is
documented in detail, including the one real bug it caught, in `AGENT_USAGE.md`. **Before running
this for real, install the dependencies and run `pytest` / `npm run dev` yourself** — that full
loop has not been executed.

## Completed scope

- Data contract definition + deterministic validation (missing / duplicate / inconsistent /
  suspicious detection, both schema-level and cross-field)
- Deterministic dataset profiling
- AI-agent-proposed analyses with rationale grounded in profile facts, requiring approval before
  running
- Deterministic analytics engine (6 analysis types incl. period comparison) fully decoupled from
  the AI layer
- AI interpretation of computed results only, classified as observation/correlation/hypothesis,
  with a numeric-invention guard
- Evidence tables + charts, all traceable to source records
- Save sessions; approve/reject proposals; edit/reject conclusions
- Upload updated dataset versions (lineage/versioning model)
- Rerun a previous analysis against a new version; per-conclusion staleness verdict
- React UI for the full flow, styled per the requested palette (no white; warm parchment
  background with dark-navy highlights)

## Intentionally excluded scope

- **Authentication / multi-user access control** — out of scope for this exercise; all sessions
  are globally visible. A real deployment would add auth and scope datasets/sessions per user or
  workspace.
- **Alembic migrations** — tables are created via `Base.metadata.create_all()` at startup instead
  of versioned migrations, to keep setup to one command. Would need Alembic before any real schema
  evolution in production.
- **Async DB access / background job queue** — analysis runs execute synchronously in the request.
  Fine for the row counts this is designed around; a larger dataset or a slower model call would
  want this moved to a background worker (e.g. Celery/RQ) with a job-status endpoint.
- **File formats beyond CSV** (Excel, JSON) — the contract and parser are CSV-only.
- **Streaming/chunked upload** for very large files — the whole file is read into memory and
  parsed by pandas; `MAX_UPLOAD_ROWS` caps this rather than solving it properly.
- **Fine-grained diffing of individual records between dataset versions** — rerun/staleness
  compares *metrics*, not a full row-level diff of what changed between v1 and v2.
- **Automated frontend tests** (e.g. Playwright/RTL) — not written; backend logic is unit-tested,
  the frontend was verified by syntax-checking + manual code review only (see "Tests" above).

## Known limitations

- The numeric-invention guard is a heuristic (regex-based number extraction + set membership with
  a small-integer allowance and an ordinal exclusion). It can both under- and over-flag on
  unusual phrasing; it's a safety net for human review, not a proof of correctness.
- `overdue_rate`'s "as of" comparison for still-open tasks uses `date.today()` by default, so two
  runs of the *same* analysis on an unchanged dataset on different calendar days can legitimately
  produce different numbers for open (non-Done) tasks. This is documented behavior, not a bug, but
  worth knowing when interpreting rerun/staleness output.
- `period_comparison` filters records by `created_date` falling inside each window; it does not
  handle tasks that were created before a period but completed inside it.
- This submission's test run of the app was necessarily partial due to the no-network sandbox
  described above — the FastAPI/React apps have not been booted and clicked through end-to-end by
  the author. Please run the "Try it end-to-end" steps yourself after installing dependencies.

## Deployment

- **Backend**: any ASGI host (Render, Fly.io, Railway, ECS, etc.) running
  `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, pointed at a managed PostgreSQL instance via
  `DATABASE_URL`. Set `CORS_ORIGINS` to the deployed frontend origin.
- **Frontend**: `npm run build` produces a static `dist/` bundle deployable to any static host
  (Vercel, Netlify, S3+CloudFront, etc.), with `VITE_API_BASE_URL` set at build time to the
  backend's public URL.
- **Database**: PostgreSQL 14+. No migration tool is wired up (see "Intentionally excluded
  scope") — run against a fresh database, or add Alembic before evolving the schema in place.
