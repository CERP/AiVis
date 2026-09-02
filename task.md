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

- [ ] Not started
- Deps: P3-002
- Acceptance: manual login works in browser

### P3-004 — Route protection (frontend middleware, backend dependency)

- [~] Backend: `app/api/deps.py::get_current_user` (HTTPBearer + JWT decode) — done, verified. Frontend middleware not started.
- Acceptance: unauthenticated access blocked — verified for backend (`/api/auth/me` returns 401 without token)

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

- [ ] Pydantic schemas for request/response
- Acceptance: OpenAPI docs generated

### P6-002 — File validation (extension, MIME sniff, size limit, structure check)

- [ ] Reject mismatched/malformed files, path traversal safe filenames
- Deps: P6-001
- Acceptance: unit tests with malformed fixtures

### P6-003 — Frontend upload UI (drag-drop, progress, validation feedback)

- [ ] Component with Framer Motion progress states
- Deps: P6-001
- Acceptance: manual browser test with clean.csv

### P6-004 — Upload → object storage → dataset record pipeline

- [ ] Wire upload endpoint to storage + DB
- Deps: P5-*, P6-002, P4-004
- Acceptance: integration test creates dataset row + object

---

## Phase 7 — Dataset Ingestion

### P7-001 — CSV/Excel/JSON ingestion via Polars

- [ ] Parse into Arrow/Parquet, handle nested JSON
- Deps: P6-004
- Acceptance: fixture datasets ingest without error

### P7-002 — Convert to Parquet, store processed version

- [ ] `data/ingestion.py`
- Acceptance: parquet file in object storage, dataset_versions row

### P7-003 — DuckDB query layer over Parquet

- [ ] `data/duckdb_engine.py`
- Acceptance: sample query returns rows

### P7-004 — Malformed file handling

- [ ] Graceful errors, partial parse reporting
- Deps: P7-001
- Acceptance: malformed.csv fixture produces structured error, not crash

---

## Phase 8 — Data Profiling

### P8-001 — Column type inference (raw + semantic types)

- [ ] Numeric/categorical/date/text/boolean/identifier/geo detection
- Deps: P7-003
- Acceptance: unit tests per fixture

### P8-002 — Statistical profiling (nulls, unique, distributions, min/max/mean/median, outliers, correlations)

- [ ] `insights/profiler.py`
- Deps: P8-001
- Acceptance: profile JSON matches expected fixture stats

### P8-003 — Data profile persistence + API (`GET /api/datasets/:id/profile`)

- [ ] Store in `data_profiles` table
- Deps: P8-002, P4-004
- Acceptance: endpoint returns profile

### P8-004 — Frontend data profile UI

- [ ] Column cards, distributions, summary stats
- Deps: P8-003
- Acceptance: manual browser test

### P8-005 — PII / sensitive-column detection

- [ ] Heuristics for email/phone/SSN/name-like columns
- Deps: P8-001
- Acceptance: flags fixture with PII columns

---

## Phase 9 — Data Cleaning

### P9-001 — Cleaning suggestion generation (deterministic + AI-assisted recommend-only)

- [ ] AI recommends, engine never mutates raw data directly
- Deps: P8-*, P11-*
- Acceptance: suggestions reference profiler findings

### P9-002 — Deterministic transformation executors (parse dates, coerce numeric, trim strings, dedupe, standardize categories)

- [ ] `data/transforms.py`, each pure + reversible + logged
- Acceptance: unit tests: valid/invalid counts reported (e.g. "49,982 valid / 18 invalid")

### P9-003 — Cleaning operation audit log (`cleaning_operations` table)

- [ ] Every transform recorded with before/after summary
- Deps: P4-004, P9-002
- Acceptance: history queryable

### P9-004 — API: `POST /api/datasets/:id/clean`

- [ ] Apply validated transform, return report
- Deps: P9-002, P9-003
- Acceptance: integration test on messy.csv

### P9-005 — Frontend cleaning review UI (accept/reject suggestions)

- [ ] Deps: P9-004
- Acceptance: manual browser test

---

## Phase 10 — Data Structuring

### P10-001 — Column name normalization (snake_case, dedupe collisions)

- [ ] Deps: P9-002
- Acceptance: unit test

### P10-002 — Mixed-format parsing (dates, percentages, currency-as-text)

- [ ] Deps: P9-002
- Acceptance: fixture-driven tests

### P10-003 — Duplicate row detection/handling

- [ ] Deps: P9-002
- Acceptance: unit test

### P10-004 — Preserve original + cleaned + transformation history (`dataset_versions`)

- [ ] Immutable raw version always retained
- Deps: P4-001, P9-003
- Acceptance: both versions retrievable

---

## Phase 11 — AI Integration

### P11-001 — AIProvider interface (abstract base)

- [ ] `ai/base.py`: methods for structured-output generation, no chat-specific coupling
- Acceptance: interface documented in AI_ARCHITECTURE.md

### P11-002 — GeminiProvider implementation

- [ ] `ai/gemini_provider.py`, structured output via schema, retries, timeouts
- Deps: P11-001
- Acceptance: unit test with mocked Gemini client

### P11-003 — Data minimization layer (profiler summary → AI, never raw dataset)

- [ ] `ai/context_builder.py`
- Deps: P8-002, P11-001
- Acceptance: unit test asserts no raw row-level PII sent unless sampled+redacted

### P11-004 — Prompt injection resistance + AI output schema validation

- [ ] Pydantic validation of every AI response; reject/repair on mismatch
- Deps: P11-002
- Acceptance: test with adversarial fixture prompt

### P11-005 — AI response caching (Redis)

- [ ] Deps: P11-002
- Acceptance: cache hit test

---

## Phase 12 — Insight Engine

### P12-001 — Trend detection

- [ ] Deps: P8-*, P7-3
- Acceptance: unit test on synthetic time series

### P12-002 — Change/comparison detection

- [ ] Acceptance: unit test

### P12-003 — Outlier/anomaly detection

- [ ] Acceptance: unit test

### P12-004 — Relationship/correlation detection

- [ ] Acceptance: unit test

### P12-005 — Ranking detection

- [ ] Acceptance: unit test

### P12-006 — Distribution summary

- [ ] Acceptance: unit test

### P12-007 — Seasonality detection (where applicable)

- [ ] Acceptance: unit test

### P12-008 — Insight persistence + field/calculation provenance (`insights` table)

- [ ] Every insight references source fields + calc
- Deps: P12-001..007, P4-004
- Acceptance: insight rows link back to columns

### P12-009 — API: `GET/POST /api/datasets/:id/insights[/analyze]`

- [ ] Deps: P12-008
- Acceptance: endpoint tests

---

## Phase 13 — Story Engine

### P13-001 — Story data model (title, description, question, fields, insight ref, recommended viz, confidence)

- [ ] `stories` table + schema
- Deps: P4-001
- Acceptance: model documented

### P13-002 — Story generation logic (question templates + AI-assisted phrasing over real insights)

- [ ] Deps: P12-*, P11-*
- Acceptance: generates ≥5 stories on fixture dataset, all field-grounded

### P13-003 — API: story listing per dataset

- [ ] Acceptance: endpoint test

---

## Phase 14 — Visualization Specification

### P14-001 — Canonical VisualizationSpec schema (Pydantic + TS mirror)

- [ ] id, dataset, chartType, dimensions, measures, encodings, transformations, filters, sorting, annotations, theme, typography, layout, interactions, metadata
- Acceptance: schema documented in VISUALIZATION_ENGINE.md, shared type source of truth

### P14-002 — Visualization validation layer

- [ ] Validate spec against dataset schema before render
- Deps: P14-001
- Acceptance: unit tests reject invalid encodings

### P14-003 — Versioning model (`visualization_versions`)

- [ ] Each mutation = new version, diffable
- Deps: P4-001, P14-001
- Acceptance: version chain test (v1→v4)

### P14-004 — VisualizationMutation / Command interfaces (future-copilot extension point, no chatbot logic)

- [ ] `visualization/commands.py` defining command types (change_chart_type, change_field, change_theme, add_annotation, etc.) applied deterministically
- Deps: P14-001
- Acceptance: manual command application produces new version

---

## Phase 15 — Visualization Registry

### P15-001 — Chart type registry (metadata: category, required encodings, data-type compatibility)

- [ ] `visualization/registry.py`
- Deps: P14-001
- Acceptance: registry lists implemented + planned types

### P15-002 — Renderer interface (decoupled from AI, dispatches to D3/Vega-Lite/specialized)

- [ ] `Visualization Spec → Validation → Renderer → D3/Vega-Lite`
- Deps: P14-002, P15-001
- Acceptance: interface documented, no AI-generated code executed

---

## Phase 16 — Core Visualization Renderers

### P16-001 — Bar chart (D3)

- [ ] Acceptance: renders from spec, responsive

### P16-002 — Grouped/stacked bar

- [ ] Acceptance: renders from spec

### P16-003 — Line chart

- [ ] Acceptance: renders from spec

### P16-004 — Area chart

- [ ] Acceptance: renders from spec

### P16-005 — Scatter plot

- [ ] Acceptance: renders from spec

### P16-006 — Histogram

- [ ] Acceptance: renders from spec

### P16-007 — Pie/donut (used sparingly, guarded by cardinality rules)

- [ ] Acceptance: renders from spec

### P16-008 — Vega-Lite fallback renderer for registry types without custom D3

- [ ] Acceptance: at least one type renders via Vega-Lite path

---

## Phase 17 — Visualization Recommendation Engine

### P17-001 — Candidate visualization generator (from dataset schema + profile)

- [ ] Deps: P8-*, P15-001
- Acceptance: generates >8 candidates on fixture dataset

### P17-002 — Compatibility filtering (data type, cardinality, temporal structure)

- [ ] Deps: P17-001
- Acceptance: filters invalid combos

### P17-003 — Ranking (analytical relevance, insight strength, clarity, accessibility, redundancy, editorial suitability)

- [ ] Deps: P12-*, P13-*, P17-002
- Acceptance: deterministic ranking test with fixed fixture + seed

### P17-004 — Redundancy filtering

- [ ] Deps: P17-003
- Acceptance: no near-duplicate encodings in top-8

### P17-005 — API: `GET /api/datasets/:id/visualizations/recommendations`

- [ ] Deps: P17-004
- Acceptance: returns top 8 + derived pool

---

## Phase 18 — Eight Visualization Recommendation UI

### P18-001 — Recommendation card component (preview, name, question, explanation, why-recommended, confidence, related insight)

- [ ] Editorial card design, not generic dashboard cards
- Deps: P17-005, P16-*
- Acceptance: renders 8 cards from API data

### P18-002 — "8 ways to see your data" screen layout + Framer Motion entrance

- [ ] Responsive horizontal/vertical exploration
- Deps: P18-001
- Acceptance: manual browser test desktop+mobile

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
