from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.db import get_session
from app.main import app
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


async def _signup_and_upload(c: AsyncClient) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "rows@example.com",
            "password": "supersecret1",
            "organization_name": "Rows Co",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
    project_id = project.json()["id"]

    with open(FIXTURES / "clean.csv", "rb") as f:
        resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": ("clean.csv", f, "text/csv")},
            headers=headers,
        )
    return resp.json(), headers


async def test_rows_returns_capped_sample_with_correct_values(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c)

        resp = await c.get(
            f"/api/datasets/{dataset['id']}/rows", params={"limit": 3}, headers=headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["total_row_count"] == 8
        assert body["returned_row_count"] == 3
        assert len(body["rows"]) == 3
        assert body["rows"][0]["region"] == "North"
        assert body["rows"][0]["revenue"] == 1200.5


async def test_rows_limit_is_capped_server_side(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c)

        resp = await c.get(
            f"/api/datasets/{dataset['id']}/rows", params={"limit": 999999}, headers=headers
        )
        assert resp.status_code == 200
        assert resp.json()["returned_row_count"] == 8  # capped by actual row count, not 999999
