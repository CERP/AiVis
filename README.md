# Aivis — AI-Native Editorial Data Visualization Studio

An editorial-quality data visualization studio: upload a dataset, get it profiled and cleaned,
discover insights and stories, receive ranked visualization + theme recommendations, then refine
in a manual studio and export. Inspired by the storytelling/typography/clarity of data journalism
at outlets like the NYT and WaPo — no proprietary assets or branding used.

**Scope note:** the AI Visualization Copilot (chatbot) is a planned Phase 2 feature and is
intentionally **not implemented**. The architecture (`VisualizationSpec`, `VisualizationCommand`,
`AIProvider`) is designed so it can be added later without a rewrite. See
[AI_ARCHITECTURE.md](AI_ARCHITECTURE.md).

See [task.md](task.md) for the full engineering backlog and current status.

## Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS v4 + Radix + Framer Motion +
  Zustand + TanStack Query + D3 + Vega-Lite
- **Backend:** FastAPI + Pydantic v2 + SQLModel + PostgreSQL + Redis
- **Data engine:** Polars + DuckDB + PyArrow + Parquet
- **Object storage:** S3-compatible (MinIO locally)
- **AI:** provider-abstracted, Gemini as the initial implementation

## Repository layout

```
frontend/   Next.js app (App Router, src/ dir)
backend/    FastAPI service
  app/
    api/            versioned route handlers
    core/           config, db session, logging, middleware
    models/         SQLModel ORM models
    schemas/        Pydantic request/response schemas
    services/       business logic (storage, etc.)
    repositories/    data-access layer
    workers/        background job entrypoints
    data/           ingestion / Polars / DuckDB engine
    visualization/  spec, registry, renderers, themes
    insights/       profiler, insight + story engine
    ai/             AIProvider abstraction + Gemini implementation
  tests/
docker-compose.yml   local infra: postgres, redis, minio, backend, worker
task.md              engineering backlog (source of truth for progress)
```

## Local development

### Frontend
```
cd frontend
npm install
npm run dev      # http://localhost:3000
```

### Backend
```
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.in
cp ../.env.example ../.env   # fill in secrets
uvicorn app.main:app --reload   # http://localhost:8000/api/health
```

### Full local infra (Postgres, Redis, MinIO, backend, worker)
```
cp .env.example .env
docker compose up
```

## Testing

- Backend: `cd backend && pytest`
- Frontend: `cd frontend && npm test` (Vitest, once added)
- E2E: Playwright (once added)

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SECURITY.md](SECURITY.md)
- [DATA_ENGINE.md](DATA_ENGINE.md)
- [VISUALIZATION_ENGINE.md](VISUALIZATION_ENGINE.md)
- [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md)
