# Aivis — AI-Assisted Data Visualization Studio

An analytics tool for CERP: upload a dataset, get it profiled and cleaned, discover statistical
insights, receive ranked chart recommendations grounded in those insights, then refine in a
manual studio and export. Visual quality bar (typography, whitespace, restraint) is inspired by
the graphic design of outlets like the NYT and WaPo — no narrative/storytelling framing, no
proprietary assets or branding used. This is a data analysis tool, not a data-journalism product.

**Scope note:** the AI Visualization Copilot (chatbot) is a planned Phase 2 feature and is
intentionally **not implemented**. The architecture (`VisualizationSpec`, `VisualizationCommand`,
`AIProvider`) is designed so it can be added later without a rewrite. See
[AI_ARCHITECTURE.md](doc/AI_ARCHITECTURE.md).

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

## Run locally (recommended)

Use Docker for the API, worker, PostgreSQL, Redis, and MinIO. Run the frontend
in a separate terminal; it is not included in Docker Compose.

### 1. Install prerequisites

- Docker with the Compose plugin (`docker compose`) and the Docker daemon running.
- Node.js 24.x and npm (the frontend lockfile includes dependencies requiring recent Node versions).
- Git to clone the repository, if you have not already done so.

The commands below use Bash (Linux, macOS, or WSL). Start in the repository root.

### 2. Configure environment variables

```bash
cp -n .env.example .env
```

Edit the root `.env`:

- Set `GEMINI_API_KEY` to your Gemini API key for AI analysis and recommendations.
- Set `GEMINI_MODEL` to a model available to your account. The example file and
  backend default currently differ; the value in `.env` takes precedence.
- Keep the database, Redis, and MinIO values for the supplied local infrastructure.
  Compose automatically replaces host addresses with container service names.

The default upload limit is 1 GiB (1,024 MiB) per file, configured with
`MAX_UPLOAD_SIZE_MB=1024`. Processing can require several times the file size in RAM.

The API can start without a Gemini key, but AI requests will fail. The supplied
credentials and secret placeholders are for local development only.

Create `frontend/.env.local` with:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This is the API base URL, without `/api`. Restart the frontend after changing it.

### 3. Start infrastructure and initialize the backend

Run these commands from the repository root, in order:

```bash
docker compose up -d --wait postgres redis minio
docker compose build backend worker
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -c "from app.services.storage import StorageService; StorageService().ensure_buckets()"
docker compose up -d backend worker
```

The migration command creates or updates database tables. The storage command
creates the raw-data, processed-data, and export buckets if they do not exist.
Run migrations again after pulling changes that add migrations.

### 4. Start the frontend

In a separate terminal, starting from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Keep this terminal open while using the app.

### 5. Open and verify

| Service | Address | Purpose |
| --- | --- | --- |
| Web app | http://localhost:3000 | Register an account, sign in, and upload a dataset |
| API health | http://localhost:8000/api/health | Returns `{"status":"ok"}` |
| API docs | http://localhost:8000/docs | Interactive API documentation |
| MinIO console | http://localhost:9001 | Storage console; user `aivis`, password `aivis12345` |
| PostgreSQL | `localhost:55433` | Database `aivis`, user/password `aivis` |
| Redis | `localhost:6379` | Local Redis service |

Check the containers and logs:

```bash
docker compose ps
curl http://localhost:8000/api/health
docker compose logs --tail=100 backend worker
```

The health endpoint confirms the API responds; it does not test the database,
object storage, or Gemini. Upload and analyze a dataset to check the full workflow.
The worker must be running to process queued analyses.

### Stop and restart

Stop the frontend with `Ctrl+C`. From the repository root, stop the containers:

```bash
docker compose down
```

Database and storage data remain in Docker volumes. To restart:

```bash
docker compose up -d
```

Then run `npm run dev` from `frontend/` again. After changing backend dependencies,
rebuild with `docker compose up -d --build backend worker`.

## Run the backend without Docker (development alternative)

Use this option for API auto-reload. PostgreSQL, Redis, and MinIO still run in Docker.
Do not run the Docker backend and local backend together on port 8000.

Install Python 3.12 with venv support and the `libmagic` system library. On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y python3.12 python3.12-venv libmagic1
```

On macOS, install Python 3.12 and `libmagic` through your package manager.

Complete the environment setup above, then run from the repository root:

```bash
docker compose stop backend worker
docker compose up -d --wait postgres redis minio
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.in
cp -n ../.env .env
alembic upgrade head
python -c "from app.services.storage import StorageService; StorageService().ensure_buckets()"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend reads `.env` from the current working directory. For these commands,
that means `backend/.env`, not the root `.env`. Keep it in sync when changing
settings. Local `DATABASE_URL` must use `localhost:55433`, and storage must use
`http://localhost:9000`; container hostnames such as `postgres` and `minio` do not
resolve from the host.

Start the worker in another terminal, from the repository root:

```bash
cd backend
source .venv/bin/activate
python -m app.workers.main
```

Start the frontend as described above. Stop each local process with `Ctrl+C`.

## Testing

Frontend tests and linting:

```bash
cd frontend
npm test
npm run lint
```

Backend tests use the local Python environment and development dependencies from
the preceding section. Start PostgreSQL and MinIO from the repository root, then run:

```bash
docker compose up -d --wait postgres minio
cd backend
source .venv/bin/activate
python -m pytest
```

For backend unit tests only, use `python -m pytest tests/unit`.
Integration tests use the separate `aivis_test` database on port `55433`; their
fixtures create and drop test tables. The PostgreSQL initialization script creates
that database when the Docker volume is first initialized. If an older volume lacks
it, run from the repository root:

```bash
docker compose exec postgres createdb -U aivis aivis_test
```

## Troubleshooting

- **Database errors or missing tables:** ensure PostgreSQL is healthy and run
  `alembic upgrade head` using the appropriate Docker or local command above.
- **Analysis stays queued:** check `docker compose logs --tail=100 worker`, or start
  the local worker in its own terminal.
- **Gemini errors:** check the API key and model in the environment file used by
  the backend and worker. After editing the root `.env`, run
  `docker compose up -d --force-recreate backend worker`; restart local processes
  if using the Python setup.
- **Uploads fail with missing buckets:** rerun the `StorageService().ensure_buckets()`
  command and check that MinIO is running.
- **Frontend cannot reach the API:** check `NEXT_PUBLIC_API_URL`, the API health URL,
  and `CORS_ORIGINS`. If the frontend uses another port, add its origin to
  `CORS_ORIGINS` and restart the backend.
- **Port already in use:** free ports `3000`, `8000`, `55433`, `6379`, `9000`, and `9001`,
  or update the relevant port mappings and environment values together.

## Documentation

- [ARCHITECTURE.md](doc/ARCHITECTURE.md)
- [SECURITY.md](doc/SECURITY.md)
- [DATA_ENGINE.md](doc/DATA_ENGINE.md)
- [VISUALIZATION_ENGINE.md](doc/VISUALIZATION_ENGINE.md)
- [AI_ARCHITECTURE.md](doc/AI_ARCHITECTURE.md)
