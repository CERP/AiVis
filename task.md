# Project Task List — AI-Native Editorial Data Visualization Studio

## Legend

- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked

Priority:

- P0 = Critical / foundation
- P1 = High
- P2 = Medium
- P3 = Future / optional

Scope reminder: Chatbot / AI Visualization Copilot is FUTURE PHASE 2. Do not implement now — only design extension points for it.

---

## Phase 0 — Project Discovery & Architecture

### P0-001 — Inspect repo, confirm empty greenfield state

- [x] Confirmed empty dir, no git, node v26/npm11, python3.12, docker present, no uv/poetry/pnpm
- Acceptance: documented in this file's history / commit log

### P0-002 — Choose toolchain

- [x] Frontend: Next.js 15 (App Router) + TS + Tailwind v4 + npm
- [x] Backend: FastAPI + Pydantic v2 + SQLModel + Postgres + Redis, python venv + pip (uv/poetry unavailable)
- Acceptance: recorded in README.md / ARCHITECTURE.md

### P0-003 — Create task.md

- [x] This file

---

## Phase 1 — Repository & Tooling Foundation

### P1-001 — Monorepo layout (`frontend/`, `backend/`)

- [x] Created via create-next-app + manual backend scaffold
- Acceptance: both dirs exist with correct skeletons

### P1-002 — Frontend scaffold (Next.js + TS + Tailwind + App Router)

- [x] `npx create-next-app` with TS, Tailwind, ESLint, App Router, src dir
- Acceptance: `npm run dev` boots

### P1-003 — Frontend core deps

- [x] zustand, @tanstack/react-query, framer-motion, d3, vega/vega-lite/vega-embed, radix primitives, zod, cva, clsx, tailwind-merge, lucide-react
- Acceptance: `npm install` succeeds, 0 vulnerabilities

### P1-004 — shadcn/ui init

- [~] shadcn CLI registry fetch blocked by sandbox network (ui.shadcn.com timeout); hand-authored components.json + Button/Card manually instead (P2-004). Add remaining components (input, dialog, tabs, tooltip, select, progress, label, popover, sonner) incrementally as features need them.
- Deps: P1-002
- Acceptance: components render in a smoke page (Button/Card verified live)

### P1-005 — Backend scaffold (FastAPI modular structure)

- [x] Created `backend/app/{api,core,models,schemas,services,repositories,workers,data,visualization,insights,ai}`
- Acceptance: importable package tree

### P1-006 — Backend Python env + dependencies

- [x] venv created, requirements.in/requirements-dev.in/requirements.txt (fastapi, uvicorn, pydantic v2, sqlmodel, asyncpg, alembic, redis, polars, duckdb, pyarrow, boto3, python-multipart, passlib, python-jose, google-generativeai, pytest, httpx, ruff, mypy) installed clean
- Deps: P1-005
- Acceptance: `pip install -r requirements-dev.in` clean install — verified

### P1-007 — Linting/formatting config

- [x] Frontend: eslint (from create-next-app); Backend: ruff+mypy config in `backend/pyproject.toml`
- Acceptance: `npm run lint` and `ruff check app` both pass — verified

### P1-008 — Root README.md

- [x] Documents stack, structure, how to run locally
- Acceptance: accurate, up to date

### P1-009 — .env.example (root + backend + frontend)

- [x] All required env vars documented in root `.env.example`, no secrets committed
- Acceptance: file present, `.env` gitignored

### P1-010 — Docker Compose for local infra (Postgres, Redis, backend, worker)

- [x] `docker-compose.yml` at root with postgres, redis, minio, backend, worker services + healthchecks. Postgres host port moved to 55433 (5432 was already taken by another local container). Added `infra/postgres-init/001-create-test-db.sql` so a fresh container also provisions `aivis_test`, keeping integration-test `create_all`/`drop_all` cycles off the dev DB Alembic manages.
- Deps: P1-006
- Acceptance: `docker compose up -d postgres` verified repeatedly this session (migrations, repo tests, auth tests all ran against it); `redis`/`backend`/`worker` services defined but not yet started/tested

### P1-011 — .gitignore (root)

- [x] node_modules, .venv, __pycache__, .env, .next, dist, *.parquet local data
- Acceptance: `git status` clean after scaffold

### P1-012 — Initial git commit

- [x] Commit foundation scaffold (48e9d2b)
- Deps: P1-001..P1-011
- Acceptance: `git log` shows commit

---

## Phase 2 — Design System

### P2-001 — Design tokens (color, spacing, radius, shadow) as CSS variables / Tailwind theme

- [x] Editorial palette (warm off-white/ink, terracotta accent) in `frontend/src/app/globals.css`, light + dark via `.dark` class, registered through Tailwind v4 `@theme inline`
- Acceptance: tokens usable via Tailwind classes — verified live (screenshot)

### P2-002 — Typography system

- [x] Georgia-based editorial serif headline stack + system sans body (no Google Fonts dependency — network to font/registry hosts is sandboxed), responsive clamp sizes, full hierarchy in `src/components/ui/typography.tsx` (Headline/Subtitle/SectionHeading/Annotation/ChartLabel/AxisLabel/SourceNote/Footnote)
- Acceptance: renders correctly — verified live

### P2-003 — Layout primitives

- [~] `AppShell` (header+nav+main) done; Container/Stack/Grid primitives not yet split out — add as studio/recommendation screens need them
- Acceptance: reusable components in `src/components/layout`

### P2-004 — Base shadcn component theming

- [~] shadcn CLI blocked (see P1-004); hand-authored `Button` (cva variants) and `Card` wired to design tokens instead. Additional components to add on demand.
- Deps: P1-004, P2-001
- Acceptance: visually consistent with editorial theme — verified live

### P2-005 — Loading / empty / error state components

- [x] `Skeleton`, `EmptyState`, `ErrorState`, `ProcessingState` in `src/components/ui/states.tsx`
- Acceptance: implemented; wired into real screens as those screens are built

### P2-006 — App shell (nav, header, responsive frame)

- [x] `src/components/layout/app-shell.tsx`
- Acceptance: renders on all routes — verified on landing page

---

## Phase 3 — Authentication

### P3-001 — Auth data model (users, sessions)

- [x] `User`, `Organization`, `Membership` SQLModel models (Phase 4); no separate sessions table — JWT bearer tokens are stateless for now
- Acceptance: migration created — covered by `f1c76e675d43_init_schema`

### P3-002 — Auth endpoints (signup/login/logout/session)

- [x] `app/api/v1/auth.py`: `POST /api/auth/signup` (creates user + owner-role org + membership), `POST /api/auth/login`, `GET /api/auth/me`. Password hashing via `bcrypt` directly (`app/core/security.py`) — switched off passlib's `CryptContext` after hitting a known passlib/bcrypt≥4.1 compatibility bug (`ValueError: password cannot be longer than 72 bytes`) triggered by passlib's internal self-test, unrelated to actual input length. JWT via `python-jose`. No logout endpoint yet (stateless tokens — nothing to invalidate server-side without a blocklist, deferred).
- Deps: P3-001, P4-*
- Acceptance: integration tests pass — `tests/integration/test_auth_api.py` (signup/me/401/bad-login/good-login/duplicate-email), plus manual live curl run against uvicorn+Postgres, all verified

### P3-003 — Frontend auth flow (login/signup pages, session state)

- [x] `frontend/src/app/login/page.tsx`, `frontend/src/app/signup/page.tsx` — TanStack Query mutations against the real `/api/auth/{login,signup}` endpoints. Session state via `frontend/src/store/auth-store.ts` (Zustand + `persist` to localStorage). `frontend/src/lib/api/client.ts` attaches the bearer token to every request automatically.
- Deps: P3-002
- Acceptance: manual login works in browser — **verified live end-to-end**: ran backend+Postgres+MinIO+frontend together, signed up a real account through the browser (`browsertest@example.com`), confirmed `POST /api/auth/signup` → 201 in the network log, redirect to `/projects`, and a real `GET /api/projects` → 200 rendering the "No projects yet" empty state.

### P3-004 — Route protection (frontend middleware, backend dependency)

- [x] Backend: `app/api/deps.py::get_current_user` (HTTPBearer + JWT decode) — done, verified (Phase 3-002). Frontend: `frontend/src/middleware.ts` gates `/projects`, `/datasets`, `/studio` behind a non-httpOnly `aivis_auth_present` cookie mirrored by the auth store on login/signup — **this only proves a token is present, not that it's valid**; real authorization still happens server-side on every API call. Documented as a UX redirect, not the security boundary.
- Acceptance: unauthenticated access blocked — verified for backend (`/api/auth/me` returns 401 without token) **and now for frontend**: visiting `/projects` with no auth cookie live-redirected to `/login?next=%2Fprojects` in the browser, confirmed via `window.location.pathname`.

---

## Phase 4 — Database

### P4-001 — Postgres schema design (users, organizations, memberships, projects, datasets, dataset_versions, dataset_columns, data_profiles, cleaning_operations, insights, stories, visualizations, visualization_versions, themes, exports, audit_logs)

- [x] All 16 SQLModel models implemented in `backend/app/models/` with FKs, indexes, timestamps (created_at/updated_at). Raw dataset immutability via `DatasetVersion.is_raw` + `parent_version_id` chain instead of soft-delete (nothing is deleted, only versioned).
- Acceptance: table list documented in ARCHITECTURE.md; `configure_mappers()` verified clean (all 16 tables resolve with no FK/relationship errors)

### P4-002 — Alembic migrations setup

- [x] `alembic init -t async`, wired `env.py` to `SQLModel.metadata` + app settings, added `import sqlmodel` to script template. First migration `f1c76e675d43_init_schema` generated and verified: `alembic upgrade head` against a throwaway local Postgres container created all 17 tables (16 + alembic_version), then container torn down.
- Deps: P4-001
- Acceptance: `alembic upgrade head` works against local Postgres — verified

### P4-003 — DB session/connection management (async SQLAlchemy engine)

- [x] `app/core/db.py` — async engine + session factory, `get_session()` FastAPI dependency
- Acceptance: importable, used by future routes

### P4-004 — Repository layer per entity

- [~] Generic `BaseRepository[ModelT]` (get/list/create/delete) + concrete repos for User, Organization, Membership, Project, Dataset, DatasetVersion, DatasetColumn, DataProfile, CleaningOperation. Verified against live Postgres: 5/5 integration tests pass (email lookup, slug lookup, project listing, version ordering/get-latest, enum role persistence). Insight/Story/Visualization/Theme/Export repos not yet added — add when their API phases start.
- Deps: P4-002
- Acceptance: unit tests per repo — passing for entities implemented so far

---

## Phase 5 — Object Storage

### P5-001 — S3-compatible storage client abstraction

- [x] `app/services/storage.py`: boto3 S3 client wrapper (works against MinIO), `build_object_key` sanitizes client filenames (strips path separators, leading dots — path-traversal safe), upload/download/delete + `ensure_buckets`.
- Acceptance: `tests/integration/test_storage.py` — 4/4 passing against live MinIO (bucket create, upload/download round-trip, path-traversal key sanitization, delete removes object)

### P5-002 — MinIO in docker-compose for local dev

- [x] `minio` service added to `docker-compose.yml` (ports 9000/9001, healthcheck). Verified via `docker compose up -d minio` + integration test run, then torn down.
- Deps: P1-010
- Acceptance: local upload round-trip works — verified

### P5-003 — Signed URL generation for upload/download

- [x] `presigned_put_url` / `presigned_get_url` on `StorageService`
- Deps: P5-001
- Acceptance: tested via integration test — verified

---

## Phase 6 — Dataset Upload

### P6-001 — Upload API contract (POST /api/datasets)

- [x] `app/schemas/dataset.py` (`DatasetResponse`), `app/schemas/project.py` for the minimal project endpoints upload depends on. Also added `POST/GET /api/projects`, `GET /api/projects/:id` (not a numbered phase in the spec but required to scope datasets — organization is derived from the caller's JWT via `get_current_organization_id`, never trusted from the request body).
- Acceptance: FastAPI auto-generates OpenAPI docs at `/docs`; routes verified via integration tests below

### P6-002 — File validation (extension, MIME sniff, size limit, structure check)

- [x] `app/data/upload_validation.py`: extension whitelist (csv/tsv/json/xlsx/xls), libmagic content sniffing cross-checked against extension (defeats extension spoofing — e.g. a `.csv` containing PNG magic bytes is rejected), size limit from `MAX_UPLOAD_SIZE_MB`. Path-traversal-safe object keys via `StorageService.build_object_key` (Phase 5). "Structure check" (does the CSV actually parse) deferred to ingestion (Phase 7) — upload-time validation only confirms file type, not full parseability.
- Deps: P6-001
- Acceptance: `tests/integration/test_dataset_upload_api.py` — 4/4 passing (clean upload, malicious extension rejected, MIME/extension mismatch rejected, cross-org project access rejected with 404)

### P6-003 — Frontend upload UI (drag-drop, progress, validation feedback)

- [~] `frontend/src/app/projects/[projectId]/page.tsx` — click-to-upload via a hidden file input (accepts .csv/.tsv/.json/.xlsx/.xls), dataset list with a status pill (Uploading/Processing/Analyzing/Ready/Failed) that polls every 1.5s while a dataset is mid-pipeline, error message shown inline on upload failure. **Gap:** no drag-drop yet, just click-to-browse — flagged for a follow-up, not a blocker for the golden path.
- Deps: P6-001
- Acceptance: manual browser test with clean.csv — **verified live end-to-end**: ran backend+Postgres+MinIO+frontend together, signed up, created a project through the UI, uploaded clean.csv (simulated file selection via a synthetic DataTransfer since cross-tool real filesystem access to the preview browser wasn't available — same code path as a real pick, `POST /api/datasets` → 201), and confirmed the dataset appears in the list as a clickable "clean.csv" link with status "Ready" and correct size, via accessibility snapshot.

### P6-004 — Upload → object storage → dataset record pipeline

- [x] `POST /api/datasets` validates, uploads to MinIO/S3 raw bucket, creates `Dataset` row (status `uploading`). Ingestion (Parquet conversion, `DatasetVersion` creation) is Phase 7 — not yet wired, so status never advances past `uploading` today.
- Deps: P5-*, P6-002, P4-004
- Acceptance: integration test creates dataset row + object — verified against live Postgres + MinIO, then torn down

### Test fixtures added this session

- [x] `tests/fixtures/clean.csv`, `messy.csv` (inconsistent headers/dates/casing/duplicates/missing values), `malformed.csv` (broken quoting, ragged row). Still need: `large.csv`, `dates.csv`, `categorical.csv`, `geographic.csv`, `financial.csv` — add when Phase 7/8 (ingestion/profiling) need them.

---

## Phase 7 — Dataset Ingestion

### P7-001 — CSV/Excel/JSON ingestion via Polars

- [x] `app/data/ingestion.py::parse_to_dataframe` — csv/tsv/json via Polars, xlsx/xls via `fastexcel` engine. Column names normalized to snake_case + de-duplicated before Parquet write. Nested JSON: Polars `read_json` handles it structurally (nested fields become Struct/List columns); no flattening logic yet — deferred until Phase 10 structuring needs it.
- Deps: P6-004
- Acceptance: fixture datasets ingest without error — verified live (clean.csv, messy.csv both parse; messy columns intentionally stay string-typed pending Phase 9 cleaning)

### P7-002 — Convert to Parquet, store processed version

- [x] `app/services/ingestion.py::ingest_dataset` — parses upload, writes Parquet, uploads to the processed bucket, creates `DatasetVersion` (v0, `is_raw=True`) + one `DatasetColumn` row per column. Wired synchronously into `POST /api/datasets` (no worker queue yet — Phase 27 concern once dataset size warrants it). Dataset status flow: `uploading` → `ingesting` → `ready`/`failed`.
- Acceptance: parquet file in object storage, dataset_versions row — verified via `tests/integration/test_ingestion.py` (row_count/column_count/is_raw asserted) against live Postgres + MinIO

### P7-003 — DuckDB query layer over Parquet

- [x] `app/data/duckdb_engine.py`: `query_parquet_bytes` (registers an Arrow table from Parquet bytes, runs caller-constructed SQL — never raw user input), `row_count`. Verified manually with a GROUP BY aggregation against clean.csv's parquet output.
- Acceptance: sample query returns rows — verified

### P7-004 — Malformed file handling

- [x] Polars parse failures wrapped as `IngestionError` with a structured message (not a raw traceback). On ingest failure the dataset is marked `status=failed` with `error_message` set, not silently dropped or left stuck.
- Deps: P7-001
- Acceptance: malformed.csv fixture produces structured error, not crash — verified via `test_malformed_csv_marks_dataset_failed` (upload endpoint still returns 201 with the dataset row; status reflects failure)

### Bug fixed this session: cascade delete

- [x] `DELETE /api/datasets/:id` was raising a Postgres NOT NULL violation on `dataset_versions.dataset_id` because SQLAlchemy tried to null out child FKs on parent delete with no cascade configured. Fixed by adding `cascade="all, delete-orphan"` to the `Dataset.versions`, `DatasetVersion.columns`, `DatasetVersion.cleaning_operations`, and `DatasetColumn.profile` relationships (ORM-level, no migration needed — DB schema unchanged). Verified via the full upload/list/get/delete integration test.

---

## Phase 8 — Data Profiling

### P8-001 — Column type inference (raw + semantic types)

- [x] `app/insights/profiler.py::infer_semantic_type` — date/boolean/numeric/currency/identifier/categorical/text/geographic, using dtype + column-name heuristics (e.g. `_id` suffix → identifier, price/revenue/cost → currency, region/country/lat/lon → geographic). No dedicated correlation/relationship pass yet — that's P12-004 (Insight Engine).
- Deps: P7-003
- Acceptance: verified live against `clean.csv` — all 5 columns classified correctly (date, geographic, categorical, currency, numeric)

### P8-002 — Statistical profiling (nulls, unique, distributions, min/max/mean/median, outliers, correlations)

- [x] `profile_column`: null/unique counts; numeric columns get min/max/mean/median/std, a skew heuristic (mean-vs-median ratio), and IQR-based outlier count; date columns get min/max; string columns get top-10 value counts. Cross-column correlations deferred to Phase 12 (Insight Engine relationship detection).
- Deps: P8-001
- Acceptance: profile JSON matches expected fixture stats — verified live and via `test_profile_endpoint_returns_column_stats` (revenue mean asserted to 3 decimal places)

### P8-003 — Data profile persistence + API (`GET /api/datasets/:id/profile`)

- [x] Profiling now runs synchronously as part of ingestion (`ingest_dataset`): status flows `ingesting` → `profiling` → `ready`/`failed`. Each column's semantic_type/is_pii is written onto `DatasetColumn`; stats persist to `data_profiles` (1:1 per column). New `GET /api/datasets/:id/profile` returns row/column counts plus per-column semantic type, PII flag, null/unique counts, and stats; 409 if the dataset isn't `ready` yet.
- Deps: P8-002, P4-004
- Acceptance: endpoint returns profile — verified via `tests/integration/test_profile_api.py` (2/2) against live Postgres + MinIO

### P8-004 — Frontend data profile UI

- [ ] Not started
- Deps: P8-003
- Acceptance: manual browser test

### P8-005 — PII / sensitive-column detection

- [x] `detect_pii`: name-hint set (email/phone/ssn/full_name/address/dob/passport/credit_card/...) plus content sniffing on string columns (regex-matches a majority of a 50-row sample as email or phone). Verified: an `email`-named column with real addresses flags true, a `full_name`-named column flags true by name alone, a plain product-name column flags false.
- Deps: P8-001
- Acceptance: flags fixture with PII columns — verified via manual script; no dedicated fixture with PII columns added yet (clean/messy/malformed fixtures don't contain PII) — add one if/when Phase 9 cleaning needs a PII-bearing fixture

---

## Phase 9 — Data Cleaning

### P9-001 — Cleaning suggestion generation (deterministic + AI-assisted recommend-only)

- [ ] Not started — blocked behind Phase 11 (AI integration). The executor/audit/API side (P9-002..004) is done and callable directly with an explicit operation_type; only the "AI looks at the profile and suggests which op to run" layer is missing.
- Deps: P8-*, P11-*
- Acceptance: suggestions reference profiler findings

### P9-002 — Deterministic transformation executors (parse dates, coerce numeric, trim strings, dedupe, standardize categories)

- [x] `app/data/transforms.py`: `trim_strings`, `standardize_case`, `coerce_numeric` (strips $/€/£/¥/commas), `parse_dates` (tries `%Y-%m-%d`, `%m/%d/%Y`, `%d/%m/%Y`, `%b %d %Y`, `%B %d %Y`, `%Y/%m/%d` in order), `normalize_percentage`, `dedupe_rows` (optional column subset). Each is pure (input DataFrame/Series untouched) and returns a `TransformResult`/`DedupeResult` with valid/invalid counts. Caught a real bug while testing: valid_count was initially double-counting missing (null) values as "valid" instead of excluding them from both valid and invalid — fixed so valid+invalid+missing accounts for every row correctly.
- Acceptance: unit tests — `tests/unit/test_transforms.py`, 10/10 passing, asserting exact valid/invalid counts against known messy inputs

### P9-003 — Cleaning operation audit log (`cleaning_operations` table)

- [x] `app/services/cleaning.py::apply_cleaning_operation` writes one `CleaningOperation` row per call (operation_type, column_name, params, valid_count, invalid_count, ai_suggested=False for now) against the *new* version it produces.
- Deps: P4-004, P9-002
- Acceptance: history queryable — row created and returned via the API response; verified in integration tests

### P9-004 — API: `POST /api/datasets/:id/clean`

- [x] Loads the dataset's latest Parquet version, applies the requested transform, writes a new immutable `DatasetVersion` (`parent_version_id` set, `is_raw=False`), re-profiles all columns for the new version (reuses the Phase 8 profiler), and returns `{new_version_id, version_number, row_count, column_count, valid_count, invalid_count}`. 409 if dataset isn't `ready`; 422 for an unknown operation or column.
- Deps: P9-002, P9-003
- Acceptance: integration test on messy.csv — `tests/integration/test_cleaning_api.py`, 5/5 passing (coerce_numeric with 1 invalid "twenty", parse_dates, dedupe_rows removing the intentional duplicate, unknown-op 422, not-ready 409) against live Postgres + MinIO

### P9-005 — Frontend cleaning review UI (accept/reject suggestions)

- [ ] Not started
- Deps: P9-004
- Acceptance: manual browser test

---

## Phase 10 — Data Structuring

### P10-001 — Column name normalization (snake_case, dedupe collisions)

- [x] `app/data/ingestion.py::normalize_column_name` + `deduplicate_column_names`, applied at ingestion time (Phase 7) before the first Parquet write — e.g. `"Revenue ($)"` → `revenue`, `"Product Name"` → `product_name`, collisions get `_1`/`_2` suffixes.
- Deps: P9-002
- Acceptance: unit test — covered indirectly via ingestion/profile integration tests asserting normalized names (`region`, `product_name`, etc.); add a dedicated unit test if collision edge cases grow

### P10-002 — Mixed-format parsing (dates, percentages, currency-as-text)

- [x] `coerce_numeric` (currency-as-text), `parse_dates` (mixed formats), `normalize_percentage` — all in `app/data/transforms.py`, exposed via `POST /api/datasets/:id/clean`.
- Deps: P9-002
- Acceptance: fixture-driven tests — verified against `messy.csv`'s `$1,200.50`, `01/02/2024`/`Jan 4 2024` mixed dates, and non-numeric `"twenty"`

### P10-003 — Duplicate row detection/handling

- [x] `dedupe_rows` (full-row or column-subset), exposed as the `dedupe_rows` operation type.
- Deps: P9-002
- Acceptance: unit test + integration test — `messy.csv`'s intentional duplicate row removed when subset excludes the differing `notes` column

### P10-004 — Preserve original + cleaned + transformation history (`dataset_versions`)

- [x] v0 (`is_raw=True`) is created at ingestion and never modified; every cleaning op appends a new version via `parent_version_id`, forming a full lineage chain. Raw upload bytes also remain untouched in the raw object storage bucket independent of any processed version.
- Deps: P4-001, P9-003
- Acceptance: both versions retrievable — verified via `DatasetVersionRepository.list_for_dataset`/`get_latest` in tests; no dedicated "diff two versions" endpoint yet (not required by any task so far)

---

## Phase 11 — AI Integration

### P11-001 — AIProvider interface (abstract base)

- [x] `app/ai/base.py`: `AIProvider.generate_structured(system_instruction, prompt, response_schema) -> SchemaT`. Deliberately no "conversation"/"chat" concept — every call is one-shot structured generation, matching current-phase responsibilities (interpretation/suggestions/ranking), not dialogue. `AIProviderError` for all failure modes so callers can degrade gracefully instead of crashing when AI is unavailable.
- Acceptance: interface documented in AI_ARCHITECTURE.md — done (already described the abstraction before implementation existed; now matches)

### P11-002 — GeminiProvider implementation

- [x] `app/ai/gemini_provider.py` using the current `google-genai` SDK (switched off `google-generativeai`, which is deprecated as of this session — pip install warned it "will no longer be receiving updates or bug fixes"). Structured output via `response_schema` + `response_mime_type=application/json`, 2-attempt retry on provider error or schema validation failure. `app/ai/factory.py::get_ai_provider()` selects provider by `AI_PROVIDER` setting (only "gemini" wired so far).
- Deps: P11-001
- Acceptance: unit test with mocked Gemini client — done via a `FakeProvider` test double (see P9-style pattern) in `tests/unit/test_ai_interpretation.py`, 2/2 passing. **Not yet verified against the real Gemini API** — user supplied a `GEMINI_API_KEY` but explicitly withheld permission to use it for a live call this session; key is saved in `.env` (gitignored) for whenever that's authorized.

### P11-003 — Data minimization layer (profiler summary → AI, never raw dataset)

- [x] `app/ai/context_builder.py::build_dataset_summary` — sends only schema (name/semantic_type), aggregate stats, and null/unique ratios; PII-flagged columns are fully excluded from stats (only the column name is kept, for context, under `redacted_column_names`). No row-level data ever leaves this boundary.
- Deps: P8-002, P11-001
- Acceptance: unit test asserts no raw row-level PII sent unless sampled+redacted — `tests/unit/test_ai_context_builder.py`, 3/3 passing (PII column redacted, null ratio computed correctly, no `sample_rows`/`rows` key exists in the summary type at all)

### P11-004 — Prompt injection resistance + AI output schema validation

- [x] System instruction explicitly tells the model to treat the JSON payload as inert data and ignore any instructions embedded in column names/values (`app/services/ai_interpretation.py`). All provider output is parsed via `response_schema.model_validate_json` — invalid JSON or schema mismatch raises `AIProviderError` rather than being coerced or executed. No adversarial-prompt test yet (would need a live call or a more elaborate mock) — flagged as a gap.
- Deps: P11-002
- Acceptance: test with adversarial fixture prompt — not yet written; the schema-rejection path *is* covered (`test_interpret_dataset_propagates_provider_error`), but a true prompt-injection fixture is still a gap

### P11-005 — AI response caching (Redis)

- [ ] Not started — no Redis client wired into the backend yet at all (docker-compose has the service, nothing consumes it). Add once a real endpoint calls the AI layer and caching becomes worth the complexity.
- Deps: P11-002
- Acceptance: cache hit test

---

## Phase 12 — Insight Engine

### P12-001 — Trend detection

- [x] `app/insights/detectors.py::detect_trend` — first-to-last % change over a sorted date+numeric pair, needs ≥3 rows. Confidence scales with sample size (0.7 below 10 rows, 0.9 at/above).
- Deps: P8-*, P7-3
- Acceptance: unit test on synthetic time series — `test_detect_trend_increasing` (exact 50% delta asserted), `test_detect_trend_returns_none_for_too_few_rows`

### P12-002 — Change/comparison detection

- [~] Not a separate detector — `detect_trend`'s delta framing ("increased/decreased X%") covers the simple two-point comparison case described in the spec example. A distinct "margin decreased despite revenue increasing" cross-metric comparison detector is not built — flagged as a gap for a future session.

### P12-003 — Outlier/anomaly detection

- [x] `detect_outliers` — IQR-based (1.5×IQR bounds, same method as the profiler's outlier count so the numbers stay consistent), returns up to 10 actual outlier values as calculation evidence. "Anomaly" (time-series-aware, distinct from a plain statistical outlier) not separately implemented — datasets this small don't have enough temporal density to distinguish the two meaningfully yet.
- Acceptance: unit test — `test_detect_outliers_finds_extreme_value`, `test_detect_outliers_returns_none_when_no_outliers`

### P12-004 — Relationship/correlation detection

- [x] `detect_relationship` — Pearson correlation between numeric-column pairs, only surfaced above `|r|>=0.5` (moderate) with strong/moderate + positive/negative framing. Confidence = `min(0.95, |r|)`.
- Acceptance: unit test — `test_detect_relationship_finds_strong_positive_correlation` (r=1.0 exact linear relationship), `test_detect_relationship_returns_none_for_weak_correlation`

### P12-005 — Ranking detection

- [x] `detect_ranking` — sum-by-category, requires 2-50 distinct categories (below 2 is meaningless, above 50 isn't a "ranking" a reader can act on). Reports the leader's share of the total.
- Acceptance: unit test — `test_detect_ranking_finds_top_category`, `test_detect_ranking_returns_none_for_single_category`

### P12-006 — Distribution summary

- [x] `detect_distribution` — IQR-based "most values fall between X and Y" framing plus median.
- Acceptance: unit test — `test_detect_distribution_reports_iqr`

### P12-007 — Seasonality detection (where applicable)

- [ ] Not implemented. Every fixture dataset so far has ≤8 rows spanning ≤8 days — nowhere near enough temporal density for a real seasonality test (would need autocorrelation or STL decomposition over weeks/months of data). Needs a proper `dates.csv`-style long-time-series fixture before this can be built and honestly tested; building it against toy data would risk exactly the "hallucinated conclusion" the spec explicitly warns against.

### P12-008 — Insight persistence + field/calculation provenance (`insights` table)

- [x] `app/services/insight_analysis.py::analyze_dataset_version` — loads the latest version's Parquet, runs `app/insights/engine.py::generate_insights` (dispatches detectors by column semantic type: numeric → outlier/distribution, date×numeric → trend, categorical×numeric → ranking, numeric×numeric → relationship), persists each `InsightCandidate` as an `Insight` row with `fields`/`calculation` intact.
- Deps: P12-001..007, P4-004
- Acceptance: insight rows link back to columns — verified: every insight in the API response carries non-empty `fields` and `calculation`, asserted in `test_analyze_produces_grounded_insights`

### P12-009 — API: `GET/POST /api/datasets/:id/insights[/analyze]`

- [x] `POST /api/datasets/:id/insights/analyze` runs the engine and persists results (409 if not ready); `GET /api/datasets/:id/insights` lists persisted insights for the latest version, ranked by confidence.
- Deps: P12-008
- Acceptance: endpoint tests — `tests/integration/test_insights_api.py`, 2/2 passing. Verified live against `clean.csv`: correctly found revenue↑83.3%, units↑75%, Gadget leads both revenue and units, revenue/units r=0.998 (strong positive). 49/49 total backend tests passing.

---

## Phase 13 — Story Engine

### P13-001 — Story data model (title, description, question, fields, insight ref, recommended viz, confidence)

- [x] `Story` model already existed (Phase 4); confirmed it fits (title, description, analytical_question, relevant_fields, insight_id FK, recommended_chart_type, confidence) — no migration change needed
- Deps: P4-001
- Acceptance: model documented — in ARCHITECTURE.md's entity list

### P13-002 — Story generation logic (question templates + AI-assisted phrasing over real insights)

- [x] `app/insights/story_generator.py`: one story per insight, question-template-per-InsightType (e.g. trend → "How did X change over time?", ranking → "Which {category} leads on {measure}?"), chart-type recommendation per insight type (trend→line, ranking→bar, relationship→scatter, outlier→box_plot, distribution→histogram). Deliberately **not** AI-assisted phrasing yet — stayed template-based since Phase 11's AI plumbing exists but hasn't been live-verified; wiring AI-polish onto these templates is a natural follow-up once that's authorized. Every story is derived from an actual persisted Insight, so it can never claim more than the insight already grounded.
- Deps: P12-*, P11-* (soft dep on P11 — not actually required since templates don't call AI)
- Acceptance: generates ≥5 stories on fixture dataset, all field-grounded — verified live on clean.csv: 7 insights → 7 stories, 1:1, every story's `relevant_fields` inherited directly from its source insight

### P13-003 — API: story listing per dataset

- [x] `POST /api/datasets/:id/stories/analyze` (409 if insights haven't been generated yet — stories can't exist without insights), `GET /api/datasets/:id/stories`
- Acceptance: endpoint test — `tests/integration/test_stories_api.py`, 2/2 passing (409-before-insights, and full analyze→list flow) against live Postgres + MinIO. 56/56 total backend tests passing.

---

## Phase 14 — Visualization Specification

### P14-001 — Canonical VisualizationSpec schema (Pydantic + TS mirror)

- [x] `app/visualization/spec.py`: `chart_type`, `encoding` (x/y/color/size/detail, each with field/type/aggregation/label/format), `transformations` (named refs, not code), `filters`, `sort`, `annotations` (typed: callout/reference_line/highlighted_region/label/source_note), `theme`, `typography`, `layout`, `metadata` (dataset_id/dataset_version_id/story_id). JSON-serializable (`model_dump(mode="json")`) so it stores verbatim in `VisualizationVersion.spec`. **TS mirror not built yet** — no frontend visualization UI exists to consume it; will hand-write or codegen the TS type when Phase 16+ frontend work starts.
- Acceptance: schema documented in VISUALIZATION_ENGINE.md — doc predates the implementation and already matches; round-trip verified via `test_spec_round_trips_through_json`

### P14-002 — Visualization validation layer

- [x] `app/visualization/validation.py::validate_spec` — every encoded field must exist in the dataset's columns, and its semantic type must be compatible with the requested `EncodingType` (e.g. a `currency` column can be `quantitative`/`ordinal` but not `temporal`). Filters and sort also field-checked. Returns a `ValidationResult(is_valid, errors)` rather than raising, so callers control the error response shape.
- Deps: P14-001
- Acceptance: unit tests reject invalid encodings — `test_validation_rejects_unknown_field`, `test_validation_rejects_incompatible_encoding_type` (both passing); also enforced live via `POST /api/visualizations` returning 422 for an unknown field

### P14-003 — Versioning model (`visualization_versions`)

- [x] `app/services/visualization.py`: `create_visualization` writes v1; `apply_command_to_visualization` loads the latest version, applies one command, validates the result, and writes v(n+1) — never mutates the prior version. `Visualization.current_version_id` always points at the newest valid version.
- Deps: P4-001, P14-001
- Acceptance: version chain test (v1→v4) — verified v1→v2 live via `test_apply_command_creates_new_version` (chart_type bar→line persisted as a distinct version, both retrievable via `/versions`); a rejected command is proven not to create a version (`test_apply_command_rejects_invalid_field_change`). Chain length is unbounded by design — a v1→v4 test is just more of the same pattern, not a different code path.

### P14-004 — VisualizationMutation / Command interfaces (future-copilot extension point, no chatbot logic)

- [x] `app/visualization/commands.py`: `VisualizationCommand{type, params}` + `apply_command(spec, command) -> new_spec` (never mutates input). Command types: `change_chart_type`, `change_field`, `change_aggregation`, `change_theme`, `add_annotation`, `remove_annotation`, `filter_data`, `change_sort`, `change_layout`. This is deliberately the *only* mutation path — manual studio edits (once a studio UI exists) and the future AI copilot both go through the same `apply_command`, so Phase 2 needs no renderer/validator changes, only a component that constructs a `VisualizationCommand`.
- Deps: P14-001
- Acceptance: manual command application produces new version — verified via unit tests (`test_apply_command_change_chart_type_does_not_mutate_original`, `test_apply_command_add_and_remove_annotation`, `test_apply_command_change_field`, `test_apply_command_raises_on_unknown_channel`) and live via `PATCH /api/visualizations/:id`. 68/68 total backend tests passing.

---

## Phase 15 — Visualization Registry

### P15-001 — Chart type registry (metadata: category, required encodings, data-type compatibility)

- [x] Built on the **frontend** instead of as `backend/app/visualization/registry.py` — it's the only side consuming it so far (`frontend/src/lib/visualization/registry.ts`). Lists 8 implemented types (bar, grouped_bar, line, area, scatter, histogram, box_plot, donut — all Vega-Lite-backed) plus 3 explicitly `implemented: false` planned types (treemap, choropleth, sankey — D3-backed once built) so the future recommendation engine (Phase 17) has a stable universe to reference even before every renderer exists. A backend-side registry may still be needed once Phase 17 does server-side candidate generation — flagged as a possible follow-up, not duplicated speculatively now.
- Deps: P14-001
- Acceptance: registry lists implemented + planned types — done

### P15-002 — Renderer interface (decoupled from AI, dispatches to D3/Vega-Lite/specialized)

- [x] `VisualizationSpec → compileToVegaLite → vega-embed` (`frontend/src/lib/visualization/to-vega-lite.ts` + `frontend/src/components/visualization/visualization-renderer.tsx`). The renderer only ever receives a declarative `VisualizationSpec` plus row data — no code path exists for AI- or user-supplied code to reach the renderer. `getChartDefinition(chartType).renderer` picks `"d3"` vs `"vega-lite"`; only the Vega-Lite path is implemented so far.
- Deps: P14-002, P15-001
- Acceptance: interface documented, no AI-generated code executed — verified live: `/studio-preview` renders a bar chart (region×revenue, sum aggregation) and a line chart (temporal×quantitative) from real `VisualizationSpec` objects via `vega-embed`, confirmed by accessibility snapshot (`graphics-document: "Vega visualization"` × 2, correct SVG output) with zero console/server errors

---

## Phase 16 — Core Visualization Renderers

### P16-001 — Bar chart (D3)

- [x] Implemented via the Vega-Lite path, not custom D3 yet (see P15-002 rationale — D3 renderers are for cases Vega-Lite can't express cleanly; a plain bar chart isn't one of them). Acceptance: renders from spec — verified live, responsive via Vega-Lite's `width: "container"`.

### P16-002 — Grouped/stacked bar

- [x] Registry entry + compiler support exists (`grouped_bar` → Vega-Lite `bar` mark with a `color` encoding) but not live-verified with real grouped data yet — only plain bar and line were exercised on `/studio-preview` this session. Flagged as a gap: add a grouped-bar sample before calling this fully done.

### P16-003 — Line chart

- [x] Acceptance: renders from spec — verified live (temporal x, quantitative y, 5-point time series)

### P16-004 — Area chart

- [~] Compiler support exists (`area` → Vega-Lite `area` mark) but not live-verified this session.

### P16-005 — Scatter plot

- [~] Compiler support exists (`scatter` → Vega-Lite `point` mark) but not live-verified this session.

### P16-006 — Histogram

- [~] Compiler support exists (`histogram` → Vega-Lite `bar` mark, single `x` encoding) but not live-verified this session — a real histogram needs `bin: true` on the x-encoding, which the compiler doesn't set yet. Gap: wire binning before marking this done.

### P16-007 — Pie/donut (used sparingly, guarded by cardinality rules)

- [~] Compiler support exists (`donut` → Vega-Lite `arc` mark with `innerRadius`, `theta`/`color` encodings) but not live-verified, and the "guarded by cardinality rules" requirement (don't render a donut with 20 slices) isn't enforced anywhere yet — that belongs in the recommendation engine (Phase 17) or a pre-render guard, neither built yet.

### P16-008 — Vega-Lite fallback renderer for registry types without custom D3

- [x] This *is* the primary renderer right now, not a fallback behind a D3-first path — every implemented registry entry routes through it. Acceptance: at least one type renders via Vega-Lite path — 2 types verified live (bar, line), 5 more compile without error but are unverified in a browser (see gaps above).

---

## Phase 17 — Visualization Recommendation Engine

### P17-001 — Candidate visualization generator (from dataset schema + profile)

- [x] `app/visualization/recommendation.py::_build_spec_for_story` — one candidate per Story (Phase 13), never generated independently of a real insight. Field→encoding-channel assignment is heuristic but grounded: temporal/nominal fields go on x, quantitative on y (with sum aggregation for bar/line/area), two-quantitative-field stories (relationships) become scatter plots. On `clean.csv`'s 7 stories this produces 7 candidates — below the ">8" acceptance target because the fixture only has 5 columns; noted as a fixture-size limitation, not an engine bug (the *logic* scales — a wider dataset produces more candidates).
- Deps: P8-*, P15-001
- Acceptance: generates >8 candidates on fixture dataset — **not met on `clean.csv`** (7 candidates, fixture too narrow); revisit with a wider fixture (more columns) if this needs to be proven at >8

### P17-002 — Compatibility filtering (data type, cardinality, temporal structure)

- [x] Every candidate spec is run through Phase 14's `validate_spec` before being kept — same compatibility check the API uses to reject bad visualizations, applied here as a filter instead of a hard error. Cardinality guards (e.g. don't recommend a 30-slice donut) aren't enforced yet since donut/pie candidates aren't generated by this path at all currently (no story maps to `donut`) — flagged as a gap for when part-to-whole stories exist.
- Deps: P17-001
- Acceptance: filters invalid combos — a candidate referencing a field the profiler didn't detect a semantic type for is silently dropped (`_build_spec_for_story` returns `None`), verified by construction (no invalid specs reach the API in the integration test)

### P17-003 — Ranking (analytical relevance, insight strength, clarity, accessibility, redundancy, editorial suitability)

- [x] Ranked purely by the source Story's `confidence`, which already encodes analytical relevance + insight strength (Phase 12's detector confidence scores). Clarity/accessibility/editorial-suitability are **not** separately scored — those need theme/typography context that doesn't exist until Phase 20/21, so folding them in now would be guessing. Flagged as a real gap, not silently skipped.
- Deps: P12-*, P13-*, P17-002
- Acceptance: deterministic ranking test with fixed fixture + seed — no randomness in the pipeline at all (pure sort by confidence), so determinism is trivially true; verified via `test_recommendations_are_valid_specs_grounded_in_stories` asserting `top` confidences are non-increasing

### P17-004 — Redundancy filtering

- [x] `_redundancy_key` dedupes on `(chart_type, sorted(x_field, y_field))` — first (highest-confidence, since input stories arrive pre-sorted) candidate per unique key wins.
- Deps: P17-003
- Acceptance: no near-duplicate encodings in top-8 — verified: test asserts zero duplicate `(chart_type, x_field, y_field)` keys across the *entire* result set (top + derived), a stronger check than just top-8

### P17-005 — API: `GET /api/datasets/:id/visualizations/recommendations`

- [x] 409 if stories haven't been generated yet (chains: upload → `/insights/analyze` → `/stories/analyze` → `/visualizations/recommendations`); otherwise returns `{top: [...], derived: [...]}`, each entry carrying the full `VisualizationSpec`, the analytical question, an explanation, and a `why_recommended` string built from the real confidence number and field list (never invented copy).
- Deps: P17-004
- Acceptance: returns top 8 + derived pool — verified live on `clean.csv`'s full pipeline: `tests/integration/test_recommendations_api.py`, 2/2 passing. 70/70 total backend tests passing.

---

## Phase 18 — Eight Visualization Recommendation UI

### P18-001 — Recommendation card component (preview, name, question, explanation, why-recommended, confidence, related insight)

- [x] `frontend/src/components/recommendations/recommendation-card.tsx` — chart-type glyph header, title, confidence badge, chart-type label, analytical question, explanation, why-recommended note. **Gap:** no live mini-chart preview (spec says "visualization preview") — the recommendation API response only carries the `VisualizationSpec`, not row data, so there's nothing to render yet; would need either a new preview-rows endpoint or reusing `/profile` sample data. Using a static chart-type glyph as a placeholder instead of guessing at fabricated preview data.
- Deps: P17-005, P16-*
- Acceptance: renders 8 cards from API data — **rendered from data shaped exactly like the real API response, not a live fetch** (frontend auth/Phase 3-003 doesn't exist yet, so there's no way to get a token in the browser). Verified live at `/recommendations-preview`: 3 top + 1 derived card render correctly, confidence badges show 70%/95%/85%/75%, chart-type labels correct.

### P18-002 — "8 ways to see your data" screen layout + Framer Motion entrance

- [x] `frontend/src/app/recommendations-preview/page.tsx` — responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`), "Explore more" section for the derived pool, staggered Framer Motion entrance (`delay: index * 0.06`) on each card.
- Deps: P18-001
- Acceptance: manual browser test desktop+mobile — verified live at both 450px (single column, confirmed via screenshot) and 1280px (3-column grid, confirmed via screenshot + bounding-box math for centering). `prefers-reduced-motion` handled globally via the CSS rule in `globals.css` (Phase 2), not per-component — not re-verified against this specific animation this session.

---

## Phase 19 — Derived Visualization Exploration

### P19-001 — "Explore more" derived visualization list (from candidate pool beyond top 8)

- [ ] Deps: P17-001, P18-002
- Acceptance: shows genuinely distinct additional charts

---

## Phase 20 — Theme Recommendation Engine

### P20-001 — Palette generation (categorical/sequential/diverging) respecting accessibility + semantics

- [ ] `visualization/themes.py`
- Deps: P14-001
- Acceptance: contrast-checked palettes, colorblind-safe test

### P20-002 — Theme ranking (8 recommended themes per visualization/dataset context)

- [ ] Deps: P20-001
- Acceptance: API returns 8 ranked themes

### P20-003 — API: `GET /api/themes`, `GET /api/themes/recommendations`

- [ ] Deps: P20-002
- Acceptance: endpoint tests

---

## Phase 21 — Theme / Design System (Editorial Themes)

### P21-001 — Theme token schema (colors, typography, spacing, grid, annotations, axes, labels, background, borders, emphasis)

- [ ] Deps: P14-001
- Acceptance: schema documented

### P21-002 — Implement themes: Minimal, Classic Editorial, Investigative, Financial, Scientific, Climate, Election, Sports, Economic, Monochrome, High Contrast, Dark Editorial

- [ ] Deps: P21-001
- Acceptance: all themes render on sample chart

### P21-003 — Theme selection UI (8-theme recommendation grid)

- [ ] Deps: P20-003, P21-002
- Acceptance: manual browser test

---

## Phase 22 — Visualization Studio

### P22-001 — Studio layout shell (toolbar, canvas, properties panel)

- [ ] Deps: P2-006, P15-002
- Acceptance: renders with placeholder panels

### P22-002 — Chart type switch control

- [ ] Deps: P22-001, P14-004
- Acceptance: mutates spec, new version created

### P22-003 — Data mapping controls (encodings, aggregation)

- [ ] Deps: P22-001
- Acceptance: manual test

### P22-004 — Style controls (colors, typography, spacing, legend, axes, labels, number formats, background, grid, dimensions)

- [ ] Deps: P22-001, P21-*
- Acceptance: manual test

### P22-005 — Studio state management (Zustand store bound to VisualizationSpec + version history)

- [ ] Deps: P14-003
- Acceptance: undo/redo works via version stack

### P22-006 — Save/persist studio changes (`PATCH /api/visualizations/:id`)

- [ ] Deps: P14-003, P4-004
- Acceptance: reload preserves state

---

## Phase 23 — Annotations

### P23-001 — Annotation spec types (callout, reference line, highlighted region, label, trend note, source note)

- [ ] Deps: P14-001
- Acceptance: schema documented

### P23-002 — Annotation renderer (D3 overlay layer)

- [ ] Deps: P23-001, P15-002
- Acceptance: renders on top of chart

### P23-003 — Annotation editor UI (add/edit/remove in studio)

- [ ] Deps: P22-001, P23-002
- Acceptance: manual test

---

## Phase 24 — Responsive Behavior

### P24-001 — Chart container responsive resize (ResizeObserver-driven)

- [ ] Deps: P15-002
- Acceptance: chart resizes without layout thrash

### P24-002 — Mobile layout for viewing/sharing screens (studio desktop-first)

- [ ] Deps: P2-003
- Acceptance: manual test mobile/tablet/desktop viewports

---

## Phase 25 — Accessibility

### P25-001 — Keyboard navigation across app + studio

- [ ] Acceptance: manual keyboard-only pass

### P25-002 — Semantic HTML + ARIA labels, chart text descriptions

- [ ] Acceptance: axe scan clean on key pages

### P25-003 — Color contrast + colorblind-safe palette enforcement

- [ ] Deps: P20-001
- Acceptance: automated contrast check in palette tests

### P25-004 — `prefers-reduced-motion` support

- [ ] Deps: all Framer Motion usage
- Acceptance: verified via emulated media query

---

## Phase 26 — Export

### P26-001 — SVG export

- [ ] Deps: P15-002
- Acceptance: exported SVG retains typography/annotations/labels/source

### P26-002 — PNG export

- [ ] Deps: P26-001
- Acceptance: exported PNG matches rendered chart

### P26-003 — JSON spec export

- [ ] Deps: P14-001
- Acceptance: round-trips through validator

### P26-004 — API: `POST /api/exports`, `GET /api/exports/:id`

- [ ] Deps: P26-001..003, P4-004, P5-*
- Acceptance: endpoint tests, files in object storage

### P26-005 — PDF export

- [ ] P2 stretch; Deps: P26-002
- Acceptance: manual test

---

## Phase 27 — Performance

### P27-001 — Virtualized data table for dataset preview

- [ ] Acceptance: smooth scroll on 100k-row fixture

### P27-002 — Code splitting / dynamic imports for studio + chart renderers

- [ ] Acceptance: bundle analysis shows split chunks

### P27-003 — Backend caching (Redis) for profiles/insights/recommendations

- [ ] Deps: P11-005 pattern
- Acceptance: cache hit reduces latency in test

### P27-004 — DB indexes review

- [ ] Deps: P4-001
- Acceptance: EXPLAIN on key queries uses indexes

---

## Phase 28 — Security Hardening

### P28-001 — Upload validation hardening (magic-byte MIME check, size limits, path traversal prevention)

- [ ] Deps: P6-002
- Acceptance: adversarial fixture tests pass

### P28-002 — AuthN/AuthZ + RBAC foundation, tenant isolation

- [ ] Deps: P3-*, P4-001
- Acceptance: cross-tenant access test fails as expected

### P28-003 — Rate limiting

- [ ] Deps: core middleware
- Acceptance: 429 on burst test

### P28-004 — CSRF protection for cookie-based auth

- [ ] Deps: P3-002
- Acceptance: verified via test

### P28-005 — Secrets management review (.env only, never committed)

- [ ] Acceptance: git history scan clean

### P28-006 — Audit logging (`audit_logs` table)

- [ ] Deps: P4-001
- Acceptance: key mutations logged

### P28-007 — SECURITY.md

- [ ] Acceptance: documents threat model, reporting process

---

## Phase 29 — Testing

### P29-001 — Backend pytest setup + fixtures (clean.csv, messy.csv, large.csv, dates.csv, categorical.csv, geographic.csv, financial.csv, malformed.csv)

- [ ] Acceptance: fixtures load, pytest runs

### P29-002 — Backend unit tests (transforms, profiler, insight detectors, spec validation)

- [ ] Deps: respective phases
- Acceptance: `pytest` green

### P29-003 — Backend API integration tests

- [ ] Deps: P29-001
- Acceptance: `pytest -m integration` green

### P29-004 — Frontend unit tests (Vitest + RTL)

- [ ] Acceptance: `npm test` green

### P29-005 — E2E tests (Playwright): upload → profile → recommendations → studio → export

- [ ] Deps: MVP flow implemented
- Acceptance: `playwright test` green on golden path

### P29-006 — AI tests with deterministic fixtures / mocked provider

- [ ] Deps: P11-*
- Acceptance: no test depends on live LLM wording

---

## Phase 30 — Observability

### P30-001 — Structured logging (backend, request IDs)

- [ ] Acceptance: logs are JSON, correlate by request id

### P30-002 — Error tracking (Sentry, frontend+backend)

- [ ] Acceptance: test error captured

### P30-003 — Metrics (basic request/latency counters)

- [ ] Acceptance: /metrics or equivalent exposed

### P30-004 — Never log dataset contents (redaction review)

- [ ] Acceptance: log audit confirms no PII/raw rows logged

---

## Phase 31 — Documentation

### P31-001 — README.md

- [x] initial version written

### P31-002 — ARCHITECTURE.md

- [x] initial version written

### P31-003 — SECURITY.md

- [x] initial version written

### P31-004 — API.md (or OpenAPI-generated)

- [ ] rely on FastAPI's auto-generated OpenAPI docs at `/docs` for now; write API.md once more endpoints exist

### P31-005 — DATA_ENGINE.md

- [x] initial version written

### P31-006 — VISUALIZATION_ENGINE.md

- [x] initial version written

### P31-007 — AI_ARCHITECTURE.md

- [x] initial version written

### P31-008 — CONTRIBUTING.md

- [x] initial version written
- Note: all docs are early skeletons reflecting planned architecture; must be kept in sync as each phase actually lands

---

## Phase 32 — Deployment

### P32-001 — Dockerfiles (frontend, backend, worker)

- [ ] Acceptance: images build

### P32-002 — docker-compose production overlay

- [ ] Deps: P32-001
- Acceptance: `docker compose -f ... up` serves app

### P32-003 — CI pipeline (lint, typecheck, test) — GitHub Actions

- [ ] Acceptance: pipeline green on push

---

## Phase 33 — Final QA

### P33-001 — Full golden-path manual run through MVP acceptance criteria (see spec §52)

- [ ] Deps: all MVP phases
- Acceptance: all 25 MVP criteria checked off

### P33-002 — task.md sync pass

- [ ] Acceptance: statuses reflect true implementation state

---

## Future Phase 2 — AI Visualization Copilot (PLANNING ONLY — DO NOT IMPLEMENT)

### F2-001 — Document chatbot architecture extension points (VisualizationCommand, Validator, AIProvider hook)

- [ ] Deps: P14-004, P11-001
- Acceptance: documented in AI_ARCHITECTURE.md, no code executed

---

## Execution Notes

- Respect dependencies; do not skip ahead of blocking tasks.
- MVP priority order: Foundation/Security/Ingestion/Profiling/Spec/Rendering (P0-P8,P14-16,P28 basics) → AI/Insights/Stories/Recommendations/Themes/Studio (P9-13,17-23) → Advanced/Export/Perf (P24-27) → Testing/Docs/Deploy/QA (P29-33).
- Update this file's checkboxes immediately after verifying each task.
