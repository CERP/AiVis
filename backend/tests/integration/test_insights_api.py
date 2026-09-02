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
            "email": "insights@example.com",
            "password": "supersecret1",
            "organization_name": "Insights Co",
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


async def test_analyze_produces_grounded_insights(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "clean.csv")
        assert dataset["status"] == "ready"

        resp = await c.post(f"/api/datasets/{dataset['id']}/insights/analyze", headers=headers)
        assert resp.status_code == 201, resp.text
        insights = resp.json()
        assert len(insights) > 0

        by_type = {i["type"]: i for i in insights}
        assert "relationship" in by_type
        assert by_type["relationship"]["calculation"]["metric"] == "pearson_correlation"
        assert set(by_type["relationship"]["fields"]) == {"revenue", "units"}

        assert "ranking" in by_type
        assert by_type["ranking"]["calculation"]["top_category"] == "Gadget"

        # Every insight must carry field provenance -- never a bare claim
        for insight in insights:
            assert len(insight["fields"]) > 0
            assert insight["calculation"]

        listed = await c.get(f"/api/datasets/{dataset['id']}/insights", headers=headers)
        assert listed.status_code == 200
        assert len(listed.json()) == len(insights)


async def test_analyze_requires_ready_dataset(client: AsyncClient) -> None:
    async with client as c:
        dataset, headers = await _signup_and_upload(c, "malformed.csv")
        assert dataset["status"] == "failed"

        resp = await c.post(f"/api/datasets/{dataset['id']}/insights/analyze", headers=headers)
        assert resp.status_code == 409
