# AGENT_USAGE.md

This document describes how an AI coding agent (Claude, in the Claude.ai chat interface with
its bash/file-editing tools) was used to build this project, per the round's request to document
"use and verification of coding agents."

## Tools used

- **Claude (chat interface)** as the sole coding agent, with its sandboxed Linux container
  (`bash`, `create_file`, `str_replace`, `view`) as the only execution environment. No IDE
  plug-in, no separate CLI agent, no second model — one agent, one session, building the entire
  submission (backend, frontend, docs, sample data) directly to disk.
- **No internet access** in that sandbox (confirmed via `pip install` / `npm install` attempts
  which correctly failed with "no matching distribution"). This shaped the verification strategy
  described below.
- Standard library / already-vendored tooling only: Python 3.12's own `py_compile` for syntax
  checking, a locally-available `esbuild` binary (a transitive dependency of an unrelated global
  npm package already present in the sandbox) for JSX syntax checking, and hand-written
  dependency-free smoke tests for the modules that needed real logic verification.

## Representative prompts

The project was driven by two user messages:

1. The full problem statement (verbatim brief: build a retrospective analytics workbench for one
   dataset domain, FastAPI/React/PostgreSQL, with the validate → profile → propose → approve →
   run → interpret → rerun workflow, deterministic-only calculation, and the three deliverable
   docs), plus explicit product direction: *"mainly focus on the backend, the response should be
   very accurate and correct without any mistake... use very light colors and highlight with dark
   colors, light color means dont use white, any other light color which look very minimal."*
2. `"Continue"` — sent after the agent's first turn ran out of budget partway through the
   backend, to resume and complete the remaining scope (agent layer fixes, frontend, docs,
   packaging).

No other prompts were sent; the agent made the implementation decisions below on its own
(analysis-type selection, schema design, file layout, color values, testing approach) rather than
being given a spec for each of them individually.

## Work delegated to the agent

Effectively all of it: choosing the domain (project & task activity) and its data contract,
designing the Postgres/SQLAlchemy schema, writing the validation engine and its issue taxonomy,
designing and implementing all six deterministic analyses, designing the AI-agent boundary
(profile-only proposals, computed-results-only interpretation) and its rule-based offline fallback,
implementing the numeric-invention guard, the staleness/rerun comparator, all FastAPI routes, the
full React frontend (routing, API client, chart rendering, forms, the approve/reject/edit
workflows), the color palette, generating synthetic sample CSVs with deliberately injected data
issues for the demo, and all three required documentation files.

## An important agent mistake, caught and corrected

While implementing the rule-based fallback for `interpret_results()` (used when no
`ANTHROPIC_API_KEY` is configured), the agent's first draft had the interpreter itself compute
`p90 − median` in Python to narrate "the distribution has a long tail" as a correlation statement.

This is exactly the class of mistake the "LLM must not perform or invent numerical calculations"
requirement is meant to prevent — even though the code doing the subtraction wasn't literally an
LLM, it was standing in for one in the interpretation layer, and the same drift would have shown
up if a real model had been prompted loosely. The agent had, in the same turn, built a guard
(`check_for_invented_numbers`) that checks every number an interpretation states against the set
of numbers present in `computed_metrics`; running that guard against its own fallback output
immediately flagged `6.5` (the unlisted difference) as unverified in a smoke test. The fix moved
the subtraction into `analytics._stats()` as a precomputed `p90_minus_median` field, so the
interpretation layer only ever echoes numbers that already exist in the deterministic output. This
is called out in `README.md` as well, since it's a good illustration of *why* the architecture
separates calculation from interpretation as strictly as it does — the enforcement mechanism
caught a real violation of the project's own rule before it shipped.

A second, smaller issue the guard surfaced along the way: it initially also flagged legitimate
statements that mentioned "90th percentile," because the regex number-extractor treated the "90"
in "90th" as a claimed value. Fixed by excluding ordinal-suffixed numbers (`\d+(?:st|nd|rd|th)`)
from the check, since naming a statistic ("the 90th percentile") is not the same as asserting an
unverified value.

## Rejected / not-pursued approaches

- Considered giving the interpretation layer read access to full `Record` rows (not just
  `evidence_table` samples) so it could "double-check" the evidence table's summarization. Rejected
  because it widens the surface area for the model to compute or restate uninstructed numbers; the
  agent already gets a representative `evidence_table` sample plus the full `computed_metrics`,
  which is enough to interpret without needing raw-record access.
- Considered using Alembic migrations for the database schema. Rejected for this submission's
  scope in favor of `Base.metadata.create_all()` at startup, to keep setup to a single command;
  documented as excluded scope in `README.md` rather than silently left out.

## How the generated output was verified

Because the sandbox had no network access, the standard "install deps, run the app, run pytest"
loop was not available. Verification was done at the module level instead:

- **`validation.py`** (zero framework dependencies — only `pandas`, which was present): tested
  directly against hand-built DataFrames covering every issue type (missing required column,
  missing required field, duplicate `task_id`, exact-duplicate row, invalid status enum,
  completed-before-created, actual-hours-far-exceeds-estimate, negative hours) — 10/10 assertions
  passed, both as an ad hoc script and as the final `pytest`-style suite in
  `backend/tests/test_validation.py` (run manually with a stubbed `pytest` import, since `pytest`
  itself couldn't be installed).
- **`analytics.py`**: `Record`'s type import was made `TYPE_CHECKING`-only so the module has zero
  runtime dependency on SQLAlchemy, then tested with lightweight `SimpleNamespace` stand-ins for
  `Record` covering cycle time, overdue rate, estimation accuracy, and workload distribution
  against hand-computed expected values (e.g. verifying `overdue_rate` correctly counts a
  late-completed task *and* a still-open task past its due date, but not an on-time completion) —
  7/7 assertions passed in `backend/tests/test_analytics.py`.
- **`agent.py`**: `httpx` import made optional (falls back to `None`, which forces the rule-based
  path) so it's testable without the dependency; `pydantic_settings`/`app.config` were stubbed
  with minimal fakes to isolate the module under test. This is how the `p90_minus_median` bug
  above was actually caught — by running the guard against the fallback interpreter's own output.
- **`staleness.py`**: tested with hand-built old/new metric dicts confirming a metric that moves
  from 10.0 to 25.0 is correctly classified as `changed` (>10% drift tolerance) rather than
  `still_supported`.
- **All backend modules**: `python -m py_compile` across every file in `app/` and `app/routers/`
  to catch any remaining syntax errors.
- **All frontend `.jsx`/`.js` files**: bracket-balance checked, then syntax-checked with a
  locally-available `esbuild` binary (`esbuild <file> --bundle=false`) to confirm they parse as
  valid JSX/ESM. This does not catch type errors, prop-shape mismatches, or runtime issues — it
  only confirms the files are syntactically well-formed.
- **Not done**: booting `uvicorn`, running `npm run dev`, or clicking through the actual UI. This
  is stated plainly in `README.md`'s "Known limitations" — the reviewer should run the app
  themselves before relying on it, particularly around FastAPI route wiring, SQLAlchemy model
  relationships, and the React component tree, none of which were exercised end-to-end in this
  sandbox.
