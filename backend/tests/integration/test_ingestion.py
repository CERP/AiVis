from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.main import app
from app.repositories.dataset import DatasetVersionRepository
from app.services.storage import get_storage_service

pytestmark = pytest.mark.asyncio

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.fixture
def client(session: AsyncSession) -> AsyncClient:
    async def _get_session_override() -> AsyncSession:
        return session

    app.dependency_overrides[get_session] = _get_session_override
    get_storage_service().ensure_buckets()
    try:
        transport = ASGITransport(app=app)
        yield AsyncClient(transport=transport, base_url="http://test")
    finally:
        app.dependency_overrides.clear()


async def _signup_and_create_project(c: AsyncClient) -> tuple[str, str]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "ingest@example.com",
            "password": "supersecret1",
            "organization_name": "Ingestion Co",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "Ingestion Project"}, headers=headers)
    return token, project.json()["id"]


async def test_clean_csv_creates_version_and_columns(
    client: AsyncClient, session: AsyncSession
) -> None:
    async with client as c:
        token, project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {token}"}

        with open(FIXTURES / "clean.csv", "rb") as f:
            resp = await c.post(
                "/api/datasets",
                params={"project_id": project_id},
                files={"file": ("clean.csv", f, "text/csv")},
                headers=headers,
            )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "ready"

        version = await DatasetVersionRepository(session).get_latest(body["id"])
        assert version is not None
        assert version.row_count == 8
        assert version.column_count == 5
        assert version.is_raw is True


async def test_malformed_csv_marks_dataset_failed(client: AsyncClient) -> None:
    async with client as c:
        token, project_id = await _signup_and_create_project(c)
        headers = {"Authorization": f"Bearer {token}"}

        with open(FIXTURES / "malformed.csv", "rb") as f:
            resp = await c.post(
                "/api/datasets",
                params={"project_id": project_id},
                files={"file": ("malformed.csv", f, "text/csv")},
                headers=headers,
            )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "failed"
        assert body["error_message"] is not None
