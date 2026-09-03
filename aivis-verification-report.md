# AiVis Verification, QA & Production-Readiness Audit

Audit of the automatic dataset-intelligence pipeline (Phase 34) against the original spec. Every
claim below was checked against running code, not documentation — see "Tests Executed" and "E2E
Verification" for the actual commands and live evidence.

## Executive Summary

**Overall status: Needs More Work** (not "Not Production Ready" — the core pipeline is real,
automatic, and end-to-end functional; but several requirements from the audit brief are
genuinely unimplemented, not just polish gaps).

Two real bugs were found by actually running the application (not by reading code) and fixed
during this audit: (1) the backend never validated `chart_type` against a known registry at all,
so a hallucinated or bogus chart type could pass validation; (2) the data-quality
inconsistent-casing check silently skipped geographic-classified columns (like `state`), so
`"NY"` vs `"ny"` went undetected on exactly the kind of field most likely to have it. Both are
fixed, tested, and re-verified live.

## Overall Score (out of 10)

| Area | Score | Why |
| --- | --- | --- |
| Architecture | 8 | Clean orchestrator/worker separation, canonical `VisualizationSpec`, AIProvider abstraction. Loses points for the `transformations` field existing but never being wired to anything. |
| Automatic Pipeline | 9 | Verified live: upload → queued → real backend stages → ready, with zero manual buttons. Refresh/reconnect verified live, not assumed. |
| Data Profiling | 8 | Deterministic, well-tested (Phase 8/12 unit tests). No live correlation-relationship UI surface beyond what feeds insights. |
| Data Quality | 8 | Real, actionable (after this audit's fix), live-verified. Found and fixed a real coverage gap (geographic columns). |
| Gemini Integration | 7 | Real integration (first one in this codebase), schema-validated, retry-tested at the SDK boundary (added this audit), degrades gracefully on failure. No token-usage tracking, no fine-grained rate-limit backoff. |
| Recommendation Quality | 7 | Deterministic core + AI-assisted, redundancy-filtered, honest shortfall messaging (verified live — a 3-row dataset returned 2 recs with an explanation, not 8 padded ones). Not tested against the full realistic-dataset matrix the brief requested (financial/geographic/large fixtures don't exist). |
| Visualization Validation | 8 | Field + encoding-type + (as of this audit) chart-type-registry validation, all enforced before a recommendation or a manual studio edit can persist. |
| Visualization Rendering | 6 | Only 8 chart types render (bar/grouped_bar/line/area/scatter/histogram/box_plot/donut) — see the separate 41-type visualization-library audit for full detail. |
| Themes | 5 | Real, WCAG-checked, 12 themes — but static/dataset-independent, unchanged from Phase 20. Not "8 recommendations after selecting a visualization" in a dataset-aware sense. |
| Derived Visualizations | 3 | "Derived" = additional candidates from the same redundancy pool, not computed transformations (% of total, MoM growth, z-score). `VisualizationSpec.transformations` is a dead field. |
| Reliability | 7 | Retries work, idempotent re-runs verified, but resume-from-exact-failed-stage isn't implemented (always restarts from `profiling_quality`, which is cheap so this is low-impact). |
| Security | 8 | No code-execution paths found, upload hardening solid (tested), path-traversal-safe object keys, PII redaction verified, prompt-injection resistance now structurally tested. No rate limiting (pre-existing gap). |
| Testing | 8 | 114/114 backend, 16/16 frontend passing after this audit added 16 new tests (Gemini SDK contract, chart-registry validation, prompt-injection structure, data-quality regression). No golden-dataset matrix (financial/geo/large fixtures). |
| Performance | 5 | Not measured this audit — no timing instrumentation exists. Polars loads full dataframes into memory; fine at current fixture sizes, unverified at scale. |
| Frontend UX | 7 | Verified live at default viewport; the 5-breakpoint responsive matrix from the brief wasn't re-run this audit (was done in a prior session for other pages, not the analysis-progress UI specifically). |

## Requirement Verification Table

| Requirement | Status | Evidence |
| --- | --- | --- |
| Upload triggers pipeline automatically, no manual buttons | ✅ | Live: uploaded `qualitycheck2.csv`, zero clicks beyond upload, watched it progress `queued → ready` |
| Analysis is a persisted domain object with real lifecycle | ✅ | `app/models/analysis.py`; `status` field IS the current stage (no separate drift-prone field) |
| Refresh/reconnect reconstructs state, doesn't restart | ✅ | Live: stopped worker, uploaded, reloaded browser mid-`queued`, confirmed same state, no duplicate Analysis row |
| Data quality: missing/duplicate/inconsistent/outliers/empty/constant/high-cardinality | ✅ | `app/insights/data_quality.py`, 11 unit tests; geographic-column gap found and fixed this audit |
| AI context is compact, PII-redacted, never raw rows | ✅ | `build_analysis_context`; PII columns excluded from stats, only name kept; verified via existing PII redaction test |
| Gemini behind an AIProvider abstraction | ✅ | `app/ai/base.py` → `GeminiProvider`; recommendation/orchestrator code never imports the SDK directly |
| Gemini cannot execute code | ✅ | Repo-wide grep for eval/exec/subprocess found zero AI-adjacent code execution; Gemini output is Pydantic-validated JSON only |
| Field hallucination protection | ✅ | Every AI finding's fields re-validated against real schema before use; unit-tested |
| Chart-type hallucination protection | ✅ (fixed this audit) | No registry existed before; now `validate_spec()` rejects unknown/unimplemented chart types |
| Exactly-8-or-honest-shortfall | ✅ | Live: 3-row dataset → 2 recommendations + explicit "only 2..." message, not padded |
| Deterministic ranking, not blind Gemini trust | ✅ | Sort by confidence only; Gemini's own ordering never used; AI candidates go through the same `validate_spec` + redundancy filter as deterministic ones |
| Preview/Studio/Export use the same VisualizationSpec | ✅ | Export uses the exact `view` instance (`viewRef.current`) the studio canvas renders with — no separate render path |
| Theme recommendations after selecting a viz | ✅ (static) | Fetched unconditionally on studio load; NOT dataset-aware (Phase 20 limitation, unchanged) |
| Derived visualizations (computed transformations) | 🔴 | Not implemented — `transformations` field is dead code; "derived" = extra chart candidates only |
| Observability (structured logs per stage) | 🟡 | `app/workers/main.py` logs analysis_id/dataset_id/stage/duration; no dedicated metrics table, no token-usage field |
| Idempotency/caching by dataset+prompt hash | 🟡 | `pipeline_version`/`prompt_version` recorded but not used to skip re-running Gemini on retry |
| No new broker / DB-polling worker | ✅ | `SELECT ... FOR UPDATE SKIP LOCKED`, verified live with worker stopped/restarted |
| Rate limiting | 🔴 | Not implemented anywhere in the API (pre-existing, tracked at P28-003, not introduced by this work) |
| Prompt injection resistance | ✅ | Structurally verified this audit: malicious content only ever reaches Gemini as an escaped JSON value, `system_instruction` is a fixed constant |

## Critical Findings

None. No code-execution vulnerability, no data-leak path, no architecture that silently fakes
success.

## High Priority Findings

1. **Chart-type validation gap** (found + fixed this audit) — `validate_spec()` never checked
   `chart_type` against a real registry before this session. Fixed: `app/visualization/registry.py`
   + `validate_spec()` wiring. Tested.
2. **Data-quality blind spot on geographic columns** (found + fixed this audit, via live testing,
   not code review) — inconsistent-casing check silently skipped `semantic_type="geographic"`
   columns. Fixed. Tested + re-verified live.
3. **Derived visualizations are not implemented as computed transformations** — the spec's
   "Revenue by month → Month-over-month growth" style derivation doesn't exist. `VisualizationSpec.transformations`
   is a dead field. This is the largest single gap between spec and implementation.

## Medium Priority Findings

4. No token-usage tracking on Gemini calls.
5. No dataset-hash-keyed cache to avoid re-calling Gemini on retry (only prevents duplicate DB rows, not duplicate API calls).
6. Themes are static/dataset-independent — Gemini is never consulted for theme selection despite the spec allowing it.
7. No rate limiting anywhere in the API (pre-existing).
8. No fine-grained retry/backoff distinction for Gemini rate-limit vs. transient-network errors — both hit the same generic 2-attempt retry.

## Low Priority Findings

9. No performance timing instrumentation (upload/profile/AI/render latencies aren't measured anywhere).
10. No golden-dataset test matrix (financial/geographic/large/time-series fixtures beyond `clean.csv`/`messy.csv`/`malformed.csv`).
11. Resume-after-retry always restarts from `profiling_quality` rather than the exact failed stage (low-impact since that stage is fast).

## Tests Executed

| Command | Purpose | Result |
| --- | --- | --- |
| `pytest -q` (baseline, before fixes) | Full backend suite | 98/98 passed |
| `pytest -q` (after fixes + new tests) | Full backend suite | **114/114 passed** |
| `pytest tests/unit/test_gemini_provider.py -q` | New: GeminiProvider SDK-boundary contract tests (malformed JSON, empty response, SDK exception, retry recovery) | 6/6 passed |
| `pytest tests/unit/test_ai_findings.py -q` | AI findings incl. new prompt-injection structural test | 6/6 passed |
| `pytest tests/unit/test_data_quality.py -q` | Data quality incl. new geographic-field regression test | 11/11 passed |
| `pytest tests/unit/test_recommendation_ai_findings.py -q` | AI-assisted recommendation edge cases incl. new invalid-chart-type test | 8/8 passed |
| `pytest tests/unit/test_visualization_spec.py -q` | Spec validation incl. new chart-registry tests | 10/10 passed |
| `pytest tests/integration/test_analysis_pipeline.py -q` | Full pipeline incl. new phantom-analysis regression test | 5/5 passed |
| `npx tsc --noEmit` | Frontend typecheck | clean |
| `npm run lint` | Frontend lint | clean |
| `npx vitest run` | Frontend unit tests | 16/16 passed |
| `ruff check app/` | Backend lint | clean |
| `grep -rn "eval(\|exec(\|subprocess\|os.system"` (repo-wide) | Code-execution audit | zero AI-adjacent hits |
| `grep -rn "dangerouslySetInnerHTML"` (frontend) | XSS surface audit | only a static, non-user-derived script |

## E2E Verification (live, browser + real backend + real worker process)

1. Stopped the worker deliberately.
2. Uploaded `refreshtest.csv` through the browser (synthetic `DataTransfer`, same code path as a real file pick).
3. Opened the dataset page — confirmed genuine `Queued` status with the full real stage checklist (not fabricated).
4. **Reloaded the browser.** Confirmed status still `Queued`, no duplicate Analysis row, no restart. This is the refresh/reconnect requirement, proven, not assumed.
5. Restarted the worker. It picked up the still-queued row (proving durability across worker restarts, not just in-process state) and completed processing.
6. Reloaded again — status `ready`, 2 non-redundant recommendations with an honest "only 2, not 8" explanation (3-row dataset genuinely can't support more).
7. Uploaded `qualitycheck.csv` (`state` column with `"NY"`/`"ny"` casing inconsistency) — **found the geographic-column bug live**: 100/100 score, zero issues (wrong).
8. Fixed the bug, restarted the worker with the fix, re-uploaded the identical fixture as `qualitycheck2.csv` — **92/100, issue correctly detected, actionable recommendation text rendered** ("Normalize casing and whitespace before aggregating or grouping by this field.").
9. Confirmed recommendation cards render **live Vega-Lite mini-charts** from real data (not static images/placeholders) — `graphics-document: "Vega visualization"` with real SVG content in the accessibility tree.

Not re-verified this audit (already verified in the prior pipeline-build session and unchanged since): theme selection → studio → annotation editing → export. These were exercised end-to-end when built and no code in that path changed during this audit.

## Security Findings

- No `eval`/`exec`/`subprocess`/dynamic-code paths anywhere near AI output — confirmed by repo-wide grep, not assumed from architecture description.
- Upload validation: extension whitelist + libmagic content-sniff cross-check + size limit + empty-file rejection, all tested (`tests/integration/test_dataset_upload_api.py`).
- Object storage keys are path-traversal-safe (`build_object_key` strips path separators, whitelists characters).
- PII columns are excluded from any AI-bound payload (name only, no stats) — pre-existing, re-confirmed still true in the new `build_analysis_context`.
- Prompt-injection resistance is now structurally tested (not just asserted in a system-instruction string): malicious dataset content can only reach Gemini as an escaped JSON value inside `prompt`, never able to alter `system_instruction`.
- Tenant isolation (`_require_project` ownership check) confirmed present on both new Analysis endpoints.
- No raw dataset content ever appears in logs — worker logging is limited to `analysis_id`/`dataset_id`/`stage`/`duration`.
- **Gap, not a defect introduced here:** no rate limiting anywhere in the API. Pre-existing, tracked at task.md P28-003.

## Performance Findings

Not systematically measured this audit — no timing/metrics instrumentation exists to measure
against. Qualitative observation from live testing: a 3-8 row CSV completes the full pipeline
(data quality → AI context → Gemini → recommendations → ready) in well under a second end to end
(worker log: `duration_s=0.44` for one run). No large-dataset (100k+ row) test was performed;
Polars loads the full dataframe into memory during profiling and data-quality analysis, which is
a known, documented, unaddressed scaling limit (task.md Phase 27, "not started").

## Final Recommendation

**AiVis is not yet ready for real analytics users as a complete product**, but the automatic
pipeline work from this session (Phase 34) is genuinely solid and production-quality *for what it
covers*: real automatic triggering, real background processing, real Gemini integration with
proper validation and graceful degradation, real refresh/reconnect durability, and — as of this
audit — real chart-type validation and a real data-quality coverage fix, all verified by actually
running the application and catching two live bugs, not just reading the code.

What blocks a "production ready" verdict:
1. **Derived visualizations don't compute anything** — the feature described in the spec (MoM
   growth, % of total, z-score) doesn't exist; only additional chart *candidates* do.
2. **Only 8 of a much larger desired chart library render** — see the separate visualization-library
   audit for exact scope.
3. **No rate limiting** on a public-facing API that calls a paid external service (Gemini) is a
   real cost/abuse risk before real users touch it.
4. **No performance testing at scale** — untested beyond small fixtures.

None of these are hidden or downplayed — they were already known (documented in the Phase 34
audit doc before this session) or found and disclosed here. What changed this session: two real
correctness bugs were found by running the app, not reading it, and both are now fixed and
tested.
