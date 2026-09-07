# AiVis — AI-Assisted Data Visualization Studio

This document serves as the foundational architectural and development guide for the **AiVis** workspace. It provides the necessary context, commands, directories, and coding standards for anyone or any agent working on this codebase.

---

## 1. Project Overview

**AiVis** is an advanced internal analytics and data visualization tool designed for the Analytics department of the **Center for Economic and Research Policy (CERP)**. It allows analysts to:

1. Upload datasets (CSV, Excel, JSON).
2. Automatically profile, score, and detect data quality issues.
3. Apply auditable, deterministic, and reversible transformations/cleaning operations.
4. Discover statistical insights and receive ranked chart recommendations grounded in those insights.
5. Manually edit and refine visualizations in a dedicated studio using a unified `VisualizationSpec`.
6. Export charts in professional-grade formats (SVG, PNG, data tables).

### Core Philosophy & Aesthetic

* **NYT/WaPo Polish:** The visual bar (typography, whitespace, restraint, color schemes) is inspired by premier editorial departments. However, this is strictly a data analysis tool, **not** a narrative/storytelling platform. No storytelling or proprietary branding elements are exposed to users.
* **Compact, Secure AI Integration:** AI (Gemini) is used as an expert assistant for semantic interpretation, profiling/cleaning suggestions, and recommendation ranking. The raw dataset is **never** sent to the LLM; only secure, PII-redacted, profiler-derived statistical summaries are transmitted.
* **Strict Specification & Validation:** The frontend never executes AI-generated code. Visualizations are represented by a unified, versioned `VisualizationSpec`, which is rigorously validated against the dataset's schema and a strict chart registry before being rendered.
* **Phase 2 Scope Reminder:** The AI Visualization Copilot (interactive chatbot) is a planned Phase 2 feature and is **intentionally not implemented**. Hook endpoints, `VisualizationCommand`, and mutation abstractions are designed to easily support it later without a rewrite.

---

## 2. Technology Stack

* **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Radix UI + Framer Motion + Zustand + TanStack Query (React Query) + D3 + Vega-Lite + Vitest.
* **Backend:** FastAPI + Pydantic v2 + SQLModel (SQLAlchemy) + PostgreSQL (asyncpg) + Redis + Alembic.
* **Data Engine:** Polars + DuckDB + PyArrow + Parquet.
* **Object Storage:** S3-compatible API (MinIO for local development).
* **AI Integration:** Abstracted provider architecture (`AIProvider`), with **Gemini** (`gemini-3.1-flash-lite`) as the primary implementation via the Google Generative AI SDK.

---

## 3. Repository Layout

```
/
├── frontend/                   # Next.js 16 App Router (src/ dir)
│   ├── src/
│   │   ├── app/                # Pages and routing layout
│   │   ├── components/         # React components (auth, UI, layout, visualizations)
│   │   ├── lib/                # Client state, hooks, and D3/Vega utility functions
│   │   └── store/              # Zustand global client state
│   ├── vitest.config.mts       # Vitest setup and configuration
│   └── package.json            # Frontend package dependencies & scripts
│
├── backend/                    # FastAPI python app
│   ├── app/
│   │   ├── ai/                 # AIProvider abstraction + Gemini implementation
│   │   ├── api/                # FastAPI routers & V1 endpoints
│   │   ├── core/               # App configuration, DB engine, logging, middleware, security
│   │   ├── data/               # Ingestion (Polars), transformations, validation rules
│   │   ├── insights/           # Statistical profilers, data quality detectors, story generators
│   │   ├── models/             # SQLModel ORM models (users, datasets, visualizations, etc.)
│   │   ├── repositories/       # Data Access Object (DAO) layer
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Orchestrators & business logic (auth, ingestion, analysis)
│   │   ├── visualization/      # Chart registry, spec validation, themes
│   │   └── workers/            # Background worker job queue (analysis & processing)
│   ├── alembic/                # Database migrations
│   ├── tests/                  # Backend pytest suite
│   │   ├── integration/        # Database, API endpoints, S3 storage integration tests
│   │   └── unit/               # Local transforms, spec validation, and Gemini mocks
│   ├── requirements.txt        # Production python requirements
│   ├── requirements-dev.in     # Direct development dependencies
│   └── pyproject.toml          # Ruff lint/formatting & pytest config
│
├── doc/                        # Comprehensive architecture markdown guides
│   ├── ARCHITECTURE.md         # Architecture overview & core pipeline flow
│   ├── AI_ARCHITECTURE.md      # AI Provider, context building, output safety constraints
│   ├── DATA_ENGINE.md          # Polars/DuckDB pipeline, S3 keys, transforms
│   └── VISUALIZATION_ENGINE.md # Visualization specs, registry, themes
│
├── infra/
│   └── postgres-init/
│       └── 001-create-test-db.sql # DB initialization hooks (provisions 'aivis_test' database)
│
├── docker-compose.yml          # Postgres (55433), Redis (6379), MinIO (9000/9001), Backend & Worker
└── README.md                   # Quickstart guide
```

---

## 4. Local Development

### Prerequisites

* **Node.js:** v26+ (npm v11+)
* **Python:** 3.12+ (venv)
* **Docker:** Required for running local infrastructure (Postgres, Redis, MinIO)

### Environment Configuration

1. Copy the example configuration from the root:

   ```bash
   cp .env.example .env
   ```

2. Fill in the required secrets, particularly `GEMINI_API_KEY` (if utilizing the live Gemini integration).

---

### Running the Services

#### Option A: Full Infrastructure via Docker Compose

To boot up local Postgres, Redis, MinIO, Backend, and the background Worker:

```bash
docker compose up --build
```

#### Option B: Hybrid Dev (Recommended)

Boot up the external services (DB, cache, storage) in Docker first:

```bash
docker compose up -d postgres redis minio
```

##### 1. Running the Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.in

# Run database migrations
alembic upgrade head

# Boot the FastAPI uvicorn reloading dev server (http://localhost:8000)
uvicorn app.main:app --reload
```

##### 2. Running the Worker (Background Processor)

The analysis pipeline runs asynchronously outside of HTTP threads. Ensure the worker is active to process uploaded datasets:

```bash
cd backend
source .venv/bin/activate
python -m app.workers.main
```

##### 3. Running the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev # Launches at http://localhost:3000
```

---

## 5. Verification & Testing

Always verify and run existing suites when making changes to either frontend or backend.

### Backend Pytest Suite

Backend tests require Postgres and MinIO to be running (`docker compose up -d postgres minio`). They use a separate database `aivis_test` on port `55433` (provisioned during docker startup).

```bash
cd backend
source .venv/bin/activate

# Run all backend unit & integration tests
pytest -v
```

### Frontend Vitest Suite

```bash
cd frontend
npm run test
```

### Formatting, Linting & Typechecking

Ensure your modifications pass all static analysis checks before submitting.

#### Backend (Python)

We use `ruff` for formatting & linting, and `mypy` for static type checking.

```bash
cd backend
source .venv/bin/activate

# Run ruff check and format
ruff check app/
ruff format app/ --check

# Run mypy type checking
mypy app/
```

#### Frontend (TypeScript)

```bash
cd frontend

# Run ESLint check
npm run lint

# Run TypeScript compilation check
npx tsc --noEmit
```

---

## 6. Development Conventions & Architectural Mandates

### 1. Data Minimization & AI Privacy

* **Never** send row-level or raw dataset data to any LLM.
* Use `app/ai/context_builder.py` to extract only statistical distributions, data-types, cardinality, null-percentages, and correlations.
* Detect and flag PII/sensitive columns and strictly redact them (exclude their statistical properties, passing only column names) from payloads bound for AI providers.

### 2. Provider-Abstracted AI Layer

* Do not import or invoke generative AI SDKs directly in the application logic.
* All AI actions must be routed through the `AIProvider` abstract base class defined in `backend/app/ai/base.py`.
* The current primary provider is `GeminiProvider` (`backend/app/ai/gemini_provider.py`). It incorporates schema-constrained requests and automatic recovery/retry handlers for parsing errors.

### 3. Registry-Driven Visualization Library

* AiVis implements a **41-type** (plus `grouped_bar`) extensive visualization library.
* **All** visualizations are cataloged in a strict central registry: `backend/app/visualization/registry.py` and `frontend/src/lib/visualization/registry.ts`.
* Adding or modifying a chart type must always be done by registering it in these registries and implementing the corresponding D3, Vega-Lite, or custom React component. **Never write inline if-else branches for chart routing.**
* The spec checker (`validate_spec()` in `backend/app/visualization/validation.py`) strictly validates incoming visualization specs, dimensions, measures, encodings, and chart types against the central registry to prevent model hallucinations from compiling or rendering.

### 4. Compact Idempotent Worker

* The background processor (`backend/app/workers/main.py`) acts as an SQS-like concurrent execution thread.
* It utilizes a lightweight, highly reliable database lock query (`SELECT ... FOR UPDATE SKIP LOCKED`) to fetch queued analysis jobs.
* Avoid introducing dedicated queue brokers (like Celery/RabbitMQ) unless specifically requested.

### 5. Unified `VisualizationSpec` and Versioning

* All previews, studio operations, and exports flow through a single, canonical, versioned schema: `VisualizationSpec`.
* Editing, annotating, or tweaking themes in the studio creates a new database record under `visualization_versions`. This supports infinite undo/redo and strict auditable history out of the box.

### 6. Relentless Code Verification

* We do not rely on passive verification. If code changes are made:
  1. Add a corresponding test file or unit test.
  2. Verify that both unit and integration tests run clean.
  3. Ensure that linters (`ruff`, `eslint`) and compiler checks (`tsc`) compile with **0 warnings and 0 errors**.
