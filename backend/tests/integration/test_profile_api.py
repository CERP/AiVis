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


async def _signup_and_upload(c: AsyncClient, fixture_name: str) -> tuple[dict, dict]:
    signup = await c.post(
        "/api/auth/signup",
        json={
            "email": "profiler@example.com",
            "password": "supersecret1",
            "organization_name": "Profiler Co",
        },
    )
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    project = await c.post("/api/projects", json={"name": "P"}, headers=headers)
    project_id = project.json()["id"]

    with open(FIXTURES / fixture_name, "rb") as f:
        resp = await c.post(
            "/api/datasets",
            params={"project_id": project_id},
            files={"file": (fixture_name, f, "text/csv")},
            headers=headers,
        )
    return resp.json(), headers


async def test_profile_endpoint_returns_column_stats(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "clean.csv")
        assert dataset["status"] == "ready"

        resp = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["row_count"] == 8
        assert body["column_count"] == 5

        by_name = {col["name"]: col for col in body["columns"]}
        assert by_name["date"]["semantic_type"] == "date"
        assert by_name["region"]["semantic_type"] == "geographic"
        assert by_name["product"]["semantic_type"] == "categorical"
        assert by_name["revenue"]["semantic_type"] == "currency"
        assert by_name["revenue"]["stats"]["mean"] == pytest.approx(1702.15, rel=1e-3)
        assert by_name["revenue"]["null_count"] == 0
        assert all(not col["is_pii"] for col in body["columns"])


async def test_profile_endpoint_404_for_failed_dataset(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "malformed.csv")
        assert dataset["status"] == "failed"

        resp = await c.get(f"/api/datasets/{dataset['id']}/profile", headers=headers)
        assert resp.status_code == 409
