# AiVis Automatic Dataset Intelligence Pipeline — Implementation Audit

Documents what was actually built, not the aspirational spec. Every claim below is backed by a
file reference and/or a passing test — see `task.md` Phase 34 for the task-by-task breakdown.

## 1. Implemented architecture

```
DATASET UPLOAD (POST /api/datasets)
        │
        ▼
  INGESTION + PROFILING          <- already automatic & synchronous (Phase 7/8, unchanged)
        │  (dataset.status -> ready)
        ▼
  Analysis row created (status=queued)   <- app/api/v1/datasets.py::upload_dataset
        │
        ▼  (background worker polls, see §2)
  PROFILING_QUALITY   -> app/insights/data_quality.py + reused Phase 12 insight detectors
        │
        ▼
  BUILDING_AI_CONTEXT -> app/ai/context_builder.py::build_analysis_context
        │
        ▼
  AI_ANALYZING        -> app/services/ai_findings.py (Gemini, degrades gracefully on failure)
        │
        ▼
  GENERATING_RECOMMENDATIONS -> app/visualization/recommendation.py (deterministic core + AI-assisted candidates)
        │
        ▼
  VALIDATING          -> app/visualization/validation.py (already ran inline above; visible checkpoint)
        │
        ▼
  RANKING             -> split_top_and_derived(top_n=8) + recommendation_shortfall_reason()
        │
        ▼
  GENERATING_PREVIEWS -> freezes validated specs into Analysis.recommendations (persisted JSON)
        │
        ▼
  READY (or FAILED, with stage-prefixed error + retry endpoint)
```

The user-facing flow this produces: upload once → `GET /api/datasets/:id/analysis` polling shows
real progress → recommendations appear automatically → select one → theme selection (unchanged,
Phase 20/21) → studio (unchanged, Phase 22/23).

## 2. Analysis lifecycle

`app/models/analysis.py::AnalysisStatus`:

`queued → profiling_quality → building_ai_context → ai_analyzing → generating_recommendations →
validating → ranking → generating_previews → ready | failed`

No separate "current_stage" field — `status` *is* the current stage, eliminating a class of
drift bug where the two could disagree. `AnalysisResponse.from_analysis()`
(`app/schemas/analysis.py`) computes a `stages` map (`complete`/`processing`/`pending` per stage)
and a `progress` percentage from `status`'s position in `STAGE_ORDER` — never a fabricated
number, and never advances without a real backend transition (each stage change is a committed
DB write before the next stage starts).

No message broker was introduced. `app/workers/main.py` polls the `analyses` table every 2
seconds and claims one queued row at a time via `AnalysisRepository.claim_next_queued()`
(`SELECT ... FOR UPDATE SKIP LOCKED`) — this is safe for multiple worker replicas without any
additional coordination infrastructure. This was a deliberate scope decision: no
Celery/RQ/arq/Redis-backed queue existed anywhere in the codebase before this work (confirmed via
research, not assumed), and standing one up is a separable project from "make analysis
automatic."

## 3. Gemini integration

**Before this phase, Gemini was not called anywhere in the insights/stories/recommendations
chain** — the only existing use case (`app/services/ai_interpretation.py`, dataset semantic
interpretation) wasn't wired into anything downstream. This phase adds the first real use.

- **Model**: same `GeminiProvider` (`app/ai/gemini_provider.py`), `gemini-2.0-flash` by default,
  unchanged — no new provider code needed.
- **Structured output**: `app/ai/schemas.py::AnalyticalFindings` / `AnalyticalFinding` — typed
  `FindingType` enum, `fields: list[str]` (max 6), `description` (max 500 chars), `confidence`
  (0–1), optional `suggested_chart_type` constrained by prompt instruction to the actual
  supported chart set (`bar, grouped_bar, line, area, scatter, histogram, box_plot, donut`).
- **Context construction**: `app/ai/context_builder.py::build_analysis_context` extends the
  existing PII-safe `DatasetSummary` (Phase 11 — PII columns' stats are never sent, only their
  name for context) with data-quality findings and already-detected statistical relationships
  (reuses Phase 12's Insight rows as a grounding signal, so Gemini isn't asked to blindly
  re-derive correlations from a stats summary).
- **Retries**: unchanged from Phase 11 — 2 attempts, schema-validated on each (`GeminiProvider`).
- **Caching**: `Analysis.pipeline_version`/`prompt_version` fields exist and are recorded, but a
  full cross-dataset semantic cache was not built (see §7, deferred).
- **Token usage**: not separately tracked — flagged as a gap, not implemented.
- **Failure handling**: an AI failure sets `Analysis.ai_findings = {"error": ..., "findings": []}`
  and the pipeline continues with deterministic-only recommendations — verified by
  `test_ai_failure_degrades_gracefully_not_a_hard_failure`. This was a deliberate choice: the
  user's spec says "deterministic services provide correctness," so a Gemini outage degrades
  quality, not availability.

## 4. Recommendation system

- **Candidate generation**: unchanged deterministic core (`app/visualization/recommendation.py`,
  Phase 17) — every Story-derived candidate is still built from a real, already-persisted
  Insight. **New**: AI findings can *add* candidates for field combinations the fixed detector set
  didn't cover; every AI-derived field reference is re-validated against the real dataset schema
  before it can become a recommendation (`test_ai_finding_with_hallucinated_field_is_discarded`).
- **Scoring/ranking**: still a plain sort by confidence (Story confidence for deterministic
  candidates, Gemini's stated confidence for AI-derived ones) — Gemini's own ranking/ordering is
  never used directly, per the "don't rely entirely on Gemini's ranking" requirement.
- **Redundancy handling**: tightened this phase — the dedup key changed from
  `(chart_type, fields)` to `fields` alone, so a bar chart and a line chart over the same two
  fields are now correctly treated as redundant (previously they weren't), directly implementing
  the "avoid Bar vs Horizontal Bar vs Lollipop" guidance
  (`test_ai_finding_redundant_with_existing_story_is_dropped`).
- **Validation**: `app/visualization/validation.py::validate_spec` (Phase 14, unchanged) runs on
  every candidate — hallucinated fields and incompatible encoding types are rejected before a
  recommendation is ever constructed.
- **Shortfall handling**: `recommendation_shortfall_reason()` — when fewer than 8 non-redundant
  candidates exist, the API returns however many are genuinely warranted plus an explicit reason
  string, never padded filler.

## 5. Themes

Unchanged this phase — Phase 20/21's static, dataset-independent `rank_themes()` (sorted by a
hand-assigned `editorial_suitability_score` prior) is still what powers theme selection. Making
theme ranking dataset-aware is flagged as a follow-up (§7), not attempted here, to keep this
phase's scope to the analysis pipeline itself.

## 6. Derived visualizations

Unchanged this phase — Phase 19's "Explore more" pool (recommendations beyond the top 8, from the
same redundancy-filtered candidate list) is still how derived visualizations work. A distinct
"month-over-month growth from a monthly total" style transformation-based derivation (per the
spec's `Revenue by month → Month-over-month growth` example) was not built — the current
"derived" pool is additional *chart* candidates, not new *computed metrics*. Flagged as a gap.

## 7. Reliability

- **Retries**: `POST /api/datasets/:id/analysis/retry` — 409 unless `status=failed`; re-queues via
  `AnalysisRepository.requeue_for_retry` (`status=queued`, `retry_count` incremented, `error`
  cleared). Insight/Story generation is idempotent (checked for existing rows before
  regenerating), so a retry doesn't duplicate deterministic work — it just re-runs the (cheap)
  data-quality pass and re-attempts whichever stage actually failed.
- **Idempotency**: `pipeline_version`/`prompt_version` fields recorded on every `Analysis` row.
  **Not built**: a full dataset-hash-keyed cache that would skip re-running Gemini entirely for an
  unchanged dataset across retries — the idempotency here prevents duplicate *database rows*, not
  duplicate *Gemini calls* on retry. Flagged as a real gap for a future pass.
- **Resumability**: a retried analysis restarts from `profiling_quality` (cheap, deterministic)
  rather than exactly the failed stage — full per-stage resume was judged not worth the added
  state-tracking complexity given every stage before `ai_analyzing` runs in well under a second on
  the datasets this app currently handles.
- **Observability**: structured `logging` in `app/workers/main.py` (analysis id, dataset id,
  stage, duration per cycle). A dedicated metrics/observability table was not built (flagged,
  §deferred) — logs cover the "record pipeline execution" requirement without new schema.

## 8. Testing

- **Unit**: `tests/unit/test_data_quality.py` (9), `tests/unit/test_ai_findings.py` (5),
  `tests/unit/test_recommendation_ai_findings.py` (4) — all using the existing `FakeProvider`
  double pattern established in Phase 11's `test_ai_interpretation.py`, not `unittest.mock`.
- **Integration**: `tests/integration/test_analysis_pipeline.py` (4) — full pipeline via the same
  `AnalysisRepository.claim_next_queued()` + `run_analysis()` path the real worker uses, covering:
  upload auto-creates a queued Analysis, a full run with a fake Gemini response produces validated
  non-redundant recommendations, a Gemini failure still yields ready deterministic
  recommendations, and retry is rejected outside the failed state.
- **Golden datasets**: one fixture (`clean.csv`) proves the pipeline end-to-end. The spec's
  8-golden-dataset matrix (time series, categorical, geographic, financial, messy, large, ...)
  was not built — flagged as incremental test-coverage work, not a correctness gap in the pipeline
  itself (existing Phase 12 detector unit tests already cover per-detector correctness on
  synthetic data).
- **Full suite**: 98/98 backend tests passing (`pytest -q`), frontend 16/16 (`vitest run`), both
  `tsc --noEmit` and `next build` clean.

## 9. Security / data minimization

Unchanged and preserved: PII-flagged columns are still fully excluded from any AI-bound payload
(name only, no stats — `build_dataset_summary`, Phase 11, reused as-is inside
`build_analysis_context`). No raw rows are ever sent to Gemini. `AnalyticalFinding.fields` is
re-validated against the real schema before use, so Gemini cannot cause a recommendation to
reference a column that doesn't exist. No AI-generated code is ever executed — Gemini only
produces data (`AnalyticalFindings`), never instructions, and `apply_command()` (Phase 14, the
only spec-mutation path) is untouched by this phase.

## Deferred (explicitly, not silently dropped)

See `task.md` P34-008: SSE/WebSocket push, a dedicated observability/metrics table, a full
cross-dataset Gemini-response cache, the 8-golden-dataset test matrix, dataset-aware theme
ranking, and the copilot (out of scope per the user's own spec).
